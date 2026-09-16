# Three.js vanilla (TypeScript) y Astro

Cuando no hay framework reactivo alrededor del canvas (Astro, Blade sin Inertia, landings estáticas) la unidad de trabajo es una clase `Scene` con `init / resize / dispose` y un loop propio. Es también la forma más ligera: solo `three` y los addons que uses.

## 1. Clase `Scene` (contrato)

```ts
export interface SceneOptions {
  canvas: HTMLCanvasElement;
  container?: HTMLElement;         // para medir tamaño; por defecto canvas.parentElement
  modelUrl?: string;
  reducedMotion?: boolean;
}

export interface SceneHandle {
  init(): Promise<void>;           // carga assets, monta el grafo, arranca el loop
  resize(): void;
  start(): void;                   // setAnimationLoop(loop)
  stop(): void;                    // setAnimationLoop(null)
  dispose(): void;                 // libera TODO: loop, observers, listeners, GPU
}
```

Principios:

- Toda suscripción (ResizeObserver, IntersectionObserver, `visibilitychange`, listeners de puntero, `webglcontextlost`) se registra en `init` y se elimina en `dispose`. Usa un `AbortController` para los `addEventListener` y así un solo `abort()` limpia todos.
- `dispose` debe ser idempotente (llamarlo dos veces no explota): las View Transitions y HMR lo llamarán en momentos inesperados.
- La clase no conoce el framework; recibe un `<canvas>` y opciones planas. La integración (Astro script, componente Vue/React, Blade) es un wrapper de 20 líneas.
- Guarda las referencias a lo que creas (`private disposables: { dispose(): void }[]`) y recórrelas en `dispose`.

Ver `templates/scene.ts` para la implementación completa. Uso mínimo:

```ts
import { HeroScene } from '@/three/HeroScene';

const canvas = document.querySelector<HTMLCanvasElement>('#hero-canvas')!;
const scene = new HeroScene({ canvas, modelUrl: '/models/hero.glb' });
await scene.init();
// ...
scene.dispose();
```

## 2. Integración con Astro

### Opción A: `<canvas>` + `<script>` (sin island, recomendado para vanilla)

Los `<script>` de Astro se bundlean con Vite, admiten TypeScript e `import`, se ejecutan una vez por página como módulos y se deduplican si el componente aparece varias veces. Esto último importa: el script corre una vez aunque haya tres `<Hero />`, así que selecciona todos los canvases.

```astro
---
// src/components/Hero.astro
interface Props { modelUrl: string; poster: string }
const { modelUrl, poster } = Astro.props;
---
<section class="hero">
  <img src={poster} alt="" class="hero__poster" aria-hidden="true" />
  <canvas class="hero__canvas" data-hero-canvas data-model-url={modelUrl} aria-hidden="true"></canvas>
</section>

<style>
  .hero { position: relative; height: 80vh; }
  .hero__poster, .hero__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .hero__canvas { opacity: 0; transition: opacity 600ms ease; }
  .hero__canvas.is-ready { opacity: 1; }
</style>

<script>
  import { mountHeroScenes } from '@/three/mount-hero';
  // Ver "View Transitions" más abajo para la versión con astro:page-load
  mountHeroScenes();
</script>
```

```ts
// src/three/mount-hero.ts
import type { SceneHandle } from './scene';

const instances = new Map<HTMLCanvasElement, SceneHandle>();

export async function mountHeroScenes(root: ParentNode = document) {
  const canvases = root.querySelectorAll<HTMLCanvasElement>('[data-hero-canvas]');
  for (const canvas of canvases) {
    if (instances.has(canvas)) continue;
    const { HeroScene } = await import('./HeroScene'); // chunk lazy con three
    const scene = new HeroScene({
      canvas,
      modelUrl: canvas.dataset.modelUrl,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    instances.set(canvas, scene);
    await scene.init();
    canvas.classList.add('is-ready');
  }
}

export function disposeHeroScenes() {
  for (const [canvas, scene] of instances) {
    scene.dispose();
    instances.delete(canvas);
  }
}
```

Notas:

- `is:inline` en el `<script>` desactiva el bundling: no lo uses aquí.
- Vite en Astro: `three` va a un chunk propio gracias al `import()`; con `build.rollupOptions.output.manualChunks` puedes fijar `three: ['three']`.
- Los assets en `public/models` se referencian como `/models/x.glb`. Con `import modelUrl from '@/assets/hero.glb?url'` obtienes hashing, útil si el modelo cambia a menudo (Draco/KTX2 decoders siguen en `public/`).

### Opción B: island de framework (`client:visible`)

Si la escena ya existe como componente Vue (TresJS) o React (R3F), Astro puede montarla como island:

```astro
---
import HeroScene from '@/components/HeroScene.vue';
---
<HeroScene client:visible={{ rootMargin: '200px' }} modelUrl="/models/hero.glb" />
```

