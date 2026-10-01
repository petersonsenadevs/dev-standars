/**
 * gsap-astro.ts — ciclo de vida de animaciones GSAP con Astro View Transitions (<ClientRouter />).
 *
 * Importar UNA vez en el layout base:
 *   <script>import '@/lib/gsap-astro';</script>
 *
 * En cualquier componente .astro:
 *   <script>
 *     import { gsap } from '@/lib/gsap';
 *     import { onPageAnimations } from '@/lib/gsap-astro';
 *     onPageAnimations(() => {
 *       document.querySelectorAll<HTMLElement>('[data-cards]').forEach((root) => {
 *         gsap.context(() => { gsap.from('.card', { y: 30, autoAlpha: 0, stagger: 0.08 }); }, root);
 *       });
 *     });
 *   </script>
 *
 * Funcionamiento:
 * - Los <script> de Astro se ejecutan una sola vez por sesión (deduplicados), así que
 *   `onPageAnimations` registra el init una vez; el init se re-ejecuta en cada `astro:page-load`.
 * - En `astro:before-swap` se revierte el contexto y se matan los ScrollTriggers restantes.
 * - Sin <ClientRouter />, `astro:page-load` se dispara igualmente en la carga inicial.
 */
import { gsap, ScrollTrigger } from '@/lib/gsap';

type Init = (ctx: gsap.Context) => void | (() => void);

const inits = new Set<Init>();
const cleanups = new Set<() => void>();
let ctx: gsap.Context | null = null;
let mounted = false;

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Registra una función que se ejecutará en cada carga de página. */
export function onPageAnimations(init: Init): () => void {
  inits.add(init);
  // si la página ya está montada (script cargado tarde, p. ej. island), ejecutar ahora
  if (mounted && ctx) runInit(init);
  return () => inits.delete(init);
}

function runInit(init: Init) {
  ctx!.add(() => {
    const c = init(ctx!);
    if (typeof c === 'function') cleanups.add(c);
  });
}

function mount() {
  if (ctx) unmount(); // seguridad ante doble page-load
  ctx = gsap.context(() => {});
  inits.forEach(runInit);
  mounted = true;

  requestAnimationFrame(() => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

function unmount() {
  cleanups.forEach((c) => c());
  cleanups.clear();
  ctx?.revert();
  ctx = null;
  // por si algo se creó fuera del contexto
  ScrollTrigger.getAll().forEach((t) => t.kill());
  mounted = false;
}

document.addEventListener('astro:page-load', mount);
document.addEventListener('astro:before-swap', unmount);

/* -------------------------------------------------------------------------- */
/* Transición de página con GSAP (opcional)                                    */
/* Requiere transition:animate="none" en <main> para no duplicar con las CSS   */
/* -------------------------------------------------------------------------- */

export function enableGsapPageTransition(selector = 'main') {
  document.addEventListener('astro:before-preparation', (ev) => {
    if (prefersReducedMotion()) return;
    const e = ev as Event & { loader: () => Promise<void> };
    const original = e.loader;
    e.loader = async () => {
      await gsap.to(selector, { autoAlpha: 0, y: -12, duration: 0.25, ease: 'power2.in' });
      await original();
    };
  });

  document.addEventListener('astro:after-swap', () => {
    if (prefersReducedMotion()) return;
    gsap.set(selector, { autoAlpha: 0, y: 12 });
  });

  document.addEventListener('astro:page-load', () => {
    if (prefersReducedMotion()) return;
    gsap.to(selector, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform' });
  });
}

/* -------------------------------------------------------------------------- */
/* Lenis global (opcional): sobrevive a las View Transitions                   */
/* -------------------------------------------------------------------------- */

export async function enableLenis() {
  if (prefersReducedMotion()) return null;
  const { default: Lenis } = await import('lenis');
  const lenis = new Lenis({ lerp: 0.1, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.addEventListener('astro:after-swap', () => {
    // resetear solo en navegación hacia delante; Astro restaura scroll en back/forward
    if (!(history.state && history.state.scrollY)) lenis.scrollTo(0, { immediate: true });
  });

  return lenis;
}
