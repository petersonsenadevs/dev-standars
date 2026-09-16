# Fuentes de efectos: dónde encontrar técnicas de nivel award y cómo hacerlas nuestras

Colección VIVA: aquí se documenta dónde mirar cuando el catálogo (`effects-catalog.md`) no tiene el
efecto, y el protocolo para convertir lo encontrado en **receta propia** del sistema. El objetivo no es
copiar demos: es destilar la técnica y que la colección crezca con cada proyecto.

## 1. Webs de referencia

| Web | Qué encontrarás | Cómo usarla |
|---|---|---|
| awwwards.com | Webs premiadas: animación, inmersivas, experiencias completas | Inspiración de dirección y composición; NO hay código: identifica la técnica y búscala abajo |
| tympanus.net/codrops | Tutoriales y demos CON código (WebGL, GSAP, CSS); case studies de estudios top | La mejor fuente técnica: cada tutorial explica el cómo. Licencia propia (tympanus.net/codrops/licensing): usable en proyectos, no redistribuir/vender los demos tal cual |
| godly.website | Selección curada de webs creativas por estilo/sección | Referencias por tipo de página (protocolo en ui-ux-pro-max `inspiration.md`) |
| hoverstat.es | "Alternative web design": experimental, tipografía viva, navegación no convencional | Cuando el brief pide algo fuera de plantilla; extrae UNA idea, no el caos entero |
| codepen.io | Demos aisladas de cada técnica (busca por término: "marquee gsap", "spotlight card") | Los pens públicos son MIT: puedes adaptar el código citando autor en el devlog |

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
