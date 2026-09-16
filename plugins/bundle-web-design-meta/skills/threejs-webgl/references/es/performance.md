# Rendimiento: presupuesto, técnicas y ciclo de vida

El 3D en una web de producto compite con el LCP, el scroll y la batería. La regla: **60 fps en un móvil de gama media de hace 3 años**, y que el canvas nunca bloquee la carga del resto de la página.

## 1. Presupuesto por frame

| Métrica | Móvil | Desktop | Cómo medir |
|---|---|---|---|
| Draw calls (`renderer.info.render.calls`) | < 100 | < 300 | `renderer.info` tras `render()` |
| Triángulos (`renderer.info.render.triangles`) | < 300k | < 1-2 M | idem |
| Texturas en GPU (`renderer.info.memory.textures`) | < 30, ≤ 1024² | < 60, ≤ 2048² | idem |
| Geometrías (`renderer.info.memory.geometries`) | debe ser estable frame a frame; si crece, hay leak | | idem |
| Programas (`renderer.info.programs.length`) | < 20 | < 40 | cada combinación material/defines compila un shader |
| Luces con sombra | 1 | 1-2 | cada una es un pase de render extra |
| DPR | ≤ 1.5 | ≤ 2 | `renderer.getPixelRatio()` |
| Tiempo de frame JS + GPU | < 8 ms | < 12 ms | Chrome DevTools → Performance, o `stats.js` / `stats-gl` |

Cada `Mesh` visible = al menos un draw call (más si tiene varios materiales o `castShadow` con luz de sombras). Reducir draw calls es casi siempre la primera y mayor ganancia.

```ts
// Log puntual (no en cada frame en producción)
console.table(renderer.info.render);   // calls, triangles, points, lines
console.table(renderer.info.memory);   // geometries, textures
```

Para ver el tiempo GPU real: `stats-gl` (npm) con `trackGPU: true`, o la extensión Spector.js para inspeccionar cada draw call.

## 2. Reducir draw calls

### InstancedMesh

Misma geometría y material repetidos N veces en un único draw call. Para partículas, árboles, columnas, tarjetas de un grid.

```ts
const count = 1000;
const mesh = new THREE.InstancedMesh(geometry, material, count);
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // solo si vas a actualizar cada frame
const dummy = new THREE.Object3D();
const color = new THREE.Color();

for (let i = 0; i < count; i++) {
  dummy.position.set(Math.random() * 20 - 10, 0, Math.random() * 20 - 10);
  dummy.rotation.y = Math.random() * Math.PI * 2;
  dummy.scale.setScalar(0.5 + Math.random());
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
  mesh.setColorAt(i, color.setHSL(Math.random(), 0.6, 0.5)); // color por instancia opcional
}
mesh.instanceMatrix.needsUpdate = true;
if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
mesh.computeBoundingSphere(); // para que el frustum culling funcione con la extensión real
scene.add(mesh);
```

- Raycast devuelve `hit.instanceId`. Ocultar una instancia: escala 0 o reducir `mesh.count`.
- `BatchedMesh` (r160+) permite geometrías distintas con el mismo material en un draw call; útil para escenas con muchos props diferentes.

### mergeGeometries

Fusiona geometrías estáticas que comparten material en una sola.

```ts
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const geometries = meshes.map((m) => {
  const g = m.geometry.clone();
  g.applyMatrix4(m.matrixWorld); // hornea la transformación
  return g;
});
const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
const single = new THREE.Mesh(merged, sharedMaterial);
```

Pierdes la posibilidad de mover/pickear partes individuales; solo para decorado. Con `useGroups = true` conserva grupos de material (varios draw calls, pero una sola geometría en memoria).

### Compartir materiales y texturas

Dos meshes con dos instancias distintas de `MeshStandardMaterial` idénticas compilan el mismo programa pero fuerzan cambios de estado. Reutiliza el mismo objeto material. Un atlas de texturas reduce bindings.

## 3. Culling y LOD

