# Astro 5+: buenas prácticas

## Índice

- [Modelo mental: HTML primero, islas mínimas](#modelo-mental-html-primero-islas-mínimas)
- [Directivas client:* correctas](#directivas-client-correctas)
- [Content collections y schemas](#content-collections-y-schemas)
- [Rendering: estático, servidor e híbrido](#rendering-estático-servidor-e-híbrido)
- [Endpoints y Actions](#endpoints-y-actions)
- [Imágenes](#imágenes)
- [View Transitions](#view-transitions)
- [SEO](#seo)
- [i18n](#i18n)
- [Variables de entorno](#variables-de-entorno)
- [Build, rendimiento y presupuestos](#build-rendimiento-y-presupuestos)
- [Estructura, componentes y estilos](#estructura-componentes-y-estilos)
- [Testing y tooling](#testing-y-tooling)

## Modelo mental: HTML primero, islas mínimas

- Astro renderiza a HTML sin JS por defecto. Cada isla (`client:*`) cuesta hidratación, bundle y complejidad: justifícala.
- Antes de crear una isla pregúntate: ¿se resuelve con HTML nativo (`<details>`, `<dialog>`, formularios, `popover`), CSS (`:has`, scroll-snap) o un `<script>` vanilla de 10 líneas? Si sí, no uses framework.
- Componentes `.astro` para todo lo que no necesite interactividad; componentes React/Vue/Svelte solo para widgets interactivos concretos (buscador, carrito, editor).
- Las islas no comparten estado entre sí por props: usa `nanostores` (`@nanostores/react`, `@nanostores/vue`) o eventos DOM para comunicarlas.
- Pasa a las islas datos ya calculados en el servidor y serializables; no hagas fetch en el cliente si el servidor ya lo tenía.
- `<script>` en `.astro` se procesa, empaqueta y deduplica automáticamente; usa `is:inline` solo para snippets que deben ir tal cual (analytics, tema antes del paint).

## Directivas client:* correctas

| Directiva | Cuándo |
|---|---|
| (ninguna) | Solo render en servidor. Por defecto. |
| `client:load` | Interactividad crítica y visible al cargar (menú móvil, carrito en cabecera). |
| `client:idle` | Interactivo pronto pero no crítico (chat, tooltips). Acepta `{ timeout }`. |
| `client:visible` | Bajo el pliegue (carruseles, mapas, comentarios). Acepta `rootMargin`. |
| `client:media="(max-width: 768px)"` | Solo en ciertos viewports. |
| `client:only="react"` | Sin SSR: componentes que dependen de `window`. Último recurso; pierde HTML inicial. |

- Nunca `client:load` por defecto "porque funciona". Empieza por `client:visible`/`client:idle`.
- Un componente de framework anidado dentro de otro del mismo framework hereda la hidratación del padre; no repitas la directiva.
- No mezcles frameworks en la misma isla; entre islas, sí (pero cada framework añade su runtime al bundle).
- Islas de servidor (`server:defer`) para contenido personalizado o lento dentro de una página estática, con `slot="fallback"`.

## Content collections y schemas

- Todo contenido estructurado (posts, docs, autores, productos) en `src/content.config.ts` con la Content Layer API (Astro 5): `defineCollection({ loader, schema })`.
- Loaders: `glob()` para Markdown/MDX/JSON locales, `file()` para un único archivo, loaders custom o de terceros para CMS/APIs. El contenido se cachea entre builds.
- Schema zod estricto; deriva tipos con `CollectionEntry<"blog">`. Sin acceso a `frontmatter` sin validar.
- Referencias entre colecciones con `reference("authors")`; resuelve con `getEntry`.
- Fechas como `z.coerce.date()`, imágenes con `image()` del helper de schema para que pasen por el pipeline de optimización.

```ts
import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: ({ image }) => z.object({
    title: z.string().max(80),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
    cover: image().optional(),
    author: reference("authors"),
    tags: z.array(z.string()).default([]),
  }),
});
export const collections = { blog };
```

- Filtra borradores en producción: `getCollection("blog", ({ data }) => import.meta.env.PROD ? !data.draft : true)`.
- Renderiza con `render(entry)` (Astro 5) y `<Content />`; para MDX, componentes personalizados por prop `components`.

## Rendering: estático, servidor e híbrido

- Por defecto `output: 'static'`. Marca páginas dinámicas individualmente con `export const prerender = false` (necesita adapter). Usa `output: 'server'` solo si casi todo es dinámico.
- Páginas estáticas con `getStaticPaths()` para rutas dinámicas; pagina con `paginate()`.
- En SSR: `Astro.request`, `Astro.cookies`, `Astro.locals` (poblado por middleware). Cabeceras de cache explícitas (`Astro.response.headers.set("Cache-Control", ...)`).
- Middleware (`src/middleware.ts`) para auth, redirecciones, locales; encadena con `sequence()`. Sin lógica de negocio.
- No leas `Astro.request.headers` en páginas prerendered: estarán vacías en build.

## Endpoints y Actions

- **Actions** (`src/actions/index.ts`, `defineAction`) para mutaciones desde formularios/islas: entrada validada con zod, tipado end-to-end, funcionan sin JS con `<form method="POST" action={actions.x}>`.
- Lanza `ActionError({ code: "UNAUTHORIZED" | "NOT_FOUND" | "BAD_REQUEST" ... })` para errores esperados; el cliente recibe `{ data, error }` tipado.
- Autoriza dentro de la action (lee sesión desde `context.locals`/cookies); nunca confíes en datos del cliente para identificar al usuario.
- **Endpoints** (`src/pages/api/*.ts` exportando `GET`, `POST`) para APIs consumidas por terceros, webhooks, RSS, sitemaps, OG images. Devuelven `Response` estándar.
- En endpoints, valida `request.json()` con zod y devuelve códigos correctos y `problem+json` en errores.

```ts
export const server = {
  subscribe: defineAction({
    accept: "form",
    input: z.object({ email: z.string().email() }),
    handler: async ({ email }, ctx) => {
      await newsletter.add(email, { ip: ctx.clientAddress });
      return { ok: true };
    },
  }),
};
```

## Imágenes

- `<Image />` y `<Picture />` de `astro:assets` para imágenes locales (`src/`) e importadas: genera `width/height` (sin CLS), formatos modernos y `loading="lazy"` por defecto.
- Imágenes remotas: autoriza dominios en `image.domains`/`remotePatterns` y pasa `width`/`height` explícitos o `inferSize` (coste en build).
- LCP: `loading="eager"` + `fetchpriority="high"` solo en la imagen principal above the fold. `priority` en Astro 5.10+.
- `<Picture formats={["avif", "webp"]} />` y `widths`/`sizes` para responsive; no sirvas 2000 px a móviles.
- `public/` solo para archivos que no deben procesarse (favicons, robots.txt, imágenes referenciadas por CMS externos).
- SVG: importa como componente (Astro 5.7+) o inline; no como `<img>` si necesitas estilos.

## View Transitions

- Astro 5 usa `<ClientRouter />` (antes `<ViewTransitions />`) en el `<head>` del layout para navegación tipo SPA con transiciones.
- Los `<script>` de página se ejecutan una vez: reengancha con `document.addEventListener("astro:page-load", init)` o usa `data-astro-rerun`.
- Persiste islas/estado entre navegaciones con `transition:persist` (reproductor, mapa) y nombres estables con `transition:name`.
- Prefiere View Transitions nativas del navegador (cross-document, sin `ClientRouter`) si solo quieres animación y no persistencia: cero JS.
- Comprueba `prefers-reduced-motion` y define transiciones con `transition:animate="none"` donde no aporten.

## SEO

- Layout base con `<title>`, `<meta name="description">`, canonical (`new URL(Astro.url.pathname, Astro.site)`), Open Graph y Twitter cards; `site` configurado en `astro.config`.
- `@astrojs/sitemap` y `robots.txt` (con `Sitemap:`); excluye rutas de borrador/privadas.
- JSON-LD por tipo de página (`Article`, `Product`, `BreadcrumbList`) generado desde el mismo dato que la vista.
- `hreflang` en sitios i18n; `noindex` en paginación profunda, búsquedas y páginas de utilidad.
- Encabezados jerárquicos, un `h1` por página, `alt` en imágenes, enlaces con texto significativo.
- OG images generadas en un endpoint (`satori` + `resvg`) en build.

## i18n

- Configura `i18n: { defaultLocale, locales, routing: { prefixDefaultLocale } }` en `astro.config`. Estructura `src/pages/[lang]/...` o carpetas por locale.
- Helpers de `astro:i18n` (`getRelativeLocaleUrl`, `getAbsoluteLocaleUrl`) para enlaces; nunca concatenes prefijos a mano.
- Traducciones en JSON/TS tipados (`Record<Locale, Record<Key, string>>`) con una función `t(key)` que falle en build si falta clave (tipo `keyof`).
- Contenido traducido: una colección con campo `lang` o subcarpetas por idioma; enlaza equivalentes para `hreflang`.
- Fechas/números con `Intl.*` según locale; no formatees a mano.
- Fallback configurable (`fallback: { es: "en" }`) solo si es aceptable mostrar contenido en otro idioma.

## Variables de entorno

- Usa `astro:env` (Astro 5): declara en `env.schema` con `envField.string({ context: "server" | "client", access: "secret" | "public" })`. Validación en arranque y tipado.
- `client` + `public` únicamente para valores que pueden ser públicos (URL del API, clave pública de analytics). Los secretos son `server` + `secret`: jamás llegan al bundle.
- No leas `import.meta.env.X` en componentes con `client:*` esperando secretos: solo se exponen las `PUBLIC_*`.
- `.env.example` actualizado; en CI, variables inyectadas, nunca commiteadas.

## Build, rendimiento y presupuestos

- Objetivo: 0 KB de JS en páginas de contenido; < 50 KB gz en páginas con islas.
- `astro build` + `astro preview`; inspecciona `dist/_astro` y usa `rollup-plugin-visualizer` vía `vite.plugins` para ver qué pesa.
- Fuentes: `@fontsource-variable/*` o la API de fuentes de Astro 5.7+ (`fonts` en config): self-hosted, `font-display: swap`, subsets acotados, `preload` solo de la principal.
- CSS: scoped por defecto; Tailwind vía plugin de Vite (`@tailwindcss/vite`). Evita CSS global grande; `inlineStylesheets: 'auto'`.
- Prefetch: `prefetch: { prefetchAll: true, defaultStrategy: "viewport" }` con moderación; `data-astro-prefetch="hover"` en enlaces concretos.
- Cache de contenido (`.astro/`) en CI para builds incrementales; `experimental.contentIntellisense` para el editor.
- Mide con Lighthouse CI en `astro preview`: LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- Third-party scripts: `@astrojs/partytown` para analytics pesados, o carga `is:inline` diferida tras `load`.

## Estructura, componentes y estilos

```
src/
  actions/        # defineAction
  components/     # .astro (ui/, layout/) e islas por framework (islands/)
  content/        # markdown/mdx/json de colecciones
  content.config.ts
  layouts/        # BaseLayout.astro, PostLayout.astro
  lib/            # utilidades puras, clientes de API, schemas
  middleware.ts
  pages/          # rutas y endpoints
  styles/         # global.css, tokens
```

- Componentes `.astro`: frontmatter tipado con `interface Props` y `Astro.props`; sin lógica pesada en el frontmatter (extráela a `lib/`).
- `set:html` solo con contenido confiable o sanitizado; `Fragment` para agrupar sin wrapper.
- Layouts reciben `title`, `description`, `image` y renderizan `<slot />`; slots nombrados para `head` extra.
- Nombra las islas por lo que hacen (`SearchBox.tsx`), y mantenlas sin lógica de datos: reciben props.

## Testing y tooling

- `astro check` (tipos en `.astro`) en CI, junto a `tsc`/`vue-tsc` para islas.
- Vitest con `getViteConfig()` de Astro; Container API (`experimental_AstroContainer`) para renderizar componentes `.astro` a string y afirmar sobre el HTML.
- Islas: testéalas con las herramientas de su framework (Testing Library React/Vue).
- E2E con Playwright contra `astro preview`: navegación, formularios con Actions, View Transitions. Añade `@axe-core/playwright`.
- Lint: `eslint-plugin-astro` + `typescript-eslint`; `prettier-plugin-astro` para formato.
- Comandos: `astro check && astro build`, `vitest run`, `playwright test`.
