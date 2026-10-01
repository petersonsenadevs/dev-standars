# Fundamentos de Three.js (r170+)

Referencia condensada de los bloques básicos: escena, cámara, renderer, luces, materiales, geometrías, loop, resize, picking y controles. Todo en ESM; los addons se importan desde `three/addons/...`.

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

## 1. Escena

`THREE.Scene` es el grafo raíz. Todo `Object3D` (Mesh, Group, Light, Camera) tiene `position`, `rotation` (Euler, radianes), `quaternion`, `scale`, `visible`, `children`, `userData`.

```ts
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0b0f');        // o null para transparente (renderer alpha)
scene.fog = new THREE.Fog('#0b0b0f', 10, 40);           // Fog lineal; FogExp2 para densidad
```

- `scene.environment` acepta una textura PMREM (ver `assets-loaders.md`) y aporta iluminación basada en imagen a todos los materiales PBR sin necesidad de luces.
- `scene.backgroundBlurriness` (0-1) y `scene.backgroundIntensity` controlan el fondo HDRI.

## 2. Cámaras

### PerspectiveCamera(fov, aspect, near, far)

```ts
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
camera.position.set(0, 1.5, 6);
camera.lookAt(0, 0, 0);
```

- `fov` es vertical, en grados. 35-50 para producto/hero; 60-75 para primera persona. Un fov bajo aplana la perspectiva (aspecto "de catálogo").
- `near`/`far`: cuanto menor sea la razón `far/near`, mayor precisión del depth buffer. Evita `near = 0.001` y `far = 100000` (z-fighting). Ajusta al tamaño real de la escena: `near 0.1`, `far 50-200` suele bastar.
- Tras cambiar `fov`, `aspect`, `near` o `far` llama a `camera.updateProjectionMatrix()`.

### OrthographicCamera(left, right, top, bottom, near, far)

Sin perspectiva; útil para UI 3D, isométricas, mapas y pases de postprocesado.

```ts
const frustum = 5;
const aspect = width / height;
const ortho = new THREE.OrthographicCamera(
  -frustum * aspect / 2, frustum * aspect / 2, frustum / 2, -frustum / 2, 0.1, 100,
);
```

En resize hay que recalcular los cuatro bordes con el nuevo aspect y llamar a `updateProjectionMatrix()`.

### Encuadrar un objeto (fit to view)

```ts
function fitCameraToObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D, offset = 1.25) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (maxDim / 2 / Math.tan(fov / 2)) * offset;
  camera.position.copy(center).add(new THREE.Vector3(0, 0, distance));
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
}
```

## 3. Renderer

```ts
const renderer = new THREE.WebGLRenderer({
  canvas,                       // reutiliza un <canvas> existente; si no, renderer.domElement
  antialias: true,              // MSAA; desactívalo si usas postprocesado con su propio AA (SMAA)
  alpha: false,                 // true para fondo transparente sobre el HTML
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(width, height, false); // false: no toca el estilo CSS del canvas; controla el tamaño con CSS
renderer.outputColorSpace = THREE.SRGBColorSpace;   // valor por defecto desde r152, explicítalo igualmente
renderer.toneMapping = THREE.ACESFilmicToneMapping; // alternativas: AgXToneMapping, NeutralToneMapping (r162+)
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // VSMShadowMap para sombras muy suaves (más caro)
```

Notas:

- `setPixelRatio` con cap a 2 (o 1.5 en móvil) es la optimización más rentable: un DPR 3 renderiza 9x píxeles.
- Color management: desde r152 `THREE.ColorManagement.enabled = true` por defecto. Las texturas de color (`map`, `emissiveMap`) deben tener `texture.colorSpace = THREE.SRGBColorSpace`; las de datos (normal, roughness, metalness, AO) se dejan en `NoColorSpace` (linear). GLTFLoader ya lo hace correctamente.
- Tone mapping solo afecta a materiales con `toneMapped: true` (por defecto). Para elementos UI/planos con textura exacta usa `material.toneMapped = false`.
- `renderer.setClearColor(color, alpha)` si no usas `scene.background`.

### WebGPURenderer (opcional)

```ts
import { WebGPURenderer } from 'three/webgpu';
const renderer = new WebGPURenderer({ canvas, antialias: true });
await renderer.init();               // asíncrono; hace fallback a WebGL2 si no hay WebGPU
renderer.setAnimationLoop(animate);
```

