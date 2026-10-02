# Versión móvil: pensarla, no encogerla

## Índice
- [La regla](#la-regla)
- [1. Plan «En móvil» por sección](#1-plan-en-móvil-por-sección)
- [2. Efectos: ¿funciona y encaja en táctil?](#2-efectos-funciona-y-encaja-en-táctil)
- [3. Navegación: burger, barra inferior o nada (y el kebab)](#3-navegación-burger-barra-inferior-o-nada-y-el-kebab)
- [4. Tamaños: cómo sale todo a 375 px](#4-tamaños-cómo-sale-todo-a-375-px)
- [5. Hover: cada hover necesita su versión táctil](#5-hover-cada-hover-necesita-su-versión-táctil)
- [6. Verificar: la cifra Y la captura](#6-verificar-la-cifra-y-la-captura)

## La regla
El móvil NO es la web de escritorio estrecha. Antes de maquetar, cada sección y cada efecto se DECIDE para
móvil (se queda, cambia o se quita, y por qué). La mayoría de visitas de una web de negocio llegan desde el
móvil: si solo se piensa en escritorio, se diseña para la minoría.

## 1. Plan «En móvil» por sección
El blueprint (`proposal-mode.md`) lleva una columna **En móvil** y no se aprueba sin ella. Una línea por
sección, con las cuatro decisiones:

| Decisión | Pregunta | Ejemplo |
|---|---|---|
| Orden | ¿Qué va primero cuando todo es una columna? | «foto DEBAJO del titular; el teléfono, arriba del todo» |
| Efecto | ¿Se queda, se degrada o se quita? (§2) | «el tilt de las cards → fuera; entrada con fade corto» |
| Interacción | ¿Qué era hover y qué es ahora? (§5) | «el detalle del proyecto, visible siempre bajo la foto» |
| Tamaño | ¿Cuánto mide lo importante? (§4) | «h1 36 px, 3 líneas máx.; CTA ancho completo 48 px» |

Las rejillas se deciden, no se apilan sin más: 3 columnas → 1 columna, o carrusel horizontal con
`scroll-snap` (se ve asomar la siguiente tarjeta), o 2 columnas si son iconos cortos. Tablas → tarjetas
por fila o scroll horizontal dentro de su caja, nunca de la página.

## 2. Efectos: ¿funciona y encaja en táctil?
Cuatro preguntas para cada efecto del catálogo (`front-activation` → `references/effects-catalog.md`,
columna **Coste móvil**):
1. **¿Depende del ratón?** (cursor propio, magnético, tilt, spotlight, imagen que sigue al puntero) →
   en táctil NO existe: se quita con `@media (hover: hover) and (pointer: fine)`.
2. **¿Necesita ancho?** (scroll horizontal anclado, rejilla rota, texto gigante que cruza la pantalla) →
   versión vertical, o el mismo contenido apilado.
3. **¿Cuesta batería o GPU?** (WebGL, partículas, vídeo de fondo, muchos blur/backdrop-filter) → imagen
   o vídeo póster en móvil; máximo un efecto de coste Alto por página, y en móvil degradado.
4. **¿Pelea con el scroll del dedo?** (scroll secuestrado, pin muy largo, parallax con
   `background-attachment: fixed`, que iOS ignora) → fuera, o con `ScrollTrigger.matchMedia`.

| Efecto en escritorio | En móvil |
|---|---|
| Hover que revela info / imagen flotante | Visible siempre, o un toque que despliega |
| Cursor propio, botón magnético, tilt 3D | Se quita (nada lo sustituye: el dedo tapa lo que toca) |
| Scroll horizontal anclado (pin) | Apilado vertical o carrusel con `scroll-snap` |
| Parallax de fondo | Fondo normal; como mucho, un desplazamiento leve con `transform` |
| Escena 3D / WebGL | Imagen o vídeo póster (`playsinline muted`), lazy |
| Texto que se anima letra a letra | Se queda si es corto (titular); en párrafos, fuera |
| Marquee / cinta de logos | Se queda, más lenta y pausable |
| Tarjetas apiladas en sticky | Se quedan si cada una mide < 70 % de la pantalla |

## 3. Navegación: burger, barra inferior o nada (y el kebab)
- **≤ 4 enlaces cortos**: visibles en una fila (o logo + 1-2 enlaces + CTA). Sin menú escondido.
- **5 o más**: **burger ☰** (con la palabra «Menú» al lado si el público es mayor o poco digital). El CTA
  principal (llamar, pedir presupuesto) queda FUERA del menú, visible en la cabecera.
- **App con 3-5 destinos que se usan a diario**: **barra inferior** (tab bar) con icono + texto; burger
  solo para lo secundario.
- **Kebab ⋮ / meatballs ⋯**: NUNCA para la navegación principal. Solo acciones secundarias de UN elemento
  (una tarjeta, una fila de tabla: editar, duplicar, borrar).

Burger bien hecho: botón ≥ 44×44 (48 mejor) con `aria-label="Menú"`, `aria-expanded` y
`aria-controls`; el panel a pantalla completa o cajón lateral, por encima de todo (`z-index` y su propio
contexto de apilamiento); enlaces de 48 px de alto; Escape cierra y devuelve el foco al botón; el body no
hace scroll detrás; el botón se convierte en ✕ en el mismo sitio.

## 4. Tamaños: cómo sale todo a 375 px
| Elemento | Móvil (375) | Nota |
|---|---|---|
| Texto base | 16-18 px, interlineado 1,5-1,6 | 30-45 caracteres por línea |
| h1 | 32-44 px con `clamp()` | ≤ 3-4 líneas; nunca más de media pantalla |
| h2 / h3 | 24-30 px / 19-22 px | |
| Campos de formulario | 16 px como mínimo | con menos, iPhone hace zoom al tocar |
| Botones y enlaces sueltos | ≥ 44×44 px (48 mejor), separados ≥ 8 px | CTA principal a ancho completo |
| Cabecera fija | 56-64 px | que no tape más del 10-15 % de la pantalla |
| Margen lateral | 16-20 px | igual en toda la página |
| Separación entre secciones | 48-64 px | la mitad o dos tercios de la de escritorio |

El primer pantallazo (≈ 700 px de alto) debe contener: qué es, para quién y el CTA o el teléfono.

## 5. Hover: cada hover necesita su versión táctil
En móvil no hay hover: lo que solo aparece con `:hover` NO EXISTE para quien usa el dedo.
- Info que se revela → visible siempre en móvil, o con un toque (botón con `aria-expanded`).
- Submenú desplegable con hover → se abre con un toque (y con teclado: `:focus-within`).
- Tooltip → texto visible o un botón «i» que lo despliega.
- Efecto decorativo (zoom de la foto, subrayado animado) → se limita a `@media (hover: hover)`, y el
  estado `:active` da respuesta al toque.

## 6. Verificar: la cifra Y la captura
`ui-verify` (`scripts/verify-ui.mjs`) a 375 mide lo que se suele mirar a ojo: hover sin versión táctil,
campos < 16 px, fijos que tapan, fondos fijos, cursor propio, h1 que se come la pantalla, navegación que no
cabe, y **usa el menú de verdad** (lo pulsa, mide el panel abierto, lo captura y prueba Escape). Imprime los
**tamaños reales** (h1, párrafo, cabecera, primer CTA) para compararlos con la tabla del §4.

Las dos cosas a la vez:
- Cada aviso lleva un número (`[m2]`, `[g1]`) que aparece recuadrado en `375-anotada.png`: ábrela y
  confirma o descarta el aviso MIRÁNDOLO (un aviso que en la captura está bien se anota en el devlog con el
  porqué, no se ignora en silencio).
- Lo que en la captura parece torcido, apretado o grande se MIDE antes de corregirlo (el número de la
  geometría manda sobre la impresión).
- `375-menu.png` es el menú abierto: revisa jerarquía, que el CTA esté y que nada se corte.
