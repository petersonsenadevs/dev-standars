# Accesibilidad práctica (WCAG 2.2 AA) — qué hacer y cómo comprobarlo

## Contraste
- Texto normal ≥ **4.5:1**; texto grande (≥ 24px o ≥ 19px bold) ≥ **3:1**; componentes UI (bordes
  de input, iconos, indicadores de foco) ≥ **3:1** contra el fondo adyacente.
- Cálculo rápido (luminancia relativa): `L = 0.2126 R + 0.7152 G + 0.0722 B` con canales linearizados
  (`c/12.92` si `c ≤ 0.03928`, si no `((c+0.055)/1.055)^2.4`); ratio `(L1 + 0.05) / (L2 + 0.05)`.
- Comprobación: DevTools → color picker muestra el ratio; extensión axe; Lighthouse.
- Texto sobre imagen: overlay `bg-black/50` o degradado; nunca confiar en que la foto "sea oscura".

## Teclado y foco
- Todo lo interactivo es alcanzable con Tab en orden visual; `tabindex` solo `0` o `-1`.
- `:focus-visible` con anillo de 2px y offset 2px (token `primary`), nunca `outline: none` sin sustituto.
- Skip link "Saltar al contenido" como primer elemento focusable.
- Modales/drawers: foco atrapado, `Esc` cierra, foco vuelve al disparador.
- Menús/tabs/listbox: navegación con flechas, `Home/End`, patrón WAI-ARIA APG.

## Semántica y ARIA
- HTML primero: `<button>`, `<a href>`, `<nav>`, `<main>`, `<header>`, `<footer>`, `<section aria-labelledby>`.
- Un solo `<h1>`; no saltar niveles de encabezado.
- ARIA solo cuando HTML no basta. `aria-label` en botones de solo icono; `aria-current="page"`;
  `aria-expanded` en desplegables; `aria-live="polite"` para actualizaciones (toasts, contadores de resultados).
- Iconos decorativos `aria-hidden="true"`; imágenes informativas con `alt` descriptivo; decorativas `alt=""`.

## Formularios
- `<label for>` visible; grupos con `<fieldset><legend>`; requerido indicado con texto, no solo `*` rojo.
- Errores: junto al campo, `aria-invalid`, `aria-describedby`, resumen arriba si hay > 3 errores, foco al primero.
- No validar en cada tecla al principio: validar al `blur` y luego en vivo mientras corrige.
- `autocomplete` (WCAG 1.3.5) y sin límite de tiempo para completar.

## Movimiento y animación
- `prefers-reduced-motion: reduce` → desactiva parallax, autoplay, animaciones grandes; deja fades sutiles.
- Nada que parpadee > 3 veces/segundo. Autoplay de vídeo silenciado y con control de pausa.
- Scroll-jacking (Lenis, snap forzado) solo si aporta y siempre desactivado con reduced-motion.

## Responsive y zoom
- Funciona a 320px de ancho y con zoom del 400% (reflow, WCAG 1.4.10). Nada de `user-scalable=no`.
- Tamaño de texto mínimo 16px en inputs móviles (evita zoom automático en iOS).
- Objetivos táctiles 44×44 (24×24 mínimo WCAG 2.2 con separación).

## Color y estado
- Nunca solo color: estado + icono/texto/patrón. Enlaces en texto corrido subrayados o con contraste 3:1 contra el texto.
- Dark mode: comprueba contraste otra vez; los grises "muted" suelen fallar.

## Contenido
- `lang` correcto en `<html>` (`es`), `title` único por página, textos de enlace descriptivos (no "clic aquí").
- Tablas con `<th scope>`; `<caption>` o `aria-label`.

## Herramientas
- Lighthouse (Accesibilidad ≥ 95), axe DevTools, `@axe-core/playwright` en tests E2E, lector de pantalla
  (NVDA en Windows) para flujos críticos (login, checkout).
- Comprobación manual mínima por vista: Tab completo, zoom 200%, dark/light, 375px.
