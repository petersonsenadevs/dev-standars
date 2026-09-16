# ScrollTrigger — Patrones completos

Todos los ejemplos asumen:

```js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const DEV = import.meta.env.DEV; // markers solo en desarrollo
```

## Fundamentos que aplican a todos los patrones

- `start` / `end`: `"[posición del trigger] [posición del viewport]"`. `"top 80%"` = cuando el top del trigger llega al 80% de la altura del viewport. Acepta `px`, `%`, `top|center|bottom`, `"+=500"`, funciones `() => ...`.
- `markers: DEV` nunca en producción.
- `scrub: true` liga la animación al scroll; `scrub: 0.5..1.5` añade suavizado (segundos de retardo).
- `toggleActions: 'play none none reverse'` (onEnter onLeave onEnterBack onLeaveBack). Valores: `play pause resume reset restart complete reverse none`.
- `once: true` para reveals que no deben repetirse.
- `invalidateOnRefresh: true` cuando los valores dependen de medidas (funciones en `x`, `end`, etc.); recalcula en cada `refresh()`.
- `ScrollTrigger.refresh()` tras carga de imágenes, fuentes o contenido asíncrono que cambie la altura de la página:

```js
window.addEventListener('load', () => ScrollTrigger.refresh());
document.fonts.ready.then(() => ScrollTrigger.refresh());
// imágenes lazy: usar loading="eager" para las above-the-fold y width/height explícitos para reservar espacio
```

- Envolver siempre en `gsap.context()` (o `useGsap` / `useGSAP`) para el cleanup.
- Prefiere `transform` y `opacity`. Respeta `prefers-reduced-motion` con `gsap.matchMedia()` (ver `performance-a11y.md`).

---

## 1. Fade-up on enter

```html
<section>
  <h2 class="reveal">Título</h2>
  <p class="reveal">Texto</p>
</section>
```

```js
gsap.utils.toArray('.reveal').forEach((el) => {
  gsap.fromTo(el,
    { y: 32, autoAlpha: 0 },
    {
      y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true, markers: DEV },
    },
  );
});
```

Notas: `fromTo` + `autoAlpha` evita el parpadeo inicial de `from`. Un ScrollTrigger por elemento; para muchos elementos usar `batch` (patrón 2).

## 2. Batch reveal (`ScrollTrigger.batch`)

Agrupa elementos que entran en el mismo frame y los anima con stagger, con un solo cálculo por lote. Ideal para grids y listados.

```html
<div class="grid">
  <article class="card">...</article>
  <!-- x N -->
</div>
```

```js
gsap.set('.card', { y: 40, autoAlpha: 0 });

ScrollTrigger.batch('.card', {
  start: 'top 90%',
  once: true,
  batchMax: 6,        // máximo por lote
  interval: 0.1,      // segundos de ventana para agrupar
  onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.6, ease: 'power2.out', overwrite: true }),
  // sin once: añadir onLeave/onEnterBack/onLeaveBack
});
```

Notas: `gsap.set` inicial en vez de `from` para que el estado sea determinista. Si el contenido cambia (paginación), llamar a `ScrollTrigger.refresh()` y crear un nuevo batch para los nuevos nodos.

## 3. Pin + scrub timeline

Fija una sección y reproduce una timeline según el scroll.

```html
<section class="pin-section">
  <div class="pin-content">
    <h2 class="step step-1">Uno</h2>
    <h2 class="step step-2">Dos</h2>
    <h2 class="step step-3">Tres</h2>
  </div>
</section>
```

```css
.pin-section { min-height: 100vh; position: relative; }
.step { position: absolute; inset: 0; display: grid; place-items: center; }
```

```js
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: '.pin-section',
    start: 'top top',
    end: '+=300%',        // 3 alturas de viewport de scroll
    pin: true,
    scrub: 1,
    anticipatePin: 1,     // evita salto en pins con scroll rápido
    markers: DEV,
  },
  defaults: { ease: 'none' },
});

tl.from('.step-1', { autoAlpha: 0 })
  .to('.step-1', { autoAlpha: 0 }, '+=1')
  .from('.step-2', { autoAlpha: 0 }, '<')
  .to('.step-2', { autoAlpha: 0 }, '+=1')
  .from('.step-3', { autoAlpha: 0 }, '<');
```

