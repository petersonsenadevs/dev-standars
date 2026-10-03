# Instalar Senzu (Claude Code y Codex)

> Después de instalar, la guía del día a día (qué es automático, comandos, flujos) está en [`USO.md`](USO.md).

Senzu se instala en dos niveles:

1. **En tu agente** (una vez por máquina): el plugin de Claude Code o de Codex. Con eso ya tienes las
   skills y el comando `/instalar`.
2. **En cada proyecto**: `/instalar` deja en el proyecto las reglas (`CLAUDE.md` / `AGENTS.md`), los muros
   (hooks), los comandos y la carpeta `senzu/` con el plan, el devlog y la memoria. Los muros solo actúan
   en los proyectos instalados.

**Requisitos:** Node 18 o superior y Git. Python 3 es opcional (lo usa el buscador de diseño de
ui-ux-pro-max). Funciona en Windows, WSL, Linux y macOS.

## 1. Lo recomendado: plugin + `/instalar` (sin clonar nada)

### Claude Code
Dentro de Claude Code:
```
/plugin marketplace add petersonsenadevs/senzu
/plugin install senzu-all@senzu
```
`senzu-all` es el paquete completo (recomendado). Hay versiones ligeras: `senzu-front`, `senzu-backend`
y `senzu-core` (lo mínimo: devlog, enrutador y muros).

### Codex
En la app de Codex: añade el marketplace `petersonsenadevs/senzu`, instala `senzu-all` y **aprueba los
hooks** cuando te lo pida (sin aprobarlos, los muros no actúan).

### En cada proyecto
Abre una sesión del agente **dentro de la carpeta del proyecto** y escribe:
```
/instalar
```
El agente:
1. Descarga Senzu en `~/.senzu` (la carpeta `.senzu` de tu usuario) si no está, o lo actualiza.
2. Detecta el stack (Laravel, Next, Astro, Vue, Nuxt, SvelteKit, WordPress, Node API, Python), o se lo
   dices tú: `/instalar laravel`.
3. Te pregunta, en una sola pregunta, el stack, las herramientas (Claude, Claude + Codex o solo Codex)
   y qué hacer con tu `CLAUDE.md`, `AGENTS.md` o diario si ya existen (por defecto se respaldan).
4. Te pregunta **qué instalar**: **todo** (recomendado), **por categorías** (front, animación, 3D, calidad,
   arquitectura, marketing y SEO, operaciones, diseño gráfico) o **a medida** (skills, muros y comandos
   uno a uno). El núcleo (plan, devlog, calidad y enrutado) va siempre.
5. Lo instala y te dice qué ha dejado. **Abre una sesión nueva** al terminar: los muros y las skills se
   cargan al arrancar.

### Qué deja en el proyecto

| Herramienta | Archivos |
|---|---|
| Claude Code | `CLAUDE.md` + `.claude/skills/` + `.claude/hooks/` (los muros) + `.claude/commands/` (`/plan`, `/verificar`, `/brief`, `/propuestas`…) + `.claude/settings.json` |
| Codex | `AGENTS.md` (las mismas reglas) + `.agents/skills/` (Codex las descubre solo) |
| Los dos | `senzu/plan/`, `senzu/devlog/`, `senzu/senzu.json` (lo que elegiste, para actualizar después) |

> Si el proyecto ya tenía un `CLAUDE.md` o `AGENTS.md` propio, se respalda en `CLAUDE.project.md`.
> Revísalo y fusiona lo que quieras conservar.

## 2. Con el instalador de terminal (sin agente)

Útil para instalar en varios proyectos seguidos o si prefieres un menú. Descarga Senzu una vez, en la misma
carpeta que usa `/instalar`:
```
git clone https://github.com/petersonsenadevs/senzu.git ~/.senzu
```
(En PowerShell, `~` también vale: `git clone https://github.com/petersonsenadevs/senzu.git $HOME\.senzu`.)

Y ejecuta el instalador:
```
node $HOME/.senzu/tools/init.mjs
```
Sin argumentos abre un menú que comprueba los requisitos y pregunta la carpeta del proyecto, el stack
(lo detecta solo; confirmas con Enter), las herramientas y qué instalar (todo, por categorías o a medida).

Sin menú, con los mismos resultados:
```
node $HOME/.senzu/tools/init.mjs --stack astro --path ./mi-proyecto --tools claude,codex
node $HOME/.senzu/tools/init.mjs --path ./mi-proyecto --seleccion categorias --grupos front,motion
node $HOME/.senzu/tools/init.mjs --help        # todas las opciones
```
- `--stack`: `laravel` · `next` · `astro` · `vue-ts` · `nuxt` · `sveltekit` · `wordpress` · `node-api` · `python-langgraph`.
- `--tools`: `claude`, `codex`, `cursor`, `windsurf`, `antigravity` (las que uses, separadas por coma).
- `--bundle core-3d-animation` añade el paquete de animación y 3D (Three.js, GSAP, R3F, Motion).

**Modo ahorro de tokens** (opcional; el menú lo pregunta al final): `--ahorro` deja el `CLAUDE.md`
compacto (sin la lista de skills, que Claude ya carga por su cuenta, y con el devlog y el flujo de git en
una línea, porque los muros los hacen cumplir). Ahorra en torno a un 30 % del `CLAUDE.md`; `AGENTS.md` no
cambia. `--sin-ahorro` lo quita.

## 3. Actualizar

- **El plugin**: en Claude Code, `/plugin marketplace update senzu` y actualiza el plugin desde `/plugin`.
  En Codex, desde la app.
