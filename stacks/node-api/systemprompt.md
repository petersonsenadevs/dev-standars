# Stack: Node API (Express / NestJS)

> Este prompt es EVOLUTIVO: se ajusta a medida que avanza el proyecto (quitar/añadir indicaciones).

Trabajas en una API/servicio Node + TypeScript (Express o NestJS). Sigue las reglas base + estas.

## Convenciones
- TypeScript estricto (`strict: true`); nada de `any` sin justificar. ESM o CJS según el proyecto: no mezcles.
- **Valida en el borde**: todo lo que entra por HTTP/cola/webhook pasa por schema (zod en Express,
  class-validator + `ValidationPipe` global en Nest) y se convierte a DTO tipado; el core confía en sus tipos.
- Estructura por recurso/feature (rutas → controlador → servicio → repositorio), no por tipo de archivo gigante.
- Errores centralizados: middleware/filter de errores único que mapea excepciones de dominio a códigos HTTP;
  nunca `res.send(err)` con el stack al cliente.
- Async correcto: siempre `await` o retorno de la promesa (sin floating promises); en Express, los errores
  async llegan al handler de errores (wrapper o Express 5).
- Logs con **pino** (JSON, niveles, request-id); `console.log` está bloqueado por el hook.

## NestJS (si aplica)
- Módulos cohesivos, DI por constructor, providers con interfaces para lo intercambiable.
- Guards para auth, Interceptors para transversales, Pipes para validación — no lógica en decoradores caseros.

## Datos
- ORM del proyecto (Prisma/TypeORM/Drizzle) con **migraciones versionadas**: nunca editar una aplicada,
  nunca `migrate reset`/`sync({ force })` sin aprobación (bloqueado por el guard).
- Transacciones para operaciones múltiples; índices para todo filtro nuevo; paginación en cada listado.

## API
- Contrato claro (REST con códigos correctos o tRPC/GraphQL según proyecto); versionado si hay consumidores externos.
- Auth en cada endpoint sensible; rate limiting; CORS explícito (no `*` en producción con credenciales).
- Config por entorno validada al arrancar (zod/env-var): si falta una variable, el proceso NO arranca a medias.

## Antes de dar por hecho
1. `npm run lint` 2. `npx tsc --noEmit` 3. `npm test` 4. probar el endpoint tocado (curl/httpie) 5. `devlog/`.

## Plan y tareas
- Antes de una feature o proyecto: `plan/PLAN.md` (skill `project-planner`); una tarea `doing` a la vez.
- El cuerpo del commit lleva `Tarea: <id>` y la tarjeta se marca `done` con el enlace al devlog.
