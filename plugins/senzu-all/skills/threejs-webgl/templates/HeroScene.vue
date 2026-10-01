<script setup lang="ts">
/**
 * HeroScene.vue (TresJS)
 *
 * Canvas hero con modelo GLTF, luces, environment y OrbitControls opcional.
 * Carga en el padre con defineAsyncComponent + v-if="mounted" para no evaluar
 * Three en SSR (Inertia) y mantener `three` fuera del bundle inicial:
 *
 *   const HeroScene = defineAsyncComponent(() => import('@/Components/Three/HeroScene.vue'));
 *   const mounted = ref(false); onMounted(() => (mounted.value = true));
 *   <HeroScene v-if="mounted" model-url="/models/hero.glb" />
 *
 * Requiere `templateCompilerOptions` de @tresjs/core en vite.config.ts.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { TresCanvas } from '@tresjs/core';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import HeroContent from './HeroContent.vue';
import { useWebGLSupport } from '@/composables/useWebGLSupport';

const props = withDefaults(
  defineProps<{
    modelUrl: string;
    hdriUrl?: string;
    poster?: string;
    controls?: boolean;
    autoRotate?: boolean;
    transparent?: boolean;
  }>(),
  { hdriUrl: undefined, poster: undefined, controls: true, autoRotate: true, transparent: true },
);

const emit = defineEmits<{ ready: []; error: [error: unknown] }>();

const { supported, reducedMotion } = useWebGLSupport();

const root = shallowRef<HTMLElement>();
const inView = ref(false);
const ready = ref(false);
const progress = ref(0);

const isMobile = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const dpr = computed<[number, number]>(() => [1, isMobile ? 1.5 : 2]);

// Monta el canvas solo cuando el contenedor se acerca al viewport.
let io: IntersectionObserver | null = null;
onMounted(() => {
  if (!root.value) return;
  io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        inView.value = true;
        io?.disconnect();
        io = null;
      }
    },
    { rootMargin: '200px' },
  );
  io.observe(root.value);
});
onBeforeUnmount(() => io?.disconnect());

function onReady() {
  ready.value = true;
  emit('ready');
}

watch(progress, (value) => {
  root.value?.style.setProperty('--hero-progress', String(value));
});
</script>

<template>
  <div ref="root" class="hero-scene" :class="{ 'is-ready': ready }">
    <img v-if="poster" :src="poster" alt="" aria-hidden="true" class="hero-scene__poster" />

    <div
      v-if="!ready && supported && inView"
      class="hero-scene__loading"
      role="progressbar"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Cargando escena 3D"
    >
      <span class="hero-scene__bar" />
    </div>

    <TresCanvas
      v-if="supported && inView"
      class="hero-scene__canvas"
      shadows
      :alpha="transparent"
      :dpr="dpr"
      :antialias="true"
      power-preference="high-performance"
      :tone-mapping="ACESFilmicToneMapping"
      :output-color-space="SRGBColorSpace"
      :shadow-map-type="PCFSoftShadowMap"
      :clear-color="transparent ? undefined : '#0b0b0f'"
      aria-hidden="true"
    >
      <HeroContent
        :model-url="modelUrl"
        :hdri-url="hdriUrl"
        :controls="controls"
        :auto-rotate="autoRotate && !reducedMotion"
        :reduced-motion="reducedMotion"
        @progress="progress = $event"
        @ready="onReady"
        @error="emit('error', $event)"
      />
    </TresCanvas>
  </div>
</template>

<style scoped>
.hero-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
}

.hero-scene__poster,
.hero-scene__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.hero-scene__poster {
  object-fit: cover;
  transition: opacity 600ms ease;
}

.hero-scene.is-ready .hero-scene__poster {
  opacity: 0;
}

.hero-scene__canvas {
  opacity: 0;
  transition: opacity 600ms ease;
  touch-action: pan-y; /* no secuestrar el scroll vertical en móvil */
}

.hero-scene.is-ready .hero-scene__canvas {
  opacity: 1;
}

.hero-scene__loading {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgb(255 255 255 / 0.15);
}

.hero-scene__bar {
  display: block;
  height: 100%;
  width: 100%;
  transform-origin: left;
  transform: scaleX(var(--hero-progress, 0));
  background: currentColor;
  transition: transform 200ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .hero-scene__poster,
  .hero-scene__canvas,
  .hero-scene__bar {
    transition: none;
  }
}
</style>
