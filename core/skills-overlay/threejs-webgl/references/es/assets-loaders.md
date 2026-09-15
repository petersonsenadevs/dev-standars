# Assets y loaders: glTF, Draco, KTX2, Meshopt, HDRI y progreso de carga

## 1. Formato: glTF 2.0 binario (`.glb`)

Usa siempre `.glb` (un único fichero binario con geometría, texturas y animaciones). Evita OBJ/FBX en producción: sin PBR estándar, sin compresión, loaders más pesados. Convierte con Blender o `gltf-transform`.

Ubicación en el proyecto:

- **Laravel + Vite**: `public/models/*.glb`, `public/textures/*.ktx2`, `public/hdri/*.hdr`. Se sirven tal cual (`/models/hero.glb`); no pasan por Vite ni por el hash de assets, así que versiona a mano (`hero.v3.glb`) o añade `?v=` con un hash en el componente.
- **Next.js**: `public/models/...` → `/models/hero.glb`.
- **Astro**: `public/models/...` idéntico. No los pongas en `src/assets` salvo que quieras el hashing (funciona con `?url`, pero complica Draco/KTX2 que cargan ficheros auxiliares por ruta).

Configura cabeceras de caché largas para `/models`, `/textures`, `/hdri` (nginx `expires 1y` o CDN) y `Content-Encoding` no es necesario: Draco/KTX2/Meshopt ya están comprimidos y gzip apenas ayuda.

## 2. GLTFLoader + DRACO + KTX2 + Meshopt

Los decoders (Draco, KTX2/Basis) son ficheros WASM/JS que se cargan aparte. Cópialos desde `node_modules/three/examples/jsm/libs/{draco,basis}/` a `public/draco/` y `public/basis/`, o usa un CDN fijado a la versión de Three:

```ts
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export function createGLTFLoader(renderer: THREE.WebGLRenderer, manager?: THREE.LoadingManager) {
  const draco = new DRACOLoader(manager).setDecoderPath('/draco/'); // contiene draco_decoder.wasm, draco_wasm_wrapper.js
  draco.setDecoderConfig({ type: 'js' }); // opcional; 'wasm' por defecto cuando está disponible

  const ktx2 = new KTX2Loader(manager)
    .setTranscoderPath('/basis/')           // basis_transcoder.js + .wasm
    .detectSupport(renderer);               // elige el formato GPU (ASTC/ETC2/BC7/S3TC) según el dispositivo

  const loader = new GLTFLoader(manager);
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

// Uso
const loader = createGLTFLoader(renderer);
const gltf: GLTF = await loader.loadAsync('/models/hero.glb', (e) => {
  if (e.lengthComputable) console.log((e.loaded / e.total) * 100);
});
gltf.scene.traverse((o) => {
  const m = o as THREE.Mesh;
  if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
});
scene.add(gltf.scene);

// Animaciones
const mixer = new THREE.AnimationMixer(gltf.scene);
gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
// en el loop: mixer.update(delta)
```

Detalles:

- Un solo `GLTFLoader` reutilizado para todos los modelos: los decoders instancian workers y tienen coste de arranque. Al desmontar, `draco.dispose()` y `ktx2.dispose()`.
- `KTX2Loader.detectSupport(renderer)` es obligatorio antes de cargar; para WebGPU pasa el `WebGPURenderer`.
- Draco vs Meshopt: Draco comprime más la geometría pero decodifica más lento (WASM worker) y el decoder pesa ~300 KB. Meshopt (`EXT_meshopt_compression`) decodifica casi instantáneo, decoder de ~30 KB, comprime algo menos. Para webs con varios modelos medianos Meshopt suele ganar en tiempo total; para un único modelo pesado Draco.
- `GLTFLoader` gestiona bien el color space: `map`/`emissiveMap` en sRGB, resto lineal. No lo toques después.
- `gltf.scene` es un `Group`; los nombres de Blender se conservan (`gltf.scene.getObjectByName('Screen')`), con espacios sustituidos por `_` y sin caracteres especiales.
- Materiales del glTF son `MeshStandardMaterial` o `MeshPhysicalMaterial` (si usan `KHR_materials_transmission`, `clearcoat`, etc.). Puedes reemplazarlos: `mesh.material = customMaterial` (dispón el original).
- Reutilizar un modelo varias veces: `import { clone } from 'three/addons/utils/SkeletonUtils.js'` (necesario si tiene skinning); para estático `gltf.scene.clone()` comparte geometrías y materiales (bien).

