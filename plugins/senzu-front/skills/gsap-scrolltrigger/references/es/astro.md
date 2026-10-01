# GSAP con Astro

## 1. Modelo mental

Astro renderiza HTML estático (o SSR) y solo hidrata islands. GSAP puede usarse de dos formas:

1. `<script>` en un componente `.astro`: se procesa con Vite, se deduplica (aunque el componente se use 10 veces, el script se ejecuta una vez) y se ejecuta tras el parse del documento (como `type="module"`). Es la forma más barata: sin framework ni hidratación.
2. Dentro de un island (Vue/React/Svelte) con `client:*`: para animaciones que dependen de estado del componente. Aplican las guías de `vue-inertia-integration.md` / `react-integration.md`.

Usar (1) para reveals, parallax, heros y scroll-story. Usar (2) solo cuando la animación necesita reactividad.

## 2. Setup base

```ts
// src/lib/gsap.ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);
gsap.defaults({ ease: 'power2.out', duration: 0.6 });

export { gsap, ScrollTrigger, SplitText };
```

Los `<script>` de Astro solo se ejecutan en el navegador, así que no hace falta guard de `window` aquí. Sí es necesario si el módulo se importa desde un `.astro` frontmatter o desde un island con SSR (`if (typeof window !== 'undefined')`).

## 3. `<script>` en componentes Astro (sin View Transitions)

```astro
---
// src/components/Cards.astro
const { items } = Astro.props;
---
<section data-cards>
  {items.map((it) => <article class="card">{it.title}</article>)}
</section>

<script>
  import { gsap } from '@/lib/gsap';

  // el script se ejecuta UNA vez por página aunque haya varias instancias:
  // iterar todas las instancias del componente
  document.querySelectorAll<HTMLElement>('[data-cards]').forEach((root) => {
    gsap.context(() => {
      gsap.from('.card', {
        y: 30, autoAlpha: 0, stagger: 0.08,
        scrollTrigger: { trigger: root, start: 'top 85%', once: true },
      });
    }, root);
  });
</script>
```

Reglas:

- Nunca asumir una sola instancia: iterar con `querySelectorAll` y un `gsap.context` por instancia con scope.
- No usar `is:inline` salvo necesidad (pierde bundling, deduplicación e imports).
- Para pasar datos del frontmatter al script: `data-*` attributes o `define:vars` (este último fuerza `is:inline`).

## 4. View Transitions (`<ClientRouter />`) y ciclo de vida

Con `import { ClientRouter } from 'astro:transitions'` en el `<head>`, la navegación es SPA-like: el `<body>` se sustituye y los `<script>` de módulo NO se re-ejecutan en la nueva página (ya están cargados). Consecuencias:

- Las animaciones no se inicializan en la segunda página.
- Los ScrollTriggers de la página anterior apuntan a nodos que ya no existen.

Eventos del ciclo de vida (`document`):

| Evento | Cuándo |
|---|---|
| `astro:before-preparation` | Inicio de la navegación, antes de cargar la nueva página |
| `astro:after-preparation` | Nueva página cargada, aún no intercambiada |
| `astro:before-swap` | Justo antes de sustituir el DOM. Momento para matar animaciones |
| `astro:after-swap` | DOM ya sustituido, antes de que el scroll y el título se actualicen |
| `astro:page-load` | Página lista (también en la carga inicial). Momento para inicializar |

Patrón: registrar en `astro:page-load` e invalidar en `astro:before-swap`. Template completo en `templates/gsap-astro.ts`.

```ts
// src/lib/gsap-astro.ts (resumen)
import { gsap, ScrollTrigger } from '@/lib/gsap';

type Init = (ctx: gsap.Context) => void;
const inits = new Set<Init>();
let ctx: gsap.Context | null = null;

export function onPageAnimations(init: Init) {
  inits.add(init);
}

function mount() {
  ctx = gsap.context(() => { inits.forEach((fn) => fn(ctx!)); });
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

function unmount() {
  ctx?.revert();
  ctx = null;
  ScrollTrigger.getAll().forEach((t) => t.kill()); // por si algo se creó fuera del contexto
}

document.addEventListener('astro:page-load', mount);
document.addEventListener('astro:before-swap', unmount);
```

Uso en componentes: en lugar de ejecutar la animación directamente, registrar una función que se ejecutará en cada `page-load`:

