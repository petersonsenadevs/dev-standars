<!-- GENERADO por tools/build-docs.ps1 desde core/skills-registry.json, core/commands/, core/hooks/ y stacks/. NO editar a mano. -->

# Referencia completa de dev-standards

Todo el catálogo en una página. Por temas: [skills](docs/skills.md) · [comandos](docs/comandos.md) · [hooks](docs/hooks.md) · [stacks](docs/stacks.md) · [arquitectura](docs/arquitectura.md). Guías: [README](README.md) · [INSTALL](INSTALL.md) · [USO](USO.md).

## 1. Skills y enrutamiento

El agente decide solo, en tres capas automáticas:
1. **Al arrancar la sesión** (hook SessionStart): estado del proyecto (stack, versiones+EOL, si es nuevo o
   existente, design system, plan, devlog, convenciones) + puertas de entrada: UI → `ui-ux-pro-max` ·
   lógica → `code-quality` · proyecto nuevo → `project-planner` · duda → `skill-router`.
2. **En cada petición** (hook UserPromptSubmit): las *señales* de las tablas de abajo sugieren la skill
   (máx. 2, una vez por skill y sesión). Los *entrypoints* van primero; a igual match gana la prioridad mayor.
3. **Tablas de activación** (`skill-router` y `front-activation`, generadas del registro): el agente las
   consulta cuando duda; `references/decision-trees.md` tiene los árboles de decisión completos.

Total: **41 skills**. Fuente única: `core/skills-registry.json` (grupo, cuándo, señales, prioridad, dependencias).

### Planificación (grupo `planning`, 1 skill)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| **`project-planner`** (entrada) | 20 | Arrancar un proyecto o feature, planificar, "¿qué hacemos ahora?", siguiente tarea; y SIEMPRE que exista plan/PLAN.md (se sigue el plan) | planifica, planning, roadmap, fases, hoja de ruta, que hacemos ahora, siguiente tarea, empezamos… |

### Enrutado (grupo `routing`, 2 skills)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| **`skill-router`** (entrada) | 0 | Empezar cualquier tarea no trivial: decide qué skill y sección leer (tabla de activación + protocolo de carga) | que stack, elegir stack, con que lo hago, que skill |
| `front-activation` | 0 | Empezar una tarea de UI, animación o 3D: detecta el perfil de front y la lectura mínima por tarea |  |

### Calidad de código (grupo `quality`, 1 skill)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `code-quality` | 5 | Escribir o refactorizar lógica, crear tests, manejar errores/logs, seguridad, rendimiento, diseñar endpoints/APIs, revisar o abrir un PR | tests, refactor, revisa, pull request, seguridad, security, rendimiento, performance… |

### Arquitectura (grupo `architecture`, 1 skill)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `ddd-hexagonal` | 5 | Módulo con reglas de negocio ricas, varios contextos, refactor de arquitectura desde MVC, "¿cómo estructuro esto?" (empieza por su checklist "¿hace falta?") | ddd, hexagonal, arquitectura, architecture, dominio, domain, agregado, aggregate… |

### Documentación (grupo `docs`, 1 skill)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| `devlog` | 5 | Terminar un paso relevante o commitear (siempre) | commit, commitea, cierra la tarea, documenta, devlog |

### Front y diseño (grupo `front`, 7 skills)

| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |
|---|---|---|---|
| **`ui-ux-pro-max`** (entrada) | 15 | Crear, maquetar o rediseñar páginas, vistas, layouts, componentes, formularios, dashboards, temas, colores, tipografía, iconos, responsive, accesibilidad; archivos .vue .tsx .jsx .astro .blade.php .html .css | landing, web, sitio, home, hero, pagina, pantalla, vista… |
| `design-system` | 10 | Tokens de diseño (primitivos → semánticos → componente), CSS variables, validación de tokens | design tokens, tokens de diseño, tokens semanticos, primitivos, css variables, sistema de diseño |
| `ui-styling` | 10 | Componentes shadcn/ui (React o Vue) y utilidades/tema de Tailwind | shadcn-vue, radix, reka, componentes de ui, tailwind config, cva |
| `image-gen` | 8 | Generar imágenes IA acordes a la web: producto flotante, heros, fondos, 3D, mockups, texturas (gpt-image en Codex, Nano Banana en Antigravity, script multi-proveedor) | genera una imagen, imagenes ia, fotos de producto, producto flotando, levitando, hero image, imagen para el hero, fondo generado… |
| `skill de marca de la agencia` | 8 | Proyecto propio o white-label de la agencia la agencia: tokens de marca, tono de voz y convenciones de entrega (legales RGPD, analítica, crédito) | la agencia, nuestra marca, marca de la agencia, proyecto propio, white-label, aviso legal, politica de privacidad, rgpd… |
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

## 2. Comandos slash

Atajos opcionales: hablar en llano activa lo mismo vía enrutador. `plan/siguiente/verificar/desplegar/adoptar`
se instalan SIEMPRE; el resto solo en stacks con perfil de front.