- `client:visible` hidrata cuando el elemento entra en el viewport (con `rootMargin` para adelantarse). Es el directive adecuado para 3D: no penaliza LCP ni carga `three` si el usuario no llega al canvas.
- `client:idle` si el canvas está above the fold (hidrata en `requestIdleCallback`).
- Nunca `client:load` para un canvas: bloquea el hilo principal en la carga inicial.
- El componente se renderiza en SSR (HTML estático) y luego hidrata; el guard `onMounted` / `useEffect` sigue siendo necesario dentro de él para no tocar `window` en el servidor. Con `client:only="vue"` te saltas el SSR del componente (pierdes el placeholder HTML, pero evitas cualquier import de Three en Node).
- Integraciones: `@astrojs/vue` (+ `templateCompilerOptions` de TresJS en `astro.config.mjs` → `vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('Tres') && tag !== 'TresCanvas' } } })`), `@astrojs/react`.

## 3. View Transitions (`<ClientRouter />`)

Con `<ClientRouter />` (antes `<ViewTransitions />`) Astro reemplaza el `<body>` sin recargar la página. Consecuencias:

- Los `<script>` de módulo **no se vuelven a ejecutar** en la navegación (ya están cargados). Hay que engancharse a los eventos del ciclo de vida.
- El canvas antiguo se elimina del DOM sin avisar a Three; el `WebGLRenderer` y su loop siguen vivos → leak de contextos y CPU.

Eventos (en orden): `astro:before-preparation` → `astro:after-preparation` → `astro:before-swap` → `astro:after-swap` → `astro:page-load`.

```ts
// src/three/mount-hero.ts (añadir al final)
function setupLifecycle() {
  // Primera carga y cada navegación (page-load también se dispara en la carga inicial)
  document.addEventListener('astro:page-load', () => {
    void mountHeroScenes();
  });
  // Antes de que el body se sustituya: libera GPU y loops del documento saliente
  document.addEventListener('astro:before-swap', () => {
    disposeHeroScenes();
  });
}
setupLifecycle();
```

```astro
<script>
  import { mountHeroScenes, disposeHeroScenes } from '@/three/mount-hero';
  document.addEventListener('astro:page-load', () => { void mountHeroScenes(); }, { passive: true });
  document.addEventListener('astro:before-swap', disposeHeroScenes);
</script>
```

- Como el módulo se evalúa una vez, los listeners se registran una vez. Si además llamas a `mountHeroScenes()` en el nivel superior del script, en la primera carga se ejecutaría dos veces (nivel superior + `page-load`); usa solo `page-load`, que también cubre la carga inicial.
- `astro:before-swap` recibe `event.newDocument`; si quieres persistir el canvas entre páginas (misma escena en todas), marca el elemento con `transition:persist` y en lugar de disponer, actualiza el estado de la escena. Es un caso avanzado; por defecto dispón y vuelve a crear.
- Si la página usa `transition:animate` y el canvas participa en la animación, dispón en `astro:after-swap` en vez de `before-swap` para que el fade-out saliente muestre el último frame (el loop ya no corre; el canvas conserva el último buffer solo si `preserveDrawingBuffer: true` o si no lo limpias).
- Para islands de framework, Astro desmonta el componente en el swap (llama a los hooks de unmount de Vue/React), así que el dispose lo hace TresJS/R3F. Solo la opción A necesita `before-swap` manual.
- HMR en desarrollo: `import.meta.hot?.dispose(() => disposeHeroScenes())` evita acumular contextos al editar.

## 4. Laravel Blade (sin Inertia)

Misma opción A: `<canvas data-hero-canvas>` en la vista Blade, y en `resources/js/app.ts`:

```ts
import { mountHeroScenes } from './three/mount-hero';
document.addEventListener('DOMContentLoaded', () => { void mountHeroScenes(); });
```

Con Livewire y `wire:navigate`, los eventos equivalentes son `livewire:navigated` (montar) y `livewire:navigating` (disponer). Con Turbo: `turbo:load` / `turbo:before-render`.

## 5. Estructura de carpetas sugerida

```
src/three/                  (o resources/js/three/ en Laravel)
  scene.ts                  Clase base con init/resize/loop/dispose (plantilla)
  HeroScene.ts              extends Scene: contenido concreto
  loaders.ts                createGLTFLoader(renderer, manager) con Draco/KTX2/Meshopt
  dispose.ts                disposeObject(root)
  support.ts                isWebGL2Available, prefersReducedMotion, isMobile
  mount-hero.ts             integración DOM / lifecycle
  shaders/*.glsl            si usas vite-plugin-glsl
public/
  models/*.glb
  hdri/*.hdr
  draco/  basis/            decoders copiados de node_modules/three/examples/jsm/libs/
```

## 6. Varias escenas en una página

Cada `WebGLRenderer` es un contexto WebGL (límite ~8-16 por pestaña, y cada uno cuesta memoria). Para una página con varios visores pequeños (grid de productos), usa **un solo renderer** fullscreen fijo y `setScissor`/`setViewport` por cada `<div>` placeholder (patrón "multiple elements" de los ejemplos de Three), o renderiza a `WebGLRenderTarget` y copia a canvases 2D. En R3F esto es `<View>` de drei; en vanilla, un `ScissorRenderer` que recorre `document.querySelectorAll('[data-view]')` y renderiza cada escena en el rectángulo de su elemento (`getBoundingClientRect`), saltando los que están fuera del viewport.

Ver `templates/scene-astro.ts` para el arranque con View Transitions e `IntersectionObserver`.