Los materiales `Mesh*NodeMaterial` y TSL (Three Shading Language) reemplazan a GLSL en este backend. Úsalo solo si necesitas compute shaders o TSL; para webs de producto WebGL sigue siendo la opción segura.

## 4. Luces

| Luz | Uso | Sombras |
|---|---|---|
| `AmbientLight(color, intensity)` | Relleno uniforme, sin dirección. Aplana. Preferir HemisphereLight o environment | No |
| `HemisphereLight(sky, ground, intensity)` | Relleno con gradiente cielo/suelo; barato y natural | No |
| `DirectionalLight(color, intensity)` | Sol; rayos paralelos. Luz clave habitual | Sí (ortográfica) |
| `PointLight(color, intensity, distance, decay)` | Bombilla omnidireccional | Sí (cube map, caro) |
| `SpotLight(color, intensity, distance, angle, penumbra, decay)` | Foco con cono | Sí (perspectiva) |
| `RectAreaLight` | Panel tipo softbox; solo Standard/Physical, sin sombras; requiere `RectAreaLightUniformsLib.init()` | No |

Desde r155 las intensidades son físicas (`useLegacyLights = false`): `PointLight`/`SpotLight` en candelas, valores altos (p. ej. 50-500); `DirectionalLight` en lux relativo (1-5 normal). Si una escena migrada se ve oscura es por esto.

```ts
const hemi = new THREE.HemisphereLight('#ffffff', '#444466', 0.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#ffffff', 2.5);
sun.position.set(5, 8, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);   // 1024 en móvil; potencias de 2
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 30;
sun.shadow.camera.left = -8;          // ajusta el frustum ortográfico a lo que proyecta sombra
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.bias = -0.0005;            // corrige shadow acne
sun.shadow.normalBias = 0.02;         // alternativa más robusta al bias
scene.add(sun);
scene.add(sun.target);                // si mueves el target, debe estar en la escena
```

Para que una sombra aparezca se necesitan las cuatro cosas: `renderer.shadowMap.enabled = true`, `light.castShadow = true`, `mesh.castShadow = true` y `receiver.receiveShadow = true`. Depura el frustum con `new THREE.CameraHelper(sun.shadow.camera)`.

Regla práctica: una luz direccional con sombra + `scene.environment` (HDRI) + un HemisphereLight tenue cubre el 90 % de los casos de producto.

## 5. Materiales

| Material | Cuándo |
|---|---|
| `MeshBasicMaterial` | Sin iluminación: UI, fondos, texturas baked, wireframe |
| `MeshLambertMaterial` / `MeshPhongMaterial` | Legacy barato; evitar en nuevo código |
| `MeshStandardMaterial` | PBR metalness/roughness. Default para todo |
| `MeshPhysicalMaterial` | Extiende Standard: `clearcoat`, `transmission`, `ior`, `thickness`, `sheen`, `iridescence`, `anisotropy`, `specularIntensity` |
| `MeshToonMaterial` | Cel shading con `gradientMap` |
| `MeshNormalMaterial` / `MeshDepthMaterial` | Debug y pases |
| `ShaderMaterial` / `RawShaderMaterial` | GLSL propio (ver `shaders-basics.md`) |
| `PointsMaterial`, `LineBasicMaterial`, `SpriteMaterial` | Puntos, líneas, sprites |

```ts
const metal = new THREE.MeshStandardMaterial({
  color: '#c8c8cc',
  metalness: 1.0,      // 0 dieléctrico, 1 metal. Evita valores intermedios salvo mapas
  roughness: 0.25,     // 0 espejo, 1 mate
  envMapIntensity: 1,  // multiplicador del scene.environment
  map, normalMap, roughnessMap, metalnessMap, aoMap,
});

const glass = new THREE.MeshPhysicalMaterial({
  color: '#ffffff',
  metalness: 0,
  roughness: 0.05,
  transmission: 1,     // refracción real; requiere scene.environment o fondo para verse
  thickness: 0.5,      // grosor simulado para la refracción
  ior: 1.5,            // vidrio 1.5, agua 1.33, diamante 2.42
  transparent: false,  // transmission NO necesita transparent: true; activarlo cambia el orden de render
});
```