- **Frustum culling** está activo por defecto (`object.frustumCulled = true`) y se basa en `geometry.boundingSphere`. Si desplazas vértices en un shader, la esfera ya no coincide y el objeto desaparece en los bordes: pon `frustumCulled = false` o agranda la esfera (`geometry.boundingSphere.radius *= 2`).
- **Occlusion culling** no existe de serie; diseña la escena para que fuera de cámara no haya nada caro (o usa `visible = false` por secciones al hacer scroll).
- **LOD**:

```ts
const lod = new THREE.LOD();
lod.addLevel(highMesh, 0);     // distancia desde la que se usa
lod.addLevel(midMesh, 8);
lod.addLevel(lowMesh, 20);
scene.add(lod);
// lod.update(camera) se llama automáticamente en render si lod.autoUpdate = true
```

Genera los niveles con `gltf-transform simplify --ratio 0.5` / `0.2`.

- **Layers**: `camera.layers` y `object.layers` para excluir objetos de una cámara o del raycaster sin tocar `visible`.

## 4. Texturas y memoria GPU

- KTX2 (Basis Universal) se mantiene comprimido en GPU: una 2048² RGBA sin comprimir son 16 MB + 5 MB de mipmaps; en ASTC/ETC2 unos 4-5 MB. En móvil con 6-8 texturas 2048² sin comprimir ya notas stutter en el upload y riesgo de context loss.
- Límite práctico móvil: **≤ 1024² por textura**, hero 2048² solo si es albedo único.
- `texture.generateMipmaps = false` + `minFilter = LinearFilter` para texturas de UI que siempre se ven a 1:1 (ahorra 33 % de memoria y un paso de upload).
- Comprueba `renderer.capabilities.maxTextureSize` (4096 en muchos móviles) y reduce si la textura lo supera; un `texImage2D` con tamaño excesivo puede fallar silenciosamente.
- No cargues texturas que no se ven en el primer frame: lazy con `IntersectionObserver` o al interactuar.

## 5. Renderer y DPR

```ts
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance', // elige la GPU dedicada en portátiles con dos GPU; 'low-power' para escenas simples que deben ahorrar batería
  alpha: false,                        // alpha: true cuesta un poco más (composición) y obliga a premultiplied alpha
  stencil: false,
  preserveDrawingBuffer: false,        // true solo si necesitas toDataURL() y sabes que cuesta
});

const isMobile = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
```

DPR dinámico: si el frame tarda más de 20 ms de media durante 1 s, baja el DPR un escalón (2 → 1.5 → 1); si sobra, sube. R3F lo trae de serie con `<PerformanceMonitor>` de drei; en vanilla es un par de líneas en el loop.

`antialias: true` (MSAA) es barato en desktop y aceptable en móvil con DPR ≤ 1.5. Si usas `EffectComposer`, el MSAA del canvas no aplica a los render targets: usa `samples: 4` en el `WebGLRenderTarget`/`EffectComposer` (WebGL2) o un pase SMAA/FXAA.

## 6. Pausar cuando no se ve

Un canvas fuera del viewport o en una pestaña oculta sigue consumiendo GPU y batería si el loop corre. `requestAnimationFrame` se pausa en pestañas ocultas, pero no cuando el canvas está fuera de pantalla por scroll.

```ts
let running = false;
let inView = false;
let visible = !document.hidden;

function updateLoop() {
  const shouldRun = inView && visible;
  if (shouldRun && !running) {
    clock.start();                      // reinicia delta para evitar salto
    renderer.setAnimationLoop(animate);
    running = true;
  } else if (!shouldRun && running) {
    renderer.setAnimationLoop(null);
    running = false;
  }
}

const io = new IntersectionObserver(([entry]) => {
  inView = entry.isIntersecting;
  updateLoop();
}, { threshold: 0.01, rootMargin: '100px' }); // arranca un poco antes de entrar
io.observe(renderer.domElement);

const onVisibility = () => { visible = !document.hidden; updateLoop(); };
document.addEventListener('visibilitychange', onVisibility);

// dispose: io.disconnect(); document.removeEventListener('visibilitychange', onVisibility);
```

