# Acciones Prohibidas (requieren aprobación EXPLÍCITA del humano)

Estas reglas aplican a TODOS los stacks. Cada stack puede añadir más en su `prohibited.md`.
Se refuerzan por dos capas: (1) `permissions.deny` en settings y (2) hooks que inspeccionan el comando.

## NUNCA sin que yo lo apruebe explícitamente en el momento

1. **`git push`** (a cualquier remoto/rama). Preparar el commit sí; empujar NO.
2. **`git push --force` / `--force-with-lease`** — jamás, ni con aprobación casual.
3. **Borrados/alteraciones destructivas en base de datos**:
   - `DROP DATABASE`, `DROP TABLE`, `DROP SCHEMA`, `TRUNCATE`.
   - `DELETE` **sin `WHERE`**, o `UPDATE` **sin `WHERE`**.
   - Migraciones destructivas: `migrate:fresh`, `migrate:refresh`, `db:wipe`,
     `prisma migrate reset`, `drop_all`, `Base.metadata.drop_all`.
4. **`rm -rf` / `Remove-Item -Recurse -Force`** sobre rutas fuera del proyecto o sobre
   directorios versionados enteros.
5. **`git reset --hard`**, `git clean -fd`, `git checkout .` que descarten trabajo no commiteado.
6. **Publicar/enviar a servicios externos** (deploy a prod, `npm publish`, `composer publish`,
   envío de correos reales, llamadas a APIs de pago que cobren).
7. **Reescribir historia** (`git rebase`, `git commit --amend` sobre commits ya compartidos).
8. **Tocar secretos**: crear/rotar/exponer `.env`, claves, tokens, credenciales.

## Archivos que no se editan desde el agente
Se leen, pero no se modifican a mano (se regeneran con dev-standards o los gestiona el humano):
- **Generados por dev-standards**: `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*`, `.windsurf/rules/*`,
  `.claude/skills/**`, `.agents/skills/**`, `.cursor/skills/**`, `.claude/hooks/**`, `.claude/settings.json`,
  `.mcp.json`, `.dev-standards.json`. Si hace falta cambiarlos, se propone el cambio en dev-standards y se reinstala.
- **Secretos**: `.env*`, `*.pem`, `*.key`, `credentials*`. Solo se documenta la variable en `.env.example`.
- **Dependencias y artefactos**: `vendor/`, `node_modules/`, `dist/`, `build/`.
- **Migraciones ya versionadas** (se crea una nueva, nunca se edita una aplicada) y **lockfiles**
  (`composer.lock`, `pnpm-lock.yaml`, `package-lock.json`, `uv.lock`), salvo que la tarea sea actualizar dependencias.
- **`.github/workflows/**`** salvo aprobación explícita.

## Qué SÍ puedo hacer sin preguntar
- Leer, buscar, analizar código.
- Crear/editar archivos dentro del proyecto.
- `git add`, `git commit` (en rama que no sea la principal; si es la principal, primero rama).
- Ejecutar tests, linters, type-checkers, builds locales.
- Correr migraciones **no destructivas** hacia adelante en entorno local (`migrate`, `migrate:up`).
- Consultas de lectura a BD (`SELECT`).

## Cómo debe comportarse el agente al toparse con una acción prohibida
1. **Detenerse**. No ejecutar.
2. Explicar qué acción es y por qué está bloqueada.
3. Proponer la alternativa segura o pedir la aprobación explícita.
4. Solo proceder si el humano dice claramente "sí, hazlo" para esa acción concreta.
   La aprobación es de un solo uso: no se extiende a la siguiente vez.

## Regla de ramas
- Si estoy en `main`/`master`/`develop`, **primero creo una rama** antes de commitear.
