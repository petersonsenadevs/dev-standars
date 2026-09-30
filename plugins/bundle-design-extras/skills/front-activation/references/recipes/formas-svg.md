# Recetas: formas y SVG

Las formas son lo que más aleja una web de la plantilla de cajas rectangulares: siluetas orgánicas,
cortes entre secciones, máscaras. Regla: UNA familia de formas por proyecto (orgánica, geométrica o
recta), escrita en el MASTER del design system, no una de cada. Código de referencia descargado:
`core/effects-vendor/` (blobs, flubber, vivus) — ver `effect-sources.md`.

## Índice
- Blob orgánico
- Separadores entre secciones
- Morph de clip-path
- Máscaras de imagen con forma
- Efecto gooey
- Dibujado de trazo
- Morph entre formas
- Texto sobre una curva

## Blob orgánico

Versión CSS (cero JS, la primera opción): un `border-radius` de 8 valores que se anima.
```css
.blob {
  aspect-ratio: 1; background: var(--color-primary);
  border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
  animation: blob 12s ease-in-out infinite alternate;
}
@keyframes blob { to { border-radius: 70% 30% 46% 54% / 30% 39% 61% 70%; } }
@media (prefers-reduced-motion: reduce) { .blob { animation: none; } }
```
Blob con forma única y reproducible (por semilla): librería `blobs` (vendor) genera el `path` SVG.
Úsalo como fondo detrás de una foto recortada o como marco de un retrato, no como relleno en cada sección.

## Separadores entre secciones

Onda, curva o diagonal entre dos secciones de distinto color: rompe la sucesión de franjas planas.
```html
<svg class="separador" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 40 C 360 80, 1080 0, 1440 40 L1440 80 L0 80 Z" fill="currentColor"/>
</svg>
```
```css
.separador { display: block; width: 100%; height: clamp(40px, 6vw, 80px); color: var(--color-next-section); }
```
Diagonal sin SVG: `clip-path: polygon(0 0, 100% 0, 100% 85%, 0 100%)` en la sección superior.
Máximo 2 estilos de separador por página; el mismo repetido en todas las secciones cansa.

## Morph de clip-path

Revelar una imagen o sección cambiando la forma del recorte (círculo que crece, diagonal que se abre).
```css
.revelar { clip-path: circle(0% at 50% 50%); transition: clip-path .8s cubic-bezier(.2,.8,.2,1); }
.revelar.visible { clip-path: circle(75% at 50% 50%); }
```
Solo interpola entre formas del MISMO tipo y mismo número de puntos (`polygon` de 4 a `polygon` de 4).
Con scroll: la misma propiedad dentro de un `animation-timeline: view()` (ver css-moderno.md).

## Máscaras de imagen con forma

La foto recortada con una forma de marca (blob, arco, pastilla) en vez del rectángulo con radio.
```css
.foto-forma {
  mask-image: url("/formas/arco.svg");
  mask-size: contain; mask-repeat: no-repeat; mask-position: center;
}
```
Arco sencillo sin archivo: `border-radius: 999px 999px 0 0`. La forma sale del design system.

## Efecto gooey

Elementos que se funden como líquido al acercarse (menús que se despliegan, botones, cursor).
```html
<svg width="0" height="0" aria-hidden="true"><filter id="goo">
  <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b"/>
  <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="g"/>
  <feComposite in="SourceGraphic" in2="g" operator="atop"/>
</filter></svg>
```
```css
.contenedor-goo { filter: url(#goo); }   /* los hijos se funden entre sí */
```
Coste medio (filtro por frame): nunca sobre áreas grandes ni con texto dentro del filtro.

## Dibujado de trazo

Un trazo SVG (firma, ruta, ilustración lineal, logo) que se dibuja al entrar o con el scroll.
```css
.trazo { stroke-dasharray: var(--len); stroke-dashoffset: var(--len); transition: stroke-dashoffset 2s ease; }
.trazo.visible { stroke-dashoffset: 0; }
```
`--len` = `path.getTotalLength()` (una línea de JS al montar). Con scroll: GSAP `DrawSVGPlugin`
(todos los plugins de GSAP son gratuitos desde 2025) con `scrub`, o `vivus` (vendor) sin GSAP.

## Morph entre formas

Un icono que se transforma en otro (menú ↔ cerrar, play ↔ pausa) o una forma de fondo que cambia por sección.
- GSAP `MorphSVGPlugin`: `gsap.to('#a', { morphSVG: '#b', duration: .6 })` — resuelve paths con
  distinto número de puntos.
- Sin GSAP: `flubber` (vendor) interpola dos paths cualesquiera y te da la función por frame.
Transiciones cortas (≤ 600 ms) en iconos; reduced-motion: cambio instantáneo de icono.

## Texto sobre una curva

Texto que sigue un arco o círculo (sellos, badges giratorios, titulares de autor).
```html
<svg viewBox="0 0 200 200" role="img" aria-label="Hecho a mano en Valencia">
  <path id="circulo" d="M100,100 m-75,0 a75,75 0 1,1 150,0 a75,75 0 1,1 -150,0" fill="none"/>
  <text><textPath href="#circulo">HECHO A MANO · VALENCIA · </textPath></text>
</svg>
```
Rotación lenta opcional (`animation: spin 20s linear infinite`, fuera con reduced-motion). El texto
va también en `aria-label`: el lector de pantalla no lee bien `textPath`.
