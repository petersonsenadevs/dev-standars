<!-- GENERADO por tools/build-docs.ps1 desde core/skills-registry.json, core/commands/, core/hooks/ y stacks/. NO editar a mano. -->

# Skills y enrutamiento

[← Volver al README](../README.md)

Qué skill existe, cuándo salta cada una y con qué señales. Las de terceros van vendorizadas con capa propia en español (ver [arquitectura](arquitectura.md)).

El agente decide solo, en tres capas automáticas:
1. **Al arrancar la sesión** (hook SessionStart): estado del proyecto (stack, versiones+EOL, si es nuevo o
   existente, design system, plan, devlog, convenciones) + puertas de entrada: UI → `ui-ux-pro-max` ·
   lógica → `code-quality` · proyecto nuevo → `project-planner` · duda → `skill-router`.
2. **En cada petición** (hook UserPromptSubmit): las *señales* de las tablas de abajo sugieren la skill
   (máx. 2, una vez por skill y sesión). Los *entrypoints* van primero; a igual match gana la prioridad mayor.
3. **Tablas de activación** (`skill-router` y `front-activation`, generadas del registro): el agente las
   consulta cuando duda; `references/decision-trees.md` tiene los árboles de decisión completos.

Total: **43 skills**. Fuente única: `core/skills-registry.json` (grupo, cuándo, señales, prioridad, dependencias).

### Planificación (grupo `planning`, 1 skill)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| **`project-planner`** (entrada) | 20 | Arrancar un proyecto o feature, planificar, "¿qué hacemos ahora?", siguiente tarea; y SIEMPRE que exista plan/PLAN.md (se sigue el plan) | planifica, planning, roadmap, fases, hoja de ruta, que hacemos ahora, siguiente tarea, empezamos… |

### Enrutado (grupo `routing`, 3 skills)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| **`skill-router`** (entrada) | 0 | Empezar cualquier tarea no trivial: decide qué skill y sección leer (tabla de activación + protocolo de carga) | que stack, elegir stack, con que lo hago, que skill |
| `front-activation` | 8 | Empezar una tarea de UI, animación o 3D: detecta el perfil de front y la lectura mínima por tarea; efectos concretos del catálogo (CSS moderno, formas y SVG, tipografía cinética, microinteracciones, WebGL avanzado, física e impacto: objetos que caen, pantalla rota, intros y loaders) | blobs, gooey, metaballs, morph, separadores de onda, onda entre secciones, clip-path, view transitions… |
| `instalar-proyecto` | 8 | Instalar o actualizar Senzu completo en el proyecto (/instalar): todo, por categorías o a medida | instalar dev.standards, actualizar dev.standards, reinstala dev.standards, instalar el paquete, instalacion de dev.standards |

### Calidad de código (grupo `quality`, 3 skills)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `backend-audit` | 8 | Auditar backend y arquitectura con pruebas (herramientas por stack, evidencia por hallazgo, informe), deuda técnica, código legado, dependencias circulares y refactor seguro con tests de caracterización | audit, deuda tecnica, codigo legado, legacy, hotspots, acoplamiento, dependencias circulares, analiza el backend… |
| `depurar` | 8 | Algo falla o no funciona (tests en rojo, excepción, error 500, resultado incorrecto): método reproducir, test que falla, hipótesis, acotar y arreglar la causa | no funciona, no va, falla, fallando, depura, debug, bug, excepciones… |
| `code-quality` | 5 | Escribir o refactorizar lógica, crear tests, manejar errores/logs, seguridad, rendimiento, diseñar endpoints/APIs, revisar o abrir un PR | tests, refactor, revisa, pull request, seguridad, security, rendimiento, performance… |

### Arquitectura (grupo `architecture`, 1 skill)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `ddd-hexagonal` | 5 | Módulo con reglas de negocio ricas, varios contextos, refactor de arquitectura desde MVC, "¿cómo estructuro esto?" (empieza por su checklist "¿hace falta?") | ddd, hexagonal, arquitectura, architecture, dominio, domain, agregado, aggregate… |

### Documentación (grupo `docs`, 1 skill)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `devlog` | 8 | Terminar un paso relevante o commitear (siempre); preguntas sobre el pasado del proyecto (memoria y buscador) | commit, commitea, cierra la tarea, documenta, devlog, memoria del proyecto, historial del proyecto, por que lo hicimos… |

### Front y diseño (grupo `front`, 6 skills)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| **`ui-ux-pro-max`** (entrada) | 15 | Crear, maquetar o rediseñar páginas, vistas, layouts, componentes, formularios, dashboards, temas, colores, tipografía, iconos, responsive, accesibilidad; archivos .vue .tsx .jsx .astro .blade.php .html .css | landing, web, sitio, home, hero, pagina, pantalla, vista… |
| `design-system` | 10 | Tokens de diseño (primitivos → semánticos → componente), CSS variables, validación de tokens | design tokens, tokens de diseño, tokens semanticos, primitivos, css variables, sistema de diseño |
| `ui-styling` | 10 | Componentes shadcn/ui (React o Vue) y utilidades/tema de Tailwind | shadcn-vue, radix, reka, componentes de ui, tailwind config, cva |
| `image-gen` | 8 | Generar imágenes IA acordes a la web: producto flotante, heros, fondos, 3D, mockups, texturas (gpt-image en Codex, Nano Banana en Antigravity, script multi-proveedor) | genera una imagen, imagenes ia, fotos de producto, producto flotando, levitando, hero image, imagen para el hero, fondo generado… |
| `ui-verify` | 8 | Verificar una UI terminada en navegador real: responsive 375/768/1440, dark mode, consola y accesibilidad (axe); obligatoria antes de dar una vista por hecha | verifica, comprueba la ui, revisa el responsive, lighthouse, axe, capturas, screenshots, se ve bien en movil… |
| `modern-web-design` | 5 | Tendencias y principios de diseño web moderno | tendencias, bento, glassmorphism, neo-brutalis, estilo moderno, inspiracion, awwwards |

