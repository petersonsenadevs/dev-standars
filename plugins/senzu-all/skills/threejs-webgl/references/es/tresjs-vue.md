# TresJS: Three.js declarativo en Vue 3 (Laravel + Inertia)

TresJS (`@tresjs/core`) es un custom renderer de Vue que expone cualquier clase de Three.js como componente `<Tres*>`. Las props se mapean 1:1 a propiedades del objeto (`:position="[0, 1, 2]"`, `:rotation-y="0.5"`, `cast-shadow`). Los objetos se crean, añaden al padre y **disponen automáticamente** al desmontar el componente.

Versiones de referencia: `@tresjs/core` 4.x, `@tresjs/cientos` 4.x, `@tresjs/post-processing` 1.x-2.x (basado en pmndrs `postprocessing`), `three` r170+. Comprueba la matriz de compatibilidad de cada release: cientos suele exigir un mínimo de core.

## 1. Instalación

```bash
pnpm add three @tresjs/core @tresjs/cientos
pnpm add -D @types/three
# opcionales
pnpm add @tresjs/post-processing postprocessing
pnpm add -D @tresjs/leches   # panel de debug estilo Leva
```

### Vite (`vite.config.ts` en Laravel)

```ts
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import { templateCompilerOptions } from '@tresjs/core';

export default defineConfig({
  plugins: [
    laravel({ input: ['resources/js/app.ts'], refresh: true }),
    vue({
      ...templateCompilerOptions, // marca <Tres*> como custom elements: evita warnings "Failed to resolve component"
      template: {
        ...templateCompilerOptions.template,
        transformAssetUrls: { base: null, includeAbsolute: false },
      },
    }),
  ],
  optimizeDeps: {
    include: ['three', '@tresjs/core', '@tresjs/cientos'], // pre-bundle: evita cascadas de peticiones en dev
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          tres: ['@tresjs/core', '@tresjs/cientos'],
        },
      },
    },
  },
});
```

`templateCompilerOptions` equivale a `compilerOptions.isCustomElement: (tag) => tag.startsWith('Tres') && tag !== 'TresCanvas'`. Si ya tienes un `isCustomElement` propio, combínalos.

Los decoders (Draco/KTX2) van en `public/draco/` y `public/basis/` (ver `assets-loaders.md`).

## 2. `<TresCanvas>`

Crea el `WebGLRenderer`, la `Scene`, el loop y el resize. Ocupa el 100 % de su contenedor (o de la ventana con `window-size`).

```vue
<script setup lang="ts">
import { TresCanvas } from '@tresjs/core';
import { SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, NoToneMapping } from 'three';
</script>

<template>
  <div class="relative h-[80vh] w-full">
    <TresCanvas
      shadows
      alpha
      :dpr="[1, 2]"
      :tone-mapping="ACESFilmicToneMapping"
      :output-color-space="SRGBColorSpace"
      :shadow-map-type="PCFSoftShadowMap"
      power-preference="high-performance"
      :antialias="true"
      clear-color="#0b0b0f"
      render-mode="always"
    >
      <!-- contenido -->
    </TresCanvas>
  </div>
</template>
```

Props relevantes:

| Prop | Descripción |
|---|---|
| `shadows` | `renderer.shadowMap.enabled = true` |
| `alpha` | Fondo transparente (el HTML de detrás se ve) |
| `window-size` | Ignora el contenedor y usa `window.innerWidth/Height` (para heros fullscreen con `position: fixed`) |
| `preset="realistic"` | Atajo: `shadows`, `PCFSoftShadowMap`, `ACESFilmicToneMapping`, sRGB, `physicallyCorrectLights`. Cómodo, pero explicita las props en producción para no depender de cambios del preset |
| `:dpr="[1, 2]"` | Rango de pixel ratio (mín, máx) |
| `render-mode` | `'always'` (por defecto), `'on-demand'` (renderiza solo cuando cambian props reactivas o llamas a `invalidate()`), `'manual'` (`advance()`) |
| `clear-color` | Color de fondo si no hay `scene.background` |
| `camera` | Pasa tu propia cámara; si no, crea una PerspectiveCamera por defecto en `[3, 3, 3]` |
| `disable-render` | Para dejar que `@tresjs/post-processing` haga el render |
| `@ready="(ctx) => ..."` | Da acceso al contexto (`renderer`, `scene`, `camera`) desde el padre |

Contexto dentro del canvas:

```ts
import { useTres } from '@tresjs/core';
const { renderer, scene, camera, sizes, invalidate } = useTres();
```

