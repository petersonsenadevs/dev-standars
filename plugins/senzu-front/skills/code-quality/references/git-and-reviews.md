# Git, Pull Requests y revisiones de código

## Índice

- [Reglas del equipo (no negociables)](#reglas-del-equipo-no-negociables)
- [Conventional Commits](#conventional-commits)
- [Commits atómicos e historia limpia](#commits-atómicos-e-historia-limpia)
- [Ramas cortas](#ramas-cortas)
- [PRs pequeñas](#prs-pequeñas)
- [Descripción de la PR](#descripción-de-la-pr)
- [Antes de pedir revisión: autorrevisión](#antes-de-pedir-revisión-autorrevisión)
- [Checklist del revisor](#checklist-del-revisor)
- [Cómo dar feedback](#cómo-dar-feedback)
- [Cómo recibir feedback y cerrar hilos](#cómo-recibir-feedback-y-cerrar-hilos)
- [Definición de hecho (DoD)](#definición-de-hecho-dod)
- [Merge, despliegue y hotfixes](#merge-despliegue-y-hotfixes)
- [Configuración recomendada de Git](#configuración-recomendada-de-git)

## Reglas del equipo (no negociables)

- **Sin co-autores en commits**: no añadas trailers `Co-authored-by:` (ni de personas ni de herramientas/IA). El autor del commit es quien lo firma con su cuenta.
- **Nunca `git push` sin aprobación explícita** del responsable del repositorio/PR. Esto incluye push a ramas propias cuando se trabaja con un agente o en pareja: se prepara el commit, se muestra, y se empuja solo tras el visto bueno. `push --force` a ramas compartidas está prohibido; en ramas propias solo `--force-with-lease` y avisando.
- Nada se fusiona a `main` sin PR aprobada y CI en verde. Sin commits directos a `main`/`develop` (protección de rama activada).
- Nunca commitees secretos, `.env`, credenciales, dumps de BD ni archivos generados grandes. `gitleaks` en pre-commit.
- Trabaja siempre en rama; no cambies de tarea con trabajo sin commit (usa `git stash` o commit WIP en tu rama).

## Conventional Commits

Formato: `<tipo>(<ámbito opcional>)!: <descripción en imperativo, minúscula, sin punto final, ≤ 72 caracteres>`

Tipos: `feat` (funcionalidad), `fix` (corrección), `refactor` (sin cambio de comportamiento), `perf`, `test`, `docs`, `build` (dependencias, build), `ci`, `chore` (mantenimiento sin código de producción), `style` (formato), `revert`.

- `!` o pie `BREAKING CHANGE:` para cambios incompatibles (API, esquema, config).
- Ámbito: módulo o feature (`orders`, `auth`, `api`, `ui`), no nombre de archivo.
- Cuerpo (opcional, tras línea en blanco): el **por qué** y el contexto, no el qué (eso está en el diff). Pie: `Refs: #123`, `Closes #123`.
- Idioma de commits: inglés (código y mensajes en inglés; documentación de equipo en español).

```
feat(orders): add cursor pagination to orders index

Offset pagination degraded past ~200k rows and skipped items when
new orders arrived during browsing. Cursor uses (created_at, id).

Closes #482
```

```
# Malos
fix stuff
WIP
feat: Added the new pagination and also fixed the login bug and updated deps
```

- Herramienta: `commitlint` + hook `commit-msg` (`@commitlint/config-conventional`); el CI valida el título de la PR con el mismo formato (será el mensaje del squash).

## Commits atómicos e historia limpia

- Un commit = un cambio lógico que compila y pasa tests. Refactor y feature en commits separados (`refactor(...)` primero, `feat(...)` después) para facilitar la revisión.
- Formateo masivo (`pint`, `ruff format`) en su propio commit `style:` sin cambios funcionales.
- Antes de abrir la PR, ordena la historia en tu rama: `git rebase -i` (fixup/squash de "arreglo typo"), mensajes correctos. Después de que empiece la revisión, evita reescribir: añade commits (`fix review: ...` está bien si se hace squash al fusionar).
- `git add -p` para separar cambios; revisa `git diff --staged` antes de cada commit.
- No commitees código comentado, `console.log`/`dd()`/`print`, TODOs sin issue, ni archivos no relacionados.

## Ramas cortas

- Nombre: `<tipo>/<issue>-<descripcion-corta>`: `feat/482-orders-cursor-pagination`, `fix/519-login-redirect-loop`, `chore/upgrade-laravel-13`.
- Sal de `main` actualizada; vida máxima 2-3 días. Si una tarea necesita más, divide en PRs incrementales detrás de un feature flag o con cambios compatibles (expand/contract).
- Actualiza con `git rebase main` (rama propia) o `git merge main` (rama compartida); resuelve conflictos en tu rama, nunca en `main`.
- Borra la rama al fusionar (automático en la plataforma).
- Trunk-based: `main` siempre desplegable; sin ramas `develop`/`release` de larga duración salvo necesidad real de releases versionadas.

## PRs pequeñas

- Objetivo: **< 400 líneas cambiadas** (sin contar lockfiles, snapshots, código generado). Ideal 100-250. Una PR grande se revisa mal (la atención cae drásticamente a partir de ~400 líneas) y tarda más en fusionarse.
- Una PR = un propósito. Si el título necesita "y", son dos PRs.
- Estrategias para trocear: refactor preparatorio primero; backend (API + tests) y frontend por separado con contrato acordado; migración expand → código → contract en PRs sucesivas; feature flags para fusionar incompleto sin activar; PRs apiladas (stacked) con base en la anterior.
- Las PRs de dependencias/formateo/generación van separadas de las de lógica.
- Si es inevitablemente grande (migración de framework), avisa al revisor, guía la lectura en la descripción (orden de archivos) y programa una sesión síncrona.

## Descripción de la PR

Plantilla mínima (en `.github/PULL_REQUEST_TEMPLATE.md`):

```markdown
## Qué
Una o dos frases: qué cambia para el usuario/sistema.

## Por qué
Contexto, problema, alternativas descartadas. Enlace a issue/ticket.

## Cómo
Decisiones de diseño relevantes, trade-offs, lo que NO se ha hecho y por qué.

## Cómo probar
Pasos concretos, datos necesarios, comandos, URLs. Capturas/GIF si hay UI.

## Riesgos / despliegue
Migraciones, variables de entorno nuevas, feature flags, orden de despliegue, rollback.

## Checklist
- [ ] Tests añadidos/actualizados  - [ ] Docs/OpenAPI actualizados
- [ ] Sin secretos/PII             - [ ] Presupuesto de rendimiento respetado
```

- Título con formato Conventional Commit. Descripción escrita para alguien sin contexto (incluido tú dentro de seis meses).
- Enlaza issue, diseño, decisiones (ADR) y PRs relacionadas o apiladas.
- Marca `Draft` mientras no esté lista; al pedir revisión, asigna revisores concretos (1-2) y etiqueta el área.

## Antes de pedir revisión: autorrevisión

- Lee tu propio diff completo en la interfaz de la PR como si fueras el revisor. Corrige lo obvio antes de gastar el tiempo de otra persona.
- CI verde: lint, tipos, tests, auditoría de dependencias, build.
- Comenta en el diff los puntos donde quieres atención o dudas ("¿preferís X o Y aquí?"), en lugar de dejarlo a la interpretación.
- Verifica: sin código muerto, sin debug, nombres claros, tests para el comportamiento nuevo, migraciones reversibles, docs y `.env.example` actualizados.
- Ejecuta el flujo manualmente una vez (no solo los tests).

## Checklist del revisor

Prioriza en este orden; comenta lo importante, no todo.

1. **Correctness**: ¿hace lo que dice la descripción? ¿Casos límite (vacío, nulo, concurrencia, zona horaria, permisos)? ¿Rompe comportamiento existente? ¿Errores manejados sin tragarlos?
2. **Tests**: ¿cubren el comportamiento nuevo y el bug corregido? ¿Fallarían si se rompiera el código? ¿Son legibles y determinísticos? ¿Nivel adecuado (unit/integración/E2E)?
3. **Seguridad**: autorización por recurso, validación en servidor, inyección, secretos, PII en logs, dependencias nuevas, superficie expuesta (rutas, Server Actions), uploads, SSRF. Ver `security-owasp.md`.
4. **Diseño y legibilidad**: ¿nombres que explican? ¿Responsabilidad única? ¿Duplicación evitable? ¿Abstracción prematura? ¿Sigue las convenciones del stack (`php-laravel.md`, `typescript.md`, etc.)? ¿Se entiende sin explicación del autor?
5. **Rendimiento**: N+1, índices en queries nuevas, paginación, trabajo pesado fuera del request, tamaño de bundle, caching. Ver `performance.md`.
6. **Operación**: migraciones seguras y reversibles, compatibilidad hacia atrás durante el despliegue, config/env, logs y métricas para lo nuevo, feature flags.
7. **Docs y contrato**: OpenAPI, README, ADR, changelog si aplica.

- Comprueba el código en local si la PR toca lógica compleja o UI: no revises solo el diff.
- Revisa en < 24 h laborables; si no puedes, dilo y reasigna. Las PRs esperando bloquean al equipo.
- Aprueba cuando el cambio mejora el sistema, aunque no sea perfecto; no bloquees por preferencias personales.

## Cómo dar feedback

- Sobre el código, nunca sobre la persona. "Esta función mezcla validación y persistencia" en lugar de "mezclas todo".
- Etiqueta la severidad para que el autor priorice: `blocker:` (debe cambiarse), `suggestion:` (mejora opcional), `question:`, `nit:` (estilo menor), `praise:` (lo bueno también se dice).
- Explica el **por qué** y, si puedes, propone la alternativa con código. Un comentario sin razón es una orden.
- Pregunta antes de asumir: "¿Hay un motivo para no usar `cursorPaginate` aquí?".
- Los `nit` no bloquean; si son muchos, sugiere una regla de lint en lugar de repetirlos.
- Discusiones largas (> 3 idas y vueltas) se resuelven en una llamada de 10 minutos y se documenta la conclusión en la PR.
- No pidas cambios fuera del alcance de la PR: abre un issue.
- Revisa con la misma exigencia el código generado por IA que el escrito a mano; el autor de la PR es responsable de cada línea.

## Cómo recibir feedback y cerrar hilos

- Responde a cada comentario: con el cambio (enlaza el commit), con un argumento, o con un issue para más adelante. Nunca resuelvas un hilo en silencio.
- El que abre el hilo lo cierra (o el autor tras aplicar el cambio evidente).
- Si no estás de acuerdo, explica; si no hay consenso, decide el responsable del área. No se bloquea por empate.
- Tras cambios sustanciales, vuelve a pedir revisión explícitamente.

## Definición de hecho (DoD)

Una tarea está hecha cuando:

- Código fusionado en `main` mediante PR aprobada por al menos un revisor con CI verde.
- Tests automatizados cubren el comportamiento nuevo y pasan; sin tests flaky añadidos.
- Lint, tipos y formato limpios; sin warnings nuevos.
- Sin regresión de seguridad ni de presupuestos de rendimiento.
- Documentación actualizada: README/ADR/OpenAPI/`.env.example`/runbook si aplica.
- Migraciones y config desplegables sin intervención manual no documentada.
- Desplegado en el entorno acordado (staging/producción) y verificado con una prueba manual del flujo.
- Observabilidad: logs/métricas/alertas para lo nuevo si es crítico.
- Issue/ticket cerrado con enlace a la PR; feature flag con fecha de retirada si se usó.

## Merge, despliegue y hotfixes

- Estrategia: **squash merge** por defecto (una PR = un commit en `main` con el título Conventional). `rebase merge` si los commits de la PR son atómicos y valiosos por separado. Nunca merge commits de "Merge branch 'main' into ..." en `main`.
- El título de la PR es el mensaje final: cuídalo.
- `main` despliega automáticamente a staging; producción por promoción manual o etiqueta (`v1.12.0`, SemVer) con changelog generado desde commits (`release-please`, `changesets`).
- Hotfix: rama desde `main`, PR pequeña con `fix:`, revisión rápida (puede ser síncrona), mismo proceso de CI; nunca commit directo.
- Revertir es la primera opción ante un incidente (`git revert`, PR automática); arreglar después con calma.
- Despliegues con cambios de esquema: expand/contract y compatibilidad N-1 entre código y BD.

## Configuración recomendada de Git

```bash
git config --global user.name "Nombre Apellido"
git config --global user.email "nombre@empresa.com"
git config --global pull.rebase true
git config --global rebase.autoStash true
git config --global push.default current
git config --global push.autoSetupRemote true
git config --global fetch.prune true
git config --global rerere.enabled true
git config --global core.autocrlf input      # en Windows: true si el equipo lo acuerda
git config --global init.defaultBranch main
git config --global diff.algorithm histogram
```

- `.gitattributes` con `* text=auto eol=lf` para evitar guerras de finales de línea; `.gitignore` por stack (usa plantillas oficiales) y sin excepciones locales commiteadas.
- Hooks con `lefthook` o `husky`/`lint-staged` (TS), `pre-commit` (Python), `composer` scripts + `lefthook` (PHP): formato, lint, `commitlint`, `gitleaks`. Los hooks no sustituyen al CI.
- Firma de commits (`gpg`/`ssh`) recomendada; obligatoria en repos con protección "require signed commits".
