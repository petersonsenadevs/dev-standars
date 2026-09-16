# Especificación de componentes base

Cada componente define: anatomía, variantes, tamaños, estados, accesibilidad y qué NO hacer.
Si el proyecto usa shadcn-vue / Reka UI / shadcn/ui, adapta sus primitivas a estos tokens en vez
de reinventar; si no, implementa con estas reglas.

## Button
- **Variantes:** primary (1 por vista/sección), secondary (outline/tonal), ghost, destructive, link.
- **Tamaños:** sm 32px · md 40px · lg 48px de alto; padding horizontal 12/16/20; icono 16/20/20.
- **Estados:** default, hover (−8% luminosidad o overlay 8%), focus-visible (anillo 2px offset 2px),
  active (scale .98 o −12%), disabled (opacity .5 + `cursor-not-allowed` + `aria-disabled`),
  loading (spinner + texto se mantiene; `aria-busy`; ancho fijo para no saltar).
- **A11y:** `<button type="button|submit">`, nunca `<div @click>`; icono solo → `aria-label`.
- **No:** texto que rompa en 2 líneas; más de un primary junto; mayúsculas forzadas en textos largos.

## Input / Textarea / Select
- Alto 40px (md); label visible encima (`text-sm font-medium`), `for/id` enlazados.
- Ayuda bajo el campo (`text-text-muted text-sm`); error sustituye a la ayuda en `text-danger`
  con icono, `aria-invalid="true"`, `aria-describedby` al mensaje.
- Estados: default, hover (borde más oscuro), focus (borde primary + anillo), disabled, readonly,
  error, success opcional.
- `autocomplete` correcto (`email`, `name`, `tel`, `new-password`, `one-time-code`…);
  `inputmode` en móviles (`numeric`, `email`, `decimal`).
- Select: nativo para listas simples; combobox (Reka UI) para búsqueda; siempre teclado.
- No: placeholder como label; borde de contraste < 3:1; ocultar el foco.

## Form (comportamiento común a todos los stacks)
- Al fallar validación: `scrollTo`/`focus()` al primer campo con error; errores junto al campo; resumen arriba si > 3.
- Botón de envío con estado `processing` (deshabilitado + spinner, texto se mantiene) para evitar doble envío.
- Tras crear/guardar: feedback visible (toast/flash) y, si hay redirección, conservar scroll/estado cuando tenga sentido.
- Agrupa campos relacionados con `<fieldset><legend>`; máximo 1 columna en móvil; `autocomplete` correcto.

| Stack | Cómo se implementa |
|---|---|
| Laravel + Inertia + Vue | `useForm` → `form.errors.campo`, `form.processing`, `form.recentlySuccessful`; `form.post(url, { preserveScroll: true })`; flash messages vía props compartidas. |
| Next.js (App Router) | Server Action + `useActionState` (errores por campo devueltos por la action, validados con zod) y `useFormStatus` para `pending`; `<form action={...}>` funciona sin JS. |
| Astro | Astro Actions (`defineAction` + `input: z.object`) con `<form method="POST">` progresivo; errores con `isInputError` y `actions.x.orThrow` en cliente si hay island. |
| Vue 3 SPA | Composable `useFormRequest` (estado `errors`, `processing`) sobre `fetch`/axios; validación con `vee-validate` + zod o `@vuelidate`; foco al primer error con `refs`. |

## Card
- `bg-surface-elevated border border-border rounded-lg shadow-card p-6`; título H3; acciones abajo
  o arriba-derecha. Card entera clicable → un único `<a>` con `after:absolute after:inset-0`.
- No anidar cards en cards; no más de 3 niveles de elevación.

## Table (listados admin)
- Cabecera sticky, fila 48-56px, alineación numérica a la derecha, columnas con ancho mínimo,
  truncado + `title`. Acciones en última columna (menú `…` si > 2).
- Estados: loading (skeleton de filas), vacío (empty state con CTA), error, sin resultados de filtro.
- Paginación server-side con orden y filtros en la URL (Inertia: `preserveState` + `only: ['items']`; Next: `searchParams`
  en Server Component; Astro: `Astro.url.searchParams`; Vue SPA: query del router).
- En móvil: colapsa a cards o scroll horizontal dentro de contenedor con sombra indicadora.

## Modal / Dialog
- Foco atrapado, `Esc` cierra, foco vuelve al disparador, `aria-modal`, `aria-labelledby`.
- Máx. `max-w-lg`; en móvil ocupa ancho completo con `rounded-t-2xl` (sheet) si es formulario.
- Acciones: primary a la derecha, cancelar a la izquierda; destructive pide confirmación explícita.
- No: modales anidados; abrir modal al cargar la página.

## Toast / Alert
- Toast: 4-6s, apilado, `role="status"` (info/success) o `role="alert"` (error); cierre manual.
- Alert inline: icono + título + texto + acción opcional; colores por token semántico, no solo color.

## Navigation
- Header 64px; logo → home; ≤ 6 items primarios; CTA a la derecha; menú móvil accesible (`aria-expanded`).
- Sidebar app: 256px (colapsable a 72px con iconos + tooltip), item activo con `aria-current="page"`.
- Breadcrumbs en vistas de profundidad ≥ 2.

## Empty state
- Ilustración/icono discreto, título claro, una línea de explicación, CTA primaria. Nunca solo "No hay datos".

## Skeleton / Loading
- Skeleton para contenido (listas, cards, texto) con la misma geometría que el contenido final;
  spinner solo para acciones (botón). Evita layout shift: reserva alturas.

## Badge / Tag / Status
- Texto 12-13px, `rounded-full`, color semántico + icono/punto; texto legible (no blanco sobre amarillo).

## Tabs
- `role="tablist"`, flechas cambian de tab, contenido con `role="tabpanel"`. Indicador animado 250ms.

## Tooltip
- Solo información complementaria; nunca contenido esencial; aparece con hover y focus; `role="tooltip"`.

## Pricing
- 3 planes máx., plan recomendado destacado (`ring-2 ring-primary` + badge), toggle mensual/anual,
  lista de features con iconos check, CTA por plan, FAQ debajo.

## Hero (landing)
- Eyebrow (opcional) → H1 (≤ 10 palabras) → subtítulo (≤ 25 palabras) → 1 CTA primaria + 1 secundaria →
  prueba social (logos / rating). Visual a la derecha en desktop, debajo en móvil. LCP < 2.5s.