`useTres` solo funciona en componentes **hijos** de `<TresCanvas>`, por eso la escena se separa en `HeroScene.vue` (canvas) + `HeroContent.vue` (objetos).

## 3. Componentes declarativos

```vue
<script setup lang="ts">
import { shallowRef } from 'vue';
import { TresCanvas } from '@tresjs/core';
import { OrbitControls, Environment, ContactShadows } from '@tresjs/cientos';
import type { Mesh } from 'three';

const boxRef = shallowRef<Mesh>(); // shallowRef, nunca ref: los objetos de Three no deben ser reactivos profundos
</script>

<template>
  <TresCanvas shadows alpha>
    <TresPerspectiveCamera :position="[0, 1.5, 6]" :fov="45" :near="0.1" :far="100" :look-at="[0, 0.5, 0]" />
    <OrbitControls enable-damping :enable-pan="false" :min-distance="3" :max-distance="10" />

    <TresHemisphereLight :args="['#ffffff', '#444466', 0.5]" />
    <TresDirectionalLight
      :position="[4, 6, 3]"
      :intensity="2.5"
      cast-shadow
      :shadow-mapSize="[2048, 2048]"
      :shadow-camera-near="0.5"
      :shadow-camera-far="30"
      :shadow-camera-left="-6"
      :shadow-camera-right="6"
      :shadow-camera-top="6"
      :shadow-camera-bottom="-6"
      :shadow-normalBias="0.02"
    />
    <Environment preset="studio" :blur="0.6" />

    <TresMesh ref="boxRef" :position="[0, 0.5, 0]" cast-shadow>
      <TresBoxGeometry :args="[1, 1, 1]" />
      <TresMeshStandardMaterial color="#4f8cff" :roughness="0.3" :metalness="0.1" />
    </TresMesh>

    <TresMesh :rotation-x="-Math.PI / 2" receive-shadow>
      <TresPlaneGeometry :args="[20, 20]" />
      <TresShadowMaterial :opacity="0.25" transparent />
    </TresMesh>

    <!-- alternativa a plano + ShadowMaterial: sombra de contacto baked (barata y bonita) -->
    <ContactShadows :opacity="0.5" :blur="2" :scale="10" :far="4" :position-y="0" />
  </TresCanvas>
</template>
```

Convenciones de props:

- `:args="[...]"` son los argumentos del constructor.
- Propiedades anidadas con guion: `:shadow-camera-far="30"` → `light.shadow.camera.far`. Las que en Three tienen camelCase no partible (`mapSize`, `normalBias`) se escriben con ese camelCase tras el guion: `:shadow-mapSize`.
- Props booleanas `cast-shadow`, `receive-shadow`, `transparent`, `visible`.
- `:position="[x, y, z]"`, `:rotation="[x, y, z]"`, `:scale="1.5"` (número escalar) o `:scale="[1, 2, 1]"`.
- `:look-at="[x, y, z]"` en cámaras.
- `<primitive :object="gltf.scene" />` para insertar un objeto creado imperativamente (modelos, instanced meshes, helpers).
- Cualquier clase importable de Three: `<TresInstancedMesh :args="[geo, mat, 200]">`, `<TresGroup>`, `<TresPoints>`, `<TresFog attach="fog" :args="['#000', 5, 30]" />`.

## 4. Animación: `useLoop` y `onBeforeRender`

```vue
<script setup lang="ts">
import { shallowRef } from 'vue';
import { useLoop } from '@tresjs/core';
import type { Mesh } from 'three';

const meshRef = shallowRef<Mesh>();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const { onBeforeRender, onAfterRender, pause, resume } = useLoop();

onBeforeRender(({ delta, elapsed }) => {
  if (!meshRef.value || reduceMotion) return;
  meshRef.value.rotation.y += delta * 0.5;
  meshRef.value.position.y = Math.sin(elapsed) * 0.1;
});
</script>
```

- `useLoop` (core 4) sustituye al antiguo `useRenderLoop`. El callback recibe `{ delta, elapsed, clock, renderer, scene, camera, invalidate }`.
- `pause()` / `resume()` para parar el loop cuando el canvas sale del viewport (usa `@vueuse/core` `useIntersectionObserver` sobre el contenedor).
- `register(cb, 'render')` para sustituir el render por defecto (postprocesado manual).
- No pongas estado reactivo de Vue (`ref`) en el loop por frame: mutar un `ref` 60 veces por segundo dispara re-renders del template. Muta el objeto de Three directamente.
- Con `render-mode="on-demand"`, llama a `invalidate()` tras mutar algo en un handler que no sea el loop.

