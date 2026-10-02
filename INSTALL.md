# Instalar Senzu en un proyecto (Claude + Codex)

> Después de instalar, la guía de uso diario (qué es automático, comandos, flujos) está en [`USO.md`](USO.md).

Guía rápida con los comandos exactos. Todo se ejecuta en PowerShell desde cualquier carpeta.

## Vienes de dev-standards (versión 1.x)

Senzu es dev-standards con otro nombre y la casa ordenada. Una vez por máquina y una vez por proyecto:

1. **Claude Code**: quita el plugin y el marketplace viejos y añade los nuevos:
   ```
   /plugin uninstall dev-standards-all@dev-standards
   /plugin marketplace remove dev-standards
   /plugin marketplace add petersonsenadevs/senzu
   /plugin install senzu-all@senzu
   ```
2. **Codex**: en la app, desinstala `dev-standards-all`, añade el marketplace `senzu`, instala
   `senzu-all` y **aprueba los hooks** (Codex pide aprobarlos de nuevo con el nombre nuevo).
3. **Cada proyecto**: abre una sesión nueva y `/instalar`. Mueve `devlog/`, `plan/`, `design-system/`,
   `conventions.*`, `.ui-verify/` y `.dev-standards.json` a `senzu/` (con `git mv`: el historial se
   conserva) y deja en la raíz solo lo que Claude y Codex exigen ahí. Revisa después tus propios
   documentos si citaban esas rutas. Para no mover nada: `--sin-migrar` (todo sigue funcionando).

Siguen funcionando los nombres viejos: `DEV_STANDARDS_*` (ahora `SENZU_*`) y el comentario
`dev-standards-allow` (ahora `senzu-allow`).

## 0. Instalador interactivo (elige qué instalar)

En una terminal, desde donde tengas clonado el repo (funciona en Windows, WSL, Linux y macOS):

```
node senzu/tools/init.mjs
```

Sin argumentos abre un menú que primero comprueba los requisitos (Node, Git, Python) y después pregunta:

1. **Carpeta del proyecto**.
2. **Stack**: lo detecta solo (Laravel, Next, Nuxt, WordPress…); confirmas con Enter.
3. **Herramientas**: Claude Code, Claude Code + Codex, o solo Codex.
4. **Qué instalar**:
   - **Todo** (recomendado): todas las skills del stack, todos los muros y comandos.
   - **Por categorías**: marcas grupos de skills (front, animación, 3D, calidad, arquitectura,
     marketing y SEO, operaciones, diseño gráfico).
   - **A medida**: eliges skills, muros (hooks) y comandos uno a uno, por número o por nombre
     (`plan,verificar`), o `todos` / `ninguno`.

El núcleo (plan, devlog, calidad y enrutado) va siempre, con cualquier selección. La selección se
guarda en `senzu/senzu.json`: cada actualización posterior (`/instalar`, `sync.ps1` o `init.mjs`) la
respeta, y si reduces la selección se quitan las skills y comandos de Senzu que ya no elegiste
(las skills propias del proyecto no se tocan).

Sin menú, con los mismos resultados: `--seleccion categorias --grupos front,motion` o
`--seleccion a-medida --solo-skills backend-audit --hooks guard,stop-guard --comandos plan,verificar`
(`node tools/init.mjs --help` lista todo). Dentro de Claude o Codex, `/instalar` hace las mismas preguntas.

**Modo ahorro de tokens** (opcional; el menú lo pregunta al final): `--ahorro`. El CLAUDE.md queda
compacto (sin la lista de skills, que Claude ya carga por su cuenta, y con el devlog y el flujo de git
resumidos en una línea, porque los hooks los hacen cumplir) y las respuestas técnicas pasan a estilo
telegráfico. Ahorra en torno a un 30 % del CLAUDE.md. AGENTS.md (Codex) no cambia: el modo ahorro
solo afecta a CLAUDE.md. Se guarda en el marcador; `--sin-ahorro` (o `sync.ps1 -SinAhorro`) lo quita.

## 1. Proyecto nuevo o existente — la vía recomendada (Claude Y Codex a la vez)

```powershell
D:\dev-standards\tools\init-project.ps1 -Stack astro -Path "C:\ruta\del\proyecto" -Tools claude,codex
```

- `-Stack`: `laravel` · `next` · `astro` · `vue-ts` · `nuxt` · `sveltekit` · `wordpress` · `node-api` · `python-langgraph`.
- `-Tools`: `claude`, `codex`, `cursor`, `windsurf`, `antigravity` (los que uses, separados por coma).
- Opcional `-Bundle core-3d-animation` (añade threejs, gsap, r3f, motion) u otros de `core/bundles.json`;
  opcional `-Skills gsap-scrolltrigger` para skills sueltas.

