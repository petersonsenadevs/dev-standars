# Descubrimiento del proyecto (≤ 10 minutos)

Antes de planificar hay que saber dónde se pisa. El descubrimiento es una lectura
rápida y ordenada del repositorio que termina en un "estado del proyecto" de 10 líneas.
No es una auditoría: si algo no se deduce en 10 minutos, se pregunta o se anota como supuesto.

## Índice

- [Objetivo y límite de tiempo](#objetivo-y-límite-de-tiempo)
- [Orden de lectura](#orden-de-lectura)
- [Qué extraer de cada fuente](#qué-extraer-de-cada-fuente)
- [Comandos útiles](#comandos-útiles)
- [Qué preguntar al usuario](#qué-preguntar-al-usuario)
- [Estado del proyecto en 10 líneas](#estado-del-proyecto-en-10-líneas)
- [Señales de riesgo](#señales-de-riesgo)
- [Proyecto nuevo (greenfield)](#proyecto-nuevo-greenfield)
- [Checklist](#checklist)

## Objetivo y límite de tiempo

- Objetivo: responder "qué es este proyecto, en qué estado está y qué me impide empezar".
- Presupuesto: 10 minutos de lectura. Si el repo es enorme, se lee lo indicado y nada más.
- Salida: bloque "Estado del proyecto" (10 líneas) + lista de preguntas + lista de riesgos.
- Todo lo descubierto alimenta la cabecera de `plan/PLAN.md` (ver `plan-format.md`).

## Orden de lectura

Leer en este orden y parar en cuanto se tenga la información; cada paso tiene un tope.

| # | Fuente | Tope | Qué responde |
|---|--------|------|--------------|
| 1 | `.dev-standards.json` | 30 s | Stack declarado, skills instaladas, versión de estándares |
| 2 | `CLAUDE.md` / `AGENTS.md` | 1 min | Reglas del proyecto, comandos, convenciones obligatorias |
| 3 | `package.json` / `composer.json` / `pyproject.toml` | 1 min | Framework, versiones, scripts (`test`, `lint`, `build`) |
| 4 | Estructura de carpetas (2 niveles) | 1 min | Arquitectura real: MVC, módulos, DDD, monorepo |
| 5 | `design-system/*/MASTER.md` | 1 min | Tokens, tipografía, componentes ya definidos |
| 6 | `devlog/INDEX.md` + última entrada `devlog/<YYYY-MM-DD>/NNN-<slug>.md` | 2 min | Qué se hizo, qué quedó a medias, decisiones recientes |
| 7 | `git log --oneline -20` | 30 s | Ritmo, convención de commits, última actividad |
| 8 | Tests existentes | 1 min | Cobertura aproximada, framework, si pasan |
| 9 | CI (`.github/workflows`, `.gitlab-ci.yml`) | 1 min | Qué se verifica automáticamente |
| 10 | `plan/PLAN.md` si existe | 1 min | Plan vigente: no se planifica desde cero si hay uno |

Si el paso 10 encuentra un plan activo, el trabajo es continuar, no rehacer.

## Qué extraer de cada fuente

**`.dev-standards.json`**: campo `stack` (p. ej. `laravel-inertia-vue`, `nextjs`, `astro`,
`vue3`, `python-langgraph`) y lista `skills`. Si falta una skill que el plan necesitará,
se anota como "skill pendiente de instalar" (ver `task-protocol.md`).

**`CLAUDE.md` / `AGENTS.md`**: comandos canónicos (cómo se ejecutan tests y lint), reglas
duras ("nunca tocar `legacy/`"), idioma de commits, estilo. Todo lo que diga aquí prevalece
sobre las suposiciones del planner.

**Manifiestos de dependencias**: versión del framework, gestor de paquetes (pnpm, npm, uv,
composer), scripts disponibles. Anotar qué script verifica qué: `pnpm test`, `php artisan test`,
`pytest`, `pnpm lint`, `pnpm typecheck`.

**Estructura**: buscar señales de arquitectura: `app/Domain`, `src/modules`, `packages/*`,
`app/Http/Controllers` gigantes. Detectar módulos existentes para no duplicarlos.

**`design-system/*/MASTER.md`**: si existe, la UI ya tiene reglas; el plan asignará
`ui-ux-pro-max` con la sección concreta. Si no existe y el trabajo tiene UI, la primera tarjeta
de la fase de UI será generarlo con `ui-ux-pro-max` (SKILL.md §2, paso 2).

**Devlog**: la última entrada (`devlog/<YYYY-MM-DD>/NNN-<slug>.md`, la de mayor `NNN`) suele
decir qué se dejó abierto. Copiar literalmente "pendientes" a las preguntas o a OUT/supuestos del plan.

**Git log**: si los commits siguen Conventional Commits, el plan lo exige; si no, se propone
adoptarlo sin reescribir historia.

**Tests y CI**: contar archivos de test y ejecutar la suite si tarda < 2 min. Un test rojo
antes de empezar es riesgo, no tarea propia (salvo que bloquee).

## Comandos útiles

```bash
cat .dev-standards.json
sed -n '1,80p' CLAUDE.md
find . -maxdepth 2 -type d -not -path '*/node_modules*' -not -path '*/.git*' -not -path '*/vendor*'
ls design-system/*/MASTER.md 2>/dev/null
sed -n '1,40p' devlog/INDEX.md && ls devlog/*/[0-9][0-9][0-9]-*.md | sort | tail -1
git log --oneline -20
find . -name '*.test.*' -o -name '*Test.php' -o -name 'test_*.py' | grep -v node_modules | wc -l
ls .github/workflows 2>/dev/null
```

En PowerShell: `Get-Content .dev-standards.json`, `Get-ChildItem -Depth 1 -Directory`,
`git log --oneline -20` funcionan igual.

## Qué preguntar al usuario

Regla: solo se pregunta lo que no se puede deducir del repo ni asumir con bajo riesgo.
Máximo 5 preguntas, cada una con la respuesta por defecto que se tomará si no contesta.

Preguntas típicas que SÍ merecen hacerse:

- Objetivo de negocio y usuario final si la petición es ambigua ("una landing" ¿para vender qué?).
- Plazo o hito externo (demo, lanzamiento) que condicione las fases.
- Marca/diseño: ¿hay logo, paleta, referencias? Si no, se propone una.
- Datos reales: ¿existe base de datos con datos que hay que respetar? ¿Migraciones destructivas permitidas?
- Integraciones externas con credenciales (pasarela de pago, CRM, LLM): ¿quién las provee?

Preguntas que NO se hacen (se deducen o se asume y se anota):

- Qué framework usar: lo dice `.dev-standards.json`.
- Convención de commits: lo dice el git log.
- Qué skill aplicar: lo decide el planner con `skill-map.md`.

Formato:

```markdown
### Preguntas abiertas
1. ¿La facturación debe soportar varios países/IVA? (Default: solo España, IVA 21 %.)
2. ¿Hay diseño previo o partimos de cero? (Default: generamos design-system con ui-ux-pro-max.)
```

## Estado del proyecto en 10 líneas

Bloque que abre la conversación de planificación y se copia en la cabecera del plan:

```markdown
## Estado del proyecto (2026-08-25)
- Stack: Laravel 12 + Inertia + Vue 3.5, pnpm, PHP 8.4. Skills: ui-ux-pro-max, code-quality, devlog.
- Arquitectura: MVC clásico; sin capa de dominio; 14 controladores, 2 muy grandes (Orders, Users).
- Design system: existe `design-system/admin/MASTER.md` (tokens y 12 componentes).
- Tests: 23 tests Pest, pasan en 40 s. Sin tests de front. CI: GitHub Actions ejecuta pest + pint.
- Devlog: 31 entradas; última (2026-08-20) deja pendiente "paginación de pedidos".
- Git: Conventional Commits, actividad diaria, rama `main` protegida.
- Datos: MySQL con datos de producción; migraciones destructivas NO permitidas.
- Dependencias: `laravel/sanctum` 2 versiones atrás; resto al día.
- Riesgos: sin tests de front; controlador Orders 900 líneas; sin `.env.example` completo.
- Pendiente de preguntar: alcance de roles, integración con pasarela de pago.
```

Diez líneas, sin adjetivos, con números. Si algo no se sabe: "desconocido" y pasa a preguntas.

## Señales de riesgo

Cada señal detectada se convierte en una fila del registro de riesgos (ver
`replanning-and-risks.md`) o en una tarea de la fase 0.

| Señal | Riesgo | Reacción en el plan |
|-------|--------|---------------------|
| Sin tests | Regresiones invisibles | Tarea S por módulo tocado: test de caracterización antes de cambiar |
| Tests rojos | Base inestable | Preguntar si arreglarlos entra en alcance; si no, aislar |
| Sin migraciones (esquema a mano) | Entornos divergentes | Tarea: capturar esquema actual en migración inicial |
| Dependencias 2+ major atrás | Incompatibilidades con skills/ejemplos | Anotar; actualizar solo si bloquea |
| Sin `.env.example` | Onboarding roto | Tarea S: crearlo con claves vacías |
| Sin CI | Verificación manual | Tarea S en F1: workflow mínimo lint + test |
| Sin design system y hay UI | UI inconsistente | Primera tarjeta de la fase de UI: generar `design-system/<slug>/MASTER.md` con `ui-ux-pro-max` |
| Controlador/servicio > 500 líneas | Cambios caros y arriesgados | Considerar `ddd-hexagonal` solo si se toca mucho ese módulo |
| Secretos en el repo | Seguridad | Tarea inmediata: rotar y mover a `.env`; avisar al usuario |
| Sin devlog | Sin memoria entre sesiones | Tarea S: inicializar `devlog/INDEX.md` antes de la primera tarea real |

No se convierte cada riesgo en trabajo: se registra y se actúa solo sobre los que afectan
al alcance actual.

## Proyecto nuevo (greenfield)

Si el repo está vacío o solo tiene el scaffold del framework:

1. Confirmar stack con el usuario (una pregunta) si `.dev-standards.json` no existe.
2. El descubrimiento se reduce a: manifiesto + scaffold + skills instaladas.
3. La fase 1 del plan siempre incluye: inicializar devlog, `.env.example`, script de test
   que pase (aunque sea un test trivial), CI mínima y, si hay UI, design system.
4. Todo lo demás son supuestos escritos en el brief (ver `brief-and-scope.md`).

## Checklist

- [ ] Leídas las 10 fuentes en orden (o marcadas como inexistentes).
- [ ] Sé qué comando ejecuta tests, lint y tipos.
- [ ] Sé qué skills están instaladas y cuáles faltarán.
- [ ] Existe o no `plan/PLAN.md`; si existe, continúo en vez de rehacer.
- [ ] Bloque "Estado del proyecto" escrito en 10 líneas con números.
- [ ] Preguntas al usuario: ≤ 5, cada una con valor por defecto.
- [ ] Señales de riesgo anotadas con reacción prevista.
- [ ] Tiempo total ≤ 10 minutos.
