# El look moderno: recetas concretas (2025-2026)

Qué hace que una web "se vea de ahora" y cómo se implementa, con snippets. Todo respeta los tokens del
design system (nada de pegar hex sueltos) y pasa por F4 antes de acumular efectos: **una decisión
memorable por página**; el resto, limpio. Tendencias en profundidad: skill `modern-web-design`.

## 1. Los 8 rasgos del look actual (checklist rápida)
1. Tipografía ENORME y con carácter en el hero (`clamp(2.5rem, 6vw + 1rem, 6rem)`, tracking −0.02em, `text-wrap: balance`).
2. Bordes sutiles 1px (`border-white/10` en oscuro, `border-black/5` en claro) en vez de sombras duras.
3. Fondos con vida discreta: aurora/gradiente + grano, no blanco plano ni gradiente chillón.
4. Esquinas generosas y consistentes (`rounded-2xl`/`rounded-3xl` — un solo radio por familia de componentes).
5. Profundidad por capas (fondo → superficie → elevado) con sombras suaves multicapa, no drop-shadow negra.
6. Micro-interacciones en TODO lo clicable (150-300ms, translate-y −2px, glow o border que se enciende).
7. Reveals al hacer scroll, sutiles y una sola vez (`once: true`); el contenido nunca depende de ellos.
8. Dark mode de verdad (no invertido): fondo `#0a0a0f`-`#101418`, superficies +4-6% de luz, acento saturado.

## 2. Heros modernos (elige UNO según el brief)
| Variante | Composición | Efecto que lo remata |
|---|---|---|
| Big type | Titular a 2 líneas ocupando el 60% del alto, badge arriba, CTA + prueba social debajo | Reveal por líneas (SplitText) + marquee de logos debajo |
| Aurora | Titular centrado sobre fondo aurora CSS (§4) + grano | Glow pulsante lento en el gradiente |
| Producto flotante | Split: copy izquierda, screenshot con `rounded-3xl` + border + glow detrás | Parallax suave del screenshot + tilt ligero en hover |
| Bento hero | Titular + grid bento (§3) con features/screenshot/métrica | Stagger de entrada de las celdas |
| Video/mockup | Video corto mudo en loop dentro de mockup de dispositivo | Zoom-out sutil al hacer scroll (scrub) |
| Editorial | Foto full-bleed con overlay oscuro, serif display gigante | Parallax de la imagen en contenedor |

## 3. Bento grid
```html
<div class="grid grid-cols-2 md:grid-cols-4 auto-rows-[minmax(120px,auto)] gap-4">
  <article class="col-span-2 row-span-2 …card…">principal</article>
  <article class="…card…">métrica</article>
  <article class="…card… col-span-2">screenshot</article>
  <!-- card = rounded-3xl border border-white/10 bg-white/[0.03] p-6 overflow-hidden -->
</div>
```
- 1 celda protagonista (2×2), el resto de apoyo; cada celda con UN contenido (métrica, feature, imagen).
- Móvil: colapsa a 1-2 columnas; las celdas decorativas se ocultan (`hidden md:block`), nunca el contenido.

## 4. Aurora / mesh gradient en CSS puro (coste bajo — antes que WebGL)
```css
.aurora { position: relative; overflow: hidden; background: var(--background); }
.aurora::before {
  content: ''; position: absolute; inset: -20%; z-index: 0; filter: blur(60px); opacity: .5;
  background:
    radial-gradient(40% 50% at 20% 30%, color-mix(in oklch, var(--primary), transparent 30%), transparent 70%),
    radial-gradient(35% 45% at 80% 20%, color-mix(in oklch, var(--accent), transparent 40%), transparent 70%),
    radial-gradient(45% 55% at 60% 80%, color-mix(in oklch, var(--primary), transparent 55%), transparent 70%);
  animation: aurora-drift 24s ease-in-out infinite alternate;
}
@keyframes aurora-drift { to { transform: translate(4%, -6%) rotate(8deg) scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .aurora::before { animation: none; } }
```
- Los colores SALEN de los tokens (nunca violeta por defecto). Grano encima para matar el banding:
```css
.grain::after { content:''; position:absolute; inset:0; z-index:1; pointer-events:none; opacity:.06;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
```
- Solo WebGL (threejs `shaders-basics.md`) si el gradiente debe reaccionar al ratón/scroll.

