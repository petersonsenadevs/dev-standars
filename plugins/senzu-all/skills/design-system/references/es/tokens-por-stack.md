# Tokens por stack: dónde viven y cómo se consumen

Índice: 1 estructura común · 2 Laravel + Inertia + Vue · 3 Next.js App Router · 4 Astro · 5 Vue SPA ·
6 dark mode y temas · 7 naming · 8 checklist.

## 1. Estructura común (todos los stacks)

```
senzu/design-system/
  <slug>/MASTER.md          decisiones de ui-ux-pro-max (fuente de verdad de diseño)
  tokens.json               DTCG: primitive / semantic / component  (fuente de verdad técnica)
<css-dir>/tokens.css        generado por generate-tokens.cjs (no editar)
<css-dir>/app.css           @import "tailwindcss"; @import "./tokens.css"; @theme; :root/.dark; @theme inline
```

`package.json`:
```json
{ "scripts": { "tokens:build": "node .claude/skills/design-system/scripts/generate-tokens.cjs --config senzu/design-system/tokens.json -o resources/css/tokens.css",
               "tokens:check": "node .claude/skills/design-system/scripts/validate-tokens.cjs --dir resources/js" } }
```

Ejemplo mínimo de `tokens.json` (formato del `templates/design-tokens-starter.json`):
```json
{
  "primitive": { "color": { "brand": { "500": { "$value": "oklch(0.62 0.19 260)", "$type": "color" },
                                        "600": { "$value": "oklch(0.55 0.20 260)", "$type": "color" } } },
                 "spacing": { "4": { "$value": "1rem", "$type": "dimension" } },
                 "duration": { "fast": { "$value": "150ms", "$type": "duration" } } },
  "semantic":  { "color": { "primary": { "$value": "{primitive.color.brand.600}", "$type": "color", "$description": "Acción principal" } } },
  "component": { "button": { "bg": { "$value": "{semantic.color.primary}", "$type": "color" } } }
}
```

Puente con Tailwind 4 (igual en todos los stacks):
```css
@import "tailwindcss";
@import "./tokens.css";                     /* --primitive-color-brand-600, --semantic-color-primary, … */
@custom-variant dark (&:where(.dark, .dark *));
@theme {                                    /* primitivos como utilidades: bg-brand-600, font-display, rounded-lg */
  --color-brand-500: var(--primitive-color-brand-500);
  --color-brand-600: var(--primitive-color-brand-600);
  --font-sans: var(--primitive-font-family-sans);
  --radius-lg: var(--primitive-radius-lg);
  --duration-fast: var(--primitive-duration-fast);
}
:root { --color-primary: var(--semantic-color-primary); --color-background: var(--semantic-color-background); }
.dark { --color-primary: var(--semantic-color-primary-dark); --color-background: var(--semantic-color-background-dark); }
@theme inline { --color-primary: var(--color-primary); --color-background: var(--color-background); }
```
Si el generador ya emite los nombres finales (`--color-primary`), se omite el remapeo y se importa directamente.

## 2. Laravel + Inertia + Vue 3

| Qué | Dónde |
|---|---|
| `tokens.json` | `senzu/design-system/tokens.json` (raíz del repo) |
| CSS generado | `resources/css/tokens.css`, importado desde `resources/css/app.css` |
| Entrada Vite | `resources/js/app.ts` importa `../css/app.css`; `@tailwindcss/vite` en `vite.config.js` |
| Clase dark inicial | script inline en `resources/views/app.blade.php` antes de `@inertia` |
| Emails / PDF (Blade) | no usan Tailwind: `resources/views/emails/*.blade.php` con `<style>` que copia solo los semánticos necesarios desde `tokens.css` en build (`vite` `?raw`) o valores inline generados |
| Validación | `tokens:check` sobre `resources/js` y `resources/views` (`--dir` dos veces); ignorar `vendor`, `public/build`, `storage` |

Consumo en SFC: clases (`bg-surface text-text border-border`) o `var(--color-primary)` en `<style scoped>` para
casos que Tailwind no cubre (gradientes complejos, SVG `fill`). shadcn-vue: mapear `--primary`, `--muted`… a los
semánticos en `:root` (ver `ui-styling/references/es/vue-shadcn.md` §3).

## 3. Next.js App Router

| Qué | Dónde |
|---|---|
| `tokens.json` | `senzu/design-system/tokens.json` |
| CSS generado | `app/tokens.css`, importado en `app/globals.css` (`@import "./tokens.css"`) |
| Fuentes | `next/font` en `app/layout.tsx` expone `--font-sans` via `variable`; `@theme { --font-sans: var(--font-inter) }` |
| Dark | `next-themes` `attribute="class"` + `suppressHydrationWarning` en `<html>` |
| Metadata de tema | `export const viewport = { themeColor: [{ media: "(prefers-color-scheme: dark)", color: "…" }] }` con el valor del token (importar el JSON en `layout.tsx`) |
| Server Components | consumen clases; no necesitan JS. Tokens en TS (`lib/tokens.ts` generado o `import tokens from "@/design-system/tokens.json"`) solo para canvas/Three/charts |
| Validación | `tokens:check --dir app --dir components` (ignora `.next` por defecto) |

