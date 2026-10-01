---
name: instalar-proyecto
description: "Instala o actualiza Senzu COMPLETO en el proyecto actual (clona el paquete, detecta el stack, pregunta todo, por categorías o a medida y ejecuta el instalador). Úsala con /instalar o cuando pidan instalar o actualizar Senzu."
---

# instalar-proyecto (Senzu)

Convierte la instalación del plugin en la instalación COMPLETA del proyecto: reglas del stack en
CLAUDE.md o AGENTS.md, skills, muros, comandos, configuración, `senzu/devlog/` y `senzu/plan/`, todo versionado con
el proyecto. Proyecto instalado con la versión antigua (devlog/, plan/, design-system/ y
`.dev-standards.json` en la raíz): el instalador lo migra solo a `senzu/` con git mv (conserva el
historial). Avísale antes, y después dile qué se movió y que revise sus propios documentos si citaban
esas rutas; si no quiere moverlo, `--sin-migrar`. Si el proyecto ya está instalado (existe `senzu/senzu.json`), el mismo proceso lo
actualiza respetando la selección guardada. No toques nada más del proyecto en esta tarea.

## Pasos, en orden

1. **Localiza el paquete** (el primero que exista): la carpeta de la variable de entorno SENZU_HOME
   (o la antigua DEV_STANDARDS_HOME), después `.senzu` dentro de la carpeta del usuario, después
   `.dev-standards` dentro de la carpeta del usuario (instalaciones antiguas), después `D:/dev-standards`.
   Si no existe ninguno, clónalo en `.senzu` dentro de la carpeta del usuario (ruta absoluta):
   `git clone https://github.com/petersonsenadevs/senzu.git <carpeta-del-usuario>/.senzu`.
   Si existe, actualízalo con `git -C <paquete> pull --ff-only` (si falla por red o permisos, sigue con
   lo local y avísalo).
2. **Detecta el stack** (salvo que el usuario lo haya dicho): `laravel/framework` en composer.json →
   `laravel` · carpeta wp-includes → `wordpress` · en package.json: next → `next`, nuxt → `nuxt`,
   @sveltejs/kit → `sveltekit`, astro → `astro`, vue sin meta-framework → `vue-ts`, express o @nestjs →
   `node-api` · pyproject.toml → `python-langgraph`. Si hay duda entre dos, pregunta con propuesta.
3. **Confirma en una sola pregunta**: stack, herramientas (Claude, Claude + Codex o solo Codex) y, si el
   proyecto ya tiene CLAUDE.md, AGENTS.md o diario propio, qué hacer con ellos (respaldar e importar es
   lo sensato por defecto).
4. **Pregunta qué instalar** (opciones cerradas; si ya lo dijo, no preguntes):
   - **Todo** (recomendado): todas las skills del stack, muros y comandos.
   - **Por categorías**: front, animación, 3D, calidad, arquitectura, marketing y SEO, operaciones,
     diseño gráfico. El núcleo (plan, devlog, calidad y enrutado) va siempre.
   - **A medida**: skills, muros y comandos uno a uno. Si no conoce los nombres, enséñale la lista con
     una frase por elemento (`docs/skills.md`, `docs/hooks.md` y `docs/comandos.md` del paquete).
   Si prefiere un menú, que ejecute él mismo en una terminal `node <paquete>/tools/init.mjs` sin argumentos.
5. **Ejecuta el instalador** (Node, igual en Windows, WSL, Linux y macOS):
   `node "<paquete>/tools/init.mjs" --stack <stack> --path "<raíz-del-proyecto>" --tools claude`
   y, según lo elegido: nada (todo) · `--seleccion categorias --grupos front,motion` ·
   `--seleccion a-medida --solo-skills a,b --hooks guard,stop-guard --comandos plan,verificar`.
   Añade `,codex` en `--tools` si usa Codex. Para cambiar una selección guardada, pasa la nueva.
   Cursor y Windsurf solo con la versión PowerShell en Windows (`tools/sync.ps1`). No inventes otros
   caminos ni scripts.
   **Permisos y hooks apagados** (`--permitir`, `--apagar-hooks`): los decide el usuario y el muro
   bloquea que los pases tú. Dale el comando para que lo ejecute él (en Claude Code, con `!` delante),
   p. ej. `! node "<paquete>/tools/init.mjs" --path . --permitir push`, o que use el menú.
6. **Cierra**: resume qué se instaló (skills, muros, comandos, guía respaldada si la había) y pide
   **abrir una sesión nueva** para que cargue la configuración del proyecto.
