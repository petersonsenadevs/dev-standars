# Rendimiento y accesibilidad

## 1. Qué animar

Solo propiedades que no disparan layout ni paint costoso:

| Anima | Evita | Alternativa |
|---|---|---|
| `x`, `y`, `scale`, `rotation`, `xPercent` | `left`, `top`, `margin`, `width`, `height` | transforms |
| `opacity` / `autoAlpha` | `visibility` sola, `display` | `autoAlpha` |
| `clipPath` | `height: auto` | `clipPath: 'inset(...)'` o `grid-template-rows` |
| `filter` (con cuidado, coste GPU) | `box-shadow` animado | pseudo-elemento con sombra + `opacity` |
| `backgroundColor` en pocos elementos | `background-position` | `x/y` en un hijo |

`height: auto` no es animable directamente. Opciones:

```js
// 1. clip-path sobre un contenedor de altura conocida
gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' });

// 2. grid-template-rows (0fr -> 1fr) — el hijo debe tener min-height: 0 y overflow: hidden
gsap.fromTo(wrapper, { gridTemplateRows: '0fr' }, { gridTemplateRows: '1fr', duration: 0.35 });

// 3. medir: height: 'auto' funciona en GSAP (mide internamente) pero dispara layout; aceptable en 1 elemento, no en listas
gsap.to(el, { height: 'auto', duration: 0.3 });
```

## 2. `will-change`

- Solo en elementos que van a animarse de forma inminente y repetida (parallax, scrub, drag). Nunca `will-change: transform` global.
- Cada `will-change` crea una capa de composición: memoria GPU. En móvil, decenas de capas degradan todo.
- GSAP añade `translate3d`/`force3D` automáticamente en tweens de transform (`force3D: 'auto'` por defecto: 3D durante la animación, vuelve a 2D al terminar). Suele bastar sin `will-change`.
- Si lo usas, aplícalo y quítalo:

```js
scrollTrigger: {
  onEnter: () => gsap.set(el, { willChange: 'transform' }),
  onLeave: () => gsap.set(el, { willChange: 'auto' }),
  onEnterBack: () => gsap.set(el, { willChange: 'transform' }),
  onLeaveBack: () => gsap.set(el, { willChange: 'auto' }),
}
```

## 3. `force3D` y `lazy`

- `force3D: true` fuerza capa GPU durante toda la vida del tween; útil para tweens de larga duración con scrub. `force3D: false` para elementos con texto pequeño que se ve borroso en capa 3D.
- `lazy: true` (defecto) retrasa la lectura de valores iniciales hasta el primer render del tween, evitando layout thrash cuando se crean muchos tweens a la vez. Solo desactivar (`lazy: false`) si un `set` inmediato debe leerse en el mismo tick.

## 4. Evitar layout thrash

- No leer (`getBoundingClientRect`, `offsetHeight`) y escribir estilos alternando en un loop. Agrupar lecturas, luego escrituras.
- En `onUpdate` de scrub no leer del DOM; precalcular en `onRefresh` o con funciones en las props (`x: () => ...` + `invalidateOnRefresh: true`).
- `gsap.quickTo`/`quickSetter` para pointer/mousemove; nunca `gsap.to` nuevo por evento.
- Evitar `stagger` sobre cientos de elementos con ScrollTrigger individual: usar `ScrollTrigger.batch`.
- Animar contenedores en vez de hijos cuando el efecto visual es equivalente.

## 5. ScrollTrigger: configuración y número de triggers

```js
ScrollTrigger.config({
  ignoreMobileResize: true, // ignora el resize por barra de dirección en móvil (evita refresh continuos y saltos)
  limitCallbacks: true,     // reduce callbacks de onUpdate cuando no cambian valores
});
```

- Cada ScrollTrigger tiene coste en `refresh()` (mide posiciones) y en cada scroll (compara). Objetivo: < 50 activos por página. Usa `batch`, un trigger por sección con una timeline en vez de uno por elemento, y `once: true` para reveals (se autodestruyen).
- `scrub` numérico (`scrub: 0.5..1`) en lugar de `scrub: true` suaviza y reduce sensación de tirones; en móviles de gama baja, `scrub: true` puede ir más fino porque no acumula retardo.
- `anticipatePin: 1` en pins con scroll rápido.
- `fastScrollEnd: true` para evitar que animaciones con `toggleActions` queden a medias tras un scroll rápido.
- `preventOverlaps: true` o `'group'` para que reveals opuestos no se solapen.

`ScrollTrigger.normalizeScroll(true)`: intercepta el scroll nativo y lo unifica (elimina la barra de dirección que aparece/desaparece en iOS y el problema de pins que saltan). Coste: pierde el scroll nativo (momentum en iOS se simula), rompe `position: fixed` en algunos casos y conflictúa con Lenis. Usarlo solo cuando hay pins críticos en iOS y no se usa smooth scroll. No combinar con Lenis.

## 6. `prefers-reduced-motion` obligatorio

Requisito no negociable. Tres niveles:

