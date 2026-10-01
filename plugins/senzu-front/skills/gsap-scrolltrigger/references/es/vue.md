# GSAP con Vue 3 + Inertia (Laravel)

## 1. Setup global

`resources/js/lib/gsap.ts` — único punto de registro de plugins y configuración:

```ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

if (!import.meta.env.SSR) {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: 'power2.out', duration: 0.6 });
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger, SplitText };
```

Importar siempre desde `@/lib/gsap`, nunca desde `gsap` directamente en componentes. Así el registro ocurre una vez y el código SSR no toca `window`.

## 2. Composable `useGsap`

Encapsula `gsap.context` en el ciclo de vida del componente. Template completo en `templates/useGsap.ts`.

```ts
// resources/js/composables/useGsap.ts
import { onMounted, onBeforeUnmount, type Ref } from 'vue';
import { gsap } from '@/lib/gsap';

type GsapFn = (self: gsap.Context) => void | (() => void);

export function useGsap(fn: GsapFn, scope?: Ref<HTMLElement | null>) {
  let ctx: gsap.Context | undefined;
  let cleanup: void | (() => void);

  onMounted(() => {
    if (import.meta.env.SSR) return;
    ctx = gsap.context((self) => { cleanup = fn(self); }, scope?.value ?? undefined);
  });

  onBeforeUnmount(() => {
    cleanup?.();
    ctx?.revert();
  });

  return {
    ctx: () => ctx,
    add: (f: () => void) => ctx?.add(f),
    revert: () => ctx?.revert(),
  };
}
```

Uso en componente:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { gsap } from '@/lib/gsap';
import { useGsap } from '@/composables/useGsap';

const root = ref<HTMLElement | null>(null);

useGsap(() => {
  // selectores con scope: solo busca dentro de root
  gsap.from('.card', { y: 30, autoAlpha: 0, stagger: 0.1, scrollTrigger: { trigger: '.card', start: 'top 85%' } });
}, root);
</script>

<template>
  <section ref="root">
    <article class="card" v-for="item in items" :key="item.id">...</article>
  </section>
</template>
```

Reglas:

- `onMounted` garantiza que el DOM existe; en `setup()` los refs aún son `null`.
- El `scope` evita que `.card` de otro componente sea capturado.
- `revert()` en unmount mata tweens y ScrollTriggers y restaura estilos: imprescindible con HMR y con Inertia (los componentes de página se desmontan al navegar).
- Para animar tras cambios reactivos: `await nextTick()` y luego `ctx.add(() => ...)`.

```ts
watch(() => props.items, async () => {
  await nextTick();
  add(() => gsap.from('.card:not(.seen)', { y: 20, autoAlpha: 0, stagger: 0.05 }));
});
```

## 3. Integración con el router de Inertia

Inertia reemplaza el componente de página al navegar. Problemas típicos: ScrollTriggers huérfanos de la página anterior, posiciones no recalculadas tras el swap, scroll restaurado antes de que existan los triggers.

`resources/js/app.ts`:

```ts
import { createInertiaApp, router } from '@inertiajs/vue3';
import { ScrollTrigger } from '@/lib/gsap';

createInertiaApp({ /* ... */ });

if (!import.meta.env.SSR) {
  // antes de que se monte la nueva página: limpiar lo que quede de la anterior
  router.on('before', () => {
    // no hacer nada aquí si usas transiciones de salida; ver sección 5
  });

  router.on('navigate', () => {
    // la página nueva ya está montada (onMounted de sus componentes ya se ejecutó)
    // los ScrollTriggers de la página anterior murieron con ctx.revert() en onBeforeUnmount
    requestAnimationFrame(() => ScrollTrigger.refresh());
  });

  router.on('finish', () => {
    // fin de la petición (incluye fallos y visits que no cambian de página, p. ej. formularios)
    ScrollTrigger.refresh();
  });
}
```

Cuándo usar `getAll().forEach(kill)`: si algún ScrollTrigger se creó fuera de un `gsap.context` (por ejemplo en un layout persistente o en un script global), mátalos manualmente:

```ts
router.on('start', (event) => {
  // solo en navegaciones reales (no reload parcial del mismo componente)
  if (event.detail.visit.url.pathname !== window.location.pathname) {
    ScrollTrigger.getAll().forEach((t) => t.vars.persist !== true && t.kill());
  }
});
```

Marca con `persist: true` (propiedad custom en vars) los triggers del layout (header oculto, progress bar) para no matarlos.

Restauración de scroll: Inertia restaura la posición con `preserveScroll`. Si tienes pins, la restauración puede ejecutarse antes del `refresh()`. Solución: `ScrollTrigger.clearScrollMemory('manual')` en `app.ts` y dejar que Inertia gestione el scroll; llamar a `refresh()` tras el `navigate`.

Reloads parciales (`router.reload({ only: ['posts'] })`): el componente no se desmonta. Usa `watch` + `nextTick` + `ctx.add` como arriba y `ScrollTrigger.refresh()` después.

## 4. Persistent layouts

El layout persistente no se desmonta entre páginas, así que sus animaciones viven todo el tiempo. Ideal para header, progress bar, cursor custom.

```vue
<!-- Layouts/AppLayout.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { useGsap } from '@/composables/useGsap';

