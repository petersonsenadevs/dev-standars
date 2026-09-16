/**
 * useGsap — composable Vue 3 que envuelve gsap.context en el ciclo de vida del componente.
 *
 * - Ejecuta `fn` en onMounted (DOM disponible) dentro de un gsap.context con `scope` opcional.
 * - Revierte todo (tweens, timelines, ScrollTriggers, SplitText, matchMedia) en onBeforeUnmount.
 * - SSR-safe: no toca `window` en servidor.
 * - `fn` puede devolver una función de cleanup para recursos ajenos a GSAP (listeners, observers).
 *
 * Uso:
 *   const root = ref<HTMLElement | null>(null);
 *   const { add } = useGsap(() => {
 *     gsap.from('.card', { y: 30, autoAlpha: 0, stagger: 0.1 });
 *   }, root);
 */
import { onMounted, onBeforeUnmount, onUnmounted, ref, type Ref } from 'vue';
import { gsap } from '@/lib/gsap';

type Cleanup = void | (() => void);
export type GsapCallback = (self: gsap.Context) => Cleanup;

export interface UseGsapReturn {
  /** Devuelve el contexto activo (undefined antes de montar o tras revertir). */
  ctx: () => gsap.Context | undefined;
  /** Añade animaciones al contexto después del mount (p. ej. tras nextTick en un watch). */
  add: (fn: (self: gsap.Context) => void) => void;
  /** Revierte manualmente (se llama automáticamente en unmount). */
  revert: () => void;
  /** Recrea el contexto ejecutando `fn` de nuevo (útil tras cambios de datos grandes). */
  rerun: () => void;
}

export function useGsap(fn: GsapCallback, scope?: Ref<HTMLElement | null | undefined>): UseGsapReturn {
  let ctx: gsap.Context | undefined;
  let cleanup: Cleanup;

  const create = () => {
    if (import.meta.env.SSR || typeof window === 'undefined') return;
    ctx = gsap.context((self) => {
      cleanup = fn(self);
    }, scope?.value ?? undefined);
  };

  const revert = () => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = undefined;
    ctx?.revert();
    ctx = undefined;
  };

  onMounted(create);
  onBeforeUnmount(revert);

  return {
    ctx: () => ctx,
    add: (f) => {
      if (!ctx) return;
      ctx.add(() => f(ctx!));
    },
    revert,
    rerun: () => {
      revert();
      create();
    },
  };
}

/**
 * usePrefersReducedMotion — ref reactivo con la preferencia del usuario.
 */
export function usePrefersReducedMotion(): Ref<boolean> {
  const reduce = ref(false);
  let mq: MediaQueryList | undefined;
  const onChange = (e: MediaQueryListEvent) => (reduce.value = e.matches);

  onMounted(() => {
    mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduce.value = mq.matches;
    mq.addEventListener('change', onChange);
  });
  onUnmounted(() => mq?.removeEventListener('change', onChange));

  return reduce;
}
