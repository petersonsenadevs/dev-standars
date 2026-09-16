<script setup lang="ts">
/**
 * ScrollReveal — wrapper que revela su contenido al entrar en el viewport.
 *
 * <ScrollReveal :y="40" :stagger="0.08" once>
 *   <article class="card" v-for="..." />   <!-- con stagger, anima los hijos directos -->
 * </ScrollReveal>
 *
 * - Sin `stagger`: anima el propio wrapper.
 * - Con `stagger` > 0: anima los hijos directos del wrapper de forma escalonada.
 * - Respeta prefers-reduced-motion (muestra el contenido sin animar).
 * - Oculto por CSS mientras JS controla (evita FOUC con SSR); visible sin JS.
 */
import { ref } from 'vue';
import { gsap } from '@/lib/gsap';
import { useGsap } from '@/composables/useGsap';

const props = withDefaults(
  defineProps<{
    /** Desplazamiento vertical inicial en px. */
    y?: number;
    /** Desplazamiento horizontal inicial en px. */
    x?: number;
    /** Retardo entre hijos (s). 0 = anima el wrapper completo. */
    stagger?: number;
    /** Solo una vez (true) o revierte al salir por arriba (false). */
    once?: boolean;
    /** Punto de disparo (ScrollTrigger start). */
    start?: string;
    duration?: number;
    delay?: number;
    ease?: string;
    /** Etiqueta HTML del wrapper. */
    tag?: string;
  }>(),
  {
    y: 32,
    x: 0,
    stagger: 0,
    once: true,
    start: 'top 85%',
    duration: 0.7,
    delay: 0,
    ease: 'power3.out',
    tag: 'div',
  },
);

const root = ref<HTMLElement | null>(null);

useGsap(() => {
  const el = root.value;
  if (!el) return;

  const targets: Element[] | HTMLElement = props.stagger > 0 ? Array.from(el.children) : el;

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set([el, ...Array.from(el.children)], { clearProps: 'all', visibility: 'visible' });
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // El wrapper se muestra siempre; si hay stagger los hijos son los que se ocultan
    if (props.stagger > 0) gsap.set(el, { visibility: 'visible' });

    gsap.fromTo(
      targets,
      { y: props.y, x: props.x, autoAlpha: 0 },
      {
        y: 0,
        x: 0,
        autoAlpha: 1,
        duration: props.duration,
        delay: props.delay,
        ease: props.ease,
        stagger: props.stagger > 0 ? props.stagger : 0,
        clearProps: 'transform',
        scrollTrigger: {
          trigger: el,
          start: props.start,
          once: props.once,
          toggleActions: props.once ? 'play none none none' : 'play none none reverse',
          markers: import.meta.env.DEV && false, // poner true puntualmente para depurar
        },
      },
    );
  });
}, root);
</script>

<template>
  <component :is="tag" ref="root" class="scroll-reveal">
    <slot />
  </component>
</template>

<style>
/* Oculto solo cuando JS está activo (html.js lo añade un script inline en <head>).
   Sin JS el contenido es visible. */
html.js .scroll-reveal {
  visibility: hidden;
}
</style>
