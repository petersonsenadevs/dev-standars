# React Three Fiber (R3F) + drei en Next.js / React

R3F es un reconciler de React para Three.js: cada elemento JSX en minúscula (`<mesh>`, `<boxGeometry>`, `<meshStandardMaterial>`) instancia la clase de Three correspondiente y las props se aplican como propiedades. drei aporta helpers de alto nivel. Versiones de referencia: `@react-three/fiber` 9 (React 19), `@react-three/drei` 10, `three` r170+.

```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
# opcionales
pnpm add @react-three/postprocessing postprocessing
pnpm add -D leva r3f-perf
```

`next.config.ts`: `transpilePackages: ['three']` solo si usas paquetes que importan `three/examples/jsm` sin ESM; con r170 no suele hacer falta.

## 1. `<Canvas>`

```tsx
'use client';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap } from 'three';

export function HeroCanvas({ children }: { children: React.ReactNode }) {
  return (
    <Canvas
      shadows                                 // true = PCFSoft; o shadows="soft" | { type: PCFSoftShadowMap }
      dpr={[1, 2]}                            // rango de pixel ratio
      camera={{ position: [0, 1.5, 6], fov: 45, near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
      frameloop="always"                      // 'demand' para render bajo demanda (+ invalidate()), 'never' para control manual
      resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
      onCreated={({ gl, scene }) => { /* acceso imperativo inicial */ }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {children}
    </Canvas>
  );
}
```

- El canvas llena su contenedor (`div` con `position: relative` y altura definida). Internamente crea un `div` wrapper + `canvas`; el resize se hace con `ResizeObserver`.
- `flat` desactiva tone mapping (útil para escenas 2D/UI); `linear` desactiva la conversión sRGB (no lo uses en PBR).
- `eventSource` / `eventPrefix="client"` para que los eventos de puntero se calculen sobre otro elemento (cuando el canvas es `fixed` bajo el contenido HTML).

## 2. Hooks esenciales

```tsx
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';

function Spinner() {
  const ref = useRef<Mesh>(null!);
  const { viewport, size, camera, gl, invalidate } = useThree(); // viewport en unidades de mundo a z=0; size en px

  useFrame((state, delta) => {
    ref.current.rotation.y += delta * 0.5;                // delta en segundos
    ref.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    // state.pointer (NDC -1..1), state.camera, state.gl, state.scene, state.raycaster
  }, 0); // prioridad: >0 asume render manual (state.gl.render) en ese callback

  return (
    <mesh ref={ref} castShadow>
      <torusKnotGeometry args={[0.6, 0.2, 128, 32]} />
      <meshStandardMaterial color="#4f8cff" roughness={0.3} />
    </mesh>
  );
}
```

Reglas:

- **Nunca `setState` dentro de `useFrame`**: provoca un re-render de React 60 veces por segundo. Muta refs y objetos de Three directamente. Si necesitas exponer valores (progreso, hover) usa un store `zustand` con `subscribe` o refs.
- **No toques el DOM en `useFrame`** para actualizar un contador o texto: usa `<Html>` de drei con refs, o un store con `useSyncExternalStore` limitado a ese nodo.
- Selectores de `useThree` (`useThree((s) => s.camera)`) para evitar re-render en cada resize.
- `useFrame` se ejecuta en cada frame de todos los componentes montados; si un objeto no cambia, no suscribas.
- Los objetos de Three no son reactivos: cambiar `ref.current.position.x` no re-renderiza (bien). Cambiar la prop `position={[x,0,0]}` sí (mal si es por frame).
- Props con `args` reconstruyen el objeto: `<boxGeometry args={[1,1,1]} />` con args cambiantes crea geometría nueva (y dispone la anterior). Memoiza arrays: `const args = useMemo(() => [1,1,1] as const, [])`.
- Setter de propiedades anidadas: `shadow-mapSize={[2048, 2048]}`, `shadow-camera-far={30}`, `rotation-x={-Math.PI/2}`, `material-color="red"`.
- `<primitive object={obj} />` para insertar objetos imperativos; `attach="fog"`, `attach="material"` para asignar a propiedades del padre.

