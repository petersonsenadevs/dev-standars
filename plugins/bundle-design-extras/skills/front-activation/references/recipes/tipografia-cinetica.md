# Recetas: tipografía cinética

Cuando la tipografía ES el diseño (portfolios, marcas con personalidad, editoriales). Regla: una
pieza tipográfica protagonista por página; el resto del texto, quieto y legible. Nunca animes
párrafos de lectura. Para reveal por líneas y por caracteres ya existen recetas en el catálogo
(sección Texto); aquí va lo que faltaba.

## Índice
- Fuente variable animada
- Vídeo dentro del texto
- Texto que se resalta al leerlo
- Split-flap
- Titular gigante con scroll
- Dividir texto correctamente

## Fuente variable animada

Una fuente variable (eje `wght`, `wdth`, `slnt` o ejes propios) que cambia con el hover o el scroll:
el peso "respira" sin cambiar de archivo de fuente. Elige la fuente en `fonts-icons.md` (Google
Fonts marca las variables); sin eje, no hay efecto.
```css
.titular { font-variation-settings: "wght" 300; transition: font-variation-settings .4s ease; }
.titular:hover { font-variation-settings: "wght" 800; }
@supports (animation-timeline: view()) {
  .titular-scroll { animation: peso linear both; animation-timeline: view(); animation-range: cover 0% cover 50%; }
  @keyframes peso { from { font-variation-settings: "wght" 200; } to { font-variation-settings: "wght" 900; } }
}
```
Por letra (efecto ola al pasar el ratón): divide en caracteres y aplica el peso con un retraso por índice.

## Vídeo dentro del texto

Un titular enorme por el que se ve un vídeo o imagen.
```html
<div class="texto-video">
  <video autoplay muted loop playsinline poster="poster.webp" src="clip.mp4" aria-hidden="true"></video>
  <h2>OCÉANO</h2>
</div>
```
```css
.texto-video { position: relative; }
.texto-video video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.texto-video h2 { position: relative; margin: 0; background: #fff; color: #000; mix-blend-mode: screen;
  font-size: clamp(4rem, 18vw, 16rem); font-weight: 900; line-height: .9; }
```
Con imagen fija basta `background-clip: text; color: transparent`. Reduced-motion: pausar el vídeo
(mostrar el poster). En móvil valora imagen en vez de vídeo (peso).

## Texto que se resalta al leerlo

Frase larga que se "enciende" palabra a palabra o con un subrayado de rotulador según avanzas.
```css
.resaltado {
  background: linear-gradient(var(--color-highlight), var(--color-highlight)) no-repeat 0 85% / 0% 35%;
}
@supports (animation-timeline: view()) {
  .resaltado { animation: rotulador linear both; animation-timeline: view(); animation-range: entry 40% cover 50%; }
  @keyframes rotulador { to { background-size: 100% 35%; } }
}
```
Variante "palabras que pasan de gris a negro": divide en palabras y anima `opacity` de .25 a 1 con
GSAP `scrub` y `stagger`. Solo en UNA frase clave, nunca en un bloque entero.

## Split-flap

Letras que giran como el panel de un aeropuerto hasta formar la palabra (ideal para cifras, horarios,
nombres de destino). Cada letra recorre caracteres aleatorios y se detiene en la suya con retraso creciente.
```js
function splitFlap(el, final, { vueltas = 8, paso = 45 } = {}) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  el.setAttribute('aria-label', final);                      // el lector lee la palabra final
  [...final].forEach((letra, i) => {
    const span = el.children[i] ?? el.appendChild(document.createElement('span'));
    span.setAttribute('aria-hidden', 'true');
    let n = 0;
    const t = setInterval(() => {
      span.textContent = n++ >= vueltas + i * 2 ? letra : abc[Math.floor(Math.random() * abc.length)];
      if (span.textContent === letra && n > vueltas + i * 2) clearInterval(t);
    }, paso);
  });
}
```
Fuente monoespaciada (evita saltos de ancho). Reduced-motion: escribir la palabra final directamente.

## Titular gigante con scroll

Un titular a sangre (ocupa todo el ancho) que escala, se desplaza en horizontal o se recorta al hacer
scroll: la tipografía como imagen de portada.
- Tamaño: `font-size: clamp(3rem, 15vw, 14rem)`; `line-height: .85`; `letter-spacing` ligeramente negativo.
- Desplazamiento horizontal ligado al scroll: `translate` en keyframes con `animation-timeline: view()`
  o GSAP `scrub` (receta de scroll horizontal del catálogo si se pina).
- En móvil comprueba que no provoca scroll horizontal (ui-verify lo detecta) — usa `overflow-x: clip` en la sección.

## Dividir texto correctamente

Toda animación por letras o palabras necesita dividir el texto sin romper la accesibilidad:
- GSAP `SplitText` (gratuito desde 2025): gestiona líneas reales tras el reflow y tiene `revert()`.
- `Splitting.js` (vendor, sin GSAP): añade variables CSS por carácter (`--char-index`) para animar solo con CSS.
- Siempre: el texto completo accesible (`aria-label` en el contenedor y `aria-hidden` en los fragmentos) y
  volver a dividir al cambiar el tamaño de ventana si se divide por líneas.