Notas: con `scrub` las duraciones son proporciones, no segundos. `pinSpacing: true` (defecto) añade padding para mantener el flujo; `pinSpacing: false` hace que el siguiente contenido se solape. `pinType: 'transform'` si el scroller es un contenedor con smooth scroll por transform.

## 4. Horizontal scroll section

```html
<section class="h-scroll">
  <div class="h-track">
    <div class="panel">1</div>
    <div class="panel">2</div>
    <div class="panel">3</div>
    <div class="panel">4</div>
  </div>
</section>
```

```css
.h-scroll { overflow: hidden; }
.h-track { display: flex; width: max-content; }
.panel { width: 100vw; height: 100vh; flex-shrink: 0; }
```

```js
const track = document.querySelector('.h-track');
const getScroll = () => track.scrollWidth - window.innerWidth;

gsap.to(track, {
  x: () => -getScroll(),
  ease: 'none',
  scrollTrigger: {
    trigger: '.h-scroll',
    start: 'top top',
    end: () => `+=${getScroll()}`,   // la distancia vertical = distancia horizontal (1:1)
    pin: true,
    scrub: 1,
    invalidateOnRefresh: true,
    anticipatePin: 1,
    markers: DEV,
  },
});
```

Animar elementos dentro de un panel horizontal (usa `containerAnimation`):

```js
const scrollTween = gsap.to(track, { ... }); // el tween anterior

gsap.from('.panel:nth-child(3) h2', {
  y: 50, autoAlpha: 0,
  scrollTrigger: {
    trigger: '.panel:nth-child(3) h2',
    containerAnimation: scrollTween,
    start: 'left 80%',   // en horizontal se usan left/right
    toggleActions: 'play none none reverse',
  },
});
```

Notas: `overflow: hidden` en la sección, no en un ancestro (ver `pitfalls.md`). En móvil considera desactivarlo con `gsap.matchMedia()`.

## 5. Parallax por capas

```html
<section class="parallax">
  <img class="layer" data-speed="0.2" src="bg.jpg" alt="">
  <img class="layer" data-speed="0.5" src="mid.png" alt="">
  <img class="layer" data-speed="0.9" src="fg.png" alt="">
  <h1 class="layer" data-speed="1.2">Título</h1>
</section>
```

```js
gsap.utils.toArray('.layer').forEach((layer) => {
  const speed = parseFloat(layer.dataset.speed || '1');
  gsap.to(layer, {
    yPercent: (1 - speed) * 50,   // capas lentas se desplazan menos
    ease: 'none',
    scrollTrigger: {
      trigger: '.parallax',
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  });
});
```

Notas: `start: 'top bottom'` / `end: 'bottom top'` cubre todo el recorrido visible. Las capas de fondo necesitan tamaño extra (`height: 120%`) para no dejar huecos. `will-change: transform` en las capas mientras la sección está en viewport.

## 6. Progress bar de lectura

```html
<div class="progress" aria-hidden="true"></div>
<article class="post">...</article>
```

```css
.progress { position: fixed; top: 0; left: 0; height: 3px; width: 100%; transform-origin: left; transform: scaleX(0); background: currentColor; }
```

```js
gsap.to('.progress', {
  scaleX: 1,
  ease: 'none',
  scrollTrigger: {
    trigger: '.post',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.3,
  },
});
```

Notas: `scaleX` en vez de `width`. Si solo quieres el valor, usa `onUpdate: (self) => self.progress`.

## 7. Contador numérico

```html
<p class="stat"><span class="count" data-to="12500" data-suffix="+">0</span></p>
```

```js
gsap.utils.toArray('.count').forEach((el) => {
  const target = parseFloat(el.dataset.to);
  const suffix = el.dataset.suffix || '';
  const fmt = new Intl.NumberFormat('es-ES');
  const obj = { value: 0 };

  gsap.to(obj, {
    value: target,
    duration: 1.6,
    ease: 'power2.out',
    snap: { value: 1 },
    onUpdate: () => { el.textContent = fmt.format(obj.value) + suffix; },
    scrollTrigger: { trigger: el, start: 'top 85%', once: true },
  });
});
```

Notas: animar un objeto plano y pintar en `onUpdate` es más barato que `textContent` como propiedad. Usa `font-variant-numeric: tabular-nums` para evitar saltos de ancho.

## 8. Sticky header que se oculta al bajar

```html
<header class="site-header">...</header>
```

```css
.site-header { position: fixed; top: 0; width: 100%; }
```