## 5. Glass bien hecho (y cuándo no)
```html
<div class="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md shadow-lg shadow-black/5">…</div>
```
- Solo funciona SOBRE algo (imagen, aurora); sobre fondo plano es gris sucio. Texto encima: contraste 4.5 igualmente.
- Máximo 1-2 superficies glass por vista (nav sticky + una card). `backdrop-blur` es caro: nunca en listas largas.

## 6. Spotlight card (borde que sigue al ratón)
```html
<article class="spot relative rounded-2xl border border-white/10 bg-white/[0.03] p-6">…</article>
<script>/* un listener por grid, no por card */
document.querySelectorAll('.spot-grid').forEach((grid) => grid.addEventListener('pointermove', (e) => {
  for (const c of grid.querySelectorAll('.spot')) {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }
}));</script>
<style>.spot::before { content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none; opacity:0; transition:opacity .3s;
  background: radial-gradient(220px at var(--mx) var(--my), color-mix(in oklch, var(--primary), transparent 82%), transparent 70%); }
  .spot:hover::before { opacity:1; }
  @media (pointer: coarse), (prefers-reduced-motion: reduce) { .spot::before { display:none; } }</style>
```

## 7. Botones y texto con brillo
- **Glow hover**: `hover:shadow-[0_0_24px_-6px_var(--primary)] hover:-translate-y-0.5 transition` (el glow usa el token).
- **Shine** (barrido de luz): pseudo-elemento `linear-gradient(105deg, transparent 40%, rgba(255,255,255,.35) 50%, transparent 60%)`
  con `background-size: 250% 100%` animando `background-position` en hover (0.6s). En táctil no existe hover: sin shine.
- **Texto degradado**: `bg-gradient-to-r from-[var(--text)] to-[color-mix(in_oklch,var(--primary),white_20%)] bg-clip-text text-transparent`
  — solo en el titular protagonista, nunca en párrafos (contraste y legibilidad).
- **Borde degradado**: doble fondo `background: linear-gradient(var(--surface),var(--surface)) padding-box, linear-gradient(120deg,var(--primary),var(--accent)) border-box; border: 1px solid transparent;`.

## 8. Nav sticky moderna
`sticky top-0 z-40 border-b border-white/10 bg-[var(--background)]/70 backdrop-blur-md` + altura que encoge
al hacer scroll (patrón §8 de `gsap-scrolltrigger/references/es/scrolltrigger-patterns.md`) + barra de progreso
de lectura opcional en artículos (2px, `scale-x` con scrub).

## 9. CSS moderno nativo (úsalo antes que JS)
| API | Para qué | Fallback |
|---|---|---|
| Scroll-driven animations (`animation-timeline: view()`) | Reveals/parallax sin GSAP en efectos simples | `@supports`: sin animación (estado final) |
| View Transitions (Astro `<ClientRouter/>`, API nativa) | Transición entre páginas sin barba.js | Corte normal |
| `:has()` | Estados padre-según-hijo (card con checkbox, form válido) | Clase con JS |
| Container queries (`@container`) | Componentes que se adaptan a SU caja, no al viewport | Media queries |
| `color-mix(in oklch …)` | Variantes de token (hover, glow, transparencias) sin hex nuevos | Valor precalculado |
| `text-wrap: balance` / `pretty` | Titulares sin viudas | Nada (progresivo) |
| `@property` | Animar custom properties (gradientes que rotan) | Sin animación |
| `light-dark()` | Tokens claro/oscuro en una línea | Pareja de custom properties |

## 10. Anti-cliché (lo que hace que parezca plantilla IA)
Violeta+Inter+glass en todo · glow en TODOS los elementos · 6 efectos compitiendo en una página ·
emojis como iconos · gradiente de texto en párrafos · glass sobre fondo plano · bento de 12 celdas iguales ·
partículas WebGL para una web de servicios. El look moderno es sobre todo **restricción**: tipografía valiente,
fondos con vida sutil, interacción que responde, y UN momento wow bien ejecutado (catálogo: `front-activation/references/effects-catalog.md`).