| Comando | Argumento | Qué hace |
|---|---|---|
| `/plan` | [descripción del proyecto o feature] | Crea o retoma el plan del proyecto (plan/PLAN.md) con la skill project-planner |
| `/siguiente` | [id de tarea opcional, p. ej. F1-T3] | Ejecuta la siguiente tarea del plan (task-protocol de project-planner) |
| `/verificar` |  | Verifica el proyecto tras los cambios — build, lint, types, tests y (si hay UI) móvil |
| `/desplegar` | [entorno u objetivo, p. ej. "producción" o "staging"] | Deploy con red — checklist PRE/DEPLOY/POST/ROLLBACK con evidencia y aprobación explícita |
| `/adoptar` | [notas opcionales, p. ej. "solo backend" o "el idioma oficial es inglés"] | Adoptar las convenciones de un proyecto existente y sellarlas como regla inmutable |
| `/brief` | [tipo de negocio si ya se sabe, p. ej. "restaurante"] | Entrevista de descubrimiento en lenguaje llano — para clientes que no saben el palabreo técnico |
| `/design-system` | [producto/industria, p. ej. "saas facturación autónomos"] | Genera (o revisa) el design system del proyecto con ui-ux-pro-max |
| `/efecto` | <nombre del efecto> [dónde, p. ej. "marquee en el footer de logos"] | Aplica un efecto pro de frontend desde el catálogo (parallax, marquee, cursor, stacking…) |
| `/instalar` | [stack opcional: laravel, next, astro, vue-ts, nuxt, sveltekit, wordpress, node-api, python-langgraph] | Instala/actualiza dev-standards COMPLETO en este proyecto desde el plugin (clona el repo, detecta el stack y ejecuta init-project) |
| `/lanzar` | [url de preview/producción] | Checklist de lanzamiento — todo lo que se comprueba antes de publicar la web |
| `/propuestas` | [página, p. ej. "home" o "landing de escombros"] | Modo propuesta — blueprint aprobable + 2 maquetas A/B visuales antes de construir |
| `/repaso` | [url o página, p. ej. "http://localhost:4321" o "la home"] | Sesión de revisión conversacional — repasamos la web juntos, sección a sección |
| `/revisar-ui` | [url o ruta de la vista, p. ej. http://localhost:5173 o Pages/Home.vue] | Audita la UI (rúbrica + verificación en navegador si hay Chrome disponible) |

### Flujos típicos
- **Proyecto nuevo con web**: `/brief` (entrevista en llano) → `/propuestas` (blueprint + maquetas A/B) →
  `/design-system` → construir con checkpoints → `/revisar-ui` → `/lanzar` → `/desplegar`.
- **Cualquier feature**: `/plan` → `/siguiente` (una tarjeta cada vez) → `/verificar` antes de cerrar.
- **Proyecto heredado**: `/adoptar` la primera sesión (analiza y sella sus convenciones) y después lo normal.
- **Efecto concreto** ("quiero un parallax/marquee/cursor"): `/efecto <nombre>` va directo al catálogo con receta y coste móvil.

## 3. Muros y hooks

Hooks en Node (`.mjs`, agnósticos de OS: funcionan igual en Windows/macOS/Linux). Los que BLOQUEAN salen
con exit 2 y el motivo; el resto solo informa. Solo Claude Code ejecuta hooks: en Codex/Cursor/Windsurf el
trabajo lo hacen las tablas de activación de las reglas generadas y los githooks (`sync.ps1 -GitHooks`).

| Hook | Evento | Qué hace |
|---|---|---|
| `session-start.mjs` | SessionStart | Inyecta estado: stack/perfil, si el proyecto es NUEVO (→ /brief + /plan) o EXISTENTE (→ /adoptar), diario propio detectado, versiones con aviso EOL, convenciones adoptadas, git, design system, plan, devlog y protocolo de skills. |
| `prompt-router.mjs` | UserPromptSubmit | Sugiere la skill que encaja con la petición (señales de docs/skills.md), una vez por skill y sesión. |
| `guard.mjs` | PreToolUse Bash/PowerShell | BLOQUEA: git push, destructivos de BD/git, rm -rf, deploy a prod sin aprobación (escape `DEV_STANDARDS_ALLOW_DEPLOY=1`), jQuery/Bootstrap (`DEV_STANDARDS_ALLOW_LIB=1`), devops peligroso (curl\|bash, chmod 777, dd, mkfs, docker prune, parar servicios, vaciar firewall, crontab -r); commits: rama protegida, Conventional ≤72, sin co-autores. |
| `protect-files.mjs` | PreToolUse Edit/Write | BLOQUEA editar: generados por dev-standards, secretos (.env, *.pem, credentials), dependencias/artefactos, migraciones versionadas, conventions.md/json sellados y `protectedPaths` del proyecto. |
| `secrets-guard.mjs` | PreToolUse Edit/Write | BLOQUEA escribir credenciales reales (AWS, GitHub, Stripe, OpenAI/Anthropic, PEM, JWT, cadenas con password); ignora placeholders. |
| `code-hygiene.mjs` | PreToolUse Edit/Write | BLOQUEA introducir: console.log/debugger/dd()/var_dump/ray, términos vetados en `gustos.md` §No, marcadores de conflicto de git, `.only`/`.skip`/xit en tests, y la lista negra anti-IA (badges de disponibilidad, numeración de secciones). Escape puntual: comentario `dev-standards-allow`. |
| `conventions-guard.mjs` | PreToolUse Edit/Write | BLOQUEA código que viole las reglas ejecutables de `conventions.json` (/adoptar): la convención del proyecto gana. |
| `front-skill-reminder.mjs` | PreToolUse Edit/Write (front) | Primera edición de UI: BLOQUEA una vez si no hay design system NI brief (obliga a preguntar); después recuerda ui-ux-pro-max, el set de iconos del MASTER y las reglas duras de UI. |
| `format-on-save.mjs` | PostToolUse | Formatea el archivo guardado con la herramienta del stack (Pint/Prettier/ruff) si existe. Nunca bloquea. |
| `edit-tracker.mjs` | PostToolUse | Marca que se editó código; stop-guard exige verificación posterior. |
| `stop-guard.mjs` | Stop | BLOQUEA el cierre (una vez) si falta: devlog del día, verify-build tras editar código, o ui-verify móvil tras tocar UI. |
| `pre-compact.mjs` | PreCompact | Re-inyecta lo esencial (stack, versiones, design system, plan, reglas) para sobrevivir a la compactación de contexto. |
| `session-end.mjs` | SessionEnd | Limpia los marcadores de sesión. |

### Escapes (siempre con aprobación explícita del usuario, documentada en el devlog)
- `DEV_STANDARDS_ALLOW_DEPLOY=1` — deploy a producción tras la aprobación del checklist `/desplegar`.
- `DEV_STANDARDS_ALLOW_LIB=1` — instalar una librería vetada (jQuery/Bootstrap) si el usuario lo pide.
- Comentario `dev-standards-allow` en la línea — excepción puntual de code-hygiene (script CLI con console.log, test .skip justificado, patrón anti-IA pedido por su nombre).
- Convenciones selladas: se cambian borrando `conventions.*` y re-ejecutando `/adoptar` (decisión del usuario).

## 4. Stacks y bundles

Cada stack define systemprompt evolutivo, mejores prácticas, prohibiciones, comandos de verificación,
formateadores, permisos y (en los de front) el perfil del buscador de diseño. `init-project.ps1 -Stack <n>`.

| Stack | Qué es | Perfil de front |
|---|---|---|
| `astro` | Astro | Astro + React islands + Tailwind |
| `laravel` | PHP / Laravel | Laravel + Inertia + Vue 3 + Tailwind |
| `next` | Next.js + TypeScript | Next.js (App Router) + React + Tailwind |
| `node-api` | Node API (Express / NestJS) | — (backend) |
| `nuxt` | Nuxt 3/4 + Vue 3 | Nuxt 3 + Vue 3 + Tailwind |
| `python-langgraph` | Python + LangGraph / LangChain | — (backend) |
| `sveltekit` | SvelteKit + Svelte 5 | SvelteKit + Svelte 5 + Tailwind |
| `vue-ts` | Vue 3 + TypeScript | Vue 3 + TypeScript + Tailwind |
| `wordpress` | WordPress / PHP clásico | WordPress + theme a medida (child theme) + CSS propio |

Lenguajes sin stack propio (referencias de `code-quality`, el router los enruta igual): **Go** (`go.md`),
**Java/Spring** (`java.md`), **C#/.NET** (`csharp.md`).

### Bundles opcionales (`sync.ps1 -Bundle <nombre>` o plugin `bundle-<nombre>`)

| Bundle | Skills |
|---|---|
| `3d-authoring` | blender-web-pipeline, spline-interactive, rive-interactive, substance-3d-texturing |
| `3d-web` | threejs-webgl, react-three-fiber, gsap-scrolltrigger, web3d-integration-patterns |
| `animation-components` | react-spring-physics, animated-component-libraries, scroll-reveal-libraries, animejs, lottie-animations |
| `architecture` | ddd-hexagonal, code-quality |
| `core-3d-animation` | threejs-webgl, gsap-scrolltrigger, react-three-fiber, motion-framer, babylonjs-engine |
| `design-extras` | ui-ux-pro-max, ui-styling, design-system, graphic-design, slides, brand, banner-design |
| `extended-3d-scroll` | aframe-webxr, lightweight-3d-effects, playcanvas-engine, pixijs-2d, locomotive-scroll, barba-js |
| `motion-web` | gsap-scrolltrigger, motion-framer, scroll-reveal-libraries |
| `web-design-meta` | web3d-integration-patterns, modern-web-design |