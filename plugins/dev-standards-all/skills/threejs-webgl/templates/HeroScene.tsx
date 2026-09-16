'use client';

/**
 * HeroScene.tsx (React Three Fiber + drei) para Next.js App Router.
 *
 * Uso desde un Client Component wrapper (next/dynamic con ssr:false no puede
 * llamarse en Server Components):
 *
 *   'use client';
 *   import dynamic from 'next/dynamic';
 *   const HeroScene = dynamic(() => import('./HeroScene').then((m) => m.HeroScene), { ssr: false });
 *   export function HeroSection() {
 *     return (
 *       <section className="relative h-[80vh]">
 *         <Image src="/images/hero-poster.webp" alt="" fill priority className="object-cover" aria-hidden />
 *         <HeroScene modelUrl="/models/hero.glb" />
 *       </section>
 *     );
 *   }
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Center,
  Html,
  Preload,
  useGLTF,
  useProgress,
  useAnimations,
} from '@react-three/drei';
import { ACESFilmicToneMapping, SRGBColorSpace, type Group } from 'three';
import { detectWebGLSupport } from './useWebGLSupport';

export interface HeroSceneProps {
  modelUrl: string;
  hdriUrl?: string;
  controls?: boolean;
  autoRotate?: boolean;
  transparent?: boolean;
  className?: string;
  onReady?: () => void;
}

export function HeroScene({
  modelUrl,
  hdriUrl,
  controls = true,
  autoRotate = true,
  transparent = true,
  className,
  onReady,
}: HeroSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [support] = useState(() => detectWebGLSupport());
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);

  // Monta el canvas cuando el contenedor se acerca al viewport.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  if (!support.supported) {
    // El poster del padre sigue visible; no renderizamos nada.
    return null;
  }

  const reducedMotion = support.reducedMotion;

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: reducedMotion ? 'none' : 'opacity 600ms ease' }}
      aria-hidden
    >
      {inView && (
        <Canvas
          shadows
          dpr={[1, support.pixelRatio]}
          camera={{ position: [0, 1.2, 5], fov: 45, near: 0.1, far: 100 }}
          gl={{
            antialias: true,
            alpha: transparent,
            powerPreference: 'high-performance',
            toneMapping: ACESFilmicToneMapping,
            outputColorSpace: SRGBColorSpace,
            stencil: false,
          }}
          frameloop={reducedMotion && !controls ? 'demand' : 'always'}
          style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());
          }}
        >
          <VisibilityPause rootRef={rootRef} />

          <hemisphereLight args={['#ffffff', '#444466', 0.5]} />
          <directionalLight
            position={[4, 6, 3]}
            intensity={2.5}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={0.5}
            shadow-camera-far={30}
            shadow-camera-left={-6}
            shadow-camera-right={6}
            shadow-camera-top={6}
            shadow-camera-bottom={-6}
            shadow-normalBias={0.02}
          />

          <Suspense fallback={<Loader />}>
            {hdriUrl ? (
              <Environment files={hdriUrl} background={false} blur={0.6} />
            ) : (
              <Environment preset="studio" background={false} blur={0.6} />
            )}
            <Center top>
              <Model url={modelUrl} spin={!controls && !reducedMotion} reducedMotion={reducedMotion} />
            </Center>
            <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={10} blur={2} far={4} resolution={512} frames={reducedMotion ? 1 : Infinity} />
            <Preload all />
            <ReadySignal onReady={() => setReady(true)} />
          </Suspense>

          {controls && (
            <OrbitControls
              makeDefault
              enableDamping
              enablePan={false}
              enableZoom={false}
              autoRotate={autoRotate && !reducedMotion}
              autoRotateSpeed={0.8}
              minPolarAngle={Math.PI * 0.2}
              maxPolarAngle={Math.PI * 0.5}
              target={[0, 0.6, 0]}
            />
          )}
        </Canvas>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------

function Model({ url, spin, reducedMotion }: { url: string; spin: boolean; reducedMotion: boolean }) {
  const group = useRef<Group>(null!);
  const { scene, animations } = useGLTF(url, '/draco/');
  const { actions } = useAnimations(animations, group);

  // scene está cacheado por URL: clónalo si el mismo modelo se monta varias veces.
  const object = useMemo(() => {
    scene.traverse((o) => {
      const mesh = o as unknown as { isMesh?: boolean; castShadow: boolean; receiveShadow: boolean };
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return scene;
  }, [scene]);

  useEffect(() => {
    if (reducedMotion) return;
    const first = Object.values(actions)[0];
    first?.reset().fadeIn(0.3).play();
    return () => {
      first?.fadeOut(0.2);
    };
  }, [actions, reducedMotion]);

  useFrame((_, delta) => {
    if (spin) group.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={group}>
      <primitive object={object} />
    </group>
  );
}

function Loader() {
  const { progress } = useProgress();
  const value = Math.round(progress);
  return (
    <Html center>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Cargando escena 3D"
        style={{ width: 160, height: 3, background: 'rgba(255,255,255,0.15)' }}
      >
        <div style={{ width: `${value}%`, height: '100%', background: 'currentColor', transition: 'width 200ms ease' }} />
      </div>
    </Html>
  );
}

/** Se monta cuando todo el subárbol Suspense ha resuelto: primer frame listo. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let cancelled = false;
    gl.compileAsync(scene, camera).then(() => {
      if (!cancelled) onReady();
    });
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, onReady]);
  return null;
}

/** Pausa el loop cuando el canvas sale del viewport o la pestaña se oculta. */
function VisibilityPause({ rootRef }: { rootRef: React.RefObject<HTMLDivElement | null> }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const frameloop = useRef<'always' | 'demand' | 'never'>('always');
  const inView = useRef(true);
  const visible = useRef(!document.hidden);

  useEffect(() => {
    const sync = () => setFrameloop(inView.current && visible.current ? frameloop.current : 'never');
    const el = rootRef.current;
    const io = el
      ? new IntersectionObserver(([entry]) => {
          inView.current = entry.isIntersecting;
          sync();
        }, { threshold: 0.01, rootMargin: '100px' })
      : null;
    if (el) io?.observe(el);
    const onVis = () => {
      visible.current = !document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [rootRef, setFrameloop]);

  return null;
}

// Opcional, a nivel de módulo en la página que sabe la URL: arranca la descarga antes del mount.
// useGLTF.preload('/models/hero.glb', '/draco/');