- **Cada proyecto**: vuelve a escribir `/instalar` en una sesión del proyecto, o en la terminal
  `node $HOME/.senzu/tools/init.mjs --path ./mi-proyecto`. Se actualiza `~/.senzu` y se reinstala respetando
  lo que elegiste (guardado en `senzu/senzu.json`); si reduces la selección, se quita lo que ya no
  elegiste (tus skills propias no se tocan). Abre una sesión nueva después.

**Perfil de front**: se detecta del `package.json` real (un Astro sin React ni Tailwind queda como
«Astro + CSS propio»). Para fijarlo a mano, edita `senzu/senzu.json` y vuelve a actualizar; lo manual gana:
```json
"frontProfile": { "label": "Astro + CSS propio + GSAP + Three.js", "stacks": ["astro"] },
"frontProfileSource": "manual"
```

## 4. Solo las skills, sin proyecto (Codex, Cursor, Windsurf)

Para tener las skills en todos tus proyectos sin instalar los muros en ninguno (en PowerShell):
```
irm https://raw.githubusercontent.com/petersonsenadevs/senzu/main/tools/install.ps1 | iex
```
Instala en `~/.codex/skills` y `~/.agents/skills` el set por defecto (`project-planner`, `skill-router`,
`front-activation`, `ui-ux-pro-max`, `ui-verify`, `image-gen`, `gsap-scrolltrigger`, `threejs-webgl`,
`code-quality`). Repetir el comando actualiza. En Codex se invocan también a mano con `$ui-ux-pro-max`.

## 5. Comprobar que funciona

- **Claude Code** (sesión nueva en el proyecto): escribe «haz la landing de X»: el aviso del enrutador debe
  sugerir `ui-ux-pro-max`, y `/plan` y `/brief` deben aparecer como comandos.
- **Codex** (sesión nueva): pide «genera una imagen del producto flotando para el hero»: debe usar
  `image-gen` (en la app genera la imagen directamente; en la CLI usa tu `OPENAI_API_KEY`).
- **Verificación de interfaz**: instala Playwright en el proyecto (`npm i -D playwright && npx playwright
  install chromium`) y prueba `/verificar` con la web en marcha. Deja en `senzu/ui-verify/` las capturas
  de cada ancho, la anotada con los avisos numerados y, en móvil, la del menú abierto (fuera de git).

## 6. Vienes de dev-standards (la versión 1.x)

Senzu es dev-standards con otro nombre y la casa ordenada. Una vez por máquina y una vez por proyecto:

1. **Claude Code**: quita el plugin y el marketplace viejos y añade los nuevos:
   ```
   /plugin uninstall dev-standards-all@dev-standards
   /plugin marketplace remove dev-standards
   /plugin marketplace add petersonsenadevs/senzu
   /plugin install senzu-all@senzu
   ```
2. **Codex**: en la app, desinstala `dev-standards-all`, añade el marketplace `senzu`, instala `senzu-all`
   y **aprueba los hooks** otra vez (Codex los pide de nuevo con el nombre nuevo).
3. **Cada proyecto**: sesión nueva y `/instalar`. Mueve `devlog/`, `plan/`, `design-system/`,
   `conventions.*`, `.ui-verify/` y `.dev-standards.json` a `senzu/` con `git mv` (el historial se
   conserva). Revisa después tus propios documentos si citaban esas rutas. Para no mover nada:
   `--sin-migrar` (todo sigue funcionando).

Siguen funcionando los nombres viejos: `DEV_STANDARDS_*` (ahora `SENZU_*`) y el comentario
`dev-standards-allow` (ahora `senzu-allow`).

## Chuleta

| Quiero… | Cómo |
|---|---|
| Instalar el plugin en Claude Code | `/plugin marketplace add petersonsenadevs/senzu` → `/plugin install senzu-all@senzu` |
| Instalar o actualizar Senzu en un proyecto | `/instalar` en una sesión del proyecto (o `node $HOME/.senzu/tools/init.mjs --path <ruta>`) |
| Dejar que el agente haga push (no a main) en este proyecto | `node $HOME/.senzu/tools/init.mjs --path <ruta> --permitir push` (`push-main` y `commit-main` para main) |
| Apagar un muro en este proyecto | `node $HOME/.senzu/tools/init.mjs --path <ruta> --apagar-hooks format-on-save` (`--encender-hooks` los vuelve a encender) |
| `CLAUDE.md` compacto (modo ahorro) | `node $HOME/.senzu/tools/init.mjs --path <ruta> --ahorro` |
| Añadir animación y 3D después | `node $HOME/.senzu/tools/init.mjs --path <ruta> --bundle core-3d-animation` |
| Solo las skills, sin proyecto | `irm https://raw.githubusercontent.com/petersonsenadevs/senzu/main/tools/install.ps1 \| iex` |
| Usar tu propia copia de Senzu (para desarrollarlo) | define `SENZU_HOME` con su ruta: `/instalar` la usará en vez de `~/.senzu` |

### Si mantienes Senzu (contribuir)
Clona el repo donde quieras y define `SENZU_HOME` con esa ruta. Scripts de mantenimiento:
`tools/check-skills.ps1` y `tools/test-router.ps1` (el paquete está sano), `tools/vendor-effects.ps1 -Missing`
(descarga la colección de efectos, que no va en git) y, en Windows, las versiones PowerShell del instalador
(`tools/init-project.ps1`, `tools/sync.ps1`), que dan el mismo resultado que `init.mjs`.
