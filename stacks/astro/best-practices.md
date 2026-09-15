# Mejores prácticas — Astro

## Islands
- Envía el mínimo JS. Directiva de hidratación más perezosa que funcione (`client:visible` > `client:idle` > `client:load`).
- Componentes `.astro` (cero JS) para todo lo no interactivo.

## Contenido
- Content Collections con esquema `zod`; `getCollection()` tipado. Nada de frontmatter sin validar.
- Markdown/MDX para contenido; layouts reutilizables.

## Assets / rendimiento
- `astro:assets` para optimizar imágenes. Fuentes locales. CSS con scope por componente.
- View Transitions para navegación fluida si aplica.

## Datos / SSR
- Elige `output` (`static` | `server` | `hybrid`) según necesidad; no fuerces SSR sin motivo.
- Endpoints tipados; validación de entrada.

## Calidad
- `astro check` (typecheck + a11y básica). ESLint/Prettier del repo.

> Detalle y ejemplos bajo demanda: skill `code-quality` → `references/astro.md` (+ `testing.md`, `security-owasp.md`, `performance.md`, `api-design.md`).
