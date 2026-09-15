# React Three Fiber en Next.js 16 (App Router)

Índice: 1 instalación · 2 montaje con `next/dynamic` y Suspense · 3 escena base con drei · 4 estado y eventos ·
5 render bajo demanda y rendimiento · 6 fallbacks · 7 scroll y GSAP · 8 limpieza y navegación · 9 pitfalls.

## 1. Instalación

```bash
npm i three @react-three/fiber @react-three/drei
npm i -D @types/three
```

Referencia: `@react-three/fiber` 9 (React 19), `@react-three/drei` 10, `three` r170+. `transpilePackages: ['three']`
solo si un paquete importa `three/examples/jsm` en CommonJS. Modelos en `public/models/*.glb` optimizados con
`npx @gltf-transform/cli optimize in.glb out.glb --texture-compress webp`.

## 2. Montaje: `next/dynamic` con `ssr: false` + Suspense

```tsx
// components/three/HeroScene.tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { Model } from "./Model";

export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.2, 5], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <Suspense fallback={null}><Model /></Suspense>
    </Canvas>
  );
}
```

```tsx
// components/three/HeroSceneLoader.tsx
"use client";
import dynamic from "next/dynamic";
import { useWebGLSupport } from "./useWebGLSupport";
const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => <HeroPoster /> });

export function HeroSceneLoader() {
  const ok = useWebGLSupport(); // null en SSR, boolean tras montar
  return ok === false ? <HeroPoster /> : <HeroScene />;
}
```

- `dynamic` con `ssr: false` solo funciona dentro de un Client Component; `page.tsx` (Server Component) renderiza
  `<HeroSceneLoader />` junto al H1 y CTA en HTML.
- `HeroPoster` es un `next/image` con `priority` del mismo encuadre: mantiene el LCP y sirve de fallback.
- Padre con `position: relative` y altura definida; canvas `absolute inset-0`. Progreso de carga: `useProgress()`
  de drei en un overlay `role="status" aria-live="polite"` fuera del canvas.

## 3. Escena base con drei

```tsx
"use client";
import { useGLTF, Environment, ContactShadows, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

export function Model() {
  const group = useRef<Group>(null!);
  const { scene } = useGLTF("/models/product.glb");
  useFrame((state, delta) => {
    group.current.rotation.y += (state.pointer.x * 0.4 - group.current.rotation.y) * Math.min(delta * 4, 1);
  });
  return (
    <>
      <group ref={group}><primitive object={scene} /></group>
      <Environment preset="city" />
      <ContactShadows position={[0, -1, 0]} opacity={0.4} blur={2.5} far={4} />
      <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={1} maxPolarAngle={1.8} enableDamping />
    </>
  );
}
useGLTF.preload("/models/product.glb");
```

`npx gltfjsx public/models/product.glb --types` genera el componente con nodos y materiales tipados. `Environment`
con `files="/hdr/studio.hdr"` propio si el preset (descarga externa) no está permitido.

## 4. Estado y eventos

- Estado global (color, variante): Zustand fuera del canvas; dentro, `useStore(s => s.color)` aplicado en `useEffect`
  sobre `material.color.set(color)` + `invalidate()`.
- Eventos: `<mesh onPointerOver={(e) => { e.stopPropagation(); setHover(true) }} onClick=…>`; el cursor se cambia en
  un efecto, no en `useFrame`.

## 5. Render bajo demanda y rendimiento

| Situación | Configuración |
|---|---|
| Configurador, visor, escena quieta | `frameloop="demand"`; `invalidate()` tras cambiar estado; `OrbitControls` invalida solo |
| Animación continua | `frameloop="always"`, pero `frameloop="never"` cuando el canvas sale del viewport (`useInView`) o la pestaña se oculta |
| Móvil con FPS bajo | `<AdaptiveDpr pixelated />` + `<PerformanceMonitor onDecline={() => setQuality("low")}>` |
| Muchos objetos | `<instancedMesh args={[undefined, undefined, count]}>` + `Object3D` temporal para `setMatrixAt` |

## 6. Fallbacks

```tsx
// components/three/useWebGLSupport.ts
"use client";
import { useEffect, useState } from "react";
export function useWebGLSupport() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { const c = document.createElement("canvas"); setOk(!!(c.getContext("webgl2") || c.getContext("webgl"))); }, []);
  return ok;
}
```

- `prefers-reduced-motion`: `useReducedMotion()` (Motion) o `matchMedia`; sin autorotación; `frameloop="demand"`.
- `webglcontextlost`: en `onCreated`, `gl.domElement.addEventListener("webglcontextlost", e => { e.preventDefault(); setLost(true) })` y mostrar el poster.
- Sin JS: el poster ya está en el HTML de servidor; el 3D es mejora progresiva.

## 7. Scroll y GSAP

- Scroll **dentro** del canvas (galería, storytelling en viewport fijo): drei `ScrollControls pages={3} damping={0.2}` +
  `useScroll()` en `useFrame` (`scroll.offset`, `scroll.range(0, 1/3)`).
- Scroll **de página** (secciones HTML que mueven la cámara): GSAP ScrollTrigger con `useGSAP` sobre refs de Three;
  patrón en `threejs-webgl/references/es/gsap-three.md`. GSAP se registra una vez en `lib/gsap.ts`.
- No combinar `ScrollControls` con Lenis/ScrollTrigger sobre el mismo scroll.

## 8. Limpieza y navegación

- Al desmontar JSX, R3F llama `dispose()` de geometrías y materiales; lo imperativo (`useMemo(() => new WebGLRenderTarget())`,
  `TextureLoader` manual) se libera en el cleanup del efecto. `useGLTF.clear(url)` si el modelo no se reutiliza.
- El Client Component del canvas se desmonta al cambiar de ruta salvo que viva en `layout.tsx`; solo ahí para escenas
  persistentes de fondo, cambiando `frameloop` según la ruta.

## 9. Pitfalls

| Síntoma | Causa | Solución |
|---|---|---|
| `window is not defined` | Import de three/R3F evaluado en servidor | `dynamic(..., { ssr: false })` desde Client Component |
| Canvas con altura 0 | Contenedor sin `height`/`position` | `relative h-[90vh]` en el padre, canvas `absolute inset-0` |
| Colores lavados u oscuros | Sin `outputColorSpace`/tone mapping o textura sin `colorSpace` | Config `gl` §2; `texture.colorSpace = SRGBColorSpace` solo en mapas de color |
| FPS cae, re-render por frame | `setState` en `useFrame` | Mutar refs; estado solo en eventos discretos |
| Memoria crece al navegar | Render targets/texturas manuales sin dispose; `useGLTF` sin `clear` | Cleanup en efectos; `useGLTF.clear` |
| Modelo negro | Sin luces ni `Environment` con material PBR | `Environment` + `directionalLight`; `MeshBasicMaterial` si es unlit |