const header = ref<HTMLElement | null>(null);

useGsap(() => {
  const show = gsap.from(header.value, { yPercent: -100, paused: true, duration: 0.3 }).progress(1);
  ScrollTrigger.create({
    start: 'top -80', end: 'max',
    onUpdate: (self) => (self.direction === -1 ? show.play() : show.reverse()),
    // @ts-expect-error prop custom para no matarlo en navegación
    persist: true,
  });
});
</script>
```

En la página:

```ts
import AppLayout from '@/Layouts/AppLayout.vue';
defineOptions({ layout: AppLayout });
```

Los triggers del layout siguen vivos entre páginas; solo necesitan `refresh()` tras cada navegación (ya cubierto en `router.on('navigate')`).

## 5. Transiciones de página

### 5.1 Entrada con timeline en `onMounted`

Cada página define su intro. Evita FOUC con `autoAlpha` inicial vía CSS (`.js .page-enter { visibility: hidden }`) y `fromTo`.

```vue
<script setup lang="ts">
const root = ref<HTMLElement | null>(null);

useGsap(() => {
  gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } })
    .fromTo('[data-intro]', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08 });
}, root);
</script>

<template>
  <main ref="root">
    <h1 data-intro>Título</h1>
    <p data-intro>Texto</p>
  </main>
</template>
```

### 5.2 Salida + entrada con `<Transition>` de Vue

Inertia renderiza el componente de página en `App`. Envuélvelo en un `<Transition>` con hooks JS para que GSAP controle salida y entrada. En `app.ts`:

```ts
import { createInertiaApp } from '@inertiajs/vue3';
import { createApp, h } from 'vue';
import PageTransition from '@/Components/PageTransition.vue';

createInertiaApp({
  resolve: (name) => resolvePageComponent(`./Pages/${name}.vue`, import.meta.glob('./Pages/**/*.vue')),
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(PageTransition, null, { default: () => h(App, props) }) })
      .use(plugin)
      .mount(el);
  },
});
```

`PageTransition.vue`:

```vue
<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { computed } from 'vue';
import { gsap, ScrollTrigger } from '@/lib/gsap';

