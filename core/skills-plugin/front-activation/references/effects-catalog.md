# Catálogo de efectos de front

## Índice

- [Cómo usar este catálogo](#cómo-usar-este-catálogo)
- [Scroll](#scroll)
- [Texto](#texto)
- [Imagen y media](#imagen-y-media)
- [Interacción y hover](#interacción-y-hover)
- [Fondos](#fondos)
- [Transiciones y navegación](#transiciones-y-navegación)
- [3D](#3d)
- [CSS nativo moderno](#css-nativo-moderno)
- [Formas y SVG](#formas-y-svg)
- [Tipografía cinética](#tipografía-cinética)
- [Microinteracciones, menús y entrada](#microinteracciones-menús-y-entrada)
- [Física e impacto](#física-e-impacto)
- [WebGL avanzado](#webgl-avanzado)
- [Reglas al aplicar cualquier efecto](#reglas-al-aplicar-cualquier-efecto)
- [Si el efecto no está aquí](#si-el-efecto-no-está-aquí)

> Antes de elegir efectos, elige la COMPOSICIÓN de la página: ui-ux-pro-max → `references/es/composiciones.md` (bento, editorial, rejilla rota, pantalla dividida, storytelling…). Cambiar la estructura aleja más de la plantilla que cualquier animación.

## Cómo usar este catálogo

Localiza el efecto en su categoría y abre SOLO el archivo y sección que indica la receta:
no cargues la skill completa ni el resto de referencias. Las rutas son relativas a la skill
instalada; los archivos `vendor` (sin `es/`) están en inglés dentro de la propia skill.
La columna Reduced-motion indica el fallback mínimo cuando `prefers-reduced-motion: reduce`
está activo: aplicarlo es obligatorio siempre, con `gsap.matchMedia()` o media query CSS.

## Scroll

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Parallax multicapa / multi-layer parallax | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §5 Parallax por capas (EN: `references/common_patterns.md` §4.2 Multi-Layer Parallax) | Todos | Desactivar (capas estáticas) | Medio |
| Parallax de imagen en contenedor / image parallax in container | gsap-scrolltrigger → `references/es/effects-pro.md` §Parallax de imagen en contenedor | Todos | Imagen fija | Bajo |
| Zoom parallax (scrub) / parallax zoom | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §11 Imagen con zoom (EN: `references/common_patterns.md` §8.3 Image Parallax Zoom) | Todos | Imagen a escala 1 | Medio |
| Sección fija con pin / sticky pinned section | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §3 Pin + scrub timeline | Todos | Sin pin, contenido en flujo | Medio |
| Stacking cards / stacked cards | gsap-scrolltrigger → `references/es/effects-pro.md` §Stacking cards completo (EN: `references/common_patterns.md` §2.4 Multiple Pinned Sections) | Todos | Cards apiladas sin pin | Medio |
| Scroll horizontal / horizontal scroll | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §4 Horizontal scroll section + `templates/HorizontalScroll.vue` | Todos | Scroll vertical normal | Alto |
| Scroll-velocity / skew on scroll | gsap-scrolltrigger → `references/es/effects-pro.md` §Scroll velocity skew | Todos | Desactivar skew | Medio |
| Header que se oculta / header hide-show | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §8 Sticky header que se oculta al bajar | Todos | Mantener (sin animación de entrada) | Bajo |
| Progress de lectura (barra) / reading progress bar | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §6 Progress bar de lectura | Todos | Mantener (informativo) | Bajo |
| Progress de lectura (circular) / circular progress | gsap-scrolltrigger → `references/common_patterns.md` §11.2 Circular Progress Indicator | Todos | Mantener (informativo) | Bajo |
| Smooth scroll (Lenis) / smooth scrolling | gsap-scrolltrigger → `templates/useLenis.ts` (React: `references/es/next.md` §7 Lenis con React) | Todos | Desactivar Lenis (scroll nativo) | Medio |
| Cambio de tema por sección / section theme switch | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §14 Cambio de tema/color de fondo por sección | Todos | Cambio instantáneo sin tween | Bajo |
| Scrollspy / active nav on scroll | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §15 Navegación activa (scrollspy) | Todos | Mantener (informativo) | Bajo |

## Texto

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Reveal por líneas / text reveal by lines | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §10 Texto por líneas con SplitText (EN: `references/common_patterns.md` §7.1 Text Reveal) | Todos | Texto visible sin animar | Bajo |
| Reveal por caracteres / text stagger by chars | gsap-scrolltrigger → `references/common_patterns.md` §5.4 Text Stagger (Words/Characters) | Todos | Texto visible sin animar | Medio |
| Scramble / scrambled text | gsap-scrolltrigger → `references/common_patterns.md` §7.2 Scrambled Text Effect | Todos | Mostrar texto final directo | Bajo |
| Typewriter / máquina de escribir | gsap-scrolltrigger → `references/common_patterns.md` §7.3 Typewriter Effect | Todos | Mostrar texto final directo | Bajo |
| Texto degradado con brillo / gradient text | ui-ux-pro-max → `references/es/modern-look.md` §7 (bg-clip-text con tokens; solo el titular protagonista) | Todos | Mantener (es estático) | Bajo |
| Contador numérico / number counter | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §7 Contador numérico | Todos | Mostrar valor final directo | Bajo |

## Imagen y media

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Image reveal cortina / curtain reveal | gsap-scrolltrigger → `references/common_patterns.md` §8.1 Image Curtain Reveal | Todos | Imagen visible sin animar | Bajo |
| Image reveal clip-path / scale reveal | gsap-scrolltrigger → `references/common_patterns.md` §8.2 Image Scale Reveal (clip-path) | Todos | Imagen visible sin animar | Bajo |
| Before/after slider / comparación de imágenes | gsap-scrolltrigger → `references/es/effects-pro.md` §Before after slider | Todos | Mantener (control manual) | Bajo |
| Efecto lupa / image magnifier | gsap-scrolltrigger → `references/es/effects-pro.md` §Efecto lupa | Todos | Mantener (sigue al puntero) | Medio |
| Video scrubbing por frames (canvas) / canvas image sequence | gsap-scrolltrigger → `references/es/scrolltrigger-patterns.md` §13 Hero con video scrubbing por frames (EN: `references/common_patterns.md` §12.1 Canvas Image Sequence) | Todos | Poster estático | Alto |
| Video scrubbing con currentTime / video.currentTime scrub | gsap-scrolltrigger → `references/es/effects-pro.md` §Video scrubbing con currentTime | Todos | Poster estático o play normal | Alto |
| Galería con filtros animados / Flip gallery filters | gsap-scrolltrigger → `references/es/effects-pro.md` §Filtros de galería con Flip | Todos | Filtrar sin animación | Medio |
| Marquee infinito / infinite marquee | gsap-scrolltrigger → `references/es/effects-pro.md` §Marquee infinito (helper `horizontalLoop`); React/Tailwind: animated-component-libraries → `references/magic_ui_components.md` §Marquee (solo React) | Todos / solo React | Pausar o desacelerar mucho | Medio |
| Galería infinita / infinite gallery | gsap-scrolltrigger → `references/es/effects-pro.md` §Galería infinita | Todos | Galería estática con scroll nativo | Alto |

## Interacción y hover

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Cursor personalizado / custom cursor | gsap-scrolltrigger → `references/es/effects-pro.md` §Cursor personalizado; base UX: modern-web-design → `SKILL.md` §5 Cursor UX | Todos | Cursor nativo (sin follower) | Bajo (desactivar en táctil) |
| Botón magnético / magnetic button | modern-web-design → `references/interaction_patterns.md` §1.3 Magnetic Button | Todos | Hover simple sin atracción | Bajo (desactivar en táctil) |
| Zoom de imagen en hover / image zoom on hover | modern-web-design → `references/interaction_patterns.md` §5.1 Image Zoom on Hover | Todos | Sin zoom | Bajo |
| Spotlight card (borde sigue al ratón) / mouse-tracking spotlight | ui-ux-pro-max → `references/es/modern-look.md` §6 Spotlight card (un listener por grid) | Todos | Sin spotlight (borde estático) | Bajo (desactivar en táctil) |
| Botón shine-glow / shiny button | ui-ux-pro-max → `references/es/modern-look.md` §7 Botones y texto con brillo | Todos | Hover simple sin barrido | Bajo |
| Tilt 3D en cards / 3D tilt with glare | lightweight-3d-effects → `references/tilt_patterns.md` (opciones §Glare Effect; wrappers §Framework Integration React/Vue) | Todos | Card plana sin tilt | Bajo (desactivar en táctil) |

## Fondos

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Aurora / mesh en CSS puro / CSS aurora background | ui-ux-pro-max → `references/es/modern-look.md` §4 Aurora (radial-gradients + blur + drift; PRIMERO esta versión, WebGL solo si debe reaccionar) | Todos | Gradiente estático (sin drift) | Bajo |
| Grano-noise overlay / film grain | ui-ux-pro-max → `references/es/modern-look.md` §4 (SVG feTurbulence en data-URI) | Todos | Mantener (es estático) | Bajo |
| Fondo animado Vanta / Vanta.js background | lightweight-3d-effects → `references/vantajs_effects.md` (14 efectos: WAVES, FOG, NET, GLOBE…) | Todos | Fondo estático (gradiente CSS) | Alto |
| Aurora de librería / library aurora background | animated-component-libraries → `references/react_bits_components.md` §Aurora (solo React) | solo React | Gradiente estático | Alto |
| Mesh gradient en shader propio / custom mesh gradient shader | threejs-webgl → `references/es/shaders-basics.md` §Mesh gradient / aurora en shader propio (base: §6.1 Gradiente animado de fondo) | Todos | Gradiente estático | Alto |
| Partículas ligeras / lightweight particles | threejs-webgl → `references/es/shaders-basics.md` §6.4 Partículas: `Points`; React: animated-component-libraries → `references/react_bits_components.md` §Particles | Todos / solo React | Sin partículas o estáticas | Medio |

## Transiciones y navegación

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Transiciones de página SPA (Vue) / SPA page transitions | gsap-scrolltrigger → `references/es/vue.md` §5 Transiciones de página | Vue/Nuxt | Fade corto o corte directo | Bajo |
| Transiciones de página SPA (Next) / SPA page transitions | gsap-scrolltrigger → `references/es/next.md` §6 ScrollTrigger y rutas de Next (View Transitions, `template.tsx`, overlay) | Next/React | Fade corto o corte directo | Bajo |
| Transiciones de página SPA (Astro) / SPA page transitions | gsap-scrolltrigger → `references/es/astro.md` §5 Transiciones de página con GSAP (y §4 View Transitions) | Astro | Fade corto o corte directo | Bajo |
| Transiciones de página MPA / Barba.js page transitions | barba-js → `references/transition_patterns.md` (fade, slide, curtain, wipe…) + `references/gsap_integration.md` (timelines) | MPA/estático | Corte directo sin transición | Medio |

## 3D

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Hover distortion WebGL / WebGL image distortion | threejs-webgl → `references/es/shaders-basics.md` §6.3 Hover distortion sobre una imagen (ratón con inercia: §6.5) | Todos | Imagen plana `<img>` | Alto |
| Displacement 2D / PixiJS displacement filter | pixijs-2d → `references/filters_effects.md` §DisplacementFilter (en Built-in Filters) | Todos | Imagen plana sin filtro | Alto |

## CSS nativo moderno

Lo más ligero: sin JS, en el hilo de composición. Empieza aquí antes de meter una librería; siempre dentro de `@supports`.

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Animación ligada al scroll / scroll-driven animation | front-activation → `references/recipes/css-moderno.md` §Animación ligada al scroll | Todos | Estado final estático | Bajo |
| Reveal al entrar en pantalla (CSS) / view() reveal | front-activation → `references/recipes/css-moderno.md` §Reveal al entrar en pantalla | Todos | Sin animación (visible) | Bajo |
| View Transitions entre páginas / cross-document view transitions | front-activation → `references/recipes/css-moderno.md` §View Transitions entre páginas | MPA: Astro, Blade, WordPress | Sin transición | Bajo |
| Entradas con @starting-style / entry transitions | front-activation → `references/recipes/css-moderno.md` §Entradas con starting-style | Todos | Aparición instantánea | Bajo |
| Tooltips y menús anclados / anchor positioning | front-activation → `references/recipes/css-moderno.md` §Anchor positioning | Todos | Mantener (sin animación) | Bajo |
| Galería con scroll-snap / scroll snap gallery | front-activation → `references/recipes/css-moderno.md` §Scroll-snap con estado | Todos | Mantener | Bajo |

## Formas y SVG

Siluetas, cortes y máscaras: lo que más aleja de la web de cajas. Una familia de formas por proyecto, fijada en el MASTER.

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Blob orgánico / organic blob | front-activation → `references/recipes/formas-svg.md` §Blob orgánico | Todos | Forma estática | Bajo |
| Separadores de onda, curva o diagonal / section dividers | front-activation → `references/recipes/formas-svg.md` §Separadores entre secciones | Todos | Mantener (estático) | Bajo |
| Morph de clip-path / clip-path reveal | front-activation → `references/recipes/formas-svg.md` §Morph de clip-path | Todos | Recorte final directo | Bajo |
| Máscara de imagen con forma / shaped image mask | front-activation → `references/recipes/formas-svg.md` §Máscaras de imagen con forma | Todos | Mantener (estático) | Bajo |
| Efecto gooey / gooey effect | front-activation → `references/recipes/formas-svg.md` §Efecto gooey | Todos | Sin fusión (elementos separados) | Medio |
| Dibujado de trazo / SVG line drawing | front-activation → `references/recipes/formas-svg.md` §Dibujado de trazo | Todos | Trazo completo | Bajo |
| Morph entre formas o iconos / shape morph | front-activation → `references/recipes/formas-svg.md` §Morph entre formas | Todos | Cambio instantáneo | Bajo |
| Texto sobre una curva / text on path | front-activation → `references/recipes/formas-svg.md` §Texto sobre una curva | Todos | Sin rotación | Bajo |

## Tipografía cinética

Cuando la tipografía ES el diseño. Una pieza protagonista por página; nunca animar párrafos de lectura.

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Fuente variable animada / variable font animation | front-activation → `references/recipes/tipografia-cinetica.md` §Fuente variable animada | Todos (fuente con ejes) | Peso fijo | Bajo |
| Vídeo dentro del texto / video text mask | front-activation → `references/recipes/tipografia-cinetica.md` §Vídeo dentro del texto | Todos | Poster fijo (vídeo pausado) | Medio |
| Texto que se resalta al leerlo / highlight on scroll | front-activation → `references/recipes/tipografia-cinetica.md` §Texto que se resalta al leerlo | Todos | Resaltado ya aplicado | Bajo |
| Split-flap (panel de aeropuerto) / split-flap text | front-activation → `references/recipes/tipografia-cinetica.md` §Split-flap | Todos | Palabra final directa | Bajo |
| Titular gigante con scroll / oversized scrolling headline | front-activation → `references/recipes/tipografia-cinetica.md` §Titular gigante con scroll | Todos | Titular estático | Medio |
| Texto que rodea una forma en movimiento (Pretext) / text wrap around moving shape | front-activation → `references/recipes/tipografia-cinetica.md` §Texto que rodea una forma en movimiento | Todos (navegador) | Forma quieta, una sola maquetación | Medio |
| Titular que se reajusta al cambiar el ancho (Pretext) / reflowing headline | front-activation → `references/recipes/tipografia-cinetica.md` §Titular que se reajusta mientras cambia el ancho | Todos (navegador) | Sin animación de ancho | Bajo |
| Altura exacta para listas y masonry (Pretext) / exact text height | front-activation → `references/recipes/tipografia-cinetica.md` §Altura exacta para listas y masonry | Todos (navegador) | Mantener | Bajo |
| Texto multilínea en canvas o WebGL (Pretext) / canvas text wrapping | front-activation → `references/recipes/tipografia-cinetica.md` §Texto en canvas o WebGL con saltos de línea | Todos (canvas, Three, Pixi) | Mantener | Medio |

## Microinteracciones, menús y entrada

Respuestas de 150-300 ms que informan de algo. Si no informa, es decoración.

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Estados de botón (cargando → hecho) / button states | front-activation → `references/recipes/microinteracciones.md` §Estados de botón | Todos | Cambio de estado sin transición | Bajo |
| Toggle y checkbox animados / animated toggle | front-activation → `references/recipes/microinteracciones.md` §Toggle y checkbox animados | Todos | Sin transición | Bajo |
| Skeleton con brillo / shimmer skeleton | front-activation → `references/recipes/microinteracciones.md` §Skeleton con brillo | Todos | Skeleton estático | Bajo |
| Like con explosión / like burst | front-activation → `references/recipes/microinteracciones.md` §Like con explosión | Todos | Cambio de icono sin partículas | Bajo |
| Toasts apilables / stacked toasts | front-activation → `references/recipes/microinteracciones.md` §Toasts apilables | Todos | Aparición instantánea | Bajo |
| Loader con marca / branded loader | front-activation → `references/recipes/microinteracciones.md` §Loader con marca | Todos | Loader estático o texto | Bajo |
| Menú a pantalla completa / fullscreen menu | front-activation → `references/recipes/microinteracciones.md` §Menú a pantalla completa | Todos | Apertura instantánea | Bajo |
| Hamburguesa que se transforma / morphing burger | front-activation → `references/recipes/microinteracciones.md` §Hamburguesa que se transforma | Todos | Cambio de icono directo | Bajo |
| Preloader con porcentaje real / real-progress preloader | front-activation → `references/recipes/microinteracciones.md` §Preloader con porcentaje | Solo con assets pesados (3D, vídeo) | Barra sin animación | Bajo |
| Intro de marca / brand intro | front-activation → `references/recipes/microinteracciones.md` §Intro de marca (con caída y cristal roto: `references/recipes/fisica-impacto.md` §Intro o loader) | Todos | Sin intro | Medio |

## Física e impacto

Objetos con gravedad, choques y cristal que se rompe. Demos que funcionan en `references/recipes/demos/`.
Uno por página, con intención (al entrar una vez, al pulsar o al llegar), saltable, y el motor cargado solo cuando se usa.

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Intro con caída y pantalla rota / falling object + shattered screen intro | front-activation → `references/recipes/fisica-impacto.md` §Intro o loader (demo `demos/intro-rotura.html`, sin dependencias) | Todos | Sin intro | Medio (menos trozos) |
| Loader que se agrieta con la carga y se rompe al terminar / cracking loader | front-activation → `references/recipes/fisica-impacto.md` §Intro o loader (modo loader) | Solo con carga pesada real | Barra o texto de carga | Medio |
| La web se rompe como un cristal (trozos = la propia página) / real page shatter | front-activation → `references/recipes/fisica-impacto.md` §La web se rompe como un cristal (demo `demos/web-rota.html`, sin dependencias) | Todos | Fundido a lo de detrás | Medio (menos trozos) |
| Pantalla o sección que se rompe / screen shatter | front-activation → `references/recipes/fisica-impacto.md` §Pantalla que se rompe (radial o Voronoi con d3-delaunay) | Todos | Sin rotura (estado final) | Medio |
| Objeto que cae encima de todo y se apoya / object drop onto page | front-activation → `references/recipes/fisica-impacto.md` §Objeto que cae (demo `demos/objeto-cae.html`, matter-js) | Todos (3D: react-three-rapier) | Aparece ya apoyado | Medio (2D) · Alto (3D) |
| La página se desmorona / page gravity collapse | front-activation → `references/recipes/fisica-impacto.md` §La página se desmorona (demo `demos/pagina-desmorona.html`) | Todos | Sin botón | Medio |
| Arrastrar y lanzar con inercia / drag and throw | front-activation → `references/recipes/fisica-impacto.md` §Arrastrar y lanzar | Todos | Arrastre sin inercia | Bajo |
| Confeti con física / physics confetti | front-activation → `references/recipes/fisica-impacto.md` §Confeti (canvas-confetti) | Todos | Sin confeti (`disableForReducedMotion`) | Bajo |
| El producto explota en partículas / particle explode | front-activation → `references/recipes/fisica-impacto.md` §El producto explota + skill threejs-webgl | Todos (canvas) | Imagen fija | Alto |
| Tela, cuerda, gelatina / verlet cloth & rope | front-activation → `references/recipes/fisica-impacto.md` §Tela, cuerda y gelatina | Todos (canvas) | Estático | Bajo |

## WebGL avanzado

Coste ALTO: máximo uno por página, lazy, con fallback estático en móvil. Solo si aporta al mensaje.

| Efecto (es / en) | Receta: skill → archivo §sección o línea | Stacks | Reduced-motion | Coste móvil |
|---|---|---|---|---|
| Fluido que sigue al ratón / fluid simulation | front-activation → `references/recipes/webgl-avanzado.md` §Fluido que sigue al ratón | Todos (canvas) | Fondo estático | Alto |
| Metaballs / metaballs shader | front-activation → `references/recipes/webgl-avanzado.md` §Metaballs | Todos (canvas) | Imagen estática | Alto |
| Dithering, ASCII y píxel / dither-ascii-pixel post | front-activation → `references/recipes/webgl-avanzado.md` §Dithering, ASCII y píxel | Todos | Imagen procesada estática | Alto |
| Globo 3D ligero / 3D globe (cobe) | front-activation → `references/recipes/webgl-avanzado.md` §Globo 3D | Todos | Globo sin rotación | Medio |
| Liquid glass / refractive glass | front-activation → `references/recipes/webgl-avanzado.md` §Liquid glass | Todos (refracción solo Chromium) | Cristal sin distorsión | Medio |
| Ruido animado en shader / animated shader noise | front-activation → `references/recipes/webgl-avanzado.md` §Ruido animado en shader | Todos | Grano estático | Medio |

## Reglas al aplicar cualquier efecto

- `prefers-reduced-motion` es obligatorio: implementa el fallback de la columna Reduced-motion con `gsap.matchMedia()` (ver `gsap-scrolltrigger → references/es/performance-a11y.md` §6) o media query CSS.
- Anima solo `transform` y `opacity`; nada de `top/left/width/height/filter` en scroll (provocan layout/paint por frame).
- Nada de scroll-jacking ni pin en páginas o secciones con formularios, checkout o contenido largo de lectura.
- Presupuesto móvil: máximo un efecto de coste Alto por página; en móvil degrada o desactiva (`ScrollTrigger.matchMedia` / detección de puntero táctil) los efectos de coste Alto.
- Limpieza al desmontar: `gsap.context()` + `revert()`, `ScrollTrigger.kill()`, `lenis.destroy()`, `effect.destroy()` (Vanta/Pixi/Three) en el unmount del componente.

## Si el efecto no está aquí

- Busca en el catálogo EN de la skill: `Grep` sobre `gsap-scrolltrigger → references/common_patterns.md` (nombres en inglés: reveal, pin, scrub, stagger, parallax…).
- Mira las **fuentes de efectos** (`references/effect-sources.md`): Codrops, CodePen (Hyperplexed, Jhey, Tom Miller…), Awwwards — con licencias y el protocolo para convertir lo encontrado en receta nueva de este catálogo.
- Si tampoco existe, diséñalo desde cero con `gsap-scrolltrigger §references/es/api-cheatsheet` (tweens, timelines, matchMedia, quickTo, utils) respetando las reglas anteriores.