1. Movimiento grande (parallax, pins largos, scrub de vídeo, elementos que cruzan la pantalla): desactivar totalmente.
2. Reveals de entrada: sustituir por fade corto (`opacity`, 200 ms) o nada.
3. Micro-interacciones (hover, botón): mantener si son sutiles (`scale 1 -> 1.03`) o reducir duración.

```js
const mm = gsap.matchMedia();

mm.add(
  { motionOk: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' },
  ({ conditions }) => {
    if (conditions.reduce) {
      // estado final directo; nada de scroll-linked
      gsap.set('[data-reveal]', { clearProps: 'all' });
      return;
    }
    gsap.from('[data-reveal]', { y: 40, autoAlpha: 0, stagger: 0.1, scrollTrigger: { trigger: '[data-reveal]', start: 'top 85%' } });
  },
);
```

CSS de respaldo (para cuando JS falla o llega tarde):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

Lenis/ScrollSmoother: no inicializar con reduce. Autoplay de vídeo: pausar.

Toggle de usuario: además de la media query, ofrecer un switch persistente (localStorage) que aplique `data-motion="reduce"` en `<html>` y que `matchMedia` evalúe vía una condición extra (`mm.add({ reduce: '(prefers-reduced-motion: reduce)' , ...})` + comprobación manual del atributo).

## 7. No bloquear la interacción

- No pausar el scroll del usuario ("scroll hijacking") salvo en snaps cortos con `duration.max <= 0.6`.
- Los elementos interactivos deben ser clicables durante y después de la animación: no dejar `pointer-events: none` ni `visibility: hidden` colgados (usar `autoAlpha`, nunca `opacity` sola en elementos que deben desaparecer).
- Foco: si un elemento revelado recibe foco por teclado antes de animarse, debe ser visible (`:focus-within` que fuerza estado final, o `once: true` con `start` generoso).
- Las animaciones de entrada no deben retrasar el LCP: el hero visible en el primer frame (animar desde `opacity: 0.001` no engaña a Lighthouse, pero un `visibility: hidden` en el LCP sí penaliza). Prefiere animar elementos secundarios y mantener la imagen/heading principal visible o con delay mínimo.
- Preloaders: máximo 1-1.5 s, saltables, y nunca en visitas repetidas (sessionStorage).

## 8. Duraciones recomendadas

| Tipo | Duración | Ease |
|---|---|---|
| Micro (hover, toggle, focus) | 150-300 ms | `power2.out` |
| Entrada de elementos (reveal, modal) | 400-800 ms | `power3.out`, `back.out(1.4)` |
| Salida | 60-70 % de la entrada | `power2.in` |
| Transición de página | 300-600 ms total | `power2.inOut` |
| Stagger | 30-80 ms por elemento, total < 1 s | `power2.out` en el stagger |
| Scroll scrub | n/a (ligado al scroll) | `none` |
| Scrub suavizado | `scrub: 0.5-1.5` | `none` |
| Loops ambientales | 4-12 s | `sine.inOut`, `none` |

Los usuarios perciben > 1 s de espera como lentitud. Un `delay` > 300 ms en la primera interacción es un fallo.

## 9. Imágenes, fuentes y refresh

- Reservar espacio (`width`/`height` o `aspect-ratio`) para todas las imágenes que afecten al layout: sin esto ScrollTrigger calcula posiciones erróneas.
- `ScrollTrigger.refresh()` tras `window.load`, `document.fonts.ready` y tras insertar contenido dinámico. No llamarlo en cada frame ni en cada `resize` (ya lo hace internamente con debounce).
- SplitText siempre tras `document.fonts.ready`.

## 10. Móvil

- Probar en dispositivo real (Android gama media y iPhone), no solo en emulación de DevTools: la GPU, la barra de dirección dinámica y el touch scrolling se comportan distinto.
- En móvil: menos capas, sin parallax multicapa, sin horizontal scroll pinned (usar carrusel nativo con `scroll-snap`), `filter: blur` prohibido en scrub.
- `100vh` con barra de dirección: usar `100svh`/`100dvh` en CSS y `ignoreMobileResize: true`.
- Reducir `stagger` y `duration` en móvil con `gsap.matchMedia()` (`isMobile`).
- Medir con Chrome DevTools > Performance en throttling 4x CPU: objetivo 60 fps sin long tasks > 50 ms durante scroll.

## 11. Medición rápida

```js
// contar triggers activos
console.log(ScrollTrigger.getAll().length);

// ver capas de composición: DevTools > Layers
// ver fps: DevTools > Rendering > Frame Rendering Stats
// detectar layout thrash: Performance > buscar "Forced reflow" en warnings
```

## 12. Checklist antes de merge

- Solo transform/opacity/clip-path (excepciones justificadas).
- `prefers-reduced-motion` cubierto vía `gsap.matchMedia`.
- Sin `markers` ni `console.log` en producción.
- `gsap.context`/`useGsap`/`useGSAP` en todo componente; cleanup verificado navegando ida y vuelta.
- `ScrollTrigger.refresh()` tras load/fonts/navegación.
- Número de triggers razonable; `batch` para grids.
- Probado en móvil real y con CPU throttling.
- El contenido es accesible y legible con JS desactivado o antes de que GSAP se ejecute (sin `opacity: 0` permanente en CSS sin fallback).
