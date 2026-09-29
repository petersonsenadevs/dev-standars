<!-- GENERADO por tools/build-docs.ps1 desde core/skills-registry.json, core/commands/, core/hooks/ y stacks/. NO editar a mano. -->

# Muros y hooks

[← Volver al README](../README.md)

Lo que el agente NO puede hacer aunque quiera — y lo que se le recuerda solo.

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