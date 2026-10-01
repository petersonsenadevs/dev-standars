/**
 * scene-astro.ts: arranque de escenas Three.js vanilla en Astro con View Transitions.
 *
 * Markup esperado (componente .astro):
 *
 *   <div class="hero" data-three-root>
 *     <img src={poster} alt="" class="hero__poster" aria-hidden="true" />
 *     <canvas data-three-canvas data-model-url="/models/hero.glb" data-hdri-url="/hdri/studio_1k.hdr" aria-hidden="true"></canvas>
 *   </div>
 *   <script>
 *     import { registerThreeLifecycle } from '@/three/scene-astro';
 *     registerThreeLifecycle();
 *   </script>
 *
 * El script de Astro se evalúa una sola vez por sesión (módulo); por eso el
 * montaje se engancha a `astro:page-load` (que también se dispara en la primera
 * carga) y el dispose a `astro:before-swap`.
 */
import type { SceneOptions } from './scene';

interface Handle {
  dispose(): void;
}

const instances = new Map<HTMLCanvasElement, Handle | Promise<Handle | null>>();
let registered = false;

function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

async function mountCanvas(canvas: HTMLCanvasElement): Promise<Handle | null> {
  const root = canvas.closest<HTMLElement>('[data-three-root]') ?? (canvas.parentElement as HTMLElement);

  if (!hasWebGL2()) {
    root.dataset.threeState = 'unsupported'; // el poster permanece visible
    return null;
  }

  // Chunk lazy: `three` solo se descarga cuando el canvas está cerca del viewport.
  const { HeroScene } = await import('./scene');

  const options: SceneOptions & { modelUrl?: string; hdriUrl?: string } = {
    canvas,
    container: root,
    modelUrl: canvas.dataset.modelUrl,
    hdriUrl: canvas.dataset.hdriUrl,
    alpha: canvas.dataset.alpha !== 'false',
    controls: canvas.dataset.controls === 'true',
    reducedMotion: prefersReducedMotion(),
    onProgress: (ratio) => root.style.setProperty('--three-progress', String(ratio)),
    onContextLost: () => (root.dataset.threeState = 'lost'),
    onContextRestored: () => (root.dataset.threeState = 'ready'),
  };

  const scene = new HeroScene(options);
  root.dataset.threeState = 'loading';
  try {
    await scene.init();
    root.dataset.threeState = 'ready';
  } catch (error) {
    console.error('[three] init failed', error);
    root.dataset.threeState = 'error';
    scene.dispose();
    return null;
  }
  return scene;
}

/** Observa los canvases del documento y monta cada uno cuando se acerca al viewport. */
export function mountThreeScenes(root: ParentNode = document): void {
  const canvases = root.querySelectorAll<HTMLCanvasElement>('[data-three-canvas]');
  if (!canvases.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const canvas = entry.target as HTMLCanvasElement;
        io.unobserve(canvas);
        if (instances.has(canvas)) continue;
        const pending = mountCanvas(canvas);
        instances.set(canvas, pending);
        pending.then((handle) => {
          // Si se hizo dispose mientras cargaba, libera inmediatamente.
          if (!instances.has(canvas)) handle?.dispose();
          else if (handle) instances.set(canvas, handle);
          else instances.delete(canvas);
        });
      }
    },
    { rootMargin: '200px' },
  );
  canvases.forEach((c) => io.observe(c));
}

/** Libera todas las escenas montadas (antes de que Astro sustituya el body). */
export function disposeThreeScenes(): void {
  for (const [canvas, handle] of instances) {
    instances.delete(canvas);
    if (handle instanceof Promise) handle.then((h) => h?.dispose());
    else handle.dispose();
  }
}

/** Registra los hooks de View Transitions una sola vez. */
export function registerThreeLifecycle(): void {
  if (registered) return;
  registered = true;

  // Primera carga y cada navegación con <ClientRouter />.
  document.addEventListener('astro:page-load', () => mountThreeScenes(), { passive: true });
  // Antes del swap del body: parar loops y liberar GPU del documento saliente.
  document.addEventListener('astro:before-swap', disposeThreeScenes);

  // Sin <ClientRouter />, astro:page-load no se dispara: monta también al cargar el DOM.
  // mountThreeScenes es idempotente por canvas (mapa `instances`), así que si ambos
  // eventos ocurren no se crea la escena dos veces.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountThreeScenes(), { once: true });
  } else {
    mountThreeScenes();
  }

  // HMR en desarrollo: evita acumular contextos WebGL.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => disposeThreeScenes());
  }
}
