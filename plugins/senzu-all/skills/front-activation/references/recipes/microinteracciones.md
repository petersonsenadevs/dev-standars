# Recetas: microinteracciones, menús y entrada

Lo que hace que una interfaz se sienta cuidada: respuestas pequeñas y rápidas a lo que hace el usuario.
Reglas: duración 150-300 ms, una sola cosa se mueve a la vez, y todas informan de algo (estado, éxito,
error). Una microinteracción que no informa es decoración. Loaders y botones de referencia en
`core/effects-vendor/` (uiverse-galaxy, whirl, css-loaders, svg-spinners).

## Índice
- Estados de botón
- Toggle y checkbox animados
- Skeleton con brillo
- Like con explosión
- Toasts apilables
- Loader con marca
- Menú a pantalla completa
- Hamburguesa que se transforma
- Preloader con porcentaje
- Intro de marca

## Estados de botón

Enviar → cargando → hecho (o error) en el propio botón, sin cambiar su ancho.
```css
.btn { display: inline-grid; place-items: center; min-width: 10rem; }
.btn > * { grid-area: 1 / 1; transition: opacity .2s, scale .2s; }      /* capas superpuestas: ancho estable */
.btn:not([data-state="loading"]) .spinner, .btn:not([data-state="done"]) .check { opacity: 0; scale: .6; }
.btn[data-state="loading"] .label, .btn[data-state="done"] .label { opacity: 0; }
```
JS: `data-state` pasa a `loading` al enviar (y `disabled` + `aria-busy="true"`), a `done` 1,5 s y vuelve.
El texto de estado se anuncia en una región `aria-live="polite"`. Receta de formularios: `forms-ux.md`.

## Toggle y checkbox animados

Siempre sobre el input nativo (accesible de serie), nunca un div con onClick.
```css
.toggle { appearance: none; width: 2.75rem; height: 1.5rem; border-radius: 999px; background: var(--color-muted);
  position: relative; transition: background .2s; }
.toggle::after { content: ""; position: absolute; inset: 3px auto 3px 3px; aspect-ratio: 1; border-radius: 50%;
  background: #fff; transition: translate .2s cubic-bezier(.3,1.4,.6,1); }
.toggle:checked { background: var(--color-primary); }
.toggle:checked::after { translate: 1.25rem 0; }
.toggle:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
```
Checkbox con check que se dibuja: `stroke-dasharray` del trazo (ver formas-svg.md, dibujado de trazo).

## Skeleton con brillo

Hueco con la forma del contenido mientras carga (mejor que un spinner para listas y tarjetas).
```css
.skeleton { background: linear-gradient(90deg, var(--sk-base) 25%, var(--sk-shine) 50%, var(--sk-base) 75%) 0 0 / 200% 100%;
  animation: brillo 1.4s linear infinite; border-radius: var(--radius-sm); }
@keyframes brillo { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
```
Misma altura que el contenido real (si no, salta al cargar: CLS). Contenedor con `aria-busy="true"`.

## Like con explosión

Corazón que late y lanza unas partículas al marcar favorito. Escala con rebote + 6-8 puntos que salen
en círculo y se desvanecen (`translate` calculado con `cos/sin` del ángulo, 400 ms). El estado va en
`aria-pressed` del botón. Solo en acciones positivas y frecuentes (favorito, guardar), nunca en todo.

## Toasts apilables

Avisos que entran desde una esquina y se apilan (el nuevo delante, los viejos se reducen detrás).
Entrada con `@starting-style` (css-moderno.md), contenedor `aria-live="polite"` presente desde el
inicio, cierre con botón + automático a los 4-6 s (pausado mientras el ratón o el foco están encima).
Errores críticos: NO en toast (se pierden) → mensaje junto a lo que falló.

## Loader con marca

Un loader que usa la forma o el símbolo de la marca en vez del spinner genérico (el logo que se dibuja,
las letras que laten). Base: `whirl` / `svg-spinners` (vendor) recoloreado con los tokens. Solo aparece
si la espera supera ~400 ms (antes, parpadea y molesta).

## Menú a pantalla completa

El menú ocupa la pantalla con enlaces grandes y una transición de entrada (cortina, círculo desde el botón).
- Revelado: `clip-path: circle(0 at <posición del botón>)` → `circle(150%)` (ver morph de clip-path).
- Enlaces con entrada escalonada (60-80 ms entre ellos).
- Accesibilidad obligatoria: `aria-expanded` en el botón, foco atrapado dentro, Escape cierra y el foco
  vuelve al botón, `body` sin scroll mientras está abierto (a11y-build.md, contrato del modal).

## Hamburguesa que se transforma

Tres líneas que se convierten en X. Con CSS sobre spans o con morph de SVG (formas-svg.md).
```css
.burger span { display: block; height: 2px; background: currentColor; transition: rotate .3s, translate .3s, opacity .2s; }
.burger[aria-expanded="true"] span:nth-child(1) { translate: 0 6px; rotate: 45deg; }
.burger[aria-expanded="true"] span:nth-child(2) { opacity: 0; }
.burger[aria-expanded="true"] span:nth-child(3) { translate: 0 -6px; rotate: -45deg; }
```
El botón lleva `aria-label="Abrir menú"`/`"Cerrar menú"` según el estado.

## Preloader con porcentaje

SOLO si la página carga assets pesados de verdad (modelo 3D, vídeo, secuencia de imágenes): el porcentaje
sale del progreso real (`THREE.LoadingManager`, eventos de carga), nunca de un temporizador falso.
En webs normales NO hay preloader: retrasa el contenido y empeora el LCP (web-performance.md).

## Intro de marca

Una animación de logo o frase al entrar, **una vez por sesión** (`sessionStorage`), saltable con
clic/tecla, de 1,5 s como máximo, y nunca delante de contenido que el usuario vino a buscar (tiendas,
reservas). Reduced-motion: sin intro.