```js
const header = document.querySelector('.site-header');
const show = gsap.from(header, { yPercent: -100, paused: true, duration: 0.3, ease: 'power2.out' }).progress(1);

ScrollTrigger.create({
  start: 'top -80',            // tras 80px de scroll
  end: 'max',
  onUpdate: (self) => {
    self.direction === -1 ? show.play() : show.reverse();
  },
});
```

Notas: `start: 'top -80'` sin trigger usa el viewport como referencia. `self.direction` = 1 bajando, -1 subiendo. Alternativa: `Observer.create({ type: 'scroll', onUp, onDown })`.

## 9. Snap por secciones

```html
<main>
  <section class="snap">1</section>
  <section class="snap">2</section>
  <section class="snap">3</section>
</main>
```

```js
const sections = gsap.utils.toArray('.snap');

ScrollTrigger.create({
  trigger: 'main',
  start: 'top top',
  end: () => `+=${sections.length * window.innerHeight}`,
  snap: {
    snapTo: 1 / (sections.length - 1),   // o función (value) => ... o array de progresos
    duration: { min: 0.2, max: 0.6 },
    delay: 0.1,
    ease: 'power1.inOut',
    directional: true,                    // snap en la dirección del scroll
  },
  invalidateOnRefresh: true,
});
```

Alternativa con timeline pineada: `snap: 'labels'` salta a labels de la timeline asociada. Para snap CSS puro considera `scroll-snap-type` cuando no haya animación asociada.

## 10. Texto por líneas con SplitText

```html
<h2 class="split-lines">Un titular largo que ocupa varias líneas en móvil y escritorio.</h2>
```

```js
import { SplitText } from 'gsap/SplitText';
gsap.registerPlugin(SplitText);

document.fonts.ready.then(() => {
  SplitText.create('.split-lines', {
    type: 'lines',
    mask: 'lines',              // cada línea en un wrapper con overflow:hidden
    autoSplit: true,            // re-split al cambiar el ancho
    onSplit(self) {
      return gsap.from(self.lines, {
        yPercent: 110,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: self.elements[0], start: 'top 85%', once: true },
      });
    },
  });
});
```

Notas: esperar a `document.fonts.ready` o las líneas se calculan con la fuente fallback. `onSplit` devuelve la animación para que `autoSplit` la revierta y la recree correctamente. Llama a `split.revert()` en el cleanup (el `gsap.context` lo hace si se crea dentro).

## 11. Imagen con zoom (scrub)

```html
<section class="zoom">
  <div class="zoom__frame"><img src="hero.jpg" alt=""></div>
</section>
```

```css
.zoom__frame { overflow: hidden; height: 100vh; }
.zoom__frame img { width: 100%; height: 100%; object-fit: cover; }
```

```js
gsap.fromTo('.zoom__frame img',
  { scale: 1.3 },
  {
    scale: 1,
    ease: 'none',
    scrollTrigger: { trigger: '.zoom', start: 'top bottom', end: 'bottom top', scrub: true },
  },
);
```

Variante con `clip-path` para revelar la imagen mientras entra:

```js
gsap.fromTo('.zoom__frame', { clipPath: 'inset(15% round 24px)' }, { clipPath: 'inset(0% round 0px)', ease: 'none', scrollTrigger: { trigger: '.zoom', start: 'top 80%', end: 'top 20%', scrub: true } });
```

## 12. Scroll-story con pin múltiple (texto que cambia, visual fijo)

```html
<section class="story">
  <div class="story__visual"><img class="visual" data-step="0" src="a.jpg" alt=""><img class="visual" data-step="1" src="b.jpg" alt=""><img class="visual" data-step="2" src="c.jpg" alt=""></div>
  <div class="story__steps">
    <div class="step">Paso 1</div>
    <div class="step">Paso 2</div>
    <div class="step">Paso 3</div>
  </div>
</section>
```

```css
.story { display: grid; grid-template-columns: 1fr 1fr; }
.story__visual { height: 100vh; position: relative; }
.visual { position: absolute; inset: 0; object-fit: cover; opacity: 0; }
.step { min-height: 100vh; display: grid; align-content: center; }
```

