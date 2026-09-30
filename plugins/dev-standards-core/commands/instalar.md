---
description: Instala/actualiza dev-standards COMPLETO en este proyecto desde el plugin (clona el repo, detecta el stack y ejecuta init-project)
---

Uso: `/instalar [stack opcional: laravel, next, astro, vue-ts, nuxt, sveltekit, wordpress, node-api, python-langgraph]` — el argumento es opcional salvo que se indique lo contrario; si no llega, aplica el comportamiento por defecto de abajo.

Convierte esta instalación de plugin en la instalación COMPLETA por proyecto (stacks, CLAUDE.md,
config, hooks y comandos versionados con el proyecto). Pasos, en orden:

1. **Localiza el repo de estándares** (primero que exista): la carpeta que indique la variable de
   entorno DEV_STANDARDS_HOME → `.dev-standards` dentro de la carpeta del usuario → `D:/dev-standards`.
   Si no existe ninguno, clónalo en `.dev-standards` dentro de la carpeta del usuario (ruta absoluta):
   `git clone https://github.com/petersonsenadevs/dev-standars.git <carpeta-del-usuario>/.dev-standards`.
   Si existe: `git -C <repo> pull --ff-only` para tenerlo al día (si falla por permisos/red, sigue con lo local y avísalo).
2. **Detecta el stack** del proyecto actual (salvo que el usuario lo haya indicado tras el comando): laravel/framework en
   composer.json → `laravel` · wp-includes/ → `wordpress` · en package.json: next → `next`, nuxt →
   `nuxt`, @sveltejs/kit → `sveltekit`, astro → `astro`, vue sin meta-framework → `vue-ts`,
   express/@nestjs → `node-api` · pyproject.toml → `python-langgraph`. Si hay duda entre dos,
   PREGUNTA al usuario con propuesta.
3. **Confirma con el usuario** en una sola pregunta: stack elegido + herramientas (claude solo, o
   claude,codex) + si el proyecto ya tiene CLAUDE.md/AGENTS.md/diario propio, qué quiere hacer con
   ellos (respaldar e importar es el default sano).
3b. **Pregunta qué instalar** (en una pregunta con opciones; si el usuario ya lo dijo, no preguntes):
   - **Todo** (recomendado): todas las skills del stack, todos los muros y comandos.
   - **Por categorías**: enséñale los grupos (front, animación, 3D, calidad, arquitectura, marketing y
     SEO, operaciones, diseño gráfico) y que elija. El núcleo (plan, devlog, calidad, enrutado) va siempre.
   - **A medida**: que elija skills, muros (hooks) y comandos uno a uno. Si no conoce los nombres,
     enséñale la lista con una frase por elemento (en `docs/skills.md`, `docs/hooks.md` y
     `docs/comandos.md` del repo de estándares).
   Alternativa: si el usuario prefiere elegirlo en un menú, dile que ejecute él mismo en una terminal
   `node <repo>/tools/init.mjs` sin argumentos (instalador interactivo con las mismas tres opciones).
4. **Ejecuta el instalador agnóstico** (Node, funciona en Windows, WSL, Linux y macOS por igual):
   `node "<repo>/tools/init.mjs" --stack <stack> --path "<raiz-del-proyecto>" --tools claude`
   más, según lo elegido en 3b: nada (todo) · `--seleccion categorias --grupos front,motion` ·
   `--seleccion a-medida --solo-skills a,b --hooks guard,stop-guard --comandos plan,verificar`.
   Añade `,codex` en `--tools` si el usuario usa Codex. Si el proyecto ya tiene `.dev-standards.json`,
   el mismo comando actualiza y respeta la selección guardada (para cambiarla, pasa la nueva). Solo
   cursor y windsurf requieren la versión PowerShell en Windows (`tools/sync.ps1`). No inventes otros
   caminos ni scripts que no existan.
5. **Cierra**: resume qué se instaló (skills, hooks, comandos, guía respaldada si la había) y pide al
   usuario REINICIAR la sesión de Claude Code para que cargue la config del proyecto (los hooks del
   plugin y los del proyecto se deduplican solos por marcador de sesión).

No toques nada más del proyecto en esta misma tarea; instalar y verificar es el único objetivo.
