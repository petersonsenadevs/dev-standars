<script setup lang="ts">
/**
 * HorizontalScroll — sección pineada cuyo contenido se desplaza en horizontal con el scroll vertical.
 *
 * <HorizontalScroll>
 *   <div class="panel">1</div>
 *   <div class="panel">2</div>
 *   <div class="panel">3</div>
 * </HorizontalScroll>
 *
 * - Desktop (>= breakpoint): pin + scrub 1:1.
 * - Móvil / reduced motion: layout vertical normal (o scroll-snap horizontal nativo con `mobile="snap"`).
 * - Expone `scrollTween` por slot scoped para animar hijos con `containerAnimation`.
 */
import { ref, shallowRef } from 'vue';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { useGsap } from '@/composables/useGsap';

const props = withDefaults(
  defineProps<{
    /** Media query para activar el modo horizontal. */
    breakpoint?: string;
    /** Suavizado del scrub (s). */
    scrub?: number | boolean;
    /** Comportamiento en móvil: 'stack' (vertical) o 'snap' (carrusel nativo). */
    mobile?: 'stack' | 'snap';
    /** Padding horizontal extra al final (px) para que el último panel no quede pegado. */
    endPadding?: number;
  }>(),
  { breakpoint: '(min-width: 1024px)', scrub: 1, mobile: 'stack', endPadding: 0 },
);

const root = ref<HTMLElement | null>(null);
const track = ref<HTMLElement | null>(null);
const scrollTween = shallowRef<gsap.core.Tween | null>(null);

useGsap(() => {
  const section = root.value;
  const el = track.value;
  if (!section || !el) return;

  const mm = gsap.matchMedia();

  mm.add(
    { horizontal: `${props.breakpoint} and (prefers-reduced-motion: no-preference)` },
    () => {
      const distance = () => el.scrollWidth - section.clientWidth + props.endPadding;

      scrollTween.value = gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: props.scrub,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          markers: import.meta.env.DEV && false,
        },
      });

      // recalcular si cambian las imágenes de los paneles
      const onLoad = () => ScrollTrigger.refresh();
      window.addEventListener('load', onLoad);

      return () => {
        window.removeEventListener('load', onLoad);
        scrollTween.value = null;
      };
    },
  );
}, root);
</script>

<template>
  <section ref="root" class="h-scroll" :data-mobile="mobile">
    <div ref="track" class="h-scroll__track">
      <slot :scroll-tween="scrollTween" />
    </div>
  </section>
</template>

<style scoped>
.h-scroll {
  overflow: hidden; /* aquí, nunca en un ancestro */
}

.h-scroll__track {
  display: flex;
  width: max-content;
  min-height: 100svh;
}

.h-scroll__track > :deep(*) {
  flex: 0 0 auto;
  width: 100vw;
}

/* Móvil: apilado vertical */
@media (max-width: 1023px) {
  .h-scroll[data-mobile='stack'] .h-scroll__track {
    flex-direction: column;
    width: auto;
    min-height: 0;
  }
  .h-scroll[data-mobile='stack'] .h-scroll__track > :deep(*) {
    width: auto;
  }

  /* Móvil: carrusel nativo con snap */
  .h-scroll[data-mobile='snap'] {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .h-scroll[data-mobile='snap'] .h-scroll__track {
    min-height: 0;
  }
  .h-scroll[data-mobile='snap'] .h-scroll__track > :deep(*) {
    scroll-snap-align: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .h-scroll .h-scroll__track {
    flex-direction: column;
    width: auto;
    min-height: 0;
  }
  .h-scroll .h-scroll__track > :deep(*) {
    width: auto;
  }
}
</style>
