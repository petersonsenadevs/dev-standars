# Mejores prácticas — Node API (Express / NestJS)

## Arquitectura
- Capas finas: controlador (HTTP puro) → servicio (lógica) → repositorio (datos). El controlador no toca el ORM.
- DTOs de entrada Y de salida: nunca devolver entidades del ORM crudas (fugas de campos).
- Dominio complejo (facturación, pedidos, estados): skill `ddd-hexagonal` antes de improvisar.

## Robustez
- Timeouts en TODA llamada externa (fetch/axios con AbortSignal); reintentos con backoff solo en idempotentes.
- Graceful shutdown: cerrar servidor y conexiones en SIGTERM (clave en Docker/K8s).
- Health endpoint (`/health`) que comprueba BD/cola — lo usa el uptime y el orquestador.
- Idempotencia en webhooks y colas (clave única + upsert): los mensajes llegan repetidos.

## Rendimiento
- Node es single-thread: nada de CPU pesada en el request (worker_threads o cola).
- Streams para archivos grandes; `Promise.all` para IO independiente; pool de conexiones dimensionado.

## Testing
- Unit para servicios (repos mockeados por interfaz); integración con supertest (Express) o
  `@nestjs/testing` + BD efímera (testcontainers/SQLite según proyecto) para los endpoints críticos.
- Un test por bug corregido (regresión) antes del fix.

## Seguridad
- helmet + rate limit + CORS explícito. Secrets solo por entorno. Dependencias auditadas (`npm audit` en CI).
- Nunca construir SQL/queries con concatenación; el ORM parametriza, no lo puentees.

> Detalle y ejemplos bajo demanda: skill `code-quality` → `references/node-api.md` (+ `typescript.md`,
> `api-design.md`, `jobs-and-queues.md`, `errors-logging.md`, `security-owasp.md`).
