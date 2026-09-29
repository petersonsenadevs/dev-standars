# Instalar dev-standards en un proyecto (Claude + Codex)

> Después de instalar, la guía de uso diario (qué es automático, comandos, flujos) está en [`USO.md`](USO.md).

Guía rápida con los comandos exactos. Todo se ejecuta en PowerShell desde cualquier carpeta.

## 1. Proyecto nuevo o existente — la vía recomendada (Claude Y Codex a la vez)

```powershell
D:\dev-standards\tools\init-project.ps1 -Stack astro -Path "C:\ruta\del\proyecto" -Tools claude,codex
```

- `-Stack`: `laravel` · `next` · `astro` · `vue-ts` · `nuxt` · `sveltekit` · `wordpress` · `node-api` · `python-langgraph`.
- `-Tools`: `claude`, `codex`, `cursor`, `windsurf`, `antigravity` (los que uses, separados por coma).
- Opcional `-Bundle core-3d-animation` (añade threejs, gsap, r3f, motion) u otros de `core/bundles.json`;
  opcional `-Skills skill de marca de la agencia` para skills sueltas.

Qué deja en el proyecto:

| Herramienta | Archivos |
|---|---|
| Claude Code | `CLAUDE.md` + `.claude/skills/` + `.claude/hooks/` (11 hooks: router, guard, verificación móvil…) + `.claude/commands/` (`/plan`, `/brief`, `/design-system`, `/efecto`, `/revisar-ui`) + `settings.json` |
| Codex | `AGENTS.md` (mismas reglas) + `.agents/skills/` (estándar Agent Skills; Codex las autodescubre) |
| Comunes | `plan/` (PLAN.md), `devlog/`, `.dev-standards.json` (marcador para sync) |

> Si el proyecto ya tenía un `CLAUDE.md`/`AGENTS.md` propio, se respalda en `CLAUDE.project.md` (revísalo y fusiona lo que quieras conservar).

## 2. Actualizar un proyecto ya inicializado

Tras cualquier cambio en dev-standards (skills, reglas, recetas):

```powershell
D:\dev-standards\tools\sync.ps1 -Path "C:\ruta\del\proyecto"
```

Lee el marcador `.dev-standards.json` y regenera todo (respeta stack, tools, bundles y skills elegidos).
Reinicia la sesión del agente después: los hooks y descriptions se cargan al arrancar.

**Perfil de front**: se detecta del `package.json` real del proyecto (un Astro sin React/Tailwind queda
como "Astro + CSS propio", no hereda el default del stack). Para fijarlo a mano, edita
`.dev-standards.json` y vuelve a sincronizar — el manual siempre gana:

```json
"frontProfile": { "label": "Astro + CSS propio + GSAP + Three.js", "stacks": ["astro"] },
"frontProfileSource": "manual"
```

## 3. Solo Claude Code, sin tocar el proyecto (plugin)

```
/plugin marketplace add D:\dev-standards
/plugin install dev-standards-all@dev-standards        # TODO (recomendado); ligeros: -front, -backend, -core
```

Otros plugins: `dev-standards-core` (mínimo), `dev-standards-backend`, `dev-standards-all` (38 skills),
`bundle-<nombre>`. Actualizar: `/plugin marketplace update dev-standards` y actualiza el plugin.

## 4. Solo Codex (y Cursor/Windsurf), skills globales sin proyecto

```powershell
D:\dev-standards\tools\install-skills.ps1 -Agents codex
```

Instala en `~/.codex/skills` y `~/.agents/skills` el set por defecto: `project-planner`, `skill-router`,
`front-activation`, `ui-ux-pro-max`, `ui-verify`, `image-gen`, `gsap-scrolltrigger`, `threejs-webgl`,
`code-quality`. Variantes: `-All` (todas), `-Bundle core-3d-animation`, `-Agents all`.
Repetir el comando actualiza. En Codex también se invocan explícitas con `$ui-ux-pro-max`.

## 5. Comprobación rápida de que funciona

- **Claude Code** (sesión nueva en el proyecto): escribe "haz la landing de X" → el hook debe sugerir
  `ui-ux-pro-max`; `/plan` y `/brief` deben existir como comandos.
- **Codex** (sesión nueva): pide "genera una imagen del producto flotando para el hero" → debe descubrir
  `image-gen` (en la app de ChatGPT/Codex genera nativo; en CLI usará `scripts/generate.mjs` con tu
  `OPENAI_API_KEY`).
- Verificación de UI: `npm i -D playwright && npx playwright install chromium` en el proyecto y
  `node .claude/skills/ui-verify/scripts/verify-ui.mjs http://localhost:PUERTO` (o `.agents/skills/...`).

## 6. Instalación remota (desde GitHub, sin tener nada local)

- **Claude Code**: `/plugin marketplace add petersonsenadevs/dev-standars` →
  `/plugin install dev-standards-all@dev-standards` — TODO el paquete (recomendado); packs ligeros: `-front`, `-backend`, `-core`, `bundle-*`.
- **Del plugin al proyecto completo en un comando**: abre Claude en tu proyecto y escribe **`/instalar`** —
  clona el repo a `~\.dev-standards` si falta, detecta el stack (o se lo dices: `/instalar laravel`),
  te confirma qué hacer con tu CLAUDE.md/diario si ya existen, y ejecuta `init-project`/`sync` por ti.
  Requiere Windows (el tooling de instalación es PowerShell); reinicia la sesión al terminar.
- **Codex / Cursor / Windsurf** (skills globales):
  `irm https://raw.githubusercontent.com/petersonsenadevs/dev-standars/main/tools/install.ps1 | iex`.

## Chuleta

| Quiero… | Comando |
|---|---|
| Proyecto nuevo con todo (Claude+Codex) | `init-project.ps1 -Stack <stack> -Path <ruta> -Tools claude,codex` |
| Traer los últimos cambios al proyecto | `sync.ps1 -Path <ruta>` |
| Añadir el bundle de animación/3D después | `sync.ps1 -Path <ruta> -Bundle core-3d-animation` |
| Solo plugin de Claude | `/plugin marketplace add D:\dev-standards` → `/plugin install dev-standards-all@dev-standards` |
| Solo skills globales de Codex | `install-skills.ps1 -Agents codex` |
| Ver que el repo está sano | `tools\check-skills.ps1` + `tools\test-router.ps1` |
