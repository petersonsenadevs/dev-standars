# Fuentes de efectos: dónde encontrar técnicas de nivel award y cómo hacerlas nuestras

Colección VIVA: aquí se documenta dónde mirar cuando el catálogo (`effects-catalog.md`) no tiene el
efecto, y el protocolo para convertir lo encontrado en **receta propia** del sistema. El objetivo no es
copiar demos: es destilar la técnica y que la colección crezca con cada proyecto.

## 0. Índices cosechados (el contenido real, catalogado)
- `sources/codrops-index.md` — ~75 tutoriales de Codrops por tipo de efecto, mapeados a nuestras skills.
- `sources/codepen-index.md` — los pens top de los 8 autores, con a qué receta nuestra se conectan.
- `sources/showcases-index.md` — categorías de Awwwards, estudios a seguir, estado de Godly/Hoverstat.es.
Cada índice dice cómo refrescarse (scraping con WebFetch/Chrome). Fecha de cosecha: 2026-09-16.

## 0b. Código vendorizado (en el repo dev-standards, licencias MIT verificadas)
`core/effects-vendor/` — **no viene al clonar el repo** (pesa 274 MB): descárgala con
`tools/vendor-effects.ps1 -Missing` (clona cada repo original, verifica su licencia y regenera el índice).
**Empieza por su `INDEX.md`**, que sí está versionado (autogenerado, por categoría): ~60 demos completos
de Codrops (cursores, texto, scroll-layout, hover, menús, transiciones, galerías — incluida la tienda
Astro con View Transitions), **uiverse-galaxy** (~3.800 elementos UI), **whirl** + **css-loaders**
(loaders CSS), **fancy-components** (React animado de fancycomponents.dev) y **vanta** (fondos WebGL).
Añadidos 2026-09-30 para las recetas nuevas: **magicui** (componentes animados React/Tailwind), **cobe**
(globo 3D), **webgl-fluid** (fluido en GPU), **splitting** (dividir texto sin GSAP), **vivus** (trazos SVG),
**blobs** y **flubber** (formas orgánicas y morph), **css-doodle** (patrones generativos).
**Excluido a propósito: React Bits** — su licencia es "MIT + Commons Clause", que prohíbe redistribuir
los componentes (este repo es público). Se puede USAR en un proyecto concreto, pero no vendorizar aquí;
el script rechaza ya automáticamente cualquier LICENSE con Commons Clause o "no redistribuir".
Gestionado por `tools/vendor-effects.ps1` + `manifest.json` (verifica el LICENSE real de cada repo;
`stripMedia` quita media pesada conservando el código). Nota: los repos GitHub de Codrops son MIT aunque
las descargas de su web tengan licencia restrictiva — vendorizar siempre desde GitHub. CodePen NO permite
descarga automatizada (Cloudflare): sus pens se consultan en el navegador (índice §0).

## 1. Webs de referencia

| Web | Qué encontrarás | Cómo usarla |
|---|---|---|
| awwwards.com | Webs premiadas: animación, inmersivas, experiencias completas | Inspiración de dirección y composición; NO hay código: identifica la técnica y búscala abajo |
| tympanus.net/codrops | Tutoriales y demos CON código (WebGL, GSAP, CSS); case studies de estudios top | La mejor fuente técnica: cada tutorial explica el cómo. Licencia propia (tympanus.net/codrops/licensing): usable en proyectos, no redistribuir/vender los demos tal cual |
| recent.design (antes godly.website, que redirige aquí) | Selección curada de webs creativas | Referencias por tipo de página (protocolo en ui-ux-pro-max `inspiration.md`) |
| hoverstat.es | "Alternative web design": experimental, tipografía viva, navegación no convencional | Cuando el brief pide algo fuera de plantilla; extrae UNA idea, no el caos entero |
| codepen.io | Demos aisladas de cada técnica (busca por término: "marquee gsap", "spotlight card") | Los pens públicos son MIT: puedes adaptar el código citando autor en el devlog |

## 1b. Más canteras (para seguir engordando la colección)

| Fuente | Qué da | Licencia / cómo usarla |
|---|---|---|
| github.com/codrops (¡todos los demos!) | Cada tutorial de Codrops tiene su repo | MIT en los repos: añadir al manifest de vendor-effects |
| threejs.org/examples + github.com/mrdoob/three.js (examples/) | Cientos de ejemplos oficiales 3D/shaders | MIT: copiar y adaptar |
| uiverse.io (github.com/uiverse-io/galaxy) | Miles de elementos UI de la comunidad | MIT — YA vendorizado |
| web.dev/patterns | Patrones copy-paste (layout, componentes, animación) de Google | Apache-2.0 |
| codepen.io/GreenSock + gsap.com/demos | Demos oficiales de GSAP por plugin | Ver en navegador; adaptar citando |
| css-loaders.com (Temani Afif) | 600+ loaders CSS de un solo div | Libre con atribución |
| animista.net | Generador de micro-animaciones CSS | Snippets libres |
| theme-toggles.com (github AlfieJones/theme-toggles) | Toggles de dark mode animados | Verificar LICENSE al vendorizar |
| lottiefiles.com (free) | Animaciones Lottie gratuitas | Lottie Simple License (uso comercial ok) |
| thebookofshaders.com | Aprender GLSL desde cero | Educativo; código de ejemplos usable |
| svg-spinners, SVG-Loaders, vanilla-tilt (GitHub) | Spinners SVG y tilt 3D sin dependencias | MIT — YA vendorizados en effects-vendor |
| ⚠️ shadertoy.com | Miles de shaders | **CC BY-NC-SA por defecto: NO usar en proyectos comerciales** sin permiso del autor |
| ⚠️ osmo.supply, hover.dev (vault de pago) | Recursos premium | Solo si el usuario tiene licencia; no copiar de previews |