## 5. Cargar modelos: `useGLTF` (cientos)

```vue
<!-- HeroModel.vue -->
<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos';
import { watchEffect } from 'vue';

const props = defineProps<{ url: string }>();

// cientos 4: composable reactivo (no suspende)
const { state: gltf, isLoading, progress } = useGLTF(props.url, { draco: true, decoderPath: '/draco/' });

watchEffect(() => {
  gltf.value?.scene.traverse((o: any) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
});
</script>

<template>
  <primitive v-if="gltf" :object="gltf.scene" :scale="1" :position="[0, 0, 0]" />
</template>
```

Si tu versión de cientos expone `useGLTF` como promesa (`const { scene } = await useGLTF(url)`), el componente se vuelve async y debes envolverlo en `<Suspense>` dentro del canvas:

```vue
<TresCanvas>
  <Suspense>
    <HeroModel url="/models/hero.glb" />
    <template #fallback><!-- opcional: un TresMesh placeholder --></template>
  </Suspense>
</TresCanvas>
```

Otras utilidades de carga en cientos: `useTexture({ map: '/textures/a.webp', normalMap: '/textures/n.webp' })` (ajusta `colorSpace` del `map` automáticamente en versiones recientes; verifica), `useFBX`, `useProgress` (progreso global para un overlay), `<GLTFModel path="..." draco cast-shadow />` como alternativa declarativa.

Preload fuera del componente para arrancar la descarga antes del mount: cientos no tiene `preload` como drei; puedes disparar `fetch('/models/hero.glb')` en `onMounted` de la página para calentar la caché HTTP, o cargar el modelo con `GLTFLoader` en un composable propio y pasarlo por `<primitive>`.

## 6. Componentes de cientos que se usan siempre

| Componente | Uso |
|---|---|
| `<OrbitControls enable-damping :auto-rotate="true" :auto-rotate-speed="0.8" :enable-zoom="false" />` | Órbita. Se enlaza a la cámara activa. `make-default` para que otros componentes lo detecten |
| `<Environment preset="studio" :background="false" :blur="0.5" />` o `<Environment files="/hdri/studio_1k.hdr" />` | HDRI con PMREM. Presets descargan de un CDN (poly haven vía pmndrs): en producción usa `files` local |
| `<ContactShadows>` | Sombra de contacto sin luces |
| `<Html :position="[0, 1, 0]" center transform occlude>` | HTML anclado a coordenadas 3D (labels, tooltips). `transform` lo escala con la perspectiva |
| `<Text3D>`, `<Text>` (troika) | Texto 3D / SDF |
| `<Stars>`, `<Sky>`, `<Sparkles>`, `<Smoke>` | Ambientación |
| `<Levioso>` (equivalente a `Float`) | Flotación suave |
| `<MouseParallax :factor="0.3" />` | Parallax de cámara con el ratón |
| `<Stats />` | FPS overlay en desarrollo |
| `<Lensflare>`, `<Reflector>`, `<MeshWobbleMaterial>`, `<MeshGlassMaterial>` | Materiales y efectos |
| `<useProgress>` | Progreso de carga global |

## 7. Eventos de puntero

TresJS hace raycasting automático sobre meshes con listeners:

```vue
<TresMesh
  @click="onClick"
  @pointer-enter="hovered = true"
  @pointer-leave="hovered = false"
  @pointer-move="onMove"
  @double-click="..."
  @context-menu="..."
  @wheel="..."
>
```

El evento recibe la `Intersection` (`event.object`, `event.point`, `event.distance`, `event.uv`) más `event.stopPropagation()`. Cambia el cursor con `document.body.style.cursor` en enter/leave, o usa `:blocking="true"` en cientos si un objeto debe ocultar los de detrás para el raycast. Desactiva el raycast en objetos que no lo necesitan (`raycast: () => null` en la prop o `:raycast="() => null"`) para ahorrar CPU en escenas grandes.

Los eventos de Vue en `<TresCanvas>` (`@pointerdown` en el div contenedor) siguen siendo eventos DOM normales.

## 8. Integración con Inertia (Laravel)

Inertia renderiza en cliente (con SSR opcional). Three.js requiere `window`, `document` y WebGL, así que el componente del canvas **no debe evaluarse en el servidor** y conviene cargarlo lazy para no meter `three` en el bundle inicial.