## 3. Carga: `useLoader`, `useGLTF`, `Suspense`

```tsx
import { Suspense } from 'react';
import { useGLTF, useTexture, useProgress, Html } from '@react-three/drei';

function Model({ url }: { url: string }) {
  const { scene, nodes, materials, animations } = useGLTF(url, '/draco/'); // Draco local; true = CDN
  // scene se cachea por URL: si lo montas dos veces, clona: const cloned = useMemo(() => scene.clone(), [scene]) o SkeletonUtils.clone
  return <primitive object={scene} castShadow receiveShadow />;
}
useGLTF.preload('/models/hero.glb', '/draco/'); // a nivel de módulo

function Loader() {
  const { progress, active } = useProgress(); // 0-100 de todos los loaders
  return (
    <Html center>
      <div role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        {Math.round(progress)} %
      </div>
    </Html>
  );
}

export function Scene() {
  return (
    <Suspense fallback={<Loader />}>
      <Model url="/models/hero.glb" />
    </Suspense>
  );
}
```

- `useLoader(GLTFLoader, url, (loader) => loader.setDRACOLoader(draco))` es la versión genérica; acepta arrays de URLs. Cachea con la URL como clave y suspende.
- Sombras en el modelo cargado: `useEffect(() => scene.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true }), [scene])`, o genera el componente con `npx gltfjsx model.glb --types --transform` que expone cada `<mesh>` con `castShadow` declarativo y tipos.
- `useTexture({ map: '/t/albedo.webp', normalMap: '/t/normal.webp' })` fija `colorSpace = SRGBColorSpace` en `map` y `emissiveMap`. `useTexture.preload`.
- `useEnvironment({ files: '/hdri/studio_1k.hdr' })` si necesitas la textura PMREM directamente.
- Animaciones: `const { actions, mixer } = useAnimations(animations, groupRef); useEffect(() => { actions.Idle?.reset().fadeIn(0.3).play(); }, [])`.
- `<Suspense>` en R3F: el subárbol suspendido no se monta en la escena hasta que todo carga, evitando pops parciales. Un fallback con `<Html>` renderiza HTML posicionado sobre el canvas. Fuera del canvas (overlay HTML global) usa `useProgress` en un componente hermano.

## 4. Next.js App Router: `next/dynamic` con `ssr: false`

R3F 9 puede renderizar en servidor sin romper (no crea el canvas hasta el cliente), pero muchos helpers de drei y `three/addons` tocan `window`, y en cualquier caso quieres el chunk fuera del bundle inicial.

```tsx
// app/(marketing)/page.tsx  (Server Component)
import { HeroSection } from '@/components/hero/HeroSection';

export default function Page() {
  return <HeroSection />;
}
```

```tsx
// components/hero/HeroSection.tsx
'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const HeroScene = dynamic(() => import('./HeroScene').then((m) => m.HeroScene), {
  ssr: false,                      // obligatorio en App Router: ssr:false solo está permitido en Client Components
  loading: () => null,             // el poster ya está debajo
});

export function HeroSection() {
  return (
    <section className="relative h-[80vh]">
      <Image src="/images/hero-poster.webp" alt="" fill priority className="object-cover" aria-hidden />
      <HeroScene modelUrl="/models/hero.glb" />
    </section>
  );
}
```

```tsx
// components/hero/HeroScene.tsx
'use client';
import { Canvas } from '@react-three/fiber';
// ... ver templates/HeroScene.tsx
```

- `next/dynamic` con `ssr: false` no se puede llamar desde un Server Component; el wrapper que lo usa debe ser `'use client'`.
- Todo archivo que importe `@react-three/fiber` o `drei` debe ser `'use client'` (hooks, contexto). Los datos (URLs, colores, copy) llegan como props serializables desde el Server Component.
- Poster `<Image priority>` como LCP; el canvas aparece encima con fade cuando `onCreated` o el primer `useFrame` ocurre.
- Para diferir hasta el viewport: `useInView` (`react-intersection-observer`) en `HeroSection` y renderiza `<HeroScene>` solo cuando `inView`.
- Pages Router: mismo `dynamic(..., { ssr: false })`, sin restricción de Client Component.
- Turbopack y `three/addons`: funciona con r170 (ESM puro). Si un paquete viejo importa `three/examples/jsm`, añade `transpilePackages`.