## 2. Autores de CodePen que son escuelas enteras

| Autor (perfil CodePen) | Qué mirar | Se conecta con nuestra skill |
|---|---|---|
| Hyperplexed | Tarjetas glow/spotlight, galerías, menús, efectos de texto virales | ui-ux-pro-max `modern-look.md` §6-7 (spotlight, shine) |
| Jhey (jh3y) | Interfaces creativas, CSS moderno (scroll-driven, `:has`, anchor), micro-experimentos | `modern-look.md` §9 CSS nativo; sus pens muestran hasta dónde llega CSS sin JS |
| Steve Gardner (ste-vg) | Experiencias interactivas y scroll-storytelling con GSAP (el avión de papel) | gsap-scrolltrigger `scrolltrigger-patterns.md` (pin+scrub, timelines largas) |
| Ana Tudor (thebabydino) | Geometría, 3D en CSS puro, gradientes matemáticos, `@property` | `modern-look.md` §9 (@property) y efectos CSS sin librería |
| Matthias Hurrle (atzedent) | Shaders GLSL, arte abstracto, fondos generativos | threejs-webgl `shaders-basics.md` (mesh gradient, fragment shaders) |
| Akimitsu Hamamuro | Partículas, física, experimentos Canvas 2D | pixijs-2d (canvas performante) y F4 antes de usarlos en producción |
| Tom Miller (creativeocean) | Animación fluida, tipografía cinética, GSAP avanzado (SplitText, physics) | gsap-scrolltrigger `effects-pro.md` y efectos de texto |
| Temani Afif (t_afif) | CSS-only extremo: un div, gradientes, máscaras; css-tip.com | Soluciones sin JS para lo que parecía necesitar JS |

## 3. Protocolo: de demo encontrada a receta del sistema

1. **Licencia primero**: CodePen público = MIT (adapta citando autor); Codrops = su licencia (usable, no
   redistribuir demos); Awwwards/Godly/Hoverstat.es = escaparates, solo inspiración de técnica.
2. **Destila la técnica**, no el código: ¿qué lo hace funcionar? (un `clip-path` animado, un `quickTo`,
   un shader de ruido). Reescríbelo sobre NUESTROS tokens y convenciones (gsap.context, matchMedia).
3. **Presupuéstalo** con el árbol F4 (reduced-motion con fallback digno, LCP, táctil, scroll-jacking) y
   pruébalo en móvil real o 375px. Si no pasa F4, se descarta por caro, no se cuela.
4. **Hazlo receta** si es reutilizable (así crece la colección):
   - Efecto GSAP/scroll → sección nueva en `gsap-scrolltrigger/references/es/effects-pro.md`.
   - Look/CSS moderno → sección en `ui-ux-pro-max/references/es/modern-look.md`.
   - Shader/canvas → sección en `threejs-webgl/references/es/shaders-basics.md`.
   - Fila nueva en `effects-catalog.md` (efecto | receta §sección | stacks | reduced-motion | coste móvil).
   - En dev-standards: `build-routers` → `check-skills` → `test-router` → commit (`docs(effects): …`).
   - En un proyecto cliente sin acceso al repo: documenta la receta en el devlog y márcala "candidata a dev-standards".
5. **Cita la fuente** en la receta o el devlog (autor + URL): es honesto y permite volver al original.

## 4. Técnica famosa → receta que ya tenemos (no reinventar)

| Lo que viste por ahí | Ya está en |
|---|---|
| Tarjeta con borde glow que sigue al ratón (Hyperplexed) | `modern-look.md` §6 Spotlight card |
| Texto que se revela línea a línea al scroll | gsap `scrolltrigger-patterns.md` §10 (SplitText) |
| Logos en cinta infinita | gsap `effects-pro.md` §Marquee infinito |
| Fondo aurora/mesh que respira | `modern-look.md` §4 (CSS) o threejs `shaders-basics.md` (reactivo) |
| Cards que se apilan al bajar | gsap `effects-pro.md` §Stacking cards completo |
| Imagen que se compara con un deslizador | gsap `effects-pro.md` §Before after slider |
| Video que avanza con el scroll | gsap `effects-pro.md` §Video scrubbing |
| Hover que distorsiona la imagen (liquid) | threejs `shaders-basics.md` / pixijs-2d (displacement) |
| Cursor que crece sobre enlaces | gsap `effects-pro.md` §Cursor personalizado |
| Texto que se escribe/desordena (typewriter, scramble) | gsap `common_patterns.md` §7.2-7.3 (EN) |
