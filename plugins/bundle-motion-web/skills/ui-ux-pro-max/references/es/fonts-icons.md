# Fuentes e iconos: variedad con criterio

Regla de oro: **no uses siempre lo mismo**. Inter + Lucide en todo proyecto es el uniforme de la IA.
Elige según el mood del design system (MASTER.md) y documenta la elección. Pero tampoco cambies por
cambiar dentro de un proyecto: 1 familia de display + 1 de texto (+ 1 mono si hay código) y UN set de iconos.

## 1. Pairings de Google Fonts por mood (display + texto)

| Mood | Display (títulos) | Texto | Notas |
|---|---|---|---|
| Corporativo sobrio | Archivo | Source Sans 3 | Archivo condensada en pesos altos para héroes |
| SaaS moderno | Space Grotesk | Inter | Space Grotesk solo en títulos; Inter desaparece como texto |
| Editorial / elegante | Fraunces | Source Serif 4 | Fraunces con ejes SOFT/WONK para personalidad |
| Premium / lujo | Cormorant Garamond | Outfit | Serif fino grande + sans geométrica pequeña |
| Tech / ingeniería | IBM Plex Sans | IBM Plex Mono | Familia completa coherente; mono para datos |
| Friendly / humano | Bricolage Grotesque | Work Sans | Bricolage tiene carácter sin ser payasa |
| Brutalist / portfolio | Archivo Black | Space Mono | Tamaños enormes, tracking apretado |
| Startup enérgica | Clash Display (Fontshare) | General Sans (Fontshare) | Fontshare: gratis con licencia comercial |
| Local / artesano | Lora | Karla | Serif cálida + sans humanista |
| Deportivo / impacto | Anton | Roboto Condensed | Anton solo mayúsculas y grande |
| Infantil / juego | Baloo 2 | Nunito | Redondas; cuidado con el contraste |
| Retro / vintage | Abril Fatface | Poppins | Display con mucha tinta + geométrica neutra |
| Datos / dashboard | Geist (Vercel) | Geist Mono | Números tabulares (`font-variant-numeric: tabular-nums`) |
| Industrial (obra, taller) | Oswald | Barlow | Condensadas, mayúsculas, pesos 600-700 |

Fuentes variables cuando existan (un archivo, todos los pesos). Fuera de Google: Fontshare (gratis),
Atipo (pago what-you-want) — verifica licencia antes de usar en cliente.

## 2. Reglas duras de tipografía
1. Máximo 2 familias (3 con mono). Pesos concretos, no "todos": p. ej. 400/600/700.
2. Escala con `clamp()`: h1 `clamp(2.2rem, 5vw + 1rem, 4.5rem)`; cuerpo ≥ 16px (móvil incluido); line-height cuerpo 1.5-1.7, títulos 1.05-1.2.
3. Carga: `preconnect` a gstatic + `display=swap` + solo los pesos usados. Self-host si CLS o RGPD lo piden (fontsource).
4. Jerarquía: si todo es grande, nada es grande. Un tamaño "wow" por vista.
5. `letter-spacing`: negativo solo en títulos grandes (−0.01/−0.03 em); positivo en mayúsculas pequeñas (+0.05-0.1 em).

## 3. Sets de iconos (elige UNO por proyecto)

| Set | Estilo | Cuándo |
|---|---|---|
| Lucide | Outline 24px, neutro | Default seguro para apps/SaaS |
| Phosphor | 6 pesos (thin→fill, duotone) | Cuando quieres variar peso por estado (fill = activo) |
| Heroicons | Outline/solid 24, redondeado | Interfaces con Tailwind, look suave |
| Tabler | Outline 24, stroke fino | Dashboards densos (4000+ iconos) |
| Iconoir | Outline fino minimalista | Sitios editoriales/premium |
| Remix Icon | Outline+fill, algo chino-tech | Apps con muchos conceptos de negocio |
| Solar / Mingcute (Iconify) | Bold/duotone modernos | Landings con personalidad; via Iconify |
| Simple Icons | Solo logos de marcas | Redes sociales y tech-stack; nunca para UI |

- En Astro: `astro-icon` con `@iconify-json/<set>` (ya en este stack). En React/Vue: paquete del set o `unplugin-icons`.
- Reglas: mismo set en todo el proyecto · tamaño consistente (16/20/24) · `stroke-width` uniforme ·
  `aria-hidden="true"` + texto accesible al lado (o `aria-label` en botones de solo icono) · **nunca emojis como iconos** ·
  color por `currentColor` para heredar del texto.
- Ilustraciones (empty states): unDraw, Storyset (atribución), Popsy — recolorea al primario del proyecto.

## 4. Anti-patrones que delatan "diseño IA"
- Inter/Poppins + Lucide + gradiente violeta + glassmorphism en TODOS los proyectos.
- Emojis como iconos (🚀 ✨ 💡) en headings o features.
- 5 pesos de la misma fuente y ninguna jerarquía real.
- Iconos de sets mezclados con strokes distintos en la misma vista.
- Display font en párrafos largos (ilegible) o texto en gris #999 sobre blanco (contraste < 4.5).

Búsqueda upstream: `search.py "<mood>" --domain typography` da más pairings con URLs; estas tablas
son el atajo curado. La elección final SIEMPRE queda escrita en `design-system/<slug>/MASTER.md`.