Qué deja en el proyecto:

| Herramienta | Archivos |
|---|---|
| Claude Code | `CLAUDE.md` + `.claude/skills/` + `.claude/hooks/` (11 hooks: router, guard, verificación móvil…) + `.claude/commands/` (`/plan`, `/brief`, `/design-system`, `/efecto`, `/revisar-ui`) + `settings.json` |
| Codex | `AGENTS.md` (mismas reglas) + `.agents/skills/` (estándar Agent Skills; Codex las autodescubre) |
| Comunes | `senzu/plan/` (PLAN.md), `senzu/devlog/`, `senzu/senzu.json` (marcador para sync) |

> Si el proyecto ya tenía un `CLAUDE.md`/`AGENTS.md` propio, se respalda en `CLAUDE.project.md` (revísalo y fusiona lo que quieras conservar).

## 2. Actualizar un proyecto ya inicializado

Tras cualquier cambio en Senzu (skills, reglas, recetas):

```powershell
D:\dev-standards\tools\sync.ps1 -Path "C:\ruta\del\proyecto"
```

Lee el marcador `senzu/senzu.json` y regenera todo (respeta stack, tools, bundles y skills elegidos).
Reinicia la sesión del agente después: los hooks y descriptions se cargan al arrancar.

**Perfil de front**: se detecta del `package.json` real del proyecto (un Astro sin React/Tailwind queda
como "Astro + CSS propio", no hereda el default del stack). Para fijarlo a mano, edita
`senzu/senzu.json` y vuelve a sincronizar — el manual siempre gana:

```json
"frontProfile": { "label": "Astro + CSS propio + GSAP + Three.js", "stacks": ["astro"] },
"frontProfileSource": "manual"
```

## 3. Solo Claude Code, sin tocar el proyecto (plugin)

```
/plugin marketplace add D:\dev-standards
/plugin install senzu-all@senzu        # TODO (recomendado); ligeros: -front, -backend, -core
```

Otros plugins: `senzu-core` (mínimo), `senzu-backend`, `senzu-all` (todas las skills),
(los bundles ya no van como plugin: se eligen al instalar en el proyecto con `--bundle`). Actualizar: `/plugin marketplace update senzu` y actualiza el plugin.

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

- **Claude Code**: `/plugin marketplace add petersonsenadevs/senzu` →
  `/plugin install senzu-all@senzu` — TODO el paquete (recomendado); packs ligeros: `senzu-front`, `senzu-backend`, `senzu-core`.
- **Del plugin al proyecto completo en un comando**: abre Claude en tu proyecto y escribe **`/instalar`** —
  clona el repo a `~/.senzu` si falta, detecta el stack (o se lo dices: `/instalar laravel`),
  te confirma qué hacer con tu CLAUDE.md/diario si ya existen, y ejecuta el instalador agnóstico
  (`tools/init.mjs`, Node): **funciona en Windows, WSL, Linux y macOS**. Reinicia la sesión al terminar.
  (Solo cursor/windsurf y `-GitHooks` siguen necesitando la versión PowerShell en Windows.)
- **Codex / Cursor / Windsurf** (skills globales):
  `irm https://raw.githubusercontent.com/petersonsenadevs/senzu/main/tools/install.ps1 | iex`.

## Chuleta

| Quiero… | Comando |
|---|---|
| Proyecto nuevo con todo (Claude+Codex) | `init-project.ps1 -Stack <stack> -Path <ruta> -Tools claude,codex` |
| Traer los últimos cambios al proyecto | `sync.ps1 -Path <ruta>` |
| Dejar que el agente haga push (no a main) en este proyecto | `init.mjs --path <ruta> --permitir push` (o `sync.ps1 -Path <ruta> -Permitir push`); `push-main` y `commit-main` para main |
| Apagar un hook en este proyecto | `init.mjs --path <ruta> --apagar-hooks format-on-save` (`--encender-hooks` los vuelve a encender) |
| CLAUDE.md compacto (modo ahorro) | `init.mjs --path <ruta> --ahorro` o `sync.ps1 -Path <ruta> -Ahorro` |
| Añadir el bundle de animación/3D después | `sync.ps1 -Path <ruta> -Bundle core-3d-animation` |
| Solo plugin de Claude | `/plugin marketplace add D:\dev-standards` → `/plugin install senzu-all@senzu` |
| Solo skills globales de Codex | `install-skills.ps1 -Agents codex` |
| Ver que el repo está sano | `tools\check-skills.ps1` + `tools\test-router.ps1` |