Propiedades transversales: `transparent` + `opacity`, `side` (`FrontSide` | `BackSide` | `DoubleSide`; DoubleSide duplica coste de fragmentos), `depthWrite` (false para partículas/transparencias apiladas), `blending` (`AdditiveBlending` para glow), `flatShading`, `wireframe`, `alphaTest`, `alphaHash` (r154+, transparencia sin sorting).

Un metal sin `scene.environment` se ve negro: los metales reflejan, no difunden. Añade siempre un env map (HDRI o `RoomEnvironment`):

```ts
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();
```

Cuando cambias propiedades que alteran el shader compilado (activar un `map` que antes era `null`, cambiar `transparent`, `side`, `flatShading`, defines) hay que poner `material.needsUpdate = true`. Cambiar `color`, `roughness`, `opacity` no lo requiere.

## 6. Geometrías

Todas son `BufferGeometry` con atributos `position`, `normal`, `uv` (+ `index`).

- Primitivas: `BoxGeometry`, `SphereGeometry(r, wSeg, hSeg)`, `PlaneGeometry(w, h, wSeg, hSeg)`, `CylinderGeometry`, `TorusGeometry`, `TorusKnotGeometry`, `CircleGeometry`, `RingGeometry`, `IcosahedronGeometry(r, detail)`, `CapsuleGeometry`.
- Segmentos: mínimos para lo que necesitas. Una esfera 64x64 son 8k triángulos; 32x16 basta para objetos pequeños. Para desplazamiento por shader sí necesitas subdivisión.
- Herramientas: `BufferGeometryUtils.mergeGeometries`, `mergeVertices`, `computeVertexNormals()`, `computeBoundingBox()/Sphere()`, `geometry.center()`, `geometry.rotateX()` (aplica transformación a los vértices, útil para orientar un plano como suelo una sola vez).
- Custom:

```ts
const geo = new THREE.BufferGeometry();
const positions = new Float32Array(count * 3);
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('aRandom', new THREE.BufferAttribute(new Float32Array(count), 1));
// tras modificar el array:
geo.attributes.position.needsUpdate = true;
```

Comparte geometrías y materiales entre meshes siempre que puedas; cada instancia única cuesta memoria GPU.

## 7. Group, jerarquía y transformaciones

```ts
const car = new THREE.Group();
car.add(body, wheelFL, wheelFR);
car.position.x = 2;         // los hijos heredan la transformación
car.rotation.y = Math.PI / 4;
```

- `object.rotation` es `Euler` en radianes con orden `XYZ`. Para rotaciones compuestas/interpoladas usa `quaternion` y `Quaternion.slerp`.
- `object.lookAt(vec3)` orienta el eje -Z hacia el punto (las cámaras miran por -Z). Para meshes, un plano `PlaneGeometry` mira por +Z.
- Espacios: `getWorldPosition(target)`, `localToWorld(v)`, `worldToLocal(v)`, `object.attach(child)` (reparenta conservando la transformación mundial).
- `object.traverse(cb)` recorre el subárbol; útil para activar sombras en un GLTF:

```ts
gltf.scene.traverse((o) => {
  if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; }
});
```

- `matrixAutoUpdate = false` + `updateMatrix()` manual para objetos estáticos en escenas grandes.

## 8. Unidades, escala y coordenadas

- Three.js no tiene unidades; la convención es **1 unidad = 1 metro**. glTF exporta en metros, las luces físicas y `transmission`/`thickness` asumen metros, y la física (Rapier, Cannon) también.
- Sistema **diestro, Y arriba**: +X derecha, +Y arriba, +Z hacia la cámara (hacia el espectador). Blender es Z arriba; el exportador glTF convierte automáticamente.
- Rotación positiva = antihoraria mirando desde el eje positivo hacia el origen.
- Un modelo importado de CAD en milímetros llega 1000x grande: `gltf.scene.scale.setScalar(0.001)` o, mejor, arreglarlo en el exportador.
- Coordenadas de pantalla a NDC (para raycaster y shaders): `x = (clientX / width) * 2 - 1`, `y = -(clientY / height) * 2 + 1`. Usa `renderer.domElement.getBoundingClientRect()` si el canvas no está en (0,0).

## 9. Clock, delta y loop de animación