Combinado con el clamp de `delta` (`Math.min(delta, 0.1)`) evita saltos de animación al reanudar.

Render bajo demanda: en escenas estáticas (visor de producto sin auto-rotación) renderiza solo cuando algo cambia:

```ts
let needsRender = true;
controls.addEventListener('change', () => { needsRender = true; });
renderer.setAnimationLoop(() => {
  if (controls.enableDamping) controls.update(); // devuelve true si aún hay inercia
  if (!needsRender) return;
  needsRender = false;
  renderer.render(scene, camera);
});
```

En R3F: `<Canvas frameloop="demand">` + `invalidate()`.

## 7. Disposal (memoria)

Three.js no libera recursos GPU al quitar objetos del grafo: `scene.remove(mesh)` solo desreferencia. Sin `dispose()`, cada navegación SPA (Inertia, Next router, Astro View Transitions) acumula geometrías y texturas hasta el context loss.

```ts
export function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      if (!mat) continue;
      for (const key of Object.keys(mat)) {
        const value = (mat as any)[key];
        if (value && typeof value === 'object' && 'isTexture' in value) (value as THREE.Texture).dispose();
      }
      mat.dispose();
    }
  });
}

export function disposeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer, extras: { dispose(): void }[] = []) {
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  scene.clear();
  (scene.environment as THREE.Texture | null)?.dispose();
  (scene.background as THREE.Texture | null)?.dispose?.();
  extras.forEach((e) => e.dispose());   // controls, composer, pmrem, loaders draco/ktx2, render targets
  renderer.dispose();                    // libera programas y estado; el contexto WebGL se libera cuando el canvas sale del DOM
  renderer.forceContextLoss();           // opcional: libera el contexto inmediatamente (útil en SPA con muchos montajes)
}
```

- Ojo con disponer geometrías/materiales **compartidos** entre varios meshes o cacheados por `useGLTF`: drei y cientos cachean; en R3F/TresJS deja que el framework gestione lo que él creó y dispón solo lo que creaste a mano.
- Comprueba después con `renderer.info.memory` (debería volver a 0 geometrías y 0 texturas) antes de disponer el renderer.
- Límite de contextos WebGL por pestaña: ~8-16 en Chrome. Cada `WebGLRenderer` nuevo sin liberar el anterior consume uno; al superarlo, el más antiguo se pierde ("Too many active WebGL contexts").

## 8. Postprocesado con criterio

Cada pase es al menos un fullscreen quad extra + render targets del tamaño del canvas. Bloom con DPR 2 en móvil es la causa número uno de escenas a 20 fps.

Opciones:

- `EffectComposer` de `three/addons/postprocessing/` con `RenderPass`, `UnrealBloomPass`, `SMAAPass`, `OutputPass` (necesario al final para aplicar tone mapping y sRGB cuando usas composer).
- `postprocessing` (pmndrs): fusiona efectos en un único pase (`EffectPass` con varios `Effect`), mejor rendimiento, base de `@react-three/postprocessing` y `@tresjs/post-processing`.

```ts
import { EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, ToneMappingEffect } from 'postprocessing';

const composer = new EffectComposer(renderer, { multisampling: isMobile ? 0 : 4 });
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera,
  new BloomEffect({ intensity: 0.6, luminanceThreshold: 0.8, mipmapBlur: true }),
  new SMAAEffect(),
));
// loop: composer.render(delta) en lugar de renderer.render
// resize: composer.setSize(w, h)
// dispose: composer.dispose()
```

Reglas: un solo `EffectPass` con todos los efectos; bloom con `mipmapBlur` (mucho más barato); nada de SSAO/SSR/DoF en móvil; desactiva postprocesado si `prefers-reduced-motion` o en dispositivos con `navigator.hardwareConcurrency <= 4`. Muchas veces un `emissive` fuerte + tone mapping ACES da el "glow" sin bloom.

## 9. Fallback sin WebGL y reduced motion

