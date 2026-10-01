# Accesibilidad de construcción: hacerlo bien ANTES de que axe lo pille

Índice: 1 Semántica primero · 2 Teclado · 3 Formularios · 4 Imágenes y media · 5 ARIA (lo justo) ·
6 Componentes típicos (modal, menú, tabs, acordeón) · 7 Movimiento y contraste · 8 Checklist rápida

## 1. Semántica primero (el 80% gratis)
- HTML correcto ANTES que ARIA: `<button>` para acciones, `<a href>` para navegación (un div con onClick
  no es ninguno de los dos), `<nav> <main> <header> <footer>`, listas reales, tablas para datos tabulares.
- UN `<h1>` por página y jerarquía sin saltos (h2 → h3): los lectores de pantalla navegan por encabezados.
- El orden del DOM = orden de lectura. No "arregles" con CSS (`order`, absolute) un orden ilógico del HTML.
- Idioma declarado (`<html lang="es">`) y `lang` puntual en fragmentos en otro idioma.

## 2. Teclado (si no funciona sin ratón, está roto)
- TODO lo interactivo alcanzable con Tab, en orden lógico, y accionable con Enter/Espacio.
- **Focus visible SIEMPRE**: `:focus-visible` con estilo claro (anillo 2px+). `outline: none` sin
  sustituto es un bug, no una decisión estética.
- Nada de `tabindex` > 0 (rompe el orden natural); `tabindex="-1"` solo para focus programático.
- Skip link ("Saltar al contenido") como primer elemento enfocable en páginas con navegación larga.
- Lo que se abre se cierra con Escape; al cerrar, el focus VUELVE a quien lo abrió.

## 3. Formularios
- Cada campo con `<label for>` real (placeholder NO es label: desaparece al escribir).
- Errores: texto junto al campo + `aria-describedby` apuntándole + `aria-invalid="true"`; al enviar con
  errores, focus al primer campo erróneo. Nunca solo color rojo (§7).
- Agrupa radios/checkboxes con `<fieldset><legend>`. `autocomplete` correcto (name, email, tel…).
- El botón de enviar dice qué hace ("Enviar solicitud", no "OK") y muestra estado de carga accesible.

## 4. Imágenes y media
- `alt` que describe la FUNCIÓN ("Logo de Acme, ir al inicio"), no "imagen de"; decorativas → `alt=""`
  (nunca sin atributo). Iconos-botón: `aria-label` en el botón y el SVG con `aria-hidden="true"`.
- Vídeo con subtítulos; nada de autoplay con sonido; controles nativos salvo motivo.

## 5. ARIA: lo justo (mal ARIA es peor que ninguno)
- Primera regla de ARIA: no uses ARIA si hay elemento nativo que lo hace.
- Lo que SÍ usarás: `aria-label` (nombre a lo que no tiene texto), `aria-expanded` (disclosure/menú),
  `aria-current="page"` (item activo de nav), `aria-live="polite"` (contenido que cambia solo: toasts,
  resultados), `aria-hidden` (decoración duplicada).
- Roles compuestos (menu, listbox, dialog) exigen implementar TODO su teclado: usa librería accesible
  (Radix/Headless UI/shadcn) antes que un rol a medio hacer.

## 6. Componentes típicos — el contrato mínimo
- **Modal**: focus dentro al abrir (trap), Escape cierra, focus vuelve al trigger, fondo `inert`/aria-hidden.
  (`<dialog>` nativo o Radix te lo dan hecho.)
- **Menú/dropdown**: trigger con `aria-expanded`; flechas para moverse; Escape cierra. Si es navegación,
  suele bastar disclosure (no role="menu", que exige más).
- **Tabs**: flechas cambian de tab, `aria-selected`, panel con `tabindex="0"` si no tiene focusable dentro.
- **Acordeón**: botón con `aria-expanded` + región asociada. Un `<details>` nativo cubre muchos casos.
- **Toast**: contenedor `aria-live="polite"` presente desde el inicio; no robar el focus.

## 7. Movimiento y contraste
- `prefers-reduced-motion: reduce` → parallax/autoplay/scroll-jacking fuera, transiciones a opacidad simple
  (regla dura del paquete; los presets de efectos ya lo traen).
- Contraste: 4.5:1 texto normal, 3:1 texto grande e iconos significativos (regla dura). El color NUNCA es
  el único canal (error = icono + texto, no solo borde rojo).
- Zoom 200% y 320px de ancho sin pérdida de contenido ni scroll horizontal.

## 8. Checklist rápida antes de dar por hecha una vista
Tab por toda la página (¿orden lógico? ¿focus visible? ¿trampas?) · Escape/retorno de focus en overlays ·
labels y errores de formulario asociados · alt/aria-label en imágenes e iconos-botón · encabezados jerárquicos ·
reduced-motion probado · y ENTONCES la pasada de axe (`ui-verify`) para pillar lo que se escapó — axe no ve
orden de focus ni calidad de alt: eso es de esta referencia.
