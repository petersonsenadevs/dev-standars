# Del design system a tokens — Tailwind 4 (y fallback CSS vars)

## Tailwind 4 (CSS-first) — `resources/css/app.css`

```css
@import "tailwindcss";

/* Variante dark por clase: toggle en <html class="dark"> (vale para cualquier stack) */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* --- Color: primitivos (de palettes.csv) --- */
  --color-brand-50:  #eef4ff;
  --color-brand-500: #2f6bff;
  --color-brand-600: #1f55e6;
  --color-brand-900: #0b1f5c;

  /* --- Tipografía (de typography.csv) --- */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", var(--font-sans);
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  /* --- Escala fluida de títulos --- */
  --text-display: clamp(2.5rem, 1.5rem + 4vw, 4.5rem);
  --text-display--line-height: 1.05;
  --text-display--letter-spacing: -0.02em;

  /* --- Radios, sombras, easing, duraciones --- */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-card: 0 1px 2px rgb(0 0 0 / .05), 0 8px 24px -12px rgb(0 0 0 / .15);
  --ease-out-soft: cubic-bezier(.2,.8,.2,1);
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
}

/* --- Tokens SEMÁNTICOS (los que usan los componentes) --- */
:root {
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-surface-elevated: #ffffff;
  --color-border: #e2e8f0;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-primary: var(--color-brand-600);
  --color-primary-foreground: #ffffff;
  --color-accent: #f59e0b;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #dc2626;
  --color-info: #0284c7;
}
.dark {
  --color-background: #0b1220;
  --color-surface: #111a2e;
  --color-surface-elevated: #172238;
  --color-border: #243049;
  --color-text: #e6edf7;
  --color-text-muted: #94a3b8;
  --color-primary: var(--color-brand-500);
  --color-primary-foreground: #0b1220;
}

/* Exponer semánticos como utilidades: bg-background, text-text-muted, border-border… */
@theme inline {
  --color-background: var(--color-background);
  --color-surface: var(--color-surface);
  --color-surface-elevated: var(--color-surface-elevated);
  --color-border: var(--color-border);
  --color-text: var(--color-text);
  --color-text-muted: var(--color-text-muted);
  --color-primary: var(--color-primary);
  --color-primary-foreground: var(--color-primary-foreground);
  --color-accent: var(--color-accent);
  --color-success: var(--color-success);
  --color-warning: var(--color-warning);
  --color-danger: var(--color-danger);
  --color-info: var(--color-info);
}

@layer base {
  html { color-scheme: light dark; }
  body { @apply bg-background text-text font-sans antialiased; }
  h1, h2, h3 { @apply font-display tracking-tight; }
  :focus-visible { @apply outline-2 outline-offset-2 outline-primary; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
  }
}

@utility container-page { @apply mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8; }
@utility section-y { @apply py-16 md:py-24; }
```

Uso en componentes: `class="bg-surface text-text border border-border rounded-lg shadow-card"`.
Nunca `bg-[#f8fafc]` repetido: si un valor aparece dos veces, es un token.

## Tailwind 3 (`tailwind.config.js`) — proyectos legacy
```js
theme: { extend: {
  colors: { background: 'rgb(var(--bg) / <alpha-value>)', /* … */ },
  fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'], display: ['Space Grotesk', 'sans-serif'] },
}}
```
y variables en `:root { --bg: 255 255 255 }` / `.dark { --bg: 11 18 32 }`.

## Fuentes
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
```
Self-host (recomendado en producción, GDPR): `@fontsource-variable/inter` + `@font-face` con
`font-display: swap` y `unicode-range` latino.

## Dark mode por stack
Regla común: la preferencia se persiste en `localStorage` (`theme` = `light|dark|system`), se respeta
`prefers-color-scheme`, y un **script inline antes de pintar** aplica la clase `dark` en `<html>` para evitar el flash.
Los componentes SOLO usan tokens semánticos; nada de `dark:bg-gray-900` a mano por todas partes.

```html
<script>
  (function () {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  })();
</script>
```

| Stack | Dónde va el script inline | Toggle |
|---|---|---|
| Laravel + Inertia + Vue | `resources/views/app.blade.php`, antes de `@inertia` | `useDark()` de VueUse (`selector: 'html'`) o composable propio |
| Next.js (App Router) | `app/layout.tsx` dentro de `<head>` con `dangerouslySetInnerHTML` (o `next-themes` con `attribute="class"`) | `useTheme()` de `next-themes` |
| Astro | `<script is:inline>` en el layout base, dentro de `<head>`; re-aplicar en `astro:after-swap` | island pequeño o script vanilla |
| Vue 3 SPA | `index.html` en `<head>` | `useDark()` de VueUse |

## Escala tipográfica recomendada
| Rol | Clase / token | Notas |
|---|---|---|
| Display | `text-display` | Solo hero. 1 por página. |
| H1 | `text-4xl md:text-5xl` | 1 por vista. |
| H2 | `text-3xl md:text-4xl` | Sección. |
| H3 | `text-xl md:text-2xl` | Subsección / card title. |
| Body | `text-base leading-relaxed` | 16-18px, medida `max-w-prose`. |
| Small | `text-sm` | Meta, ayudas. Nunca < 12px. |
| Label | `text-sm font-medium` | Inputs. |
