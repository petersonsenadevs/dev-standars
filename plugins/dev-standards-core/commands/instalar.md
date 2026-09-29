---
description: Instala/actualiza dev-standards COMPLETO en este proyecto desde el plugin (clona el repo, detecta el stack y ejecuta init-project)
argument-hint: [stack opcional: laravel, next, astro, vue-ts, nuxt, sveltekit, wordpress, node-api, python-langgraph]
---

Convierte esta instalación de plugin en la instalación COMPLETA por proyecto (stacks, CLAUDE.md,
config, hooks y comandos versionados con el proyecto). Pasos, en orden:

1. **Localiza el repo de estándares** (primero que exista): `$env:DEV_STANDARDS_HOME` →
   `~/.dev-standards` → `D:\dev-standards`. Si no existe ninguno:
   `git clone https://github.com/petersonsenadevs/dev-standars.git "$HOME/.dev-standards"`.
   Si existe: `git -C <repo> pull --ff-only` para tenerlo al día (si falla por permisos/red, sigue con lo local y avísalo).
2. **Detecta el stack** del proyecto actual (salvo que $ARGUMENTS lo diga): laravel/framework en
   composer.json → `laravel` · wp-includes/ → `wordpress` · en package.json: next → `next`, nuxt →
   `nuxt`, @sveltejs/kit → `sveltekit`, astro → `astro`, vue sin meta-framework → `vue-ts`,
   express/@nestjs → `node-api` · pyproject.toml → `python-langgraph`. Si hay duda entre dos,
   PREGUNTA al usuario con propuesta.
3. **Confirma con el usuario** en una sola pregunta: stack elegido + herramientas (claude solo, o
   claude,codex) + si el proyecto ya tiene CLAUDE.md/AGENTS.md/diario propio, qué quiere hacer con
   ellos (respaldar e importar es el default sano).
4. **Ejecuta** (Windows; en macOS/Linux avisa que el tooling de instalación requiere PowerShell y
   ofrece la alternativa: seguir solo con el plugin):
   `powershell -NoProfile -ExecutionPolicy Bypass -File "<repo>\tools\init-project.ps1" -Stack <stack> -Path "<raiz-del-proyecto>" -Tools <herramientas>`
   (si el proyecto ya tiene `.dev-standards.json`, usa `sync.ps1 -Path` en su lugar: es una actualización).
5. **Cierra**: resume qué se instaló (skills, hooks, comandos, guía respaldada si la había) y pide al
   usuario REINICIAR la sesión de Claude Code para que cargue la config del proyecto (los hooks del
   plugin y los del proyecto se deduplican solos por marcador de sesión).

No toques nada más del proyecto en esta misma tarea; instalar y verificar es el único objetivo.
