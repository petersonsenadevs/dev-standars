# Shaders básicos: ShaderMaterial, uniforms, onBeforeCompile y patrones habituales

GLSL ES 3.0 (WebGL2). Three.js inyecta automáticamente en `ShaderMaterial` las matrices y atributos estándar; `RawShaderMaterial` no inyecta nada.

## 1. ShaderMaterial vs RawShaderMaterial

`ShaderMaterial` añade al vertex shader: `uniform mat4 modelMatrix, modelViewMatrix, projectionMatrix, viewMatrix, normalMatrix; uniform vec3 cameraPosition; attribute vec3 position, normal; attribute vec2 uv;` y la cabecera `precision`. Solo declaras tus uniforms y varyings.

```ts
import * as THREE from 'three';
import vertexShader from './shaders/gradient.vert.glsl';
import fragmentShader from './shaders/gradient.frag.glsl';

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uColorA: { value: new THREE.Color('#1e3a8a') },
    uColorB: { value: new THREE.Color('#f472b6') },
    uTexture: { value: null as THREE.Texture | null },
  },
  transparent: false,
  side: THREE.FrontSide,
  depthWrite: true,
  glslVersion: THREE.GLSL3,   // opcional: in/out en lugar de attribute/varying y salida con `out vec4 fragColor`
  defines: { USE_NOISE: '' }, // #ifdef USE_NOISE
});

// loop
material.uniforms.uTime.value = clock.elapsedTime;
// resize
material.uniforms.uResolution.value.set(w * dpr, h * dpr);
```

- Los uniforms se leen por referencia: muta `.value` (o el `Vector2` en sitio), no reasignes el objeto `uniforms`.
- `uniformsNeedUpdate` no hace falta; cambiar `defines` o el código fuente sí requiere `material.needsUpdate = true`.
- `ShaderMaterial` no aplica tone mapping ni conversión de color space a la salida por defecto (sí lo hace desde r15x si `toneMapped = true` y usas los chunks `#include <tonemapping_fragment>` y `#include <colorspace_fragment>`). Si tu color sale distinto que el mismo hex en un `MeshBasicMaterial`, añade esos dos includes al final del fragment.
- Depuración: `renderer.debug.checkShaderErrors = true` (por defecto en dev), y `onShaderError` para leer el log completo.

`RawShaderMaterial`: úsalo cuando quieras control absoluto (GLSL3 con nombres propios, instancing manual) o portar shaders de otras herramientas. Debes declarar `precision`, matrices y atributos a mano.

## 2. Vertex y fragment mínimos

```glsl
// gradient.vert.glsl
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

```glsl
// gradient.frag.glsl
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vUv;

