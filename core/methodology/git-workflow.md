# Flujo de Git (común a todos los stacks)

## Ramas
- Nunca commitear directo en `main`/`master`/`develop`. Si estoy ahí, creo rama:
  `feat/<slug>`, `fix/<slug>`, `refactor/<slug>`, `chore/<slug>`.

## Commits
- Conventional Commits: `tipo(scope): descripción` en minúscula, imperativo.
  Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `build`, `ci`.
- Commits pequeños y atómicos. Un motivo por commit.
- **Sin líneas de co-autor** (`Co-Authored-By`). No añadir firmas de agente.
- Cada commit debe quedar reflejado en el `senzu/devlog/` del día (hash + mensaje).

## Push
- **PROHIBIDO** hacer `git push` sin aprobación explícita en el momento (ver prohibited-actions.md).
- Cuando el humano apruebe el push, hacerlo solo a la rama de trabajo, nunca `--force`.

## Antes de commitear
1. Correr linter + type-check + tests del stack.
2. Actualizar `senzu/devlog/` (entrada del día + INDEX.md).
3. Revisar el diff (`git diff --staged`) y describirlo en el mensaje.

## Mensajes
- Cuerpo opcional explicando el "por qué", no el "qué" (el qué está en el diff).