Charts/Three/Motion leen tokens de `tokens.json` (tipado), nunca de `getComputedStyle` en cada frame.

## 4. Astro

| Qué | Dónde |
|---|---|
| `tokens.json` | `senzu/design-system/tokens.json` |
| CSS generado | `src/styles/tokens.css`, importado en `src/styles/global.css` (`@tailwindcss/vite`) |
| Global | `global.css` importado una vez en `src/layouts/Base.astro`; islands React/Vue heredan las variables |
| Dark | script inline en `<head>` de `Base.astro`; con View Transitions, reaplicar en `astro:after-swap` |
| Islands | shadcn/ui o shadcn-vue mapean sus variables a los semánticos; `.astro` estáticos usan las mismas clases |
| Content collections (MD/MDX) | `@plugin "@tailwindcss/typography"` con `prose` configurado por tokens (`--tw-prose-body: var(--color-text)`) |
| Validación | `tokens:check --dir src` |

## 5. Vue 3 SPA (Vite)

| Qué | Dónde |
|---|---|
| `tokens.json` | `senzu/design-system/tokens.json` |
| CSS generado | `src/assets/tokens.css`, importado en `src/assets/main.css`, que importa `main.ts` |
| Dark | `useColorMode()` (VueUse) + script inline en `index.html` |
| Estado de tema en Pinia | solo si hay temas de marca (multi-tenant); el tema activo pone `data-theme="acme"` en `<html>` y `[data-theme="acme"] { --color-primary: … }` redefine semánticos |
| Validación | `tokens:check --dir src` |

## 6. Dark mode y temas

- Solo la **capa semántica** cambia entre temas; primitivos y tokens de componente permanecen.
- Selector: `.dark` (clase) para dark; `[data-theme="<marca>"]` para marcas; ambos combinables (`.dark[data-theme="acme"]`).
- `html { color-scheme: light dark }` para que formularios/scrollbars nativos sigan el tema.
- Alto contraste: `@media (prefers-contrast: more)` redefine `--color-border`, `--color-text-muted` y grosor de foco.
- En dark, sombras → bordes sutiles o `--color-surface-elevated`; nunca la misma sombra negra.
- Contraste verificado por tema: texto 4.5:1, texto grande/iconos/bordes 3:1 (`ui-ux-pro-max/references/es/accessibility.md`).
- Sin flash: script inline antes de pintar en todos los stacks (§2-5); `next-themes` lo hace por ti en Next.

## 7. Naming

| Capa | Patrón | Ejemplos |
|---|---|---|
| Primitivo | `--<categoría>-<familia>-<paso>` | `--color-brand-600`, `--spacing-4`, `--font-size-lg`, `--radius-md`, `--duration-fast` |
| Semántico | `--<categoría>-<rol>[-<variante>][-<estado>]` | `--color-primary`, `--color-primary-hover`, `--color-text-muted`, `--color-surface-elevated`, `--color-danger` |
| Componente | `--<componente>-<parte>-<propiedad>[-<estado>]` | `--button-bg`, `--button-bg-hover`, `--input-border-focus`, `--card-padding` |

- Roles semánticos obligatorios (Senzu): `background`, `surface`, `surface-elevated`, `border`, `text`,
  `text-muted`, `primary`, `primary-foreground`, `accent`, `success`, `warning`, `danger`, `info`, `ring`.
- Equivalencias shadcn: `background`→`--background`, `text`→`--foreground`, `surface`→`--card`, `text-muted`→`--muted-foreground`,
  `border`→`--border`, `danger`→`--destructive`. Se mapean en `:root`, no se duplican en componentes.
- Sin nombres de color, marca o pantalla en semánticos; sin abreviaturas (`bg` solo en componente, siguiendo shadcn).
- Estados con sufijo fijo: `-hover`, `-active`, `-focus`, `-disabled`, `-selected`.

## 8. Checklist de entrega

- [ ] `tokens.json` con las 3 capas y `$description` en semánticos; sin valores crudos fuera de `primitive`.
- [ ] `tokens.css` regenerado y `app.css`/`globals.css` importa y expone con `@theme` / `@theme inline`.
- [ ] Dark (y temas) redefinen solo semánticos; script anti-flash presente; `color-scheme` declarado.
- [ ] `tokens:check` en verde sobre los directorios del stack; añadido al CI.
- [ ] Contraste verificado en cada tema; foco visible con `--color-ring`.
- [ ] `MASTER.md` actualizado si algún valor se ajustó durante la implementación.