## 3. Optimizar modelos con gltf-transform

```bash
npm i -D @gltf-transform/cli

# Pipeline recomendado en un comando: dedup, prune, instancing, join, weld, simplify ligero,
# resize de texturas, compresión de texturas y Meshopt
npx gltf-transform optimize in.glb out.glb \
  --texture-compress webp \
  --texture-size 2048 \
  --compress meshopt

# Variante con Draco y KTX2 (mejor GPU memory; requiere KTX-Software instalado: toktx)
npx gltf-transform optimize in.glb out.glb --compress draco --texture-compress ktx2

# Pasos individuales
npx gltf-transform inspect in.glb                  # tabla de meshes, materiales, texturas, tamaños
npx gltf-transform dedup in.glb out.glb            # fusiona accessors/texturas duplicadas
npx gltf-transform prune in.glb out.glb            # elimina nodos/materiales no usados
npx gltf-transform resize in.glb out.glb --width 1024 --height 1024
npx gltf-transform webp in.glb out.glb --quality 80
npx gltf-transform etc1s in.glb out.glb            # KTX2 ETC1S: máxima compresión, calidad media (albedo)
npx gltf-transform uastc in.glb out.glb            # KTX2 UASTC: alta calidad (normal maps)
npx gltf-transform draco in.glb out.glb
npx gltf-transform meshopt in.glb out.glb
npx gltf-transform simplify in.glb out.glb --ratio 0.5 --error 0.001
npx gltf-transform center in.glb out.glb           # centra en origen
npx gltf-transform instance in.glb out.glb         # convierte nodos repetidos en EXT_mesh_gpu_instancing
```

WebP vs KTX2: WebP pesa menos en red pero se descomprime a RGBA en GPU (una textura 2048² ocupa 16 MB de VRAM + mipmaps). KTX2 pesa parecido en red pero se queda comprimido en GPU (4-8x menos VRAM, upload más rápido, sin stutter al crear la textura). Para móvil y escenas con muchas texturas, KTX2. WebP requiere `three` r150+ y navegador con soporte (universal hoy).

API programática (script Node en `scripts/optimize-models.mjs`) para integrarlo en CI:

```js
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read('in.glb');
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048] }), draco());
await io.write('out.glb', doc);
```

## 4. Checklist de exportación desde Blender

1. **Apply transforms** (Ctrl+A → All Transforms) antes de exportar; escala 1, rotación 0. Un objeto con scale 0.01 aplicado vía transform rompe normales, sombras y `Box3`.
2. **Unidades**: escena en metros (Scene Properties → Units → Metric, Unit Scale 1). El exportador convierte Z-up a Y-up.
3. **Origen** del objeto donde tenga sentido (suelo del modelo o centro) para que `position.set` sea predecible.
4. **Modificadores** aplicados o marcados "Apply Modifiers" en el exportador.
5. **Materiales Principled BSDF** únicamente; nodos raros no exportan. Texturas conectadas directamente (Base Color, Metallic/Roughness combinados en un ORM, Normal vía Normal Map node, Emission).
6. **Texturas potencia de 2** (512, 1024, 2048). 4096 solo para el hero absoluto y nunca en móvil. Empaqueta AO/Roughness/Metallic en canales R/G/B de una sola textura (glTF lo espera así: `metallicRoughnessTexture` usa G=roughness, B=metallic; `occlusionTexture` usa R).
7. **Baking**: para iluminación estática (interiores, props) hornea lightmap o combina AO+iluminación en el Base Color y usa `MeshBasicMaterial` o `emissive`. Reduce luces en runtime a cero.
8. **Decimate / Limited Dissolve** para bajar polígonos; objetivo <100k tris por modelo hero, <20k para props.
9. **Exportador glTF**: Format `glb`, +Y Up, Apply Modifiers, UVs, Normals, Vertex Colors solo si se usan, Compression (Draco) opcional (o comprime después con gltf-transform, más control), Animation → solo si hay, Sampling Rate 1, Optimize Animation Size.
10. **Nombres** limpios en objetos y materiales (sin espacios ni tildes) porque los usarás con `getObjectByName`.
11. **Sin cámaras ni luces** en el export salvo que las quieras (checkbox "Cameras"/"Punctual Lights" desactivado).
12. Verifica en https://gltf-viewer.donmccurdy.com o `npx gltf-transform inspect`.