### Animación (grupo `motion`, 9 skills)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `motion-framer` | 10 | Animación declarativa en React/Next con Motion (variants, gestos, layout animations) | framer motion, motion/react, animatepresence, variants, layout animation, usescroll, usetransform |
| `animated-component-libraries` | 8 | Componentes animados prehechos (Magic UI, React Bits) | magic ui, react bits, aceternity, componentes animados, marquee react, shimmer, border beam, bento grid… |
| `animejs` | 8 | Animaciones JS ligeras (anime.js) de DOM/SVG | anime js, anime |
| `barba-js` | 8 | Transiciones entre páginas con Barba.js (sitios multipágina) | barba js, mpa, crossfade, wipe entre paginas, multipagina |
| `locomotive-scroll` | 8 | Smooth scroll con Locomotive Scroll | locomotive |
| `lottie-animations` | 8 | Animaciones Lottie (JSON de After Effects) | lottie, after effects, bodymovin, dotlottie |
| `react-spring-physics` | 8 | Animación basada en físicas en React (react-spring) | react-spring, popmotion, animacion fisica, spring physics |
| `scroll-reveal-libraries` | 8 | Reveals simples al hacer scroll (AOS) en landings | aos, animate on scroll, reveal simple, fade in al hacer scroll |
| `gsap-scrolltrigger` | 5 | Animación, scroll-driven, parallax, pin/scrub, timelines, transiciones de página, smooth scroll (Lenis) | gsap, scrolltrigger, anima, animation, scroll, parallax, transiciones de pagina, smooth scroll… |

### 3D / WebGL (grupo `3d`, 12 skills)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `pixijs-2d` | 10 | Gráficos 2D/partículas en canvas con PixiJS | pixi js, canvas 2d, sprites, displacement, filtro 2d, pixelate, chromatic aberration, glow… |
| `react-three-fiber` | 10 | 3D declarativo en React/Next (R3F + drei) | r3f, react three fiber, drei, fiber |
| `lightweight-3d-effects` | 8 | Efectos 3D decorativos ligeros (Zdog, Vanta, tilt) | zdog, vanta, tilt, efecto 3d ligero, fondo animado, card 3d, glare, waves… |
| `aframe-webxr` | 5 | VR/AR en el navegador (A-Frame, WebXR) | a-frame, webxr, realidad virtual |
| `babylonjs-engine` | 5 | 3D con Babylon.js (juegos, escenas complejas) | babylon js |
| `blender-web-pipeline` | 5 | Exportar/optimizar modelos de Blender a glTF para web | blender, exportar gltf, draco, ktx2 |
| `playcanvas-engine` | 5 | Juegos/experiencias con PlayCanvas | playcanvas |
| `rive-interactive` | 5 | Animaciones interactivas Rive (state machines) | rive, state machine de animacion |
| `spline-interactive` | 5 | Escenas hechas en Spline e integración en web | spline |
| `substance-3d-texturing` | 5 | Texturizado PBR con Substance 3D para web | substance, texturiz, pbr |
| `threejs-webgl` | 5 | 3D, WebGL/WebGPU, modelos GLB/GLTF, shaders, partículas, configuradores, heros 3D | three js, webgl, webgpu, glb, gltf, shader, particulas, particles… |
| `web3d-integration-patterns` | 5 | Combinar Three.js + GSAP + R3F + Motion en experiencias 3D complejas | integrar 3d, 3d gsap, three motion, experiencia 3d compleja |

### Diseño gráfico y marca (grupo `design`, 4 skills)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `banner-design` | 5 | Banners para redes, ads y heros | banners, creatividades, anuncios, ads |
| `brand` | 5 | Voz de marca, identidad visual, guías de marca | marca, branding, voz de marca, guia de marca, brand |
| `graphic-design` | 5 | Logos, iconos, identidad corporativa, mockups (generación con IA) | logo, logotipo, iconos, identidad corporativa, mockups, cip |
| `slides` | 5 | Presentaciones HTML | presentacion, slides, diapositivas, deck |

### Marketing y SEO (grupo `growth`, 2 skills)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `email-html` | 8 | Maquetar o arreglar emails HTML (transaccionales y newsletters): react-email/MJML/plantillas del framework, compatibilidad Gmail/Outlook, dark mode, texto plano y pruebas antes de enviar | email transaccional, emails de bienvenida, newsletters, mjml, react-email, plantillas de email, email html, maqueta el email… |
| `marketing-seo` | 8 | Posicionar y medir la web: SEO on-page y local, keywords, Search Console, GA4, Google Tag Manager (contenedor, dataLayer, Consent Mode) y MCPs de analítica para operar con agentes | seo, posicionamiento, posicionar, salir en google, keywords, palabras clave, search console, google analytics… |

### Operaciones y despliegue (grupo `ops`, 1 skill)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `deploy-ops` | 8 | Desplegar y operar en producción cualquier stack: Netlify/Vercel/Forge/VPS, Docker, CI/CD con GitHub Actions, secretos por entorno, colas y cron en prod, backups con restore probado, monitorización e incidentes | deploy, despliegue, desplegar, subelo a produccion, docker, dockerfile, docker.compose, dockeriza… |
