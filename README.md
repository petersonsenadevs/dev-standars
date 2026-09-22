# dev-standards

Fuente única de verdad para cómo trabajo con agentes/IDEs (Claude Code, Cursor, Windsurf, Codex, Antigravity), organizada **por lenguaje/stack**.

La idea central: **escribes las reglas UNA vez** (en `core/` + `stacks/<lenguaje>/`) y un
renderer las traduce al formato de cada herramienta. Nunca mantienes el mismo prompt en 5 sitios.

## Estructura

```
dev-standards/
├── core/                     # Reglas COMUNES a todos los lenguajes
│   ├── methodology/          # devlog, git-flow, acciones prohibidas
│   ├── prompts/              # systemprompt base (se hereda en cada stack)
│   ├── hooks/                # 11 hooks PowerShell: guard, protect-files, secrets, format-on-save, session-start,
│   │                         #   prompt-router, stop-guard, pre-compact, session-end, front-skill-reminder, _common
│   ├── skills/               # skills propias: devlog, project-planner, code-quality, ddd-hexagonal, skill de marca de la agencia
│   ├── skills-vendor/        # skills de terceros COPIADAS por tools/vendor.ps1 (inglés, NO editar; VENDOR.json)
│   │                         #   ui-ux-pro-max (+ ui-styling, design-system, graphic-design, slides, brand, banner-design)
│   │                         #   + 22 skills de Claude Design Skillstack (threejs-webgl, gsap-scrolltrigger, r3f, …)
│   ├── skills-overlay/       # NUESTRA capa en español que se copia ENCIMA del vendor al renderizar
│   │                         #   ui-ux-pro-max, gsap-scrolltrigger, threejs-webgl (SKILL.md ES, references/es, templates, *.extra.csv)
│   ├── skills-plugin/        # routers (skill-router, front-activation): tablas GENERADAS desde skills-registry.json
│   ├── skills-registry.json  # FUENTE ÚNICA de enrutado: grupo, cuándo, keywords, prioridad, requires por skill
│   ├── githooks/             # commit-msg, pre-commit, pre-push (capa dura común a todas las herramientas)
│   └── bundles.json          # bundles de skills opcionales (core-3d-animation, design-extras, …)
├── plugins/                  # GENERADO por tools/build-plugins.ps1 (plugins de Claude Code)
├── .claude-plugin/           # marketplace.json (GENERADO): /plugin marketplace add D:\dev-standards
│
├── stacks/                   # UNA carpeta por lenguaje/stack
│   ├── laravel/              # PHP / Laravel      (referencia completa)
│   ├── next/                 # Next.js + TS
│   ├── astro/                # Astro
│   ├── vue-ts/               # Vue 3 + TypeScript
│   ├── nuxt/                 # Nuxt 3/4 + Vue 3
│   ├── sveltekit/            # SvelteKit + Svelte 5
│   ├── wordpress/            # WordPress / PHP clásico (themes, plugins, WooCommerce)
│   ├── node-api/             # Node API (Express / NestJS)
│   └── python-langgraph/     # Python + LangGraph/LangChain (+ MCP docu)
│       Cada stack tiene:
│         ├── stack.json            # metadata, skills base, frontProfile (stacks front) y bundles opcionales
│         ├── systemprompt.md       # prompt del stack (EVOLUTIVO)
│         ├── best-practices.md     # mejores prácticas del lenguaje
│         ├── prohibited.md         # prohibiciones específicas del stack
│         ├── mcp.json              # servidores MCP de ese stack
│         ├── skills/               # skills propias del stack
│         ├── hooks/                # hooks propios del stack
│         └── settings.partial.json # permisos/deny extra del stack
│
├── tools/                    # Automatización
│   ├── init-project.ps1      # BOOTSTRAP: crea/prepara un proyecto con un stack
│   ├── sync.ps1              # Re-renderiza la config a un proyecto ya creado (-Skills / -Bundle)
│   ├── vendor.ps1            # Descarga/actualiza las skills upstream a core/skills-vendor/
│   ├── build-plugins.ps1     # Genera plugins/ + .claude-plugin/marketplace.json (plugins de Claude Code)
│   ├── build-routers.ps1     # Regenera las tablas de skill-router / front-activation desde el registro
│   ├── check-skills.ps1      # Verificador de conectividad (10 checks): falla si algo se desconecta
│   ├── test-router.ps1       # Suite de regresión del prompt-router (22 casos dorados prompt → skill)
│   ├── build-index.py        # INDEX.md de una skill-biblioteca (ddd-hexagonal)
│   ├── install-skills.ps1    # Instala skills globales para Codex/Cursor/Windsurf/Claude (~/.codex/skills, …)
│   └── renderers/            # Un renderer por herramienta
│       ├── claude.ps1        # -> CLAUDE.md + .claude/
│       ├── cursor.ps1        # -> .cursor/rules/*.mdc
│       ├── windsurf.ps1      # -> .windsurf/rules/
│       ├── codex.ps1         # -> AGENTS.md
│       └── antigravity.ps1   # -> AGENTS.md + .agents/skills/ (idéntico a codex; se colapsan)
│
└── templates/                # Plantillas (día de devlog, decisiones, etc.)
```