## 5. HDRI: RGBELoader + PMREMGenerator

```ts
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

const hdr = await new RGBELoader().loadAsync('/hdri/studio_1k.hdr');
const envMap = pmrem.fromEquirectangular(hdr).texture;
scene.environment = envMap;          // iluminación PBR
scene.background = envMap;           // opcional: fondo visible (scene.backgroundBlurriness = 0.5 para desenfocarlo)
hdr.dispose();
pmrem.dispose();
```

- Resolución: 1k (1024x512) es suficiente para iluminación; 2k solo si el HDRI es fondo visible. Un `.hdr` 1k pesa ~1-2 MB; en formato `.exr` (`EXRLoader`) similar. Para reducir peso convierte a **`.hdr` 1k con compresión RLE** o a KTX2 HDR (r160+ soporta `UASTC HDR`).
- Alternativa gratuita y sin descarga: `RoomEnvironment` (ver `fundamentals.md`), suficiente para productos con materiales metálicos.
- Rotar el env map: `scene.environmentRotation` y `scene.backgroundRotation` (Euler, r162+).
- `material.envMapIntensity` para ajustar por material; `scene.environmentIntensity` (r163+) global.
- Fuentes: Poly Haven (CC0), ambientCG.

## 6. LoadingManager con barra de progreso

`LoadingManager` agrupa todos los loaders que lo reciban y emite `onStart`, `onProgress(url, loaded, total)`, `onLoad`, `onError`. `total` es el número de ficheros, no bytes, así que la barra avanza por fichero. Para bytes reales usa el callback `onProgress` de cada `load` (solo fiable si el servidor envía `Content-Length` y no hay `Content-Encoding` chunked).

```ts
const manager = new THREE.LoadingManager();
const overlay = document.querySelector<HTMLElement>('[data-loading]')!;
const bar = overlay.querySelector<HTMLElement>('[data-loading-bar]')!;
const label = overlay.querySelector<HTMLElement>('[data-loading-label]')!;

manager.onProgress = (_url, loaded, total) => {
  const pct = Math.round((loaded / total) * 100);
  bar.style.transform = `scaleX(${loaded / total})`;
  overlay.setAttribute('aria-valuenow', String(pct));
  label.textContent = `${pct} %`;
};
manager.onLoad = () => {
  overlay.classList.add('is-done');          // CSS: opacity 0 + pointer-events none + transition
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
};
manager.onError = (url) => console.error('Error cargando', url);

const gltfLoader = createGLTFLoader(renderer, manager);
const rgbeLoader = new RGBELoader(manager);
const textureLoader = new THREE.TextureLoader(manager);

const [gltf, hdr] = await Promise.all([
  gltfLoader.loadAsync('/models/hero.glb'),
  rgbeLoader.loadAsync('/hdri/studio_1k.hdr'),
]);
```

Ver `templates/loading-overlay.html` para el markup accesible (`role="progressbar"`, `aria-live`).

Para eliminar el stutter del primer frame (compilación de shaders + upload de texturas) llama a `renderer.compileAsync(scene, camera)` (r157+) antes de mostrar el canvas y de retirar el overlay:

