# Efectos pro

Recetas nivel award-site con GSAP 3.13. Plugins ya registrados en `lib/gsap.ts`: `import { gsap, ScrollTrigger, Flip, Observer } from '@/lib/gsap'`.
Convenciones comunes: todo dentro de `gsap.context()` (o el wrapper del stack) con `ctx.revert()` al desmontar; lo decorativo va en
`gsap.matchMedia('(prefers-reduced-motion: no-preference)')` (en `reduce`, estado final estático); los listeners se quitan en el cleanup de `mm.add`.

## Índice
- [Scroll velocity skew](#scroll-velocity-skew)
- [Marquee infinito](#marquee-infinito)
- [Galería infinita](#galería-infinita)
- [Before after slider](#before-after-slider)
- [Efecto lupa](#efecto-lupa)
- [Filtros de galería con Flip](#filtros-de-galería-con-flip)
- [Cursor personalizado](#cursor-personalizado)
- [Video scrubbing con currentTime](#video-scrubbing-con-currenttime)
- [Stacking cards completo](#stacking-cards-completo)
- [Parallax de imagen en contenedor](#parallax-de-imagen-en-contenedor)

## Scroll velocity skew

```html
<div class="grid"><img class="skew-item" src="a.jpg" alt="…"> <!-- n items --></div>
```

```js
gsap.set('.skew-item', { transformOrigin: 'center center', force3D: true });
const skewTo = gsap.quickTo('.skew-item', 'skewY', { duration: 0.5, ease: 'power3.out', unit: 'deg' });
ScrollTrigger.create({ onUpdate: (self) => skewTo(gsap.utils.clamp(-8, 8, self.getVelocity() / -350)) });
ScrollTrigger.addEventListener('scrollEnd', () => skewTo(0)); // el último evento puede dejar skew residual
```

- Variante stretch: segundo `quickTo` sobre `scaleY` con `clamp(1, 1.15)` y `Math.abs(velocity)`.
- Móvil: el momentum táctil dispara picos bruscos; baja el clamp a ±4 o desactívalo (`(pointer: fine)` en el matchMedia).
  En el cleanup, además del `ctx.revert()`, quita el listener `scrollEnd`.

## Marquee infinito

```html
<div class="marquee"><div class="marquee-track">
  <div class="marquee-group">Texto A — Texto B — Texto C —&nbsp;</div>
  <div class="marquee-group" aria-hidden="true">Texto A — Texto B — Texto C —&nbsp;</div>
</div></div>
<!-- CSS: .marquee{overflow:hidden} .marquee-track{display:flex;width:max-content} .marquee-group{flex-shrink:0} -->
```

```js
function marquee(root, { speed = 80, reversed = false } = {}) { // speed en px/s
  const track = root.querySelector('.marquee-track');
  const tween = gsap.to(track, { xPercent: -50, ease: 'none', repeat: -1, duration: track.scrollWidth / 2 / speed });
  if (reversed) tween.timeScale(-1); // dirección invertible en runtime
  const pause = () => gsap.to(tween, { timeScale: 0, duration: 0.4 });
  const play = () => gsap.to(tween, { timeScale: reversed ? -1 : 1, duration: 0.4 });
  root.addEventListener('pointerenter', pause); root.addEventListener('pointerleave', play);
  return { tween, destroy: () => { root.removeEventListener('pointerenter', pause); root.removeEventListener('pointerleave', play); tween.kill(); } };
}
```

- Seamless: mitades idénticas, sin gap en la costura (espaciado dentro del grupo, no entre grupos); si el grupo es más
  estrecho que el contenedor, duplica contenido en JS antes del tween. Anchos variables: `gsap.utils.wrap` en `modifiers.xPercent` por item.
- Reduced-motion: crea el tween pero `tween.pause()` (contenido legible en estático); el clon lleva `aria-hidden="true"`.

## Galería infinita

```html
<div class="inf-gallery"><ul class="inf-track"><li class="inf-item"><img src="…" alt="…"></li> <!-- n items --></ul></div>
<!-- CSS: .inf-gallery{overflow:hidden;touch-action:pan-y;cursor:grab} .inf-item{position:absolute;width:320px} img{pointer-events:none} -->
```

```js
const items = gsap.utils.toArray('.inf-item');
const itemW = 320 + 16; // ancho + gap; recalcula en ScrollTrigger.refresh si es responsive
const wrapX = gsap.utils.wrap(-itemW, (items.length - 1) * itemW), state = { x: 0 };
const render = () => items.forEach((el, i) => gsap.set(el, { x: wrapX(i * itemW + state.x) })); render();
Observer.create({
  target: '.inf-gallery', type: 'touch,pointer', preventDefault: true,
  onPress: () => gsap.killTweensOf(state),
  onChangeX: (self) => { state.x += self.deltaX; render(); },
  onRelease: (self) => gsap.to(state, { x: state.x + self.velocityX * 0.12, duration: 1, ease: 'power3.out', onUpdate: render }),
});
```

- `touch-action: pan-y` deja pasar el scroll vertical en táctil; `preventDefault` solo captura el gesto horizontal.
- A11y: el drag es un extra; añade botones prev/next (mueven `state.x` ± `itemW` con tween) navegables por teclado.
- Cada item necesita el mismo ancho para el wrap; con anchos variables usa un array de offsets acumulados.

## Before after slider

```html
<div class="ba" style="--pos: 50%">
  <img class="ba-before" src="before.jpg" alt="Fachada antes de la reforma">
  <img class="ba-after" src="after.jpg" alt="Fachada después de la reforma">
  <label class="sr-only" for="ba-range">Comparar antes y después</label>
  <input id="ba-range" class="ba-range" type="range" min="0" max="100" value="50">
</div>
<!-- CSS: .ba{position:relative} .ba-after{position:absolute;inset:0;clip-path:inset(0 calc(100% - var(--pos)) 0 0)}
     .ba-range{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize} + línea/asa con left:var(--pos) -->
```

```js
const root = document.querySelector('.ba'), range = root.querySelector('.ba-range');
range.addEventListener('input', () => root.style.setProperty('--pos', `${range.value}%`));
// opcional, asa con inercia: const posTo = gsap.quickTo(root, '--pos', { duration: 0.3, ease: 'power2.out', unit: '%' });
```

- El `<input type="range">` da teclado, lector de pantalla y táctil gratis; no lo sustituyas por divs con pointer events.
- `clip-path` se anima en compositor: sin repaints. Ambas imágenes con el mismo `aspect-ratio` para evitar CLS.
  Funciona sin GSAP; el `quickTo` sobre la custom property registrada solo añade suavizado.

## Efecto lupa

```html
<figure class="lens-wrap"><img class="lens-img" src="photo.jpg" alt="…"><div class="lens" aria-hidden="true"></div></figure>
<!-- CSS: .lens-wrap{position:relative} .lens{position:absolute;top:0;left:0;width:160px;height:160px;border-radius:50%;
     pointer-events:none;background:#000 no-repeat;visibility:hidden;box-shadow:0 0 0 2px #fff} -->
```

```js
const mm = gsap.matchMedia();
mm.add('(hover: hover) and (pointer: fine)', () => {
  const wrap = document.querySelector('.lens-wrap'), img = wrap.querySelector('.lens-img'), lens = wrap.querySelector('.lens');
  const R = 80, ZOOM = 2.5;
  const o = { duration: 0.25, ease: 'power3.out' };
  const xTo = gsap.quickTo(lens, 'x', o), yTo = gsap.quickTo(lens, 'y', o);
  const onEnter = () => gsap.to(lens, { autoAlpha: 1, duration: 0.2 }), onLeave = () => gsap.to(lens, { autoAlpha: 0, duration: 0.2 });
  const move = (e) => {
    const r = img.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    xTo(px - R); yTo(py - R);
    lens.style.backgroundImage = `url(${img.currentSrc})`; // currentSrc respeta srcset
    lens.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
    lens.style.backgroundPosition = `${R - px * ZOOM}px ${R - py * ZOOM}px`;
  };
  wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerenter', onEnter); wrap.addEventListener('pointerleave', onLeave);
  return () => { wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerenter', onEnter); wrap.removeEventListener('pointerleave', onLeave); };
});
```

- Desactivado en táctil por el matchMedia (`hover: hover` + `pointer: fine`); en móvil la imagen se ve tal cual.
- `background-position` reutiliza la imagen cacheada (cero peticiones); la lente es decorativa (`aria-hidden`), la información va en el `alt`.

## Filtros de galería con Flip

```html
<div class="filters" role="group" aria-label="Filtrar proyectos">
  <button data-filter="all" aria-pressed="true">Todos</button><button data-filter="web" aria-pressed="false">Web</button>
</div>
<ul class="grid" aria-live="polite"><li class="card" data-tag="web">…</li> <!-- n cards --></ul>
```

```js
const cards = gsap.utils.toArray('.card');
function applyFilter(tag) {
  const state = Flip.getState(cards);
  cards.forEach((el) => { el.style.display = tag === 'all' || el.dataset.tag === tag ? '' : 'none'; });
  Flip.from(state, {
    duration: 0.5, ease: 'power2.inOut', stagger: 0.03, absolute: true, // absolute evita colisiones de layout durante el vuelo
    onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.04 }),
    onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.92, duration: 0.3 }),
  });
}
// listener en .filters: closest('[data-filter]') → actualizar aria-pressed de todos los botones + applyFilter(btn.dataset.filter)
```

- `aria-live="polite"` en el grid anuncia el cambio; mejor aún: un contador oculto "8 proyectos" actualizado tras filtrar.
- Con reduced-motion pasa `duration: 0` a `Flip.from` (el reordenado sigue siendo instantáneo y correcto).
- En frameworks, filtra mutando la lista reactiva: `Flip.getState` antes del cambio de estado y `Flip.from` en `nextTick`/`useLayoutEffect`.

## Cursor personalizado

```html
<div class="cursor" aria-hidden="true"><span class="cursor-label"></span></div>
<a href="/proyecto" data-cursor="view">…</a> <div class="inf-gallery" data-cursor="drag">…</div>
<!-- CSS: .cursor{position:fixed;top:-20px;left:-20px;width:40px;height:40px;border-radius:50%;background:#fff;mix-blend-mode:difference;
     pointer-events:none;z-index:9999;display:grid;place-items:center} @media (pointer: coarse), (prefers-reduced-motion: reduce){.cursor{display:none}} -->
```

```js
const mm = gsap.matchMedia();
mm.add('(pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
  const cursor = document.querySelector('.cursor'), label = cursor.querySelector('.cursor-label');
  const opts = { duration: 0.35, ease: 'power3.out' };
  const xTo = gsap.quickTo(cursor, 'x', opts), yTo = gsap.quickTo(cursor, 'y', opts);
  const move = (e) => { xTo(e.clientX); yTo(e.clientY); };
  const over = (e) => {
    const mode = e.target.closest('[data-cursor]')?.dataset.cursor ?? '';
    label.textContent = mode === 'view' ? 'Ver' : mode === 'drag' ? 'Arrastrar' : mode; // texto libre en data-cursor
    gsap.to(cursor, { scale: mode ? 2.2 : 1, duration: 0.3, ease: 'power2.out' });
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerover', over);
  return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerover', over); };
});
```

- No pongas `cursor: none` global: el cursor nativo sigue visible debajo (a11y y fallback si el follower falla o hay lag).
- `mix-blend-mode: difference` exige fondo con contraste; sobre grises medios se pierde: añade borde o color plano por sección.
  El CSS ya lo oculta en táctil y reduced-motion; el matchMedia evita además el coste de los listeners.

## Video scrubbing con currentTime

```html
<section class="vscrub"><video class="vscrub-video" muted playsinline preload="auto" src="clip.mp4"></video></section>
```

```js
const section = document.querySelector('.vscrub'), video = section.querySelector('.vscrub-video'), proxy = { t: 0 };
video.addEventListener('loadedmetadata', () => {
  gsap.to(proxy, {
    t: video.duration, ease: 'none',
    scrollTrigger: { trigger: section, start: 'top top', end: '+=300%', scrub: true, pin: true },
  });
}, { once: true });
const tick = () => { if (video.duration) video.currentTime += (proxy.t - video.currentTime) * 0.15; }; // lerp: suaviza los saltos de seek
gsap.ticker.add(tick); // cleanup: gsap.ticker.remove(tick)
```

- El seek solo es fluido con keyframes densos: `ffmpeg -i in.mp4 -g 1 -crf 24 -movflags +faststart out.mp4`; si no, el navegador salta al I-frame más cercano y tiembla.
- iOS necesita `muted playsinline`; si el primer seek no responde, en la primera interacción haz `video.play().then(() => video.pause())`.
- Para clips largos, 4K o scrub a 60 fps garantizado, usa la secuencia de frames en canvas (`scrolltrigger-patterns.md` §13): más peso, cero jank.

## Stacking cards completo

```html
<div class="stack"><article class="stack-card">…</article> <!-- x4 --></div>
<!-- CSS: .stack{display:grid;gap:4rem} .stack-card{position:sticky;top:8vh;min-height:80vh;border-radius:24px;overflow:hidden} -->
```

```js
const cards = gsap.utils.toArray('.stack-card');
cards.forEach((card, i) => {
  if (i === cards.length - 1) return; // la última nunca se tapa
  gsap.to(card, {
    scale: 0.92, rotation: (i % 2 ? 1 : -1) * 1.2, filter: 'blur(4px)', transformOrigin: 'center top', ease: 'none',
    scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top top', scrub: true }, // se degrada mientras la siguiente la cubre
  });
});
```

- La versión sticky no necesita `pin` (menos frágil en resize/refresh). Variante pin: contenedor con `pin: true, end: '+=' + cards.length * 100 + '%'` y timeline que trae cada card con `yPercent: 100 → 0`; útil para snap por card.
- `filter: blur` fuerza repaint de la card entera: limita a ≤ 6px y elimínalo en móvil (`gsap.matchMedia` por ancho).
- Reduced-motion: sin tweens, las cards quedan como lista sticky legible; el contenido nunca depende del efecto.

## Parallax de imagen en contenedor

```html
<div class="parallax-media"><img src="photo.jpg" alt="…" width="1200" height="800"></div>
<!-- CSS: .parallax-media{overflow:hidden;aspect-ratio:3/2} .parallax-media img{width:100%;height:125%;object-fit:cover} -->
```

```js
gsap.utils.toArray('.parallax-media img').forEach((img) => {
  gsap.fromTo(img, { yPercent: -10 }, {
    yPercent: 10, ease: 'none',
    scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
  });
});
```

- Anti-CLS: `aspect-ratio` (o `width`/`height` en el `<img>`) fija el alto del contenedor antes de cargar la imagen; al 125% de alto,
  `yPercent` ±10 (= ±12.5% del contenedor) recorre exactamente el excedente sin dejar bordes vacíos.
- Diferencia con el zoom (`scrolltrigger-patterns.md` §11): aquí se **traslada** una imagen mayor que su marco (sin resampleo, nítida); el zoom escala en sitio y pierde nitidez pasado ~1.2x.
- Si la sección lleva texto encima, limita el rango a ±6 y desactívalo en móvil: el parallax compite con la legibilidad.