```vue
<!-- resources/js/Pages/Home.vue -->
<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue';

const HeroScene = defineAsyncComponent(() => import('@/Components/Three/HeroScene.vue'));
const mounted = ref(false);
onMounted(() => { mounted.value = true; }); // guard: solo cliente y solo tras hidratar
</script>

<template>
  <section class="relative h-[80vh]">
    <img src="/images/hero-poster.webp" alt="" class="absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
    <HeroScene v-if="mounted" model-url="/models/hero.glb" class="absolute inset-0" />
  </section>
</template>
```

- `defineAsyncComponent` + `import()` crea un chunk separado con TresJS y Three. `v-if="mounted"` garantiza que no se renderiza en SSR y que el `import()` no se dispara hasta el cliente.
- Con SSR de Inertia (`php artisan inertia:start-ssr`), el guard `onMounted` es suficiente; no hace falta `<ClientOnly>` (no existe en Inertia). Si prefieres un componente reutilizable, crea `ClientOnly.vue` que renderiza el slot tras `onMounted`.
- Para diferir aún más, combina con `useIntersectionObserver` de `@vueuse/core`: monta el canvas cuando el `<section>` esté a 200 px del viewport.
- **Navegación Inertia**: al cambiar de página, Vue desmonta el componente y TresJS dispone escena y renderer. No guardes objetos de Three en stores de Pinia o en módulos globales que sobrevivan a la página; si lo haces, dispónlos manualmente.
- **Persistent layouts**: si el canvas vive en un layout persistente, no se desmonta entre páginas; pausa el loop con `pause()` cuando la página actual no lo muestre.
- Props desde Laravel: pasa `modelUrl`, `variant`, colores como props de Inertia (`Inertia::render('Home', ['modelUrl' => asset('models/hero.glb')])`); el componente Three solo consume props planas.
- `@` alias: en Laravel suele apuntar a `resources/js` (definido en `vite.config.ts` `resolve.alias` o por `laravel-vite-plugin`).

## 9. Postprocesado: `@tresjs/post-processing`

```vue
<script setup lang="ts">
import { EffectComposerPmndrs, BloomPmndrs, SMAAPmndrs } from '@tresjs/post-processing';
import { BlendFunction } from 'postprocessing';
</script>

<template>
  <TresCanvas disable-render>
    <!-- escena -->
    <Suspense>
      <EffectComposerPmndrs :multisampling="0">
        <BloomPmndrs :intensity="0.6" :luminance-threshold="0.85" mipmap-blur />
        <SMAAPmndrs />
      </EffectComposerPmndrs>
    </Suspense>
  </TresCanvas>
</template>
```

Los nombres de componentes (`*Pmndrs` vs los basados en `three/addons`) dependen de la versión del paquete; consulta la documentación del release instalado. El composer toma el control del render (`disable-render` en el canvas). Criterios en `performance.md`.

## 10. Debug

- `@tresjs/leches`: `useControls({ intensity: { value: 1, min: 0, max: 5 } })` + `<TresLeches />` en el template. Solo en desarrollo (`v-if="import.meta.env.DEV"`).
- `<Stats />` de cientos o `stats-gl`.
- Vue DevTools muestra el árbol `<Tres*>`; la extensión Tres DevTools muestra el grafo de la escena y `renderer.info`.
- Helpers: `<TresAxesHelper :args="[2]" />`, `<TresGridHelper />`, `<TresCameraHelper :args="[light.shadow.camera]" />` vía `<primitive>`.

## 11. Disposal y ciclo de vida

- Al desmontar `<TresCanvas>`, TresJS llama a `dispose()` en geometrías, materiales y texturas creadas declarativamente y en el renderer. Los objetos insertados con `<primitive>` se eliminan de la escena pero **no** se disponen automáticamente sus geometrías/materiales si los cargaste tú: hazlo en `onUnmounted` (helper `disposeObject` en `performance.md`), salvo que provengan de la caché de `useGLTF`, que gestiona cientos.
- Usa `shallowRef`/`markRaw` para cualquier objeto Three que guardes en estado; un `ref()` profundo sobre una `Scene` convierte miles de propiedades en proxies y arrastra el rendimiento.
- No compartas un `WebGLRenderer` entre dos `<TresCanvas>`. Si necesitas varias vistas, una escena con `renderer.setScissor` en vanilla, o `<View>`-like con cientos si está disponible.

Ver `templates/HeroScene.vue` para el componente completo con `modelUrl`, guard de reduced motion, OrbitControls opcional y pausa fuera de viewport.