## Uso rápido

Crear un proyecto nuevo con el stack de Laravel, para Claude Code + Cursor:

```powershell
D:\dev-standards\tools\init-project.ps1 -Stack laravel -Path "D:\proyectos\mi-app" -Tools claude,cursor
```

Volver a sincronizar la config tras editar un systemprompt del stack:

```powershell
D:\dev-standards\tools\sync.ps1 -Path "D:\proyectos\mi-app"
```

Añadir animación/3D a un proyecto (queda guardado en `.dev-standards.json`):

```powershell
D:\dev-standards\tools\sync.ps1 -Path "D:\proyectos\mi-app" -Bundle core-3d-animation
D:\dev-standards\tools\sync.ps1 -Path "D:\proyectos\mi-app" -Skills gsap-scrolltrigger
```

Actualizar las skills de terceros desde upstream (no toca tu capa en `core/skills-overlay/`):

```powershell
D:\dev-standards\tools\vendor.ps1
```

> **Instalar: [`INSTALL.md`](INSTALL.md)** · **Usar en el día a día (comandos, qué es automático): [`USO.md`](USO.md)**

## Instalación remota (un comando, desde GitHub)

Con el repo publicado en GitHub (`<owner>/dev-standards`):

- **Claude Code** (plugins con hooks, comandos y router):
  ```
  /plugin marketplace add <owner>/dev-standards
  /plugin install dev-standards-front@dev-standards
  ```
  Actualizar: `/plugin marketplace update dev-standards`. Los `plugins/` y `.claude-plugin/` van versionados
  en el repo (el pre-commit los regenera en cada commit para que nunca queden desfasados).
- **Codex / Cursor / Windsurf** (skills globales autodescubiertas) — PowerShell 5.1+:
  ```powershell
  irm https://raw.githubusercontent.com/<owner>/dev-standards/main/tools/install.ps1 | iex
  ```
  Clona/actualiza el repo en `~\.dev-standards` y ejecuta `install-skills.ps1` (núcleo + front por defecto;
  `$env:DEV_STANDARDS_ALL='1'` para todas). Repetir el mismo comando actualiza.

## Instalación tipo plugin (sin inicializar proyecto)

Tres formas de que el agente "tenga todo", de más a menos integrada:

| Forma | Comando | Qué obtiene el agente |
|---|---|---|
| **Proyecto (recomendada)** | `init-project.ps1` / `sync.ps1` | Reglas + perfil de front + tabla de activación + skills + hooks, para las 5 herramientas. |
| **Plugin de Claude Code** | `/plugin marketplace add D:\dev-standards` → `/plugin install dev-standards-front@dev-standards` | Front todo en uno: núcleo (`devlog`, `project-planner`, `code-quality`, `skill-router`) + `ui-ux-pro-max`, `gsap-scrolltrigger`, `threejs-webgl`, `front-activation` + hooks completos con `prompt-router`. Otros: `dev-standards-core`, `dev-standards-backend`, `bundle-<nombre>`, `dev-standards-all` (35). |
| **Skills globales** (Codex, Cursor, Windsurf, Claude) | `tools\install-skills.ps1` (por defecto project-planner, skill-router, front-activation, ui-ux-pro-max, gsap-scrolltrigger, threejs-webgl, code-quality; `-Bundle …`, `-All` (35), `-Agents codex`) | Copia las skills fusionadas (vendor + overlay) a `~/.codex/skills`, `~/.agents/skills`, `~/.cursor/skills`, `~/.windsurf/skills`, `~/.claude/skills`. Se autodescubren por su descripción; en Codex también con `$ui-ux-pro-max`. |

