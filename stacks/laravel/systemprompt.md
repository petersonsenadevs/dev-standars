# Stack: PHP / Laravel

> Este prompt es EVOLUTIVO: se ajusta a medida que avanza el proyecto (quitar/añadir indicaciones).

Trabajas en un proyecto Laravel. Sigue las reglas base + estas específicas.

## Convenciones
- PHP moderno (8.2+), tipado estricto donde el proyecto lo use (`declare(strict_types=1)` si ya se usa).
- Sigue PSR-12; formatea con **Pint** antes de commitear (`./vendor/bin/pint`).
- Nombres: modelos en singular (`User`), controladores `UserController`, tablas en plural snake_case.
- Usa las convenciones de Laravel: Eloquent, Form Requests para validación, Policies para
  autorización, Resources para respuestas de API, Jobs para colas.

## Base de datos
- **Nunca** editar migraciones ya ejecutadas y compartidas: crea una nueva migración.
- Migraciones hacia adelante en local (`php artisan migrate`) sí; `migrate:fresh/refresh`
  y `db:wipe` **prohibidos sin aprobación** (borran datos).
- Usa `deleted_at` (SoftDeletes) cuando el borrado deba ser recuperable.
- Consultas: evita N+1 (usa `with()` eager loading). Nunca `DB::statement` destructivo sin aprobación.

## Calidad
- Tests con Pest/PHPUnit (`php artisan test`). Cubre el happy path y los errores.
- Análisis estático con PHPStan/Larastan si el proyecto lo tiene.
- Inyección de dependencias por constructor; evita facades en código de dominio testeable.

## Seguridad
- Nada de SQL crudo con interpolación: usa query builder/bindings.
- Respeta `$fillable`/`$guarded`. Valida SIEMPRE con Form Requests.
- Secretos solo en `.env` (nunca commitear `.env`).

## Antes de commitear
1. `./vendor/bin/pint` 2. `php artisan test` 3. PHPStan (si aplica) 4. actualizar `devlog/`.

## Front y diseño
- Este stack tiene **perfil de front**: antes de crear o editar UI aplica la skill `ui-ux-pro-max` y el
  `design-system/*/MASTER.md` del proyecto (ver bloque "Front y diseño" más abajo, generado por dev-standards).
- Animación/3D solo con sus skills instaladas (`gsap-scrolltrigger`, `threejs-webgl`, …); si no lo están, pídelo.

## Plan y tareas
- Antes de una feature o proyecto: `plan/PLAN.md` (skill `project-planner`); una tarea `doing` a la vez.
- El cuerpo del commit lleva `Tarea: <id>` y la tarjeta se marca `done` con el enlace al devlog.
