/**
 * useLenis — instancia única de Lenis sincronizada con ScrollTrigger y el ticker de GSAP.
 *
 * Instalar: npm i lenis
 * Importar CSS (opcional, recomendado): import 'lenis/dist/lenis.css'
 *
 * Uso en el layout persistente de Inertia:
 *   const { lenis, scrollTo, stop, start } = useLenis();
 *
 * Fuera de componentes (app.ts):
 *   initLenis(); router.on('navigate', () => { getLenis()?.scrollTo(0, { immediate: true }); ScrollTrigger.refresh(); });
 */
import Lenis, { type LenisOptions, type ScrollToOptions } from 'lenis';
import { onMounted, onBeforeUnmount } from 'vue';
import { gsap, ScrollTrigger } from '@/lib/gsap';

let lenis: Lenis | null = null;
let raf: ((time: number) => void) | null = null;

const DEFAULTS: LenisOptions = {
  lerp: 0.1,
  smoothWheel: true,
  syncTouch: false, // true solo si quieres smooth también en touch (coste en móviles)
  autoRaf: false,   // el raf lo dirige gsap.ticker
};

export function initLenis(options: LenisOptions = {}): Lenis | null {
  if (import.meta.env.SSR || typeof window === 'undefined') return null;
  if (lenis) return lenis;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  lenis = new Lenis({ ...DEFAULTS, ...options });

  lenis.on('scroll', ScrollTrigger.update);

  raf = (time: number) => lenis?.raf(time * 1000); // ticker en segundos, Lenis en ms
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

export function destroyLenis(): void {
  if (raf) gsap.ticker.remove(raf);
  lenis?.off('scroll', ScrollTrigger.update);
  lenis?.destroy();
  lenis = null;
  raf = null;
}

export function getLenis(): Lenis | null {
  return lenis;
}

export function useLenis(options: LenisOptions = {}) {
  onMounted(() => initLenis(options));
  // Solo destruir si el componente que lo creó (layout persistente) se desmonta de verdad
  onBeforeUnmount(destroyLenis);

  return {
    lenis: getLenis,
    scrollTo: (target: number | string | HTMLElement, opts?: ScrollToOptions) => {
      if (lenis) lenis.scrollTo(target, opts);
      else if (typeof target === 'number') window.scrollTo({ top: target });
      else (typeof target === 'string' ? document.querySelector(target) : target)?.scrollIntoView();
    },
    /** Bloquear scroll (modales, menús). */
    stop: () => lenis?.stop(),
    start: () => lenis?.start(),
  };
}

/**
 * Enlaces de ancla internos con offset del header.
 * document.addEventListener('click', anchorHandler(-80))
 */
export function anchorHandler(offset = 0) {
  return (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const target = document.querySelector(a.getAttribute('href')!);
    if (!target) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(target as HTMLElement, { offset }) : target.scrollIntoView({ behavior: 'smooth' });
  };
}