Los plugins se generan con `tools\build-plugins.ps1` (vuelve a ejecutarlo tras `vendor.ps1` o tras editar
`core\skills-overlay\`); el marketplace queda en `.claude-plugin\marketplace.json` y se valida con
`claude plugin validate D:\dev-standards`. Actualizar en Claude Code: `/plugin marketplace update dev-standards`.

## El repo se protege solo

`git init` con `.githooks/` propios: `commit-msg` (Conventional Commits, sin co-autores) y `pre-commit` que ejecuta
`check-skills.ps1` (10 checks) + `test-router.ps1` (22 casos dorados de enrutado) antes de aceptar el commit
(`DEV_STANDARDS_SKIP_CHECKS=1` para saltar en emergencias). El vendor se versiona; `plugins/` y `.claude-plugin/`
también (instalación remota): el pre-commit ejecuta `build-plugins.ps1` y los stagea en cada commit. La skill `skill de marca de la agencia` (opcional, `-Skills skill de marca de la agencia`) aporta la marca de la
agencia (tono verificado desde [web de la agencia]; tokens con `PENDIENTE-CONFIRMAR` hasta validarlos) y las convenciones
de entrega web (legales RGPD, analítica con consentimiento, crédito).

## Árboles de decisión y catálogo de efectos

- **`skill-router/references/decision-trees.md`** — 6 árboles P→sí/no→salida: global (¿hay plan? → tipo de tarea → skill),
  ¿capas simples o DDD?, backend por síntoma, ¿qué librería de animación?, ¿necesito WebGL?, ¿puedo permitirme el efecto?
  Viaja en TODOS los plugins; `skill-router` y `front-activation` lo enlazan desde su sección "empieza aquí".
- **`front-activation/references/effects-catalog.md`** — 40 efectos pro (parallax multicapa, sticky/stacking, marquee,
  skew por velocidad, cursor personalizado, before/after, lupa, Flip, video scrubbing, hover distortion, mesh gradient…)
  con puntero exacto `skill → archivo §sección`, stacks, reduced-motion y coste móvil. Las 10 recetas que faltaban están en
  `gsap-scrolltrigger/references/es/effects-pro.md` y en `shaders-basics.md` (mesh gradient).
- **Entrypoints**: `core/skills-registry.json` marca la puerta de entrada de cada grupo (`ui-ux-pro-max` para front,
  `skill-router` global, `project-planner` para planificar). El `prompt-router`, las tablas generadas y `session-start`
  las ponen SIEMPRE primero; las descriptions llevan la marca "úsala PRIMERO" (verificado por `check-skills.ps1`).

## Todo conectado: registro único y verificador

- **`core/skills-registry.json`** es la única fuente de "qué skill se usa": por skill, `group`, `when` (texto de las tablas),
  `keywords` (regex del `prompt-router`), `priority` (la específica gana: `react-three-fiber` antes que `threejs-webgl`),
  `requires` (dependencias que se instalan solas) e `installedBy`. De él se derivan: las tablas "Planificación y calidad" y
  "Front y diseño" de `CLAUDE.md`/`AGENTS.md`, las reglas del `prompt-router` (vía `config.json → router`), y las tablas
  GENERADAS de `skill-router`/`front-activation` (`tools\build-routers.ps1`).
- **`tools\check-skills.ps1`** falla si: una skill no está en el registro (o al revés); un `SKILL.md` efectivo pasa de 100 líneas
  o su `description` de 250; una referencia citada no existe; una cita `skill §sección` no resuelve contra archivos/encabezados
  reales; las tablas generadas están desactualizadas; un plugin o bundle no satisface `requires`; o los ejemplos de tarjeta
  (`### F1-T2 · título  [S] [todo]`) no los parsea el hook `session-start`.
- **Contratos únicos**: tarjeta de tarea (una regex en `core/hooks/lib.mjs`, ejemplos en `templates/PLAN.md`, `plan-format.md`,
  `task-card.md`), devlog (`devlog/<YYYY-MM-DD>/NNN-slug.md` con campo `Tarea:`), design system (`design-system/<slug>/MASTER.md`,
  primera tarjeta de UI si no existe), `hooks/config.json` (mismas claves para proyecto y plugin).
- **Paridad sin hooks** (Codex/Cursor/Windsurf): bloque "Sesión y comandos del proyecto" en las reglas (qué leer al empezar,
  comandos lint/test/types del stack) + `sync.ps1 -GitHooks` (commit-msg, pre-commit, pre-push en `.githooks/`).
- **Plugins autosuficientes**: todos llevan el núcleo `devlog + project-planner + code-quality + skill-router` (+ `front-activation`
  y `ui-ux-pro-max` si traen skills de front) y `hooks/config.json`; `prompt-router` solo en `dev-standards-core`.

## El plan manda: `project-planner`

Con ~35 skills y 11 hooks hacía falta quién decide **qué se hace, en qué orden y con qué skill**. La skill `project-planner`
(base en todos los stacks y en los plugins core/backend/front) convierte una petición en `plan/PLAN.md`:

- **Fases entregables** (walking skeleton primero) y **tareas pequeñas** (`F1-T2 · título [S|M] [todo|doing|blocked|done]`),
  cada una con **skill + sección a leer**, "hecho cuando", "verificar", dependencias y enlace al devlog. Una sola tarea `doing`.
- Los hooks lo leen: `session-start` muestra progreso, tarea en curso y siguientes (o pide crear el plan), `stop-guard` recuerda
  cerrar la tarea, `pre-compact` conserva el estado, `prompt-router` detecta "planifica / roadmap / siguiente tarea".
- Las reglas generadas obligan: si existe `plan/PLAN.md`, se sigue; si no y la petición es un proyecto o feature, se planifica antes de codificar.
- Referencias (bajo demanda): descubrimiento, brief y alcance, formato del plan, protocolo de tarea, mapa de skills,
  troceado y secuencia, definición de hecho, replanificación y riesgos, playbooks de arranque (landing, app Laravel+Inertia,
  módulo DDD, API, agente LangGraph, rediseño), ritmo de sesión. Plantillas: `PLAN.md`, `brief.md`, `task-card.md`.

El "alma" del sistema queda en tres piezas: **principios** en `core/prompts/base-systemprompt.md` (cómo pensamos),
**`skill-router`** (qué leer) y **`project-planner`** (qué hacer y en qué orden).

## Hooks (Claude Code)

Se instalan con `sync.ps1` (`.claude/hooks/*.mjs` + `settings.json`) y van dentro de los plugins `dev-standards-core`,
`dev-standards-backend` (todos) y `dev-standards-front` (los de front). Leen `.claude/hooks/config.json` (stack, perfil,
formateadores, rutas protegidas, skills instaladas), generado desde `stack.json`. Solo Claude Code tiene hooks de agente: en Codex/Cursor/Windsurf/Antigravity hacen el trabajo la tabla de activación, el bloque "Sesión y comandos" de las reglas y `sync.ps1 -GitHooks`.

| Evento | Hook | Qué hace |
|---|---|---|
| SessionStart | `session-start.mjs` | Inyecta estado: stack y perfil, **versiones detectadas** (composer/package/pyproject) con **aviso de EOL**, convenciones adoptadas, rama git y cambios pendientes (avisa si estás en main), design system, devlog de hoy, protocolo de skills. |
| UserPromptSubmit | `prompt-router.mjs` | Detecta por palabras clave qué skill instalada encaja (UI, animación, 3D, DDD, calidad, devlog) y lo recuerda **una vez por skill y sesión**. |
| PreToolUse `Bash\|PowerShell` | `guard.mjs` | Bloquea `git push`, resets/limpiezas destructivas, DROP/TRUNCATE/DELETE sin WHERE, `migrate:fresh`, `rm -rf`, publicar paquetes, comandos devops peligrosos (`curl|bash`, `chmod 777`, `dd of=/dev/*`, `mkfs`, `docker prune`, parar servicios, vaciar firewall, `crontab -r`); en `git commit`: rama protegida (main/master/develop), Conventional Commits (≤ 72 chars) y sin `Co-Authored-By`. |
| PreToolUse `Edit\|Write\|MultiEdit\|NotebookEdit` | `protect-files.mjs` | Bloquea editar archivos generados (CLAUDE.md, AGENTS.md, skills/reglas instaladas), secretos (`.env`, `*.pem`, `credentials*`), dependencias/artefactos, migraciones ya versionadas y `protectedPaths` del proyecto. |
| PreToolUse (idem) | `secrets-guard.mjs` | Bloquea escribir credenciales reales (AWS, GitHub, Stripe, OpenAI/Anthropic, Google, PEM, JWT, cadenas de conexión con password); ignora placeholders y `.env.example`. |
| PreToolUse (idem) | `conventions-guard.mjs` | Hace cumplir las convenciones adoptadas con `/adoptar` (`conventions.json`): bloquea introducir patrones que el proyecto veta (p. ej. `interface` donde se usa `type`). |
| PreToolUse (idem, solo front) | `front-skill-reminder.mjs` | Al tocar `.vue .tsx .astro .blade.php .css…` recuerda `ui-ux-pro-max` y el `design-system/*/MASTER.md`, una vez por sesión. |
| PostToolUse `Edit\|Write\|MultiEdit` | `format-on-save.mjs` | Formatea el archivo con el formateador del stack (`config.json` → Pint, Prettier, ruff) si el binario existe. Nunca bloquea. |
| Stop | `stop-guard.mjs` | Si hay cambios sin commitear y no existe devlog de hoy, **bloquea la parada una vez** pidiendo la entrada de devlog; después solo recuerda. Respeta `stop_hook_active`. |
| PreCompact | `pre-compact.mjs` | Re-inyecta stack/perfil, design system, devlog de hoy, rama y reglas duras para que no se pierdan al compactar. |
| SessionEnd | `session-end.mjs` | Limpia los marcadores de sesión (`<tmp>/dev-standards-*.flag`). |

Todos son Node ESM (`.mjs`, agnósticos de OS: Node es el único runtime garantizado allá donde corre Claude Code), leen el JSON
por STDIN en UTF-8 y bloquean con exit 2 + motivo en STDERR o con JSON (`decision: block`). `lib.mjs` contiene las utilidades compartidas.

## Cómo carga contexto el agente (disciplina de contexto)

Lo que se carga **siempre** es pequeño; lo grande se lee **bajo demanda y por secciones**:

| Capa | Tamaño | Cuándo se carga |
|---|---|---|
| Reglas generadas (`CLAUDE.md`/`AGENTS.md`): base + stack + bloques "Calidad y arquitectura" y "Front y diseño" (tablas de activación) | ~300 líneas | siempre |
| `description` de cada skill instalada | ≤ 250 caracteres | siempre (por eso todas las skills tienen overlay con descripción corta) |
| `SKILL.md` efectivo (propio u overlay ES) | ≤ 100 líneas, con tabla **"Lectura mínima por tarea"** | solo cuando la tarea encaja |
| `SKILL.upstream.md` (inglés, hasta 1.200 líneas) y `references/` | grande | solo la sección indicada (Read con offset/limit o Grep sobre el mapa de líneas del overlay) |

Protocolo (está en `base-systemprompt.md`, en `skill-router` y en cada bloque generado): una skill por tarea, solo su
sección mínima, nada se lee entero, no se relee, y si falta una skill se pide instalarla. `tools\check-skills.ps1`
verifica frontmatter, ≤ 100 líneas, `description` ≤ 250 y que las referencias citadas existan.

## Calidad de código y arquitectura

| Skill | Se instala | Qué aporta |
|---|---|---|
| `code-quality` | base en todos los stacks | Buenas prácticas por lenguaje/stack (`php-laravel`, `typescript`, `react-next`, `vue`, `astro`, `python`) y transversales (`testing`, `errors-logging`, `security-owasp`, `performance`, `api-design`, `git-and-reviews`), cada una con índice para lectura parcial; principios y checklist de PR. Las `best-practices.md` de los stacks se quedan cortas y remiten aquí. |
| `ddd-hexagonal` | opcional (`-Bundle architecture`) | DDD táctico/estratégico + puertos y adaptadores + CQRS ligero, con checklist de **cuándo NO** (CRUD simple no lo necesita), referencias por stack (Laravel, TypeScript, Vue front, Python), migración desde MVC, anti-patrones, estrategia de tests y plantillas listas (`templates/laravel|typescript|python`). |
| `skill-router` | base en todos los stacks (y en los plugins) | Tabla de activación completa + protocolo de carga; detecta el stack. |

Plugin de Claude Code: `dev-standards-backend` (code-quality + ddd-hexagonal + devlog + hooks). Con `sync.ps1` los bloques
"Calidad y arquitectura" (siempre) y "Front y diseño" (solo stacks front) se generan en las reglas de cada herramienta.

## Skills de front y diseño

Son los repos reales [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) y
[Claude Design Skillstack](https://github.com/freshtechbro/claudedesignskills) (ambos MIT), vendorizados en
`core/skills-vendor/` y adaptados con una capa propia en español (`core/skills-overlay/`):

| Capa | Qué contiene | Quién la edita |
|---|---|---|
| `core/skills-vendor/<skill>/` | Copia íntegra upstream (SKILL.md, data/, scripts/, references/, assets/) + `LICENSE.upstream`. `VENDOR.json` registra repo/commit. | Nadie: `tools/vendor.ps1` |
| `core/skills-overlay/<skill>/` | `SKILL.md` en español (activación, perfiles por stack, flujo dev-standards), `references/es/`, `templates/`, `scripts/search.ps1|.sh`, `data/stacks/<stack>.extra.csv` (filas propias que se anexan al CSV upstream). El `SKILL.md` upstream queda como `SKILL.upstream.md`. | Nosotros |

**Base en todos los stacks**: `devlog`, `project-planner`, `code-quality`, `skill-router`; en los de front (`laravel`, `next`, `astro`, `vue-ts`) además `front-activation` + `ui-ux-pro-max`.
**Opcionales** (por `-Skills` o `-Bundle`), definidos en `core/bundles.json`:

| Bundle | Skills |
|---|---|
| `core-3d-animation` | threejs-webgl, gsap-scrolltrigger, react-three-fiber, motion-framer, babylonjs-engine |
| `extended-3d-scroll` | aframe-webxr, lightweight-3d-effects, playcanvas-engine, pixijs-2d, locomotive-scroll, barba-js |
| `animation-components` | react-spring-physics, animated-component-libraries, scroll-reveal-libraries, animejs, lottie-animations |
| `3d-authoring` | blender-web-pipeline, spline-interactive, rive-interactive, substance-3d-texturing |
| `web-design-meta` | web3d-integration-patterns, modern-web-design |
| `design-extras` | ui-ux-pro-max, ui-styling, design-system, graphic-design, slides, brand, banner-design |
| `architecture` | ddd-hexagonal, code-quality |
| `motion-web` / `3d-web` | atajos: gsap + motion + aos / three + r3f + gsap + web3d |

### Perfil de front por stack (sin stack "principal")

Cada stack front declara en `stack.json` un `frontProfile` con los stacks del buscador de UI UX Pro Max, en orden:

| Stack | `frontProfile.stacks` |
|---|---|
| laravel | `laravel`, `vue`, `html-tailwind`, `shadcn` |
| next | `nextjs`, `react`, `shadcn`, `html-tailwind` |
| astro | `astro`, `html-tailwind` |
| vue-ts | `vue`, `html-tailwind`, `shadcn` |

### Cómo lo detecta el agente (Claude Code, Codex/GPT, Cursor, Windsurf, Antigravity)

1. **Descripción del `SKILL.md`** con disparadores explícitos (verbos, extensiones `.vue .tsx .astro .blade.php …`):
   es lo que usan Claude Code, Codex (`.agents/skills/`, invocable con `$ui-ux-pro-max`) y Cursor para auto-invocar.
2. **Bloque generado "Front y diseño"** en `CLAUDE.md` / `AGENTS.md` / reglas de Cursor y Windsurf: perfil del stack,
   comandos `python3` / `py -3` y **tabla de activación** (tarea → skill a leer), solo con las skills instaladas.
   Es la garantía para GPT/Codex, que no tiene hooks.
3. **Hook de Claude Code** `front-skill-reminder.mjs` (`PreToolUse` en `Edit|Write|MultiEdit` de archivos de UI):
   recuerda la skill y el `design-system/*/MASTER.md` una vez por sesión. Solo se registra en stacks con `frontProfile`.

Uso típico dentro de un proyecto:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "fintech dashboard" --design-system -p "Mi App" --persist -o .
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form validation" --stack laravel      # o nextjs, astro, vue…
# Windows: py -3 … ; wrappers: scripts/search.ps1 y scripts/search.sh
```

Las skills se copian a `.claude/skills/` (Claude Code), `.cursor/skills/`, `.windsurf/skills/` y `.agents/skills/` (Codex/Antigravity).
