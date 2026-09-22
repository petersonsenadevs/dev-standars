# Mejores prácticas — SvelteKit

## Datos
- `load` de servidor para datos con secretos/BD; universal solo para lo público. Tipa con `PageData` generado.
- `depends()`/`invalidate()` para refrescar tras mutaciones; streaming con promesas anidadas para lo lento.
- Form actions para TODA mutación (funcionan sin JS); `use:enhance` para la experiencia con JS.

## Componentes (Svelte 5)
- `$props()` tipado con destructuring y defaults; snippets (`{#snippet}`) en vez de slots complejos.
- `$derived` para computados (no `$effect` que setea estado: señal de diseño equivocado).
- `$effect` SOLO para efectos reales (DOM, subscripciones externas), con cleanup devuelto.

## Rendimiento
- Prerender (`export const prerender = true`) para páginas estáticas; `routeRules`/adapter según hosting.
- Imágenes con `@sveltejs/enhanced-img`; código pesado con `import()` dinámico en interacción.
- El payload de `load` viaja serializado al cliente: selecciona campos, no mandes entidades enteras.

## Testing
- Vitest para lógica y componentes (@testing-library/svelte); Playwright para los flujos críticos.

## Seguridad
- Validación en el servidor SIEMPRE (actions/endpoints); el load universal corre también en el cliente: sin secretos.
- CSRF: Kit lo trae para form actions same-origin; no lo desactives (`checkOrigin: false` prohibido).
- Auth centralizada en `hooks.server.ts` + `locals` tipado.

> Detalle y ejemplos bajo demanda: skill `code-quality` → `references/sveltekit.md` (+ `typescript.md`, `api-design.md`, `performance.md`).