const page = usePage();
const key = computed(() => page.component); // cambia por componente de página; usa page.url para cambiar también por query

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function onEnter(el: Element, done: () => void) {
  if (reduce()) return done();
  gsap.fromTo(el, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', onComplete: done, clearProps: 'transform' });
}

function onLeave(el: Element, done: () => void) {
  if (reduce()) return done();
  gsap.to(el, { autoAlpha: 0, y: -16, duration: 0.3, ease: 'power2.in', onComplete: done });
}

function onAfterEnter() {
  ScrollTrigger.refresh();
}
</script>

<template>
  <Transition :css="false" mode="out-in" @enter="onEnter" @leave="onLeave" @after-enter="onAfterEnter">
    <div :key="key" class="page">
      <slot />
    </div>
  </Transition>
</template>
```

Notas: `:css="false"` desactiva las clases CSS y deja el control a los hooks. `mode="out-in"` evita que ambas páginas coexistan. Si `key` no cambia (misma página con otros props), no hay transición, que es lo deseable. Con persistent layouts el layout queda fuera del `<Transition>` cuando se declara vía `defineOptions({ layout })`, pero el slot de `App` contiene layout + página; si necesitas que el layout no se anime, mueve el `<Transition>` dentro del layout envolviendo `<slot />` y usa `usePage().component` como key.

### 5.3 `<Transition>` / `<TransitionGroup>` para elementos (modales, listas)

```vue
<Transition :css="false" @enter="onEnter" @leave="onLeave">
  <div v-if="open" class="modal">...</div>
</Transition>

<TransitionGroup :css="false" tag="ul" @enter="onItemEnter" @leave="onItemLeave">
  <li v-for="(item, i) in items" :key="item.id" :data-index="i">...</li>
</TransitionGroup>
```

```ts
function onItemEnter(el: Element, done: () => void) {
  const i = Number((el as HTMLElement).dataset.index ?? 0);
  gsap.fromTo(el, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.3, delay: i * 0.04, onComplete: done });
}
function onItemLeave(el: Element, done: () => void) {
  gsap.to(el, { autoAlpha: 0, height: 0, marginBottom: 0, duration: 0.25, onComplete: done });
}
```

Para reordenaciones de lista usa Flip (`Flip.getState` antes del cambio, `Flip.from` en `nextTick`).

## 6. SSR (Inertia SSR con `ssr.ts`)

- Nunca importar/registrar plugins en el top-level sin guard. El módulo `gsap` core no rompe en Node, pero `ScrollTrigger` accede a `window` al registrarse.
- `useGsap` ya cortocircuita con `import.meta.env.SSR`. `onMounted` no se ejecuta en SSR, pero el guard evita problemas en `watch` con `immediate: true`.
- Estado inicial: si un elemento va a hacer `from` con `autoAlpha: 0`, en SSR se renderiza visible y luego GSAP lo oculta al montar: parpadeo. Solución CSS: ocultar por defecto cuando JS está activo y dejar visible sin JS.

```css
html.js [data-intro] { visibility: hidden; }
```

```ts
// en <head> inline, antes de cargar la app
document.documentElement.classList.add('js');
```

Y en el tween usar `fromTo` con `autoAlpha` que termina en 1 (sobrescribe la visibility).

- `typeof window !== 'undefined'` en utilidades puras; `import.meta.env.SSR` en código Vite (se elimina en build).

## 7. Lenis smooth scroll + ScrollTrigger

Instalación: `npm i lenis`. Template en `templates/useLenis.ts`. Debe vivir en el layout persistente o en `app.ts` (una sola instancia).

```ts
// resources/js/composables/useLenis.ts (resumen; ver template)
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from '@/lib/gsap';

let lenis: Lenis | null = null;

export function initLenis() {
  if (import.meta.env.SSR || lenis) return lenis;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis!.raf(time * 1000)); // ticker en segundos, Lenis en ms
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

export function getLenis() { return lenis; }
```

Con Inertia:

```ts
router.on('navigate', () => {
  getLenis()?.scrollTo(0, { immediate: true }); // si no usas preserveScroll
  ScrollTrigger.refresh();
});
```

Anclas internas: `getLenis()?.scrollTo('#section', { offset: -80 })`. Bloquear scroll en modales: `lenis.stop()` / `lenis.start()`.

Lenis usa el scroll nativo (no transform), así que ScrollTrigger no necesita `scrollerProxy`. Solo hay que conectar `scroll -> update` y dirigir el raf desde el ticker de GSAP.

Alternativa sin dependencia: `ScrollSmoother` de GSAP (gratuito). Requiere estructura `#smooth-wrapper > #smooth-content` y `ScrollSmoother.create({ smooth: 1, effects: true })`; con Inertia hay que crearlo en el layout persistente y llamar a `smoother.refresh()` tras navegar.

## 8. `prefers-reduced-motion`

Obligatorio. Dos capas:

1. Global: `gsap.matchMedia()` en cada `useGsap` donde haya movimiento significativo (ver `performance-a11y.md`).
2. Lenis desactivado si `reduce`.

Composable mínimo:

```ts
export function usePrefersReducedMotion() {
  const reduce = ref(false);
  onMounted(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduce.value = mq.matches;
    mq.addEventListener('change', (e) => (reduce.value = e.matches));
  });
  return reduce;
}
```

Patrón en `useGsap`:

```ts
useGsap(() => {
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.from('.card', { y: 30, autoAlpha: 0, stagger: 0.1 });
  });
  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set('.card', { clearProps: 'all' }); // visible y estático
  });
  // mm se revierte con el context del composable (matchMedia crea contextos hijos)
}, root);
```

## 9. Checklist Inertia + GSAP

- Registro de plugins en un único módulo con guard SSR.
- Cada componente: `useGsap` con scope; nada de `gsap.*` en `setup()` sin `onMounted`.
- `router.on('navigate')` -> `ScrollTrigger.refresh()` en el siguiente frame.
- Layout persistente para animaciones globales; marcar sus triggers para no matarlos.
- Transiciones de página con `<Transition :css="false" mode="out-in">` y `usePage().component` como key.
- Una instancia de Lenis, creada en el layout, sincronizada con `ScrollTrigger.update` y el ticker de GSAP.
- `prefers-reduced-motion` en todas las animaciones no triviales.
- Estados iniciales ocultos con CSS + `fromTo` para evitar FOUC con SSR.