## 5. drei imprescindibles

```tsx
import {
  OrbitControls, Environment, ContactShadows, Float, Html, Text, Center, Bounds,
  PerspectiveCamera, useGLTF, useTexture, Preload, BakeShadows, AdaptiveDpr, PerformanceMonitor, Stats,
} from '@react-three/drei';

<PerspectiveCamera makeDefault position={[0, 1.5, 6]} fov={45} />
<OrbitControls makeDefault enableDamping enablePan={false} enableZoom={false} minPolarAngle={0.6} maxPolarAngle={Math.PI / 2} autoRotate autoRotateSpeed={0.8} />

<Environment files="/hdri/studio_1k.hdr" background={false} blur={0.6} environmentIntensity={1} />
{/* preset="studio" descarga de un CDN de pmndrs: evita en producción, usa files local */}

<ContactShadows position={[0, 0, 0]} opacity={0.5} scale={10} blur={2} far={4} resolution={512} frames={1} />
{/* frames={1} lo hornea una vez: casi gratis */}

<Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.8} floatingRange={[-0.1, 0.1]}>
  <Model url="/models/hero.glb" />
</Float>

<Center top>            {/* centra el hijo en el origen (top: apoya la base en y=0) */}
  <Model />
</Center>

<Bounds fit clip observe margin={1.2}>  {/* encuadra la cámara al contenido */}
  <Model />
</Bounds>

<Html position={[0, 1, 0]} center transform occlude distanceFactor={4} className="pointer-events-none">
  <span className="badge">Nuevo</span>
</Html>

<Text font="/fonts/Inter-Bold.woff" fontSize={0.5} color="white" anchorX="center">Hola</Text>

<Preload all />         {/* precompila shaders y sube texturas de todo lo montado (evita stutter al aparecer) */}
<BakeShadows />         {/* renderiza el shadow map una vez: escenas con luz y objetos estáticos */}
<AdaptiveDpr pixelated /> {/* baja el DPR mientras hay movimiento (con frameloop demand / regress) */}
<PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(2)} />
{process.env.NODE_ENV === 'development' && <Stats />}
```

Otros útiles: `MeshTransmissionMaterial` (vidrio de calidad; caro), `MeshReflectorMaterial`, `Sparkles`, `Stars`, `Sky`, `Cloud`, `Lightformer` (dentro de `<Environment>` para luces de estudio), `useCursor(hovered)`, `Edges`, `Outlines`, `Decal`, `Instances`/`Instance` (InstancedMesh declarativo), `Merged`, `Detailed` (LOD), `View` (múltiples vistas con un solo canvas), `ScrollControls`, `CameraControls` (wrapper de `camera-controls`), `KeyboardControls`, `Loader` (overlay de carga listo).

## 6. Scroll: `ScrollControls` vs GSAP ScrollTrigger

**`ScrollControls` (drei)**: crea un contenedor con scroll propio dentro del canvas (`pages={3}`), y `useScroll()` da `offset` (0-1) y `range(a, b)`/`curve` para mapear tramos. HTML sincronizado con `<Scroll html>`.

```tsx
<ScrollControls pages={3} damping={0.2}>
  <Scene />
  <Scroll html><section style={{ height: '100vh' }}>...</section></Scroll>
</ScrollControls>

function Scene() {
  const scroll = useScroll();
  useFrame(() => {
    const r1 = scroll.range(0, 1 / 3);         // 0..1 durante el primer tercio
    camera.position.z = 6 - r1 * 3;
  });
}
```

Ventaja: todo en el canvas, sin dependencias. Inconvenientes: secuestra el scroll de la página (no es el scroll nativo del documento), difícil de mezclar con layouts normales, anclas, header sticky, y accesibilidad de scroll.