```js
const visuals = gsap.utils.toArray('.visual');
gsap.set(visuals[0], { autoAlpha: 1 });

// pin de la columna visual durante toda la sección
ScrollTrigger.create({
  trigger: '.story',
  start: 'top top',
  end: 'bottom bottom',
  pin: '.story__visual',
  pinSpacing: false,
});

// un trigger por step que activa su visual
gsap.utils.toArray('.step').forEach((step, i) => {
  ScrollTrigger.create({
    trigger: step,
    start: 'top center',
    end: 'bottom center',
    onToggle: (self) => {
      if (!self.isActive) return;
      gsap.to(visuals, { autoAlpha: 0, duration: 0.4, overwrite: 'auto' });
      gsap.to(visuals[i], { autoAlpha: 1, duration: 0.4, overwrite: 'auto' });
      step.classList.add('is-active');
    },
    onLeave: () => step.classList.remove('is-active'),
    onLeaveBack: () => step.classList.remove('is-active'),
  });
});
```

Notas: `pin` acepta un elemento distinto al trigger. En móvil (una columna) usar `gsap.matchMedia` para hacer `position: sticky` con CSS y omitir el pin.

## 13. Hero con video scrubbing por frames (canvas)

Secuencia de imágenes (p. ej. 120 frames WebP) dibujada en un canvas según el scroll. Más fiable que `video.currentTime` con scrub.

```html
<section class="frames">
  <canvas class="frames__canvas"></canvas>
</section>
```

```css
.frames { height: 400vh; }
.frames__canvas { position: sticky; top: 0; width: 100%; height: 100vh; display: block; }
```

```js
const FRAME_COUNT = 120;
const src = (i) => `/frames/frame_${String(i + 1).padStart(3, '0')}.webp`;

const canvas = document.querySelector('.frames__canvas');
const ctx2d = canvas.getContext('2d');
const images = [];
const state = { frame: 0 };

function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  render();
}

function render() {
  const img = images[state.frame];
  if (!img?.complete) return;
  // cover
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  ctx2d.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

for (let i = 0; i < FRAME_COUNT; i++) {
  const img = new Image();
  img.src = src(i);
  images.push(img);
}
images[0].onload = resize;
window.addEventListener('resize', resize);

gsap.to(state, {
  frame: FRAME_COUNT - 1,
  snap: 'frame',
  ease: 'none',
  onUpdate: render,
  scrollTrigger: { trigger: '.frames', start: 'top top', end: 'bottom bottom', scrub: 0.5 },
});
```

Notas: precarga progresiva (primeros frames prioritarios) si son muchos. Con `position: sticky` no hace falta `pin`. Tamaño de frames: 1600px de ancho máximo, WebP calidad 70, es suficiente. Evitar en `prefers-reduced-motion`: mostrar el último frame estático.

## 14. Extra: cambio de tema/color de fondo por sección

```js
gsap.utils.toArray('[data-bg]').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: (self) => self.isActive && gsap.to('body', { backgroundColor: section.dataset.bg, duration: 0.5, overwrite: 'auto' }),
  });
});
```

## 15. Extra: navegación activa (scrollspy)

```js
gsap.utils.toArray('section[id]').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    end: 'bottom center',
    onToggle: (self) => {
      document.querySelector(`nav a[href="#${section.id}"]`)?.classList.toggle('active', self.isActive);
    },
  });
});
```

---

## Utilidades de ScrollTrigger que conviene conocer

```js
ScrollTrigger.refresh();                         // recalcular posiciones
ScrollTrigger.update();                          // forzar update (Lenis)
ScrollTrigger.getAll().forEach((t) => t.kill()); // matar todos (cambio de página SPA)
ScrollTrigger.getById('hero');
ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load' });
ScrollTrigger.normalizeScroll(true);             // unifica scroll en iOS (usar con cuidado)
ScrollTrigger.scrollerProxy(el, {...});          // integrar scrollers custom
ScrollTrigger.isInViewport(el, 0.5);
ScrollTrigger.positionInViewport(el, 'center');
ScrollTrigger.maxScroll(window);
ScrollTrigger.clearScrollMemory();               // evitar restaurar scroll en SPA
ScrollTrigger.addEventListener('refresh', fn);   // 'refreshInit' | 'refresh' | 'scrollStart' | 'scrollEnd'
ScrollTrigger.saveStyles('.card');               // guardar inline styles antes de matchMedia
ScrollTrigger.sort();                            // reordenar por posición (si se crean fuera de orden)
```

Orden de creación importa: los triggers con pin deben crearse en el orden en que aparecen en la página, o llamar a `ScrollTrigger.sort()` / usar `refreshPriority`.