void main() {
  float t = vUv.y + 0.15 * sin(vUv.x * 6.2831 + uTime * 0.8);
  vec3 color = mix(uColorA, uColorB, smoothstep(0.0, 1.0, t));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
```

Colores: `THREE.Color` pasado como uniform llega ya en espacio lineal (ColorManagement convierte el hex sRGB a lineal). Por eso el include `colorspace_fragment` al final es necesario para verlo como esperas.

## 3. Vite: `vite-plugin-glsl`

```bash
pnpm add -D vite-plugin-glsl
```

```ts
// vite.config.ts
import glsl from 'vite-plugin-glsl';
export default defineConfig({
  plugins: [glsl({ include: ['**/*.glsl', '**/*.vert', '**/*.frag'], compress: false, watch: true })],
});
```

```ts
// src/types/glsl.d.ts
declare module '*.glsl' { const src: string; export default src; }
declare module '*.vert' { const src: string; export default src; }
declare module '*.frag' { const src: string; export default src; }
```

Permite `#include "./noise/simplex3d.glsl"` dentro de los ficheros GLSL (resolución en build). En Next.js usa `raw-loader` / `?raw` con Turbopack (`import frag from './x.glsl?raw'` no funciona en Next sin configuración; alternativa: template strings `/* glsl */\`...\`` con la extensión de VS Code "glsl-literal" para resaltado). Astro hereda Vite: mismo plugin.

## 4. Extender materiales estándar: `onBeforeCompile`

Para mantener PBR (luces, sombras, env map) y añadir desplazamiento o color procedural, parchea el shader de `MeshStandardMaterial` sustituyendo chunks concretos. Los chunks están en `three/src/renderers/shaders/ShaderChunk/`.

```ts
const material = new THREE.MeshStandardMaterial({ color: '#8899aa', roughness: 0.4 });
const uniforms = { uTime: { value: 0 }, uAmplitude: { value: 0.15 } };

material.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, uniforms);   // comparte las referencias: mutar uniforms.uTime.value afecta al shader

  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', /* glsl */ `
      #include <common>
      uniform float uTime;
      uniform float uAmplitude;
      varying float vDisplace;
    `)
    .replace('#include <begin_vertex>', /* glsl */ `
      #include <begin_vertex>
      float d = sin(position.y * 4.0 + uTime * 2.0) * uAmplitude;
      transformed += normal * d;
      vDisplace = d;
    `);

  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', /* glsl */ `
      #include <common>
      varying float vDisplace;
    `)
    .replace('#include <color_fragment>', /* glsl */ `
      #include <color_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.6, 0.2), smoothstep(0.0, 0.15, vDisplace));
    `);
};
material.customProgramCacheKey = () => 'displace-v1'; // evita que dos materiales con onBeforeCompile distinto compartan programa
```

Puntos de anclaje habituales: `begin_vertex` (posición → `transformed`), `beginnormal_vertex` (`objectNormal`), `project_vertex`, `color_fragment` (`diffuseColor`), `roughnessmap_fragment` (`roughnessFactor`), `emissivemap_fragment` (`totalEmissiveRadiance`), `output_fragment` / `opaque_fragment` (`gl_FragColor`). Si desplazas vértices, las sombras proyectadas no lo reflejan salvo que también parchees `mesh.customDepthMaterial` (un `MeshDepthMaterial` con el mismo `onBeforeCompile`).

Alternativa con menos fricción: `three-custom-shader-material` (npm) expone `CustomShaderMaterial` con `vertexShader`/`fragmentShader` que escriben en `csm_Position`, `csm_DiffuseColor`, `csm_Emissive`, etc., y tiene bindings para R3F y TresJS.

## 5. Noise: simplex 3D (Ashima / Ian McEwan)

Guárdalo en `shaders/noise/simplex3d.glsl` e inclúyelo. Dominio público (MIT, Ashima Arts).

```glsl
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// fbm: varias octavas
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * snoise(p); p *= 2.0; a *= 0.5; }
  return v;
}
```

Devuelve valores en [-1, 1]. Para 2D usa `snoise(vec3(uv * scale, uTime))`.

## 6. Patrones

### 6.1 Gradiente animado de fondo (plano fullscreen)

```ts
const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: { uTime: { value: 0 }, uColorA: { value: new THREE.Color('#0f172a') }, uColorB: { value: new THREE.Color('#7c3aed') } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`, // sin matrices: ocupa el clip space entero
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB; varying vec2 vUv;
    #include "./noise/simplex3d.glsl"
    void main(){
      float n = snoise(vec3(vUv * 1.5, uTime * 0.08)) * 0.5 + 0.5;
      vec3 c = mix(uColorA, uColorB, smoothstep(0.2, 0.9, n));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
}));
bg.frustumCulled = false;
bg.renderOrder = -1;
scene.add(bg);
```

### 6.2 Desplazamiento de vértices (blob)

```glsl
// vert
uniform float uTime; uniform float uAmp; uniform float uFreq;
varying float vNoise; varying vec3 vNormal;
#include "./noise/simplex3d.glsl"
void main(){
  float n = snoise(vec3(position * uFreq + uTime * 0.4));
  vec3 displaced = position + normal * n * uAmp;
  vNoise = n; vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
```

Usa `IcosahedronGeometry(1, 48)` (subdivisión alta y uniforme). Las normales originales ya no coinciden con la superficie desplazada: para iluminación correcta recalcula la normal muestreando el ruido en dos puntos vecinos (tangente/bitangente) y haciendo cross, o acepta el sombreado aproximado con `MeshStandardMaterial` + `onBeforeCompile` y `flatShading` desactivado. Pon `mesh.frustumCulled = false` si la amplitud es grande.

### 6.3 Hover distortion sobre una imagen (plane + textura)

Plano con `PlaneGeometry(1, 1, 32, 32)` escalado al tamaño de la imagen en píxeles CSS (cámara ortográfica que mapea 1 unidad = 1 px, o perspectiva ajustada con `viewport`). El ratón llega en UV y se suaviza en JS con `lerp` para dar inercia.

```glsl
// frag
uniform sampler2D uTexture; uniform vec2 uMouse; uniform float uHover; uniform float uTime; uniform vec2 uPlaneAspect;
varying vec2 vUv;
#include "./noise/simplex3d.glsl"
void main(){
  vec2 uv = vUv;
  float dist = distance(uv * uPlaneAspect, uMouse * uPlaneAspect);   // corrige aspecto para un círculo real
  float influence = smoothstep(0.35, 0.0, dist) * uHover;
  vec2 offset = vec2(snoise(vec3(uv * 3.0, uTime * 0.5)), snoise(vec3(uv * 3.0 + 10.0, uTime * 0.5))) * 0.04 * influence;
  vec3 col;
  col.r = texture2D(uTexture, uv + offset * 1.2).r;   // aberración cromática barata
  col.g = texture2D(uTexture, uv + offset).g;
  col.b = texture2D(uTexture, uv + offset * 0.8).b;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
```

JS: `uHover` va a 1 en `pointerenter` y a 0 en `pointerleave` (GSAP `gsap.to(u.uHover, { value: 1, duration: 0.6 })`), `uMouse` se actualiza en `pointermove` con `e.uv` del raycaster o calculando desde el rect del elemento. Textura con `colorSpace = SRGBColorSpace` y `minFilter = LinearFilter` si no es potencia de 2 y no quieres mipmaps. Para cubrir como `object-fit: cover`, escala las UV en el shader según la relación imagen/plano.

### 6.4 Partículas: `Points`

Con `PointsMaterial` (rápido de montar):

```ts
const count = 5000;
const positions = new Float32Array(count * 3);
for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * 10;
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const points = new THREE.Points(geo, new THREE.PointsMaterial({
  size: 0.05, sizeAttenuation: true, color: '#ffffff', transparent: true, opacity: 0.8,
  depthWrite: false, blending: THREE.AdditiveBlending, map: circleSprite, alphaTest: 0.01,
}));
```

Con shader (control por partícula: tamaño, color, animación en GPU sin tocar el buffer):

```ts
geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
const mat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uSize: { value: 30 * renderer.getPixelRatio() } },
  vertexShader: /* glsl */ `
    uniform float uTime; uniform float uSize;
    attribute float aScale; attribute float aRandom;
    varying float vAlpha;
    void main(){
      vec3 p = position;
      p.y += sin(uTime * 0.5 + aRandom * 6.28) * 0.2;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * aScale * (1.0 / -mv.z);   // atenuación por distancia
      vAlpha = 0.4 + 0.6 * aRandom;
    }`,
  fragmentShader: /* glsl */ `
    varying float vAlpha;
    void main(){
      float d = distance(gl_PointCoord, vec2(0.5));
      float a = smoothstep(0.5, 0.2, d) * vAlpha;    // disco suave sin textura
      gl_FragColor = vec4(vec3(1.0), a);
    }`,
});
```

- `uSize` se multiplica por el pixel ratio porque `gl_PointSize` está en píxeles físicos; actualízalo si cambia el DPR.
- `gl_PointSize` tiene un máximo por GPU (`renderer.capabilities.maxPointSize`, a menudo 64-256 px); para partículas grandes usa `InstancedMesh` de planos billboard.
- Para miles de partículas animadas con estado (velocidad, vida), GPGPU con `GPUComputationRenderer` (addon) o compute shaders en WebGPU.

### 6.5 Uniform del ratón con inercia (JS)

```ts
const target = new THREE.Vector2(0.5, 0.5);
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
});
// loop
material.uniforms.uMouse.value.lerp(target, 1 - Math.exp(-6 * delta)); // frame-rate independent damping
```

## 7. Buenas prácticas

- Precisión: `precision highp float;` en móvil por defecto (Three lo pone). Para ruido con coordenadas grandes usa `mod` para mantener `uTime` acotado (`uTime = elapsed % 1000`) y evitar pérdida de precisión con horas de sesión.
- Evita `if` divergentes en el fragment; prefiere `mix`/`step`/`smoothstep`.
- Los shaders se compilan en el primer frame en que se ven: `renderer.compileAsync(scene, camera)` antes de mostrar.
- Cada combinación distinta de `defines` es un programa nuevo; no generes defines por instancia.
- Texturas en el fragment: reduce muestras (cada `texture2D` cuesta ancho de banda); en móvil 3-4 lecturas por píxel a pantalla completa ya se notan.
- Utilidad para depurar: renderiza `vUv`, la normal o el valor de ruido como color (`gl_FragColor = vec4(vec3(n), 1.0)`).

## 8. Nota sobre TSL (WebGPU)

Con `WebGPURenderer` (`three/webgpu`), el lenguaje de shaders es **TSL** (Three Shading Language), un DSL en JavaScript que compila a WGSL o GLSL según el backend. Los `Node materials` (`MeshStandardNodeMaterial`, etc.) exponen slots como `positionNode`, `colorNode`, `emissiveNode`, `roughnessNode`:

```ts
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, positionLocal, normalLocal, sin, time, mix, color, mx_noise_float } from 'three/tsl';