**GSAP ScrollTrigger**: el scroll es el del documento; el canvas es `position: sticky/fixed` y los tweens mutan cámara/objetos con `scrub`. Recomendado cuando el 3D acompaña a secciones HTML reales (caso habitual en landings). Ver `gsap-three.md`. En R3F, crea el timeline en `useLayoutEffect`/`useGSAP` (`@gsap/react`) con refs a los objetos; con `frameloop="demand"` llama a `invalidate()` en `onUpdate`.

Tercera vía: `lenis` para smooth scroll + ScrollTrigger (`lenis.on('scroll', ScrollTrigger.update)`).

## 7. Postprocesado: `@react-three/postprocessing`

```tsx
import { EffectComposer, Bloom, SMAA, Vignette, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

<EffectComposer multisampling={isMobile ? 0 : 4} enableNormalPass={false}>
  <Bloom intensity={0.6} luminanceThreshold={0.85} mipmapBlur />
  <Vignette eskil={false} offset={0.1} darkness={0.6} />
  <SMAA />
  <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
</EffectComposer>
```

- Todos los efectos hijos se fusionan en un `EffectPass`. Ordena: efectos de escena (AO, bloom) → color (vignette, tone mapping) → AA.
- Con composer, el tone mapping del renderer se ignora en la salida: añade `<ToneMapping>` al final o pon `gl={{ toneMapping: NoToneMapping }}` y deja que el composer lo haga.
- `N8AO` es el AO recomendado (más barato que SSAO), pero sigue sin ser para móvil.
- Bloom "selectivo": `emissiveIntensity` alto en el material objetivo + `luminanceThreshold` en vez de `Selection`/layers cuando puedas.

## 8. Leva (debug)

```tsx
import { useControls, folder, button } from 'leva';

function Lights() {
  const { intensity, position, color } = useControls('Sun', {
    intensity: { value: 2.5, min: 0, max: 10, step: 0.1 },
    position: { value: [4, 6, 3] },
    color: '#ffffff',
    reset: button(() => console.log('reset')),
  });
  return <directionalLight intensity={intensity} position={position} color={color} castShadow />;
}
// Ocultar en producción: <Leva hidden={process.env.NODE_ENV === 'production'} /> en el root, o carga Leva con dynamic solo en dev
```

Leva re-renderiza el componente en cada cambio; para valores que se animan por frame usa `useControls` con `onChange` y muta refs. `r3f-perf` (`<Perf position="top-left" />`) muestra draw calls, triángulos, memoria y tiempo GPU.

## 9. Eventos de puntero

```tsx
<mesh
  onClick={(e) => { e.stopPropagation(); select(e.object); }}
  onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
  onPointerOut={() => setHovered(false)}
  onPointerMove={(e) => e.uv && setUv(e.uv)}
>
```

- `e.stopPropagation()` evita que el evento alcance objetos detrás.
- `useCursor(hovered)` de drei cambia el cursor.
- Eventos en muchos objetos = raycast en cada `pointermove`. Usa `<Bvh>` de drei (three-mesh-bvh) para mallas densas, `raycast={() => null}` en objetos que no lo necesitan, y `events={{ filter: ... }}` en `<Canvas>`.
- `setHovered` en `onPointerOver` sí es aceptable (evento discreto), a diferencia de en `useFrame`.

## 10. Disposal y estado

- R3F dispone automáticamente geometrías, materiales y texturas creadas declarativamente al desmontar (`dispose={null}` en un elemento para impedirlo, p. ej. objetos cacheados por `useGLTF` que reutilizas). Los objetos de `useLoader` quedan en caché; `useGLTF.clear(url)` para liberarlos.
- Al navegar entre rutas de Next el `<Canvas>` se desmonta y libera el contexto. Si el canvas vive en `layout.tsx` (persistente), controla `frameloop` según la ruta.
- Estado compartido entre HTML y canvas: `zustand` (el mismo store se lee fuera y dentro del canvas). El contexto de React **no atraviesa** el `<Canvas>` (es un root distinto) salvo con `useContextBridge` de drei o pasando el provider dentro.
- Cualquier `useEffect` que cree objetos Three imperativos debe devolver su `dispose`.

Ver `templates/HeroScene.tsx` para el componente completo con Next dynamic, reduced-motion y overlay de carga.
