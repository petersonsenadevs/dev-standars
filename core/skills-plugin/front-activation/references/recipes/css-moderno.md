# Recetas: CSS nativo moderno (cero JS)

Lo más ligero que existe: lo hace el navegador en el hilo de composición, sin librerías. **Empieza
siempre por aquí** antes de meter GSAP para algo que CSS ya resuelve. Soporte cambiante: comprueba
en caniuse.com y envuelve SIEMPRE en `@supports` con fallback estático.

## Índice
- Animación ligada al scroll
- Reveal al entrar en pantalla
- View Transitions entre páginas
- Entradas con starting-style
- Anchor positioning
- Scroll-snap con estado

## Animación ligada al scroll

Barra de progreso, parallax simple o rotación ligada al scroll de la página, sin JS.
Soporte: Chromium y Safari 26+; Firefox parcial → el `@supports` deja el estado final estático.

```css
@supports (animation-timeline: scroll()) {
  .progreso {
    position: fixed; inset: 0 0 auto 0; height: 3px;
    background: var(--color-primary);
    transform-origin: left;
    animation: crecer linear both;
    animation-timeline: scroll(root block);
  }
  @keyframes crecer { from { transform: scaleX(0); } to { transform: scaleX(1); } }
}
```
Parallax suave de una capa: `animation-timeline: scroll(); animation-range: 0 100vh;` con un
`translate` en los keyframes. Reduced-motion: `@media (prefers-reduced-motion: reduce) { .x { animation: none; } }`.

## Reveal al entrar en pantalla

Sustituye al IntersectionObserver + clase para los reveals de "aparece al hacer scroll".

```css
@supports (animation-timeline: view()) {
  .reveal {
    animation: aparecer linear both;
    animation-timeline: view();
    animation-range: entry 10% cover 30%;
  }
  @keyframes aparecer { from { opacity: 0; translate: 0 2rem; } to { opacity: 1; translate: 0 0; } }
}
@media (prefers-reduced-motion: reduce) { .reveal { animation: none; } }
```
Úsalo con moderación: si TODO aparece al hacer scroll, nada destaca (y huele a plantilla).

## View Transitions entre páginas

Transición entre páginas de una web multipágina (Astro, Laravel Blade, WordPress) sin SPA ni Barba.
Soporte: Chromium 126+ y Safari 18.2+; en el resto la navegación es normal (degradación perfecta).

```css
@view-transition { navigation: auto; }          /* en TODAS las páginas implicadas */
.hero-img { view-transition-name: hero; }        /* mismo nombre en origen y destino = morph */
::view-transition-old(root), ::view-transition-new(root) { animation-duration: .35s; }
@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation: none; } }
```
Nombres únicos por página (`view-transition-name` repetido rompe la transición). En Astro existe
además `<ClientRouter />` para modo SPA; en Next usa la API de React/Next si el proyecto la trae.

## Entradas con starting-style

Animar la APARICIÓN de un elemento que pasa de `display:none` (popover, dialog, toast) sin JS.
Soporte: Chromium 117+, Safari 17.5+, Firefox 129+.

```css
.toast {
  opacity: 1; translate: 0 0;
  transition: opacity .25s, translate .25s, display .25s allow-discrete;
  @starting-style { opacity: 0; translate: 0 1rem; }
}
.toast[hidden] { display: none; opacity: 0; }
```
Combina muy bien con `<dialog>` y el atributo `popover` nativos (accesibles de serie: foco y Escape).

## Anchor positioning

Tooltips, menús y popovers pegados a su botón sin librerías de posicionamiento.
Soporte: Chromium 125+ y Safari 26+; Firefox en progreso → fallback con posicionamiento clásico.

```css
.boton { anchor-name: --menu; }
.menu {
  position: absolute; position-anchor: --menu;
  top: anchor(bottom); left: anchor(left);
  position-try-fallbacks: flip-block;              /* se da la vuelta si no cabe */
}
```

## Scroll-snap con estado

Carruseles y galerías horizontales nativos (sustituye a la librería de carrusel en muchos casos).

```css
.galeria { display: flex; gap: 1rem; overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; }
.galeria > * { flex: 0 0 min(80%, 22rem); scroll-snap-align: start; }
```
Accesibilidad: botones anterior/siguiente visibles (no solo swipe) y `tabindex="0"` en el contenedor.
Si `gustos.md` veta los carruseles, esto también cuenta como carrusel: pregunta antes.
