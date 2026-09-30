# Composiciones de página: las "maneras" de ordenar una web

Los efectos decoran; la COMPOSICIÓN es lo que hace que una web no parezca plantilla. La plantilla IA
es siempre la misma: hero centrado → tres cards con icono → franja de logos → testimonios → CTA.
Cambiar la estructura de las secciones aleja más de eso que cualquier animación.

**Reglas**: mínimo **2 composiciones distintas por página** (no todas las secciones con el mismo
esquema) · la composición se elige por el CONTENIDO real (no hay bento sin 5-7 piezas que meter) ·
la elegida queda en el blueprint del modo propuesta · el móvil se diseña aparte (casi todas acaban en
una columna: decide el ORDEN de lectura, no lo dejes al azar del grid).

## Índice
- Bento
- Editorial de revista
- Rejilla rota
- Pantalla dividida
- Storytelling con panel fijo
- Asimétrica
- Índice o lista grande
- Full-bleed alternado
- Qué composición por tipo de negocio

## Bento

Rejilla de piezas de tamaños distintos (una grande, varias pequeñas) como una caja de bento.
Cuándo: resumir 5-7 capacidades o datos de un producto de un vistazo; dashboards de marketing.
```css
.bento { display: grid; gap: 1rem; grid-template-columns: repeat(4, 1fr); grid-auto-rows: minmax(10rem, auto); }
.bento .destacada { grid-column: span 2; grid-row: span 2; }
.bento .ancha { grid-column: span 2; }
@media (max-width: 48rem) { .bento { grid-template-columns: 1fr; } .bento > * { grid-column: auto; grid-row: auto; } }
```
Trampa: bento con todas las piezas iguales = tres cards con otro nombre. Cada celda con contenido
distinto (una cifra, una captura, una cita, una micro-demo).

## Editorial de revista

Columnas de texto, titulares grandes, capitulares, imágenes que rompen la columna, pies de foto.
Cuándo: marcas con contenido (estudios, arquitectura, gastronomía, moda, cultura, blogs cuidados).
Grid de 12 columnas con el texto en 6-7 y las imágenes saltando a 9-12; serif de lectura, `max-width`
de línea ~65 caracteres, espaciado vertical generoso.

## Rejilla rota

Elementos que se solapan o se salen de la retícula a propósito (una foto que invade la sección
siguiente, un titular que pisa una imagen). Cuándo: marcas creativas, portfolios, moda.
```css
.rota { display: grid; grid-template-columns: repeat(12, 1fr); }
.rota .foto { grid-column: 2 / 8; grid-row: 1; }
.rota .titular { grid-column: 6 / 12; grid-row: 1; align-self: end; z-index: 1; margin-bottom: -3rem; }
```
Trampa: "rota" no es "desordenada": la ruptura es UNA y deliberada; el resto alineado a retícula
(si no, la crítica visual lo suspende en alineación).

## Pantalla dividida

Dos mitades con contenidos distintos (imagen/texto, dos servicios, antes/después, dos públicos).
Cuándo: elegir entre dos caminos ("Soy particular / Soy empresa"), productos con dos caras.
`grid-template-columns: 1fr 1fr` con `min-height: 100svh`; en móvil apilado con la mitad más
importante primero.

## Storytelling con panel fijo

Un lado queda fijo (imagen, mockup del producto) mientras el otro avanza por pasos y el fijo cambia
con cada paso. Cuándo: explicar un proceso o un producto en 3-5 pasos.
```css
.historia { display: grid; grid-template-columns: 1fr 1fr; }
.historia .fijo { position: sticky; top: 10vh; height: 80vh; }
```
El cambio del panel por paso con IntersectionObserver o ScrollTrigger (sin pin: `sticky` basta).
Móvil: el panel pasa a imagen propia encima de cada paso.

## Asimétrica

Columnas desiguales (2/3 + 1/3, 5 + 7) y márgenes deliberados en vez de todo centrado.
Cuándo: casi siempre como alternativa al hero centrado; da tensión y dirección de lectura.
Texto alineado a la izquierda en una columna estrecha + imagen o dato grande en la ancha.

## Índice o lista grande

Servicios, proyectos o artículos como una lista tipográfica enorme (una línea por elemento, número o
año a la derecha, imagen que aparece al pasar el ratón). Cuándo: estudios, agencias, portfolios,
cartas de restaurante. Sustituye a la cuadrícula de cards: más elegante y más rápida de escanear.
Hover con imagen flotante: solo en puntero fino (`@media (hover: hover)`); en móvil, miniatura fija.

## Full-bleed alternado

Secciones que alternan entre ancho completo (imagen o color a sangre) y contenido estrecho centrado.
Cuándo: webs con mucha fotografía (turismo, inmobiliaria, hostelería). Da ritmo sin efectos.
`.a-sangre { width: 100vw; margin-inline: calc(50% - 50vw); }` y el resto con `max-width` de lectura.

## Qué composición por tipo de negocio

| Negocio | Composiciones que suelen funcionar | Evitar |
|---|---|---|
| SaaS / producto digital | Bento, storytelling con panel fijo, asimétrica | Tres cards clónicas |
| Estudio creativo / agencia / portfolio | Índice grande, rejilla rota, editorial | Bento genérico |
| Restaurante / hostelería | Full-bleed alternado, editorial, índice (carta) | Dashboards y bentos |
| Servicios locales (reformas, clínica, abogado) | Asimétrica, pantalla dividida (particular/empresa), storytelling del proceso | Rejilla rota (resta confianza) |
| Tienda / e-commerce | Full-bleed de colección, bento de categorías, editorial de producto | Storytelling largo antes del catálogo |
| Inmobiliaria / turismo | Full-bleed alternado, pantalla dividida | Listas tipográficas sin fotos |

Elegir por el contenido que YA existe: si el cliente no tiene fotos buenas, ninguna composición
fotográfica funciona — antes, resuelve las imágenes (skill image-gen o sesión de fotos).
