/**
 * Detección de soporte WebGL2, reduced motion, puntero grueso y presupuesto
 * aproximado del dispositivo. Devuelve refs de Vue; la función pura
 * `detectWebGLSupport()` sirve igual en React/vanilla.
 *
 * No importa `three` (evita meterlo en el bundle inicial): la comprobación
 * se hace con un canvas temporal, equivalente a WebGL.isWebGL2Available().
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export type DeviceTier = 'low' | 'mid' | 'high';

export interface WebGLSupport {
  supported: boolean;
  webgl2: boolean;
  reducedMotion: boolean;
  coarsePointer: boolean;
  tier: DeviceTier;
  maxTextureSize: number;
  /** Pixel ratio recomendado (cap). */
  pixelRatio: number;
}

export function detectWebGLSupport(): WebGLSupport {
  const fallback: WebGLSupport = {
    supported: false,
    webgl2: false,
    reducedMotion: false,
    coarsePointer: false,
    tier: 'low',
    maxTextureSize: 0,
    pixelRatio: 1,
  };
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = matchMedia('(pointer: coarse)').matches;

  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  let webgl2 = false;
  try {
    const canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    webgl2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl') ?? (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
  } catch {
    gl = null;
  }

  if (!gl) return { ...fallback, reducedMotion, coarsePointer };

  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  let tier: DeviceTier = 'mid';
  if (!webgl2 || cores <= 4 || memory <= 2 || maxTextureSize < 4096) tier = 'low';
  else if (cores >= 8 && memory >= 8 && !coarsePointer) tier = 'high';

  const pixelRatio = Math.min(window.devicePixelRatio, tier === 'high' ? 2 : tier === 'mid' ? 1.5 : 1);

  // Libera el contexto de prueba.
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  return { supported: true, webgl2, reducedMotion, coarsePointer, tier, maxTextureSize, pixelRatio };
}

/**
 * Composable Vue. `supported` es false hasta el mount (SSR-safe) para que el
 * canvas nunca se renderice en el servidor.
 */
export function useWebGLSupport(): {
  supported: Ref<boolean>;
  webgl2: Ref<boolean>;
  reducedMotion: Ref<boolean>;
  coarsePointer: Ref<boolean>;
  tier: Ref<DeviceTier>;
  pixelRatio: Ref<number>;
  checked: Ref<boolean>;
} {
  const supported = ref(false);
  const webgl2 = ref(false);
  const reducedMotion = ref(false);
  const coarsePointer = ref(false);
  const tier = ref<DeviceTier>('low');
  const pixelRatio = ref(1);
  const checked = ref(false);

  let media: MediaQueryList | null = null;
  const onMotionChange = (e: MediaQueryListEvent) => {
    reducedMotion.value = e.matches;
  };

  onMounted(() => {
    const info = detectWebGLSupport();
    supported.value = info.supported;
    webgl2.value = info.webgl2;
    reducedMotion.value = info.reducedMotion;
    coarsePointer.value = info.coarsePointer;
    tier.value = info.tier;
    pixelRatio.value = info.pixelRatio;
    checked.value = true;

    media = matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', onMotionChange);
  });

  onBeforeUnmount(() => media?.removeEventListener('change', onMotionChange));

  return { supported, webgl2, reducedMotion, coarsePointer, tier, pixelRatio, checked };
}