```astro
<script>
  import { gsap } from '@/lib/gsap';
  import { onPageAnimations } from '@/lib/gsap-astro';

  onPageAnimations(() => {
    document.querySelectorAll<HTMLElement>('[data-cards]').forEach((root) => {
      gsap.context(() => {
        gsap.from('.card', { y: 30, autoAlpha: 0, stagger: 0.08, scrollTrigger: { trigger: root, start: 'top 85%', once: true } });
      }, root);
    });
  });
</script>
```

Como el script del componente se ejecuta una sola vez (deduplicado), `onPageAnimations` registra una sola vez y la función se re-ejecuta en cada navegación. Si la página destino no contiene el componente, `querySelectorAll` devuelve vacío y no pasa nada. Importar `@/lib/gsap-astro` en el layout base para garantizar que los listeners existen antes del primer `page-load`.

Alternativa sin registro central: `data-astro-rerun` en el script fuerza su re-ejecución en cada navegación, pero solo funciona con `is:inline`, así que pierde imports; no recomendado con GSAP.

## 5. Transiciones de página con GSAP (en lugar de las CSS de Astro)

Astro anima el swap con CSS (`transition:animate`). Para controlar salida/entrada con GSAP:

```ts
document.addEventListener('astro:before-preparation', (ev) => {
  const e = ev as any; // TransitionBeforePreparationEvent
  const originalLoader = e.loader;
  e.loader = async () => {
    await gsap.to('main', { autoAlpha: 0, y: -12, duration: 0.25, ease: 'power2.in' }); // salida
    await originalLoader();
  };
});

document.addEventListener('astro:after-swap', () => {
  gsap.set('main', { autoAlpha: 0, y: 12 });
});

document.addEventListener('astro:page-load', () => {
  gsap.to('main', { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform' });
});
```

Desactivar las animaciones CSS de Astro en los elementos afectados: `transition:animate="none"` en `<main>`. Respetar `prefers-reduced-motion` saltando los tweens.

## 6. Islands (Vue/React)

```astro
<HeroVue client:load />
<CardsReact client:visible items={items} />
```

- Dentro del island aplican `useGsap` (Vue) / `useGSAP` (React). Sus cleanups se ejecutan cuando Astro desmonta el island en el swap.
- `client:visible` retrasa la hidratación hasta que entra en viewport: la animación de entrada se ejecuta al hidratar, no al hacer scroll. Para reveals puros, un `<script>` Astro es mejor.
- Tras hidratar un island que cambia altura (cargas asíncronas), llamar a `ScrollTrigger.refresh()` desde el island.
- Un island no debería crear la instancia de Lenis; Lenis va en el layout como script global (sección 7).

## 7. Lenis en Astro

```astro
<!-- src/layouts/Base.astro -->
<script>
  import Lenis from 'lenis';
  import { gsap, ScrollTrigger } from '@/lib/gsap';

  let lenis: Lenis | null = null;

  function start() {
    if (lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
  }
  function raf(time: number) { lenis?.raf(time * 1000); }

  start();
  document.addEventListener('astro:after-swap', () => lenis?.scrollTo(0, { immediate: true }));
</script>
```

Lenis sobrevive a las View Transitions porque el script es global y el `<html>` no se sustituye; solo hay que resetear el scroll tras el swap. Si Astro restaura el scroll (navegación atrás), omitir el `scrollTo(0)`.

## 8. Imágenes y `refresh`

Astro `<Image>` reserva `width/height`, por lo que normalmente no hay layout shift. Para contenido con altura desconocida (embeds, fuentes web): `document.fonts.ready.then(() => ScrollTrigger.refresh())` en el `page-load` handler y `window.addEventListener('load', ...)` en la carga inicial.

## 9. Checklist Astro

- Plugins registrados en `src/lib/gsap.ts`, importado desde scripts.
- Scripts de componente iteran instancias (`querySelectorAll`) con `gsap.context` por instancia.
- Con `<ClientRouter />`: inicializar en `astro:page-load`, revertir en `astro:before-swap`; importar el módulo de ciclo de vida en el layout base.
- Islands solo cuando hay reactividad; Lenis y animaciones globales en el layout.
- `prefers-reduced-motion` en scripts y Lenis.
- `markers` solo con `import.meta.env.DEV`.