```ts
await renderer.compileAsync(scene, camera);
renderer.render(scene, camera); // primer frame ya sin compilación
manager.onLoad?.();
```

## 7. Texturas sueltas

```ts
const texLoader = new THREE.TextureLoader(manager);
const albedo = await texLoader.loadAsync('/textures/wood_albedo.webp');
albedo.colorSpace = THREE.SRGBColorSpace;   // OBLIGATORIO para texturas de color
albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
albedo.repeat.set(4, 4);
albedo.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); // suelos vistos en ángulo
albedo.generateMipmaps = true;              // por defecto; requiere potencia de 2 en WebGL1, no en WebGL2
albedo.minFilter = THREE.LinearMipmapLinearFilter;

const normal = await texLoader.loadAsync('/textures/wood_normal.webp'); // sin colorSpace (lineal)
```

- Texturas KTX2 sueltas: `new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer).loadAsync('/textures/x.ktx2')`.
- `flipY`: `TextureLoader` pone `true`; glTF requiere `false` (GLTFLoader lo gestiona). Si aplicas una textura cargada manualmente sobre un mesh de glTF y sale invertida, `texture.flipY = false`.
- Vídeo: `new THREE.VideoTexture(videoEl)` con `<video muted playsinline autoplay loop>`; colorSpace sRGB.
- Canvas 2D como textura: `CanvasTexture`, poner `needsUpdate = true` tras dibujar.

## 8. Hooks de carga en frameworks

### drei (React)

```tsx
import { useGLTF, useTexture, useEnvironment } from '@react-three/drei';

function Model(props) {
  const { scene, nodes, materials, animations } = useGLTF('/models/hero.glb'); // Draco automático vía CDN si detecta compresión; pasa true o una ruta para decoders locales
  return <primitive object={scene} {...props} />;
}
useGLTF.preload('/models/hero.glb');  // fuera del componente: empieza la descarga antes del mount
// decoders locales: useGLTF('/models/hero.glb', '/draco/')
// KTX2/Meshopt: useGLTF(url, dracoPath, meshoptEnabled, (loader) => loader.setKTX2Loader(ktx2))
```

`useGLTF` cachea por URL y suspende (`<Suspense>`). Para tipar `nodes`/`materials` genera el componente con `npx gltfjsx model.glb --types --transform` (además optimiza con gltf-transform).

### cientos (Vue / TresJS)

```ts
import { useGLTF, useTexture, useEnvironment } from '@tresjs/cientos';

const { scene, nodes, materials, animations } = await useGLTF('/models/hero.glb', {
  draco: true,                  // usa decoder de CDN de Google
  decoderPath: '/draco/',       // o local
});
// En cientos 4.x la API moderna es: const { state, isLoading, progress } = useGLTF(url) reactivo;
// consulta la versión instalada: pnpm ls @tresjs/cientos
```

Como es asíncrono, el componente que lo llama en `<script setup>` debe ir envuelto en `<Suspense>` en el padre. Ver `tresjs-vue.md`.

## 9. Presupuesto de assets (objetivo)

| Asset | Objetivo | Máximo aceptable |
|---|---|---|
| Modelo hero `.glb` (con texturas) | < 2 MB | 5 MB (solo desktop, lazy) |
| Props secundarios | < 300 KB | 1 MB |
| Textura albedo | 1024², WebP/KTX2 | 2048² |
| Normal map | 1024², UASTC KTX2 o PNG/WebP lossless | 2048² |
| HDRI | 1k `.hdr` ≈ 1-2 MB | 2k solo si es fondo visible |
| Decoders (Draco WASM) | ~300 KB una vez, cacheable | - |
| Total 3D en primera vista | < 4 MB | 8 MB |
| Triángulos hero | < 100k | 300k |

Si la primera vista supera el presupuesto: carga un placeholder ligero (LOD bajo o `MeshBasicMaterial` con color) y sustituye al terminar; o diferir el 3D hasta después de LCP (`requestIdleCallback` + `IntersectionObserver`), ver `performance.md`.