```ts
import WebGL from 'three/addons/capabilities/WebGL.js';

if (!WebGL.isWebGL2Available()) {   // isWebGLAvailable() para WebGL1; three r163+ requiere WebGL2
  container.innerHTML = '';
  container.appendChild(fallbackImage); // <img> o <video> del render estático
  return;
}
```

Ver `templates/useWebGLSupport.ts`. Casos donde no hay WebGL: navegadores con aceleración desactivada, algunos webviews, modo ahorro de energía, drivers bloqueados. Siempre debe existir una imagen estática equivalente (también es lo que ve el crawler y lo que cuenta para el LCP si el canvas aún no ha pintado).

`prefers-reduced-motion`: no elimines el 3D, elimina el movimiento continuo. Auto-rotación off, animación de cámara al scroll sustituida por estados discretos, partículas estáticas, sin parallax con el ratón.

```ts
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionEnabled = !reduceMotion.matches;
reduceMotion.addEventListener('change', (e) => { motionEnabled = !e.matches; });
// en el loop: if (motionEnabled) mesh.rotation.y += dt * 0.4;
```

## 10. No penalizar LCP: carga diferida

`three` pesa ~150 KB gzip (core) + addons + loaders + decoders. No debe estar en el bundle inicial de una página cuyo LCP es un h1 o una imagen.

```ts
// Componente/vista: arranca el 3D después de que la página esté interactiva y el canvas visible
async function mountScene(canvas: HTMLCanvasElement) {
  const idle = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 200));
  await new Promise<void>((resolve) => idle(resolve));

  const [{ createScene }] = await Promise.all([
    import('@/three/hero-scene'),   // chunk separado: contiene import * as THREE from 'three'
  ]);
  return createScene(canvas);
}
```

- Vite/Next/Astro crean un chunk separado para el `import()` dinámico. Verifica en `vite build` / `next build` que `three` no aparece en el chunk principal (`rollup-plugin-visualizer` o `@next/bundle-analyzer`).
- Vite: en `build.rollupOptions.output.manualChunks` agrupa `three` y addons en un chunk `three` para cachearlo entre páginas.
- Con `IntersectionObserver` sobre el contenedor solo importas Three cuando el usuario se acerca al canvas (ver plantillas).
- Muestra un `<img>` poster con el mismo encuadre debajo del canvas (`position: absolute`) y haz fade-out cuando el primer frame esté renderizado; así el LCP es la imagen y el 3D "aparece" sin salto.
- Preload de recursos críticos cuando ya sabes que se van a usar: `<link rel="preload" as="fetch" href="/models/hero.glb" crossorigin>` (solo si el 3D es above the fold y el modelo es pequeño; si no, compite con el LCP).
- Cabeceras de caché largas para `/models`, `/draco`, `/basis`, `/hdri` y los chunks de Vite.

## 11. Checklist rápida antes de publicar

1. `renderer.info.render.calls` < 100 en móvil, triángulos < 300k.
2. DPR ≤ 2 (≤ 1.5 móvil).
3. Una sola luz con sombra, `shadow.mapSize` ≤ 2048 (1024 móvil), frustum de sombra ajustado.
4. Texturas KTX2 o WebP, ≤ 2048², potencia de 2; sin PNG de 4 MB.
5. Modelos con Draco/Meshopt; hero < 2 MB.
6. Loop pausado fuera de viewport y con pestaña oculta; `delta` clampeado.
7. `dispose()` completo al desmontar; `renderer.info.memory` vuelve a cero.
8. `three` en chunk lazy; LCP no depende del canvas; poster estático de fallback.
9. `WebGL.isWebGL2Available()` con fallback visual; `webglcontextlost` gestionado (ver `pitfalls.md`).
10. `prefers-reduced-motion` respetado.
11. Postprocesado: un `EffectPass`, bloom mipmap, nada de SSAO en móvil.
12. Probado en un Android de gama media real (no solo en el emulador de DevTools) y en Safari iOS (límites de memoria más agresivos: una pestaña con > 300-400 MB de GPU se recarga sola).
