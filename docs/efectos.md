# Efectos

<!-- GENERADO por tools/build-efectos.mjs desde el catálogo de efectos y las fichas de las demos. No editar. -->
[← Volver al README](../README.md)

Senzu trae un catálogo de efectos de front con receta por stack (Astro, Next/React, Vue/Inertia): se piden en
llano («ponle un parallax», «que caiga el logo y se rompa la pantalla») o con `/efecto`, y el agente abre SOLO
la receta de ese efecto. Todos tienen versión para «reducir movimiento» y su coste en móvil decidido.

## Demos que funcionan

Archivos HTML autocontenidos: se abren con doble clic y son la base que el agente adapta al proyecto.

### Intro con caída y pantalla rota

Un objeto cae, golpea la pantalla, se agrieta y el cristal se rompe en trozos que caen dejando ver la web. También como loader que se agrieta mientras carga.

- **Demo:** [`intro-rotura.html`](../core/skills-plugin/front-activation/references/recipes/demos/intro-rotura.html)
- **Receta:** [fisica-impacto.md §intro o loader con caída y pantalla rota](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#intro-o-loader-con-caída-y-pantalla-rota)
- **Dependencias:** ninguna
- **Interacción:** Botón «Saltar intro» y Escape
- **Con «reducir movimiento»:** Sin intro
- **En móvil:** Menos trozos y objeto más pequeño
- **Pruébala:** `?intro=1` (la fuerza aunque ya se viera en la sesión) · `?intro=1&modo=loader` (modo loader: las grietas avanzan con la carga y se rompe al terminar)

### Objeto que cae encima de todo

Un objeto elegido cae por encima de la web, choca con los bloques reales, se apoya en el destino y se puede coger y lanzar.

- **Demo:** [`objeto-cae.html`](../core/skills-plugin/front-activation/references/recipes/demos/objeto-cae.html)
- **Receta:** [fisica-impacto.md §objeto que cae encima de todo](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#objeto-que-cae-encima-de-todo)
- **Dependencias:** matter-js 0.20.0 (MIT; CDN jsdelivr, al ver el destino)
- **Interacción:** Arrastrar y lanzar el objeto
- **Con «reducir movimiento»:** Aparece ya apoyado, sin cargar el motor
- **En móvil:** Destino propio (data-fisica-destino-movil): los bloques se apilan

### La página se desmorona

Con un botón, los elementos de la página caen con gravedad y se apilan; se arrastran y se lanzan, y Escape los devuelve a su sitio.

- **Demo:** [`pagina-desmorona.html`](../core/skills-plugin/front-activation/references/recipes/demos/pagina-desmorona.html)
- **Receta:** [fisica-impacto.md §la página se desmorona](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#la-página-se-desmorona)
- **Dependencias:** matter-js 0.20.0 (MIT; CDN jsdelivr, al pulsar el botón)
- **Interacción:** Botón «Activar gravedad», arrastrar, Escape o «Recomponer»
- **Con «reducir movimiento»:** Sin botón de gravedad
- **En móvil:** Igual, con las paredes de la pantalla

### La web se rompe como un cristal

La página se ve normal; un clic o un objeto que cae la golpea, se agrieta y se parte en trozos que son la propia web (texto real, sin capturas) y caen girando en 3D. Detrás aparece lo que elijas.

- **Demo:** [`web-rota.html`](../core/skills-plugin/front-activation/references/recipes/demos/web-rota.html)
- **Receta:** [fisica-impacto.md §la web se rompe como un cristal](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#la-web-se-rompe-como-un-cristal)
- **Dependencias:** ninguna
- **Interacción:** Botón «Romper la web» (rompe donde pulsas), Escape la salta, «Volver» la recompone
- **Con «reducir movimiento»:** Fundido a lo de detrás, sin rotura
- **En móvil:** Menos trozos y temblor más corto
- **Pruébala:** `?auto=1` (un objeto cae a los 0,8 s y rompe la web (modo intro))

## Catálogo

### Scroll

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Parallax multicapa *(multi-layer parallax)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#5-parallax-por-capas) §5 Parallax por capas | Todos | Desactivar (capas estáticas) | Medio |
| Parallax de imagen en contenedor *(image parallax in container)* | `gsap-scrolltrigger` → [effects-pro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/effects-pro.md#parallax-de-imagen-en-contenedor) §Parallax de imagen en contenedor | Todos | Imagen fija | Bajo |
| Zoom parallax (scrub) *(parallax zoom)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#11-imagen-con-zoom) §11 Imagen con zoom | Todos | Imagen a escala 1 | Medio |
| Sección fija con pin *(sticky pinned section)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#3-pin-scrub-timeline) §3 Pin + scrub timeline | Todos | Sin pin, contenido en flujo | Medio |
| Stacking cards *(stacked cards)* | `gsap-scrolltrigger` → [effects-pro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/effects-pro.md#stacking-cards-completo) §Stacking cards completo | Todos | Cards apiladas sin pin | Medio |
| Scroll horizontal *(horizontal scroll)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#4-horizontal-scroll-section) §4 Horizontal scroll section | Todos | Scroll vertical normal | Alto |
| Scroll-velocity *(skew on scroll)* | `gsap-scrolltrigger` → [effects-pro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/effects-pro.md#scroll-velocity-skew) §Scroll velocity skew | Todos | Desactivar skew | Medio |
| Header que se oculta *(header hide-show)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#8-sticky-header-que-se-oculta-al-bajar) §8 Sticky header que se oculta al bajar | Todos | Mantener (sin animación de entrada) | Bajo |
| Progress de lectura (barra) *(reading progress bar)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#6-progress-bar-de-lectura) §6 Progress bar de lectura | Todos | Mantener (informativo) | Bajo |
| Progress de lectura (circular) *(circular progress)* | `gsap-scrolltrigger` → [common_patterns.md](../core/skills-vendor/gsap-scrolltrigger/references/common_patterns.md#112-circular-progress-indicator) §11.2 Circular Progress Indicator | Todos | Mantener (informativo) | Bajo |
| Smooth scroll (Lenis) *(smooth scrolling)* | `gsap-scrolltrigger` → [useLenis.ts](../core/skills-overlay/gsap-scrolltrigger/templates/useLenis.ts#7-lenis-con-react) §7 Lenis con React) | Todos | Desactivar Lenis (scroll nativo) | Medio |
| Cambio de tema por sección *(section theme switch)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#14-cambio-de-temacolor-de-fondo-por-sección) §14 Cambio de tema/color de fondo por sección | Todos | Cambio instantáneo sin tween | Bajo |
| Scrollspy *(active nav on scroll)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#15-navegación-activa) §15 Navegación activa | Todos | Mantener (informativo) | Bajo |

### Texto

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Reveal por líneas *(text reveal by lines)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#10-texto-por-líneas-con-splittext) §10 Texto por líneas con SplitText | Todos | Texto visible sin animar | Bajo |
| Reveal por caracteres *(text stagger by chars)* | `gsap-scrolltrigger` → [common_patterns.md](../core/skills-vendor/gsap-scrolltrigger/references/common_patterns.md#54-text-stagger) §5.4 Text Stagger | Todos | Texto visible sin animar | Medio |
| Scramble *(scrambled text)* | `gsap-scrolltrigger` → [common_patterns.md](../core/skills-vendor/gsap-scrolltrigger/references/common_patterns.md#72-scrambled-text-effect) §7.2 Scrambled Text Effect | Todos | Mostrar texto final directo | Bajo |
| Typewriter *(máquina de escribir)* | `gsap-scrolltrigger` → [common_patterns.md](../core/skills-vendor/gsap-scrolltrigger/references/common_patterns.md#73-typewriter-effect) §7.3 Typewriter Effect | Todos | Mostrar texto final directo | Bajo |
| Texto degradado con brillo *(gradient text)* | `ui-ux-pro-max` → [modern-look.md](../core/skills-overlay/ui-ux-pro-max/references/es/modern-look.md#7) §7 | Todos | Mantener (es estático) | Bajo |
| Contador numérico *(number counter)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#7-contador-numérico) §7 Contador numérico | Todos | Mostrar valor final directo | Bajo |

### Imagen y media

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Image reveal cortina *(curtain reveal)* | `gsap-scrolltrigger` → [common_patterns.md](../core/skills-vendor/gsap-scrolltrigger/references/common_patterns.md#81-image-curtain-reveal) §8.1 Image Curtain Reveal | Todos | Imagen visible sin animar | Bajo |
| Image reveal clip-path *(scale reveal)* | `gsap-scrolltrigger` → [common_patterns.md](../core/skills-vendor/gsap-scrolltrigger/references/common_patterns.md#82-image-scale-reveal) §8.2 Image Scale Reveal | Todos | Imagen visible sin animar | Bajo |
| Before/after slider *(comparación de imágenes)* | `gsap-scrolltrigger` → [effects-pro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/effects-pro.md#before-after-slider) §Before after slider | Todos | Mantener (control manual) | Bajo |
| Video scrubbing por frames (canvas) *(canvas image sequence)* | `gsap-scrolltrigger` → [scrolltrigger-patterns.md](../core/skills-overlay/gsap-scrolltrigger/references/es/scrolltrigger-patterns.md#13-hero-con-video-scrubbing-por-frames) §13 Hero con video scrubbing por frames | Todos | Poster estático | Alto |
| Video scrubbing con currentTime *(video.currentTime scrub)* | `gsap-scrolltrigger` → [effects-pro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/effects-pro.md#video-scrubbing-con-currenttime) §Video scrubbing con currentTime | Todos | Poster estático o play normal | Alto |
| Galería con filtros animados *(Flip gallery filters)* | `gsap-scrolltrigger` → [effects-pro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/effects-pro.md#filtros-de-galería-con-flip) §Filtros de galería con Flip | Todos | Filtrar sin animación | Medio |
| Marquee infinito *(infinite marquee)* | `gsap-scrolltrigger` → [effects-pro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/effects-pro.md#marquee-infinito) §Marquee infinito | Todos / solo React | Pausar o desacelerar mucho | Medio |
| Galería infinita *(infinite gallery)* | `gsap-scrolltrigger` → [effects-pro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/effects-pro.md#galería-infinita) §Galería infinita | Todos | Galería estática con scroll nativo | Alto |

### Interacción y hover

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Cursor personalizado *(custom cursor)* | `gsap-scrolltrigger` → [effects-pro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/effects-pro.md#cursor-personalizado) §Cursor personalizado | Todos | Cursor nativo (sin follower) | Bajo (desactivar en táctil) |
| Botón magnético *(magnetic button)* | `modern-web-design` → [interaction_patterns.md](../core/skills-vendor/modern-web-design/references/interaction_patterns.md#13-magnetic-button) §1.3 Magnetic Button | Todos | Hover simple sin atracción | Bajo (desactivar en táctil) |
| Zoom de imagen en hover *(image zoom on hover)* | `modern-web-design` → [interaction_patterns.md](../core/skills-vendor/modern-web-design/references/interaction_patterns.md#51-image-zoom-on-hover) §5.1 Image Zoom on Hover | Todos | Sin zoom | Bajo |
| Spotlight card (borde sigue al ratón) *(mouse-tracking spotlight)* | `ui-ux-pro-max` → [modern-look.md](../core/skills-overlay/ui-ux-pro-max/references/es/modern-look.md#6-spotlight-card) §6 Spotlight card | Todos | Sin spotlight (borde estático) | Bajo (desactivar en táctil) |
| Botón shine-glow *(shiny button)* | `ui-ux-pro-max` → [modern-look.md](../core/skills-overlay/ui-ux-pro-max/references/es/modern-look.md#7-botones-y-texto-con-brillo) §7 Botones y texto con brillo | Todos | Hover simple sin barrido | Bajo |
| Tilt 3D en cards *(3D tilt with glare)* | `lightweight-3d-effects` → [tilt_patterns.md](../core/skills-vendor/lightweight-3d-effects/references/tilt_patterns.md#glare-effect) §Glare Effect | Todos | Card plana sin tilt | Bajo (desactivar en táctil) |

### Fondos

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Aurora *(mesh en CSS puro)* | `ui-ux-pro-max` → [modern-look.md](../core/skills-overlay/ui-ux-pro-max/references/es/modern-look.md#4-aurora) §4 Aurora | Todos | Gradiente estático (sin drift) | Bajo |
| Grano-noise overlay *(film grain)* | `ui-ux-pro-max` → [modern-look.md](../core/skills-overlay/ui-ux-pro-max/references/es/modern-look.md#4) §4 | Todos | Mantener (es estático) | Bajo |
| Fondo animado Vanta *(Vanta.js background)* | `lightweight-3d-effects` → [vantajs_effects.md](../core/skills-vendor/lightweight-3d-effects/references/vantajs_effects.md) | Todos | Fondo estático (gradiente CSS) | Alto |
| Aurora de librería *(library aurora background)* | `animated-component-libraries` → [react_bits_components.md](../core/skills-vendor/animated-component-libraries/references/react_bits_components.md#aurora) §Aurora | solo React | Gradiente estático | Alto |
| Mesh gradient en shader propio *(custom mesh gradient shader)* | `threejs-webgl` → [shaders-basics.md](../core/skills-overlay/threejs-webgl/references/es/shaders-basics.md#mesh-gradient-aurora-en-shader-propio) §Mesh gradient / aurora en shader propio | Todos | Gradiente estático | Alto |
| Partículas ligeras *(lightweight particles)* | `threejs-webgl` → [shaders-basics.md](../core/skills-overlay/threejs-webgl/references/es/shaders-basics.md#64-partículas) §6.4 Partículas | Todos / solo React | Sin partículas o estáticas | Medio |

### Transiciones y navegación

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Transiciones de página SPA (Vue) *(SPA page transitions)* | `gsap-scrolltrigger` → [vue.md](../core/skills-overlay/gsap-scrolltrigger/references/es/vue.md#5-transiciones-de-página) §5 Transiciones de página | Vue/Nuxt | Fade corto o corte directo | Bajo |
| Transiciones de página SPA (Next) *(SPA page transitions)* | `gsap-scrolltrigger` → [next.md](../core/skills-overlay/gsap-scrolltrigger/references/es/next.md#6-scrolltrigger-y-rutas-de-next) §6 ScrollTrigger y rutas de Next | Next/React | Fade corto o corte directo | Bajo |
| Transiciones de página SPA (Astro) *(SPA page transitions)* | `gsap-scrolltrigger` → [astro.md](../core/skills-overlay/gsap-scrolltrigger/references/es/astro.md#5-transiciones-de-página-con-gsap) §5 Transiciones de página con GSAP | Astro | Fade corto o corte directo | Bajo |
| Transiciones de página MPA *(Barba.js page transitions)* | `barba-js` → [transition_patterns.md](../core/skills-vendor/barba-js/references/transition_patterns.md) | MPA/estático | Corte directo sin transición | Medio |

### 3D

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Hover distortion WebGL *(WebGL image distortion)* | `threejs-webgl` → [shaders-basics.md](../core/skills-overlay/threejs-webgl/references/es/shaders-basics.md#63-hover-distortion-sobre-una-imagen) §6.3 Hover distortion sobre una imagen | Todos | Imagen plana `<img>` | Alto |
| Displacement 2D *(PixiJS displacement filter)* | `pixijs-2d` → [filters_effects.md](../core/skills-vendor/pixijs-2d/references/filters_effects.md#displacementfilter) §DisplacementFilter | Todos | Imagen plana sin filtro | Alto |

### CSS nativo moderno

Lo más ligero: sin JS, en el hilo de composición. Empieza aquí antes de meter una librería; siempre dentro de `@supports`.

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Animación ligada al scroll *(scroll-driven animation)* | `front-activation` → [css-moderno.md](../core/skills-plugin/front-activation/references/recipes/css-moderno.md#animación-ligada-al-scroll) §Animación ligada al scroll | Todos | Estado final estático | Bajo |
| Reveal al entrar en pantalla (CSS) *(view() reveal)* | `front-activation` → [css-moderno.md](../core/skills-plugin/front-activation/references/recipes/css-moderno.md#reveal-al-entrar-en-pantalla) §Reveal al entrar en pantalla | Todos | Sin animación (visible) | Bajo |
| View Transitions entre páginas *(cross-document view transitions)* | `front-activation` → [css-moderno.md](../core/skills-plugin/front-activation/references/recipes/css-moderno.md#view-transitions-entre-páginas) §View Transitions entre páginas | MPA: Astro, Blade, WordPress | Sin transición | Bajo |
| Entradas con @starting-style *(entry transitions)* | `front-activation` → [css-moderno.md](../core/skills-plugin/front-activation/references/recipes/css-moderno.md#entradas-con-starting-style) §Entradas con starting-style | Todos | Aparición instantánea | Bajo |
| Tooltips y menús anclados *(anchor positioning)* | `front-activation` → [css-moderno.md](../core/skills-plugin/front-activation/references/recipes/css-moderno.md#anchor-positioning) §Anchor positioning | Todos | Mantener (sin animación) | Bajo |
| Galería con scroll-snap *(scroll snap gallery)* | `front-activation` → [css-moderno.md](../core/skills-plugin/front-activation/references/recipes/css-moderno.md#scroll-snap-con-estado) §Scroll-snap con estado | Todos | Mantener | Bajo |

### Formas y SVG

Siluetas, cortes y máscaras: lo que más aleja de la web de cajas. Una familia de formas por proyecto, fijada en el MASTER.

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Blob orgánico *(organic blob)* | `front-activation` → [formas-svg.md](../core/skills-plugin/front-activation/references/recipes/formas-svg.md#blob-orgánico) §Blob orgánico | Todos | Forma estática | Bajo |
| Separadores de onda, curva o diagonal *(section dividers)* | `front-activation` → [formas-svg.md](../core/skills-plugin/front-activation/references/recipes/formas-svg.md#separadores-entre-secciones) §Separadores entre secciones | Todos | Mantener (estático) | Bajo |
| Morph de clip-path *(clip-path reveal)* | `front-activation` → [formas-svg.md](../core/skills-plugin/front-activation/references/recipes/formas-svg.md#morph-de-clip-path) §Morph de clip-path | Todos | Recorte final directo | Bajo |
| Máscara de imagen con forma *(shaped image mask)* | `front-activation` → [formas-svg.md](../core/skills-plugin/front-activation/references/recipes/formas-svg.md#máscaras-de-imagen-con-forma) §Máscaras de imagen con forma | Todos | Mantener (estático) | Bajo |
| Dibujado de trazo *(SVG line drawing)* | `front-activation` → [formas-svg.md](../core/skills-plugin/front-activation/references/recipes/formas-svg.md#dibujado-de-trazo) §Dibujado de trazo | Todos | Trazo completo | Bajo |
| Morph entre formas o iconos *(shape morph)* | `front-activation` → [formas-svg.md](../core/skills-plugin/front-activation/references/recipes/formas-svg.md#morph-entre-formas) §Morph entre formas | Todos | Cambio instantáneo | Bajo |
| Texto sobre una curva *(text on path)* | `front-activation` → [formas-svg.md](../core/skills-plugin/front-activation/references/recipes/formas-svg.md#texto-sobre-una-curva) §Texto sobre una curva | Todos | Sin rotación | Bajo |

### Tipografía cinética

Cuando la tipografía ES el diseño. Una pieza protagonista por página; nunca animar párrafos de lectura.

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Fuente variable animada *(variable font animation)* | `front-activation` → [tipografia-cinetica.md](../core/skills-plugin/front-activation/references/recipes/tipografia-cinetica.md#fuente-variable-animada) §Fuente variable animada | Todos (fuente con ejes) | Peso fijo | Bajo |
| Vídeo dentro del texto *(video text mask)* | `front-activation` → [tipografia-cinetica.md](../core/skills-plugin/front-activation/references/recipes/tipografia-cinetica.md#vídeo-dentro-del-texto) §Vídeo dentro del texto | Todos | Poster fijo (vídeo pausado) | Medio |
| Texto que se resalta al leerlo *(highlight on scroll)* | `front-activation` → [tipografia-cinetica.md](../core/skills-plugin/front-activation/references/recipes/tipografia-cinetica.md#texto-que-se-resalta-al-leerlo) §Texto que se resalta al leerlo | Todos | Resaltado ya aplicado | Bajo |
| Split-flap (panel de aeropuerto) *(split-flap text)* | `front-activation` → [tipografia-cinetica.md](../core/skills-plugin/front-activation/references/recipes/tipografia-cinetica.md#split-flap) §Split-flap | Todos | Palabra final directa | Bajo |
| Titular gigante con scroll *(oversized scrolling headline)* | `front-activation` → [tipografia-cinetica.md](../core/skills-plugin/front-activation/references/recipes/tipografia-cinetica.md#titular-gigante-con-scroll) §Titular gigante con scroll | Todos | Titular estático | Medio |
| Texto que rodea una forma en movimiento (Pretext) *(text wrap around moving shape)* | `front-activation` → [tipografia-cinetica.md](../core/skills-plugin/front-activation/references/recipes/tipografia-cinetica.md#texto-que-rodea-una-forma-en-movimiento) §Texto que rodea una forma en movimiento | Todos (navegador) | Forma quieta, una sola maquetación | Medio |
| Titular que se reajusta al cambiar el ancho (Pretext) *(reflowing headline)* | `front-activation` → [tipografia-cinetica.md](../core/skills-plugin/front-activation/references/recipes/tipografia-cinetica.md#titular-que-se-reajusta-mientras-cambia-el-ancho) §Titular que se reajusta mientras cambia el ancho | Todos (navegador) | Sin animación de ancho | Bajo |
| Altura exacta para listas y masonry (Pretext) *(exact text height)* | `front-activation` → [tipografia-cinetica.md](../core/skills-plugin/front-activation/references/recipes/tipografia-cinetica.md#altura-exacta-para-listas-y-masonry) §Altura exacta para listas y masonry | Todos (navegador) | Mantener | Bajo |
| Texto multilínea en canvas o WebGL (Pretext) *(canvas text wrapping)* | `front-activation` → [tipografia-cinetica.md](../core/skills-plugin/front-activation/references/recipes/tipografia-cinetica.md#texto-en-canvas-o-webgl-con-saltos-de-línea) §Texto en canvas o WebGL con saltos de línea | Todos (canvas, Three, Pixi) | Mantener | Medio |

### Microinteracciones, menús y entrada

Respuestas de 150-300 ms que informan de algo. Si no informa, es decoración.

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Estados de botón (cargando → hecho) *(button states)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#estados-de-botón) §Estados de botón | Todos | Cambio de estado sin transición | Bajo |
| Toggle y checkbox animados *(animated toggle)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#toggle-y-checkbox-animados) §Toggle y checkbox animados | Todos | Sin transición | Bajo |
| Skeleton con brillo *(shimmer skeleton)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#skeleton-con-brillo) §Skeleton con brillo | Todos | Skeleton estático | Bajo |
| Like con explosión *(like burst)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#like-con-explosión) §Like con explosión | Todos | Cambio de icono sin partículas | Bajo |
| Toasts apilables *(stacked toasts)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#toasts-apilables) §Toasts apilables | Todos | Aparición instantánea | Bajo |
| Loader con marca *(branded loader)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#loader-con-marca) §Loader con marca | Todos | Loader estático o texto | Bajo |
| Menú a pantalla completa *(fullscreen menu)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#menú-a-pantalla-completa) §Menú a pantalla completa | Todos | Apertura instantánea | Bajo |
| Hamburguesa que se transforma *(morphing burger)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#hamburguesa-que-se-transforma) §Hamburguesa que se transforma | Todos | Cambio de icono directo | Bajo |
| Preloader con porcentaje real *(real-progress preloader)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#preloader-con-porcentaje) §Preloader con porcentaje | Solo con assets pesados (3D, vídeo) | Barra sin animación | Bajo |
| Intro de marca *(brand intro)* | `front-activation` → [microinteracciones.md](../core/skills-plugin/front-activation/references/recipes/microinteracciones.md#intro-de-marca) §Intro de marca | Todos | Sin intro | Medio |

### Física e impacto

Objetos con gravedad, choques y cristal que se rompe. Demos que funcionan en `references/recipes/demos/`. Uno por página, con intención (al entrar una vez, al pulsar o al llegar), saltable, y el motor cargado solo cuando se usa.

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Intro con caída y pantalla rota *(falling object + shattered screen intro)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#intro-o-loader) §Intro o loader | Todos | Sin intro | Medio (menos trozos) |
| Loader que se agrieta con la carga y se rompe al terminar *(cracking loader)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#intro-o-loader) §Intro o loader | Solo con carga pesada real | Barra o texto de carga | Medio |
| La web se rompe como un cristal (trozos = la propia página) *(real page shatter)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#la-web-se-rompe-como-un-cristal) §La web se rompe como un cristal | Todos | Fundido a lo de detrás | Medio (menos trozos) |
| Pantalla o sección que se rompe *(screen shatter)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#pantalla-que-se-rompe) §Pantalla que se rompe | Todos | Sin rotura (estado final) | Medio |
| Objeto que cae encima de todo y se apoya *(object drop onto page)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#objeto-que-cae) §Objeto que cae | Todos (3D: react-three-rapier) | Aparece ya apoyado | Medio (2D) · Alto (3D) |
| La página se desmorona *(page gravity collapse)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#la-página-se-desmorona) §La página se desmorona | Todos | Sin botón | Medio |
| Arrastrar y lanzar con inercia *(drag and throw)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#arrastrar-y-lanzar) §Arrastrar y lanzar | Todos | Arrastre sin inercia | Bajo |
| Confeti con física *(physics confetti)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#confeti) §Confeti | Todos | Sin confeti (`disableForReducedMotion`) | Bajo |
| El producto explota en partículas *(particle explode)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#el-producto-explota-skill-threejs-webgl) §El producto explota + skill threejs-webgl | Todos (canvas) | Imagen fija | Alto |
| Tela, cuerda, gelatina *(verlet cloth & rope)* | `front-activation` → [fisica-impacto.md](../core/skills-plugin/front-activation/references/recipes/fisica-impacto.md#tela-cuerda-y-gelatina) §Tela, cuerda y gelatina | Todos (canvas) | Estático | Bajo |

### WebGL avanzado

Coste ALTO: máximo uno por página, lazy, con fallback estático en móvil. Solo si aporta al mensaje.

| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |
|---|---|---|---|---|
| Fluido que sigue al ratón *(fluid simulation)* | `front-activation` → [webgl-avanzado.md](../core/skills-plugin/front-activation/references/recipes/webgl-avanzado.md#fluido-que-sigue-al-ratón) §Fluido que sigue al ratón | Todos (canvas) | Fondo estático | Alto |
| Metaballs *(metaballs shader)* | `front-activation` → [webgl-avanzado.md](../core/skills-plugin/front-activation/references/recipes/webgl-avanzado.md#metaballs) §Metaballs | Todos (canvas) | Imagen estática | Alto |
| Dithering, ASCII y píxel *(dither-ascii-pixel post)* | `front-activation` → [webgl-avanzado.md](../core/skills-plugin/front-activation/references/recipes/webgl-avanzado.md#dithering-ascii-y-píxel) §Dithering, ASCII y píxel | Todos | Imagen procesada estática | Alto |
| Globo 3D ligero *(3D globe (cobe))* | `front-activation` → [webgl-avanzado.md](../core/skills-plugin/front-activation/references/recipes/webgl-avanzado.md#globo-3d) §Globo 3D | Todos | Globo sin rotación | Medio |
| Liquid glass *(refractive glass)* | `front-activation` → [webgl-avanzado.md](../core/skills-plugin/front-activation/references/recipes/webgl-avanzado.md#liquid-glass) §Liquid glass | Todos (refracción solo Chromium) | Cristal sin distorsión | Medio |
| Ruido animado en shader *(animated shader noise)* | `front-activation` → [webgl-avanzado.md](../core/skills-plugin/front-activation/references/recipes/webgl-avanzado.md#ruido-animado-en-shader) §Ruido animado en shader | Todos | Grano estático | Medio |

## Reglas al aplicar cualquier efecto

- `prefers-reduced-motion` es obligatorio: implementa el fallback de la columna Reduced-motion con `gsap.matchMedia()` (ver `gsap-scrolltrigger → references/es/performance-a11y.md` §6) o media query CSS.
- Anima solo `transform` y `opacity`; nada de `top/left/width/height/filter` en scroll (provocan layout/paint por frame).
- Nada de scroll-jacking ni pin en páginas o secciones con formularios, checkout o contenido largo de lectura.
- Presupuesto móvil: máximo un efecto de coste Alto por página; en móvil degrada o desactiva (`ScrollTrigger.matchMedia` / detección de puntero táctil) los efectos de coste Alto.
- Limpieza al desmontar: `gsap.context()` + `revert()`, `ScrollTrigger.kill()`, `lenis.destroy()`, `effect.destroy()` (Vanta/Pixi/Three) en el unmount del componente.