```ts
const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.1); // clamp: evita saltos al volver de pestaña oculta
  const elapsed = clock.elapsedTime;

  mesh.rotation.y += delta * 0.5;   // velocidad en rad/s, independiente del framerate
  controls.update(delta);           // OrbitControls con damping necesita update por frame
  mixer?.update(delta);             // AnimationMixer de un GLTF

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);  // preferido sobre requestAnimationFrame manual: compatible con XR y se detiene con setAnimationLoop(null)
```

- Anima siempre en función de `delta` o `elapsed`, nunca `+= 0.01` por frame (a 120 Hz iría al doble de velocidad).
- Para parar: `renderer.setAnimationLoop(null)`. Para render bajo demanda (escenas estáticas): renderiza solo en `controls.addEventListener('change', render)` y en resize.
- `THREE.Timer` (r167+, `three/addons/misc/Timer.js`) es la alternativa moderna a `Clock` con soporte de `document.timeline` y pausa.

## 10. Resize

```ts
function onResize() {
  const { clientWidth: w, clientHeight: h } = container; // mide el contenedor, no window, si el canvas no es fullscreen
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
}
const ro = new ResizeObserver(onResize);
ro.observe(container);
// dispose: ro.disconnect()
```

`ResizeObserver` sobre el contenedor es más fiable que `window.resize` (cambios de layout, sidebars, barra de URL móvil). El canvas debe tener CSS `display: block; width: 100%; height: 100%`.

## 11. Raycaster (picking)

```ts
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPointerMove(e: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, true); // true = recursivo; pasa una lista acotada, no scene.children
  const first = hits[0];
  if (first) {
    first.object; first.point; first.distance; first.face; first.uv;
  }
}
```

- Ejecuta el raycast en el loop (o con throttle), no en cada `pointermove`; guarda solo las coordenadas en el evento.
- `raycaster.layers` y `object.layers` para filtrar; `raycaster.params.Points.threshold` para `Points`; `raycaster.firstHitOnly = true` con `three-mesh-bvh` para mallas grandes.
- Para `InstancedMesh`, `hit.instanceId` indica la instancia.
- Cambia `document.body.style.cursor = hits.length ? 'pointer' : ''` para feedback.

## 12. OrbitControls

```ts
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;   // inercia; OBLIGA a controls.update() cada frame
controls.dampingFactor = 0.05;
controls.target.set(0, 0.8, 0);  // punto de órbita; también lo que la cámara mira
controls.minDistance = 2;
controls.maxDistance = 12;
controls.minPolarAngle = Math.PI * 0.2;  // evita mirar desde abajo del suelo
controls.maxPolarAngle = Math.PI * 0.5;
controls.enablePan = false;      // en heros de producto casi siempre false
controls.enableZoom = false;     // si el canvas está en una página con scroll, el zoom con rueda la secuestra
controls.autoRotate = true;
controls.autoRotateSpeed = 0.8;
controls.update();
```

- Si animas la cámara con GSAP mientras OrbitControls está activo, desactívalo (`controls.enabled = false`) durante el tween o anima `controls.target` y la posición a la vez y llama a `update()` en `onUpdate`.
- Alternativas: `TrackballControls`, `MapControls`, `FlyControls`, `PointerLockControls`, y `camera-controls` (npm) para transiciones suaves con API `setLookAt`.
- En móvil el canvas con OrbitControls captura el gesto de scroll; usa `touch-action: pan-y` en el canvas o `controls.touches.ONE = THREE.TOUCH.ROTATE` con `enableZoom = false`, o mejor, deja que solo rote con un `touches` config y no bloquees el scroll vertical de la página.

## 13. Esqueleto mínimo

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1, 5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight('#fff', '#446', 0.5));
  const sun = new THREE.DirectionalLight('#fff', 2);
  sun.position.set(3, 5, 2);
  sun.castShadow = true;
  scene.add(sun);

  const mesh = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.6, 0.2, 128, 32),
    new THREE.MeshStandardMaterial({ color: '#4f8cff', roughness: 0.3, metalness: 0.1 }),
  );
  mesh.castShadow = true;
  scene.add(mesh);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.25 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1;
  floor.receiveShadow = true;
  scene.add(floor);

  const clock = new THREE.Clock();
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement!;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement!);
  resize();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    mesh.rotation.y += dt * 0.4;
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };
}
```

Ver `templates/scene.ts` para la versión completa como clase y `performance.md` para pausa fuera de viewport y presupuesto.
