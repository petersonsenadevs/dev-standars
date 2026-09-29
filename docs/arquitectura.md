[← Volver al README](../README.md)

# Arquitectura: cómo funciona por dentro

La idea central: **escribes las reglas UNA vez** (en `core/` + `stacks/<lenguaje>/`) y un renderer las
traduce al formato de cada herramienta (Claude Code, Codex, Cursor, Windsurf, Antigravity). Nunca
mantienes el mismo prompt en 5 sitios.

## Estructura del repo

```
dev-standards/
├── core/                     # Reglas COMUNES a todos los lenguajes
│   ├── methodology/          # devlog, git-flow, acciones prohibidas
│   ├── prompts/              # systemprompt base (se hereda en cada stack)
│   ├── hooks/                # 14 hooks Node (.mjs, agnósticos de OS) — ver docs/hooks.md
│   ├── skills/               # skills propias (devlog, project-planner, code-quality, deploy-ops, email-html…)
│   ├── skills-vendor/        # skills de terceros COPIADAS por tools/vendor.ps1 (inglés, NO editar)
│   ├── skills-overlay/       # NUESTRA capa en español que se copia ENCIMA del vendor al renderizar
│   ├── skills-plugin/        # routers (skill-router, front-activation): tablas GENERADAS del registro
│   ├── skills-registry.json  # FUENTE ÚNICA de enrutado: grupo, cuándo, keywords, prioridad, requires
│   ├── commands/             # comandos slash — ver docs/comandos.md
│   ├── effects-vendor/       # 124 repos MIT de efectos reales (catálogo con código descargado)
│   ├── githooks/             # commit-msg, pre-commit, pre-push (capa dura para CUALQUIER herramienta)
│   └── bundles.json          # bundles de skills opcionales
├── plugins/                  # GENERADO: 13 plugins de Claude Code (se versionan para instalar desde GitHub)
├── .claude-plugin/           # marketplace.json (GENERADO)
├── stacks/                   # UNA carpeta por stack — ver docs/stacks.md
│   └── <stack>/              # stack.json, systemprompt.md (EVOLUTIVO), best-practices.md,
│                             # prohibited.md, mcp.json, rules/ (extensible), settings.partial.json
├── tools/                    # Automatización (PowerShell 5.1, corre en la máquina que mantiene el repo)
│   ├── init-project.ps1      # BOOTSTRAP de un proyecto con un stack
│   ├── sync.ps1              # Re-renderiza la config a un proyecto (-Skills / -Bundle / -GitHooks)
│   ├── vendor.ps1            # Actualiza las skills upstream · vendor-effects.ps1: colección de efectos
│   ├── build-routers.ps1     # Regenera las tablas de skill-router/front-activation desde el registro
│   ├── build-plugins.ps1     # Genera plugins/ + marketplace.json
│   ├── build-docs.ps1        # Genera docs/ + REFERENCIA.md desde las fuentes de verdad
│   ├── check-skills.ps1      # Verificador (11 checks): falla si algo se desconecta
│   ├── test-router.ps1       # 51 casos dorados prompt → skill
│   ├── test-hooks.ps1        # 34 casos de los muros (exit 2 = bloquea)
│   ├── install-skills.ps1    # Skills globales para Codex/Cursor/Windsurf/Claude
│   └── renderers/            # claude.ps1 · codex.ps1 · cursor.ps1 · windsurf.ps1 · antigravity.ps1
└── templates/                # Plantillas (devlog, plan, decisiones)
```

## Registro único y verificador (todo conectado)

- **`core/skills-registry.json`** es la única fuente de "qué skill se usa": por skill, `group`, `when`,
  `keywords` (regex del prompt-router), `priority` (la específica gana), `requires` e `installedBy`.
  De él se derivan: las tablas de activación de `CLAUDE.md`/`AGENTS.md`, las reglas del router
  (`config.json → router`), las tablas generadas de `skill-router`/`front-activation` y `docs/skills.md`.
- **`tools/check-skills.ps1`** (11 checks) falla si: una skill no está en el registro (o al revés); un
  `SKILL.md` pasa de 100 líneas o su `description` de 250; una referencia citada no existe; una cita
  `skill §sección` no resuelve; las tablas generadas están desactualizadas; un plugin/bundle no
  satisface `requires`; los ejemplos de tarjeta no los parsea la regex real de los hooks.