const amp = uniform(0.15);
const mat = new MeshStandardNodeMaterial();
const n = mx_noise_float(positionLocal.mul(3).add(time.mul(0.4)));
mat.positionNode = positionLocal.add(normalLocal.mul(n.mul(amp)));
mat.colorNode = mix(color('#1e3a8a'), color('#f472b6'), n.mul(0.5).add(0.5));
```

Ventajas: sin strings GLSL, composable, mismo código en WebGL2 y WebGPU, ruido incluido (`mx_noise_*`, `mx_fractal_noise_*` de MaterialX), compute shaders. Estado: estable pero en evolución rápida (API cambia entre releases); para producción con WebGL como target, `ShaderMaterial`/`onBeforeCompile` siguen siendo la vía más predecible. Si un proyecto arranca con `WebGPURenderer`, escribe todo en TSL desde el principio (mezclar `ShaderMaterial` GLSL con WebGPU no está soportado).

## Mesh gradient / aurora en shader propio

Fondo animado tipo mesh gradient/aurora: el plano fullscreen del §6.1 con 3-4 colores del design system
(`design-system/*/MASTER.md`) como uniforms y el `snoise` del §5 para el flujo. Es un fondo: `setPixelRatio(1)`
(el gradiente suave no gana nada con DPR 2 y cuesta 4x) y pausa el render fuera de viewport.

```ts
const [c0, c1, c2, c3] = ['#0f172a', '#312e81', '#7c3aed', '#f472b6'].map((h) => new THREE.Color(h)); // tokens del DS
const mat = new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: { uTime: { value: 0 }, uC0: { value: c0 }, uC1: { value: c1 }, uC2: { value: c2 }, uC3: { value: c3 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; varying vec2 vUv;
    #include "./noise/simplex3d.glsl"
    void main(){
      float t = uTime * 0.04;                                  // lento: es ambiente, no protagonista
      float n1 = snoise(vec3(vUv * 1.4, t)) * 0.5 + 0.5;
      float n2 = snoise(vec3(vUv * 2.3 + 7.0, t * 1.3)) * 0.5 + 0.5;
      vec3 c = mix(uC0, uC1, smoothstep(0.15, 0.85, n1));
      c = mix(c, uC2, smoothstep(0.40, 0.95, n2));
      c = mix(c, uC3, smoothstep(0.70, 1.00, n1 * n2) * 0.6); // acento solo en picos, atenuado
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});
renderer.setPixelRatio(1);
let playing = true;
const io = new IntersectionObserver(([e]) => { playing = e.isIntersecting; });
io.observe(renderer.domElement);
// loop: if (playing) { mat.uniforms.uTime.value = clock.getElapsedTime(); renderer.render(scene, camera); }
```

Fallback (sin WebGL o con reduced-motion): no montes el canvas y deja un gradiente CSS estático con los mismos tokens.

```css
.aurora-fallback { background: radial-gradient(60% 80% at 20% 30%, #312e81 0%, transparent 60%),
  radial-gradient(50% 70% at 80% 20%, #7c3aed33 0%, transparent 60%), #0f172a; }
```

Gate en JS: `matchMedia('(prefers-reduced-motion: reduce)').matches || !WebGL.isWebGL2Available()` (addon
`three/addons/capabilities/WebGL.js`) → clase `.aurora-fallback` y no crees el renderer. Cleanup: `io.disconnect()`,
`mat.dispose()`, `renderer.dispose()` al desmontar.
