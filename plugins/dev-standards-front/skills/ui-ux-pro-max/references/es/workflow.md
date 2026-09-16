# Flujo de trabajo detallado — ui-design-system

## 0. Antes de empezar
- Lee `CLAUDE.md` (stack, prohibiciones), `package.json` (Tailwind 4 / 3, Vue/React, Inertia) y
  `resources/css/app.css` o equivalente (¿ya hay `@theme`?).
- Busca `design-system/MASTER.md`. Si existe, léelo completo antes de nada.
- Identifica librería de componentes existente (shadcn-vue/Reka UI, Headless UI, PrimeVue, shadcn/ui).
  No introduzcas una segunda librería de componentes sin aprobación.

## 1. Brief de diseño (formato mental / devlog)
| Campo | Ejemplo |
|---|---|
| Producto / industria | SaaS de facturación para autónomos |
| Página | Landing + dashboard |
| Audiencia | Autónomos 30-50 años, poco técnicos |
| Tono | Claro, confiable, moderno, sin frivolidad |
| Marca existente | Logo azul #1D4ED8, sin más |
| Restricciones | Dark mode sí, i18n es/en, móvil primero |
| Stack | (perfil de `.dev-standards.json`: Laravel+Inertia+Vue · Next.js · Astro · Vue 3) |

## 2. Generación
```powershell
py -3 .claude/skills/ui-ux-pro-max/scripts/search.py "saas facturación autónomos landing" `
  --design-system -p "FacturaFácil" --stack laravel-inertia-vue -f markdown --persist
```
Lee la salida. Si la paleta no casa con la marca existente, **sustituye el primary por el de la
marca** y recalcula el resto (mismo tono de saturación; comprueba contraste).

## 3. Decisiones que debe contener MASTER.md
- Estilo principal + 1 alternativa (para secciones secundarias).
- Paleta con tokens semánticos: `primary`, `primary-foreground`, `secondary`, `accent`, `background`,
  `surface`, `surface-elevated`, `border`, `text`, `text-muted`, `success`, `warning`, `danger`, `info`;
  variante dark de cada uno.
- Tipografía: familia de títulos, cuerpo, mono; escala (`text-xs` … `text-6xl` con `clamp` en títulos);
  pesos permitidos; `line-height`; medida máxima de párrafo (`max-w-prose`).
- Espaciado: base 4px, escala 4/8/12/16/24/32/48/64/96; padding de sección `py-16 md:py-24`.
- Radios: `sm 6px / md 10px / lg 16px / full`. Sombras: 3 niveles. Bordes: 1px `border` token.
- Iconos: librería única (Phosphor / Lucide / Heroicons), tamaños 16/20/24, stroke coherente.
- Movimiento: duraciones (150/250/400ms), easing (`cubic-bezier(.2,.8,.2,1)`), qué se anima y qué no,
  reduced-motion.
- Layout: contenedor (`max-w-7xl`), grid (12 col), breakpoints, altura de header, sidebar.
- Componentes base y sus variantes (button primary/secondary/ghost/destructive; input; select; card;
  badge; table; modal; toast; tabs; empty state; skeleton).
- "Evitar": anti-patrones concretos de la industria.

## 4. Implementación por orden
1. Tokens (`app.css` con `@theme` / CSS vars + `dark` variant).
2. Fuentes (Google Fonts con `display=swap` o self-host; `font-display: swap`; preconnect).
3. Layout (`AppLayout.vue`/`GuestLayout.vue` persistentes; header/nav/footer).
4. Componentes base reutilizables (según `components-spec.md`).
5. Páginas siguiendo las secciones del patrón.
6. Estados (loading/empty/error) y formularios.
7. Dark mode y responsive pass.
8. Animación/3D (skills `motion-gsap` / `threejs-webgl`) solo al final y con los tokens.

## 5. Verificación
- Navegador: 375 / 768 / 1024 / 1440; dark/light; teclado (Tab por toda la página); zoom 200%.
- Contraste: calcula con la fórmula WCAG (ver `accessibility.md`) o `axe`/Lighthouse.
- Lighthouse: Performance ≥ 90 en landing, Accessibility ≥ 95.
- Registra en devlog: qué se verificó, con qué herramienta, resultados y pendientes.

## 6. Cuando ya existe UI (rediseño / auditoría)
Usa `review-rubric.md`: puntúa 1-5 en jerarquía, consistencia, color, tipografía, espaciado,
estados, accesibilidad, responsive, rendimiento, copy. Propón 3-5 cambios de mayor impacto
antes de reescribir todo.