- **Contratos únicos**: tarjeta de tarea (una regex en `core/hooks/lib.mjs`), devlog
  (`devlog/<fecha>/NNN-slug.md`), design system (`design-system/<slug>/MASTER.md`), `hooks/config.json`
  (mismas claves para proyecto y plugin).
- **El repo se protege solo**: `.githooks/` con commit-msg (Conventional ≤72, sin co-autores) y
  pre-commit que regenera plugins+docs y ejecuta las 3 suites antes de aceptar el commit.

## El plan manda: `project-planner`

Con 41 skills y 13 hooks hace falta quién decide **qué se hace, en qué orden y con qué skill**:

- `plan/PLAN.md` con **fases entregables** (walking skeleton primero) y **tareas pequeñas**
  (`F1-T2 · título [S] [todo]`), cada una con skill+sección a leer, "hecho cuando" y verificación.
  Una sola tarea `doing` a la vez.
- Los hooks lo leen: `session-start` muestra progreso y siguientes, `stop-guard` exige cerrar la
  tarea con devlog, `pre-compact` conserva el estado al compactar contexto.
- El "alma" son tres piezas: **principios** (`core/prompts/base-systemprompt.md`), **`skill-router`**
  (qué leer) y **`project-planner`** (qué hacer y en qué orden).

## Disciplina de contexto (por qué no se come la ventana del agente)

Lo que se carga **siempre** es pequeño; lo grande se lee **bajo demanda y por secciones**:

| Capa | Tamaño | Cuándo se carga |
|---|---|---|
| Reglas generadas (`CLAUDE.md`/`AGENTS.md`) con las tablas de activación | ~300 líneas | siempre |
| `description` de cada skill instalada | ≤ 250 caracteres | siempre |
| `SKILL.md` efectivo (propio u overlay ES) con su tabla "Lectura mínima por tarea" | ≤ 100 líneas | solo cuando la tarea encaja |
| `SKILL.upstream.md` y `references/` | grande | solo la sección indicada (offset/limit o Grep) |

Protocolo: una skill por tarea, solo su sección mínima, nada se lee entero, no se relee.

## Capas vendor + overlay (skills de terceros sin perder upstream)

Las skills de front son los repos reales [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
y [Claude Design Skillstack](https://github.com/freshtechbro/claudedesignskills) (MIT), vendorizados:

| Capa | Qué contiene | Quién la edita |
|---|---|---|
| `core/skills-vendor/<skill>/` | Copia íntegra upstream + `LICENSE.upstream`; `VENDOR.json` registra repo/commit | Nadie: `tools/vendor.ps1` |
| `core/skills-overlay/<skill>/` | `SKILL.md` en español, `references/es/` (brief, propuestas, gustos, anti-IA, fuentes/iconos, inspiración, copywriting…), plantillas y CSVs propios | Nosotros |

Al renderizar se fusionan (overlay ENCIMA del vendor). Actualizar upstream (`vendor.ps1`) nunca pisa
la capa propia. El mismo patrón aplica al catálogo de efectos (`core/effects-vendor/`, 124 repos MIT
con el código descargado e indexado).

## Cómo detecta el front cada herramienta

1. **Descripción del SKILL.md** con disparadores explícitos: lo usan Claude/Codex/Cursor para auto-invocar.
2. **Bloque generado "Front y diseño"** en las reglas: perfil del stack + tabla de activación —
   la garantía para herramientas sin hooks.
3. **Hooks de Claude Code**: recordatorio en la primera edición de UI + muro si no hay brief ni design
   system + verificación móvil obligatoria al cerrar (ver [docs/hooks.md](hooks.md)).

Búsqueda de diseño dentro de un proyecto:
```bash
py -3 .claude/skills/ui-ux-pro-max/scripts/search.py "fintech dashboard" --design-system -p "Mi App" --persist -o .
# macOS/Linux: python3 …
```

## Paridad entre herramientas

| | Claude Code | Codex / Cursor / Windsurf / Antigravity |
|---|---|---|
| Reglas + tablas de activación | CLAUDE.md | AGENTS.md / .cursor/rules / .windsurf/rules |
| Skills | .claude/skills/ | .agents/skills/ · .cursor/skills/ · .windsurf/skills/ |
| Muros en vivo (hooks) | ✔ | — (los cubren los githooks + las reglas) |
| Comandos slash | ✔ | — (frases en llano equivalentes: USO.md §4) |
| Guía propia del proyecto | CLAUDE.project.md importada | AGENTS.project.md referenciada |
