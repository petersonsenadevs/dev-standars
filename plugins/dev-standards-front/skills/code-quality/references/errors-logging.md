# Errores, logging y resiliencia

## Índice

- [Taxonomía: excepciones de dominio vs técnicas](#taxonomía-excepciones-de-dominio-vs-técnicas)
- [No tragar errores](#no-tragar-errores)
- [Result/Either: cuándo aplicarlo](#resulteither-cuándo-aplicarlo)
- [Mensajes accionables](#mensajes-accionables)
- [Mapeo a HTTP y respuestas de error](#mapeo-a-http-y-respuestas-de-error)
- [Logging estructurado](#logging-estructurado)
- [Niveles y qué va en cada uno](#niveles-y-qué-va-en-cada-uno)
- [Contexto y correlación](#contexto-y-correlación)
- [Secretos y PII en logs](#secretos-y-pii-en-logs)
- [Observabilidad mínima](#observabilidad-mínima)
- [Timeouts](#timeouts)
- [Reintentos con backoff](#reintentos-con-backoff)
- [Circuit breaker básico](#circuit-breaker-básico)
- [Por stack: herramientas](#por-stack-herramientas)

## Taxonomía: excepciones de dominio vs técnicas

- **Dominio** (esperadas, del negocio): `InsufficientStock`, `OrderAlreadyPaid`, `NotFound`, `Forbidden`. El llamador puede reaccionar; se traducen a 4xx; se loguean en `INFO`/`WARNING` como mucho; no despiertan a nadie.
- **Técnicas** (inesperadas, de infraestructura o bug): timeout de BD, `NullPointer`, JSON corrupto del proveedor. Se traducen a 5xx; `ERROR` con stack trace; alertan.
- Jerarquía por aplicación: una base (`AppError`/`DomainException`) con `code` estable (para clientes y métricas), mensaje humano y `context` (IDs, valores). Subclases por caso, no una genérica con strings distintos.
- Constructores con nombre para dar contexto sin repetir formato: `OrderAlreadyPaid::forOrder($id)`.
- Envuelve errores de librerías de terceros en tus propias excepciones en el adaptador (`PaymentGatewayError` desde `StripeException`) y encadena la causa (`previous`/`from e`/`cause`). El dominio no conoce Stripe.
- Fallo de validación de entrada no es excepción de dominio: es un resultado (422) y se maneja en la frontera.

## No tragar errores

- Prohibido `catch (e) {}` / `except: pass` / `rescue(fn)` sin motivo documentado. Si de verdad es ignorable, comenta por qué y loguea en `DEBUG`.
- Captura la excepción concreta que sabes manejar; deja pasar el resto. `catch (Throwable)` solo en fronteras (handler global, loop de worker) y siempre relanzando o convirtiendo en respuesta.
- No conviertas errores en `null`/`false`/`[]` silenciosos: el llamador no distingue "no hay datos" de "falló".
- Al relanzar, conserva la causa: `throw new X('...', previous: $e)`, `raise X() from e`, `new Error('...', { cause: e })`.
- Promesas: nunca sin `await`/`catch`; activa `no-floating-promises`. En Python, `TaskGroup` para no perder excepciones de tareas.
- Errores en callbacks/eventos/listeners en cola: fallan el job (para que reintente) o se registran con `ERROR` y contexto; nunca desaparecen.
- Logs de "error" que no van seguidos de acción (relanzar, responder, compensar) son ruido: revisa cada uno.

## Result/Either: cuándo aplicarlo

- Úsalo cuando el fallo es un resultado esperado y frecuente que el llamador debe manejar en el flujo normal: validación de reglas, "no encontrado" en búsquedas, parseo de entrada, respuestas de LLM.
- No lo uses para fallos de infraestructura (BD caída) ni para bugs: ahí la excepción interrumpe correctamente.
- Una función devuelve `Result` **o** lanza para el mismo tipo de fallo; nunca ambas.
- El error del `Result` es una unión discriminada/enum con datos, no un string.
- En PHP no hay soporte idiomático: usa excepciones de dominio + `try` en la Action, o un objeto `Outcome` sencillo si el flujo tiene varias salidas esperadas. En TS/Python, `Result` tipado o `neverthrow`/`returns`.

## Mensajes accionables

- Un mensaje de error responde: qué falló, en qué contexto (IDs), y si es posible qué hacer. `"Order 8123 cannot be paid: status is CANCELLED"` frente a `"Invalid state"`.
- Separa mensaje para usuario (claro, sin internals, traducible) de mensaje para operador (técnico, con contexto), y de `code` para máquinas.
- No exponer al cliente: stack traces, queries, rutas de archivos, nombres de tablas, versiones de librerías, mensajes de excepciones de terceros.
- Incluye valores que ayudan a reproducir (input saneado, límites, estado actual), no solo "falló".

## Mapeo a HTTP y respuestas de error

- Un handler global mapea excepciones a respuestas `application/problem+json` (RFC 9457): `type`, `title`, `status`, `detail`, `instance`, más `code` y `errors` (validación).
- 400 sintaxis inválida, 401 no autenticado, 403 sin permiso, 404 no existe (o no eres dueño, si no quieres filtrar existencia), 409 conflicto de estado, 422 validación semántica, 429 rate limit, 500 error interno, 503 dependencia caída (con `Retry-After`).
- Nunca 200 con `{ "error": ... }` en el cuerpo. Nunca 500 para errores de dominio.
- El mismo `code` para el mismo problema en toda la API; documentado en OpenAPI.

## Logging estructurado

- JSON en producción, una línea por evento, campos clave-valor; consola legible en desarrollo.
- Nombre de evento en `snake_case` estable (`order_created`, `payment_failed`) como campo `event`/`message`, no frases largas variables. Los datos van en campos, no interpolados en el mensaje (facilita buscar y agregar).
- Campos estándar en todos los logs: `timestamp` (ISO 8601 UTC), `level`, `service`, `env`, `version`, `request_id`/`trace_id`, `user_id` (si hay), `duration_ms` en operaciones.
- Un log por operación relevante, no uno por línea de código. Sin logs en bucles calientes salvo `DEBUG` con muestreo.
- Loguea al principio de fronteras (request recibida, job iniciado) y al final con resultado y duración; los pasos intermedios solo si aportan diagnóstico.
- `stdout`/`stderr` en contenedores; el colector (Loki, Datadog, CloudWatch) se encarga del resto. Sin ficheros de log rotados a mano.

```json
{"timestamp":"2026-08-25T10:12:03.412Z","level":"warning","service":"orders-api","event":"payment_retry","request_id":"c8f1...","order_id":8123,"attempt":2,"provider":"stripe","error_code":"rate_limited","duration_ms":812}
```

## Niveles y qué va en cada uno

| Nivel | Uso | Acción esperada |
|---|---|---|
| `DEBUG` | Detalle técnico para diagnosticar; desactivado en prod | Ninguna |
| `INFO` | Eventos de negocio y ciclo de vida (request, job, pago realizado) | Ninguna; sirve para auditoría y métricas |
| `WARNING` | Situación anómala pero recuperada (reintento, fallback, deprecación, entrada rara) | Revisar si se repite |
| `ERROR` | Operación fallida que afecta a un usuario o job; incluye stack trace | Investigar; alerta si supera umbral |
| `CRITICAL` | Servicio no puede funcionar (BD inaccesible, config inválida) | Alerta inmediata |

- Un error de usuario (422, 404) no es `ERROR`. Un 500 sí.
- No dupliques: si una excepción se relanza, logra una sola vez, en la frontera que la maneja.

## Contexto y correlación

- Genera o propaga `X-Request-Id` / `traceparent` (W3C Trace Context) en cada request entrante; devuélvelo en la respuesta y pásalo a llamadas salientes, jobs y eventos.
- Vincula el contexto al hilo/request (Laravel `Log::withContext`/`Context`, Python `contextvars`, Node `AsyncLocalStorage`) para que todos los logs lo lleven sin pasarlo a mano.
- En colas: el job hereda `request_id` original y añade `job_id`; en LangGraph, `thread_id` y `run_id`.
- Errores en Sentry/equivalente con el mismo `request_id`: permite saltar de log a excepción y viceversa.

## Secretos y PII en logs

- Nunca: contraseñas, tokens, API keys, cookies de sesión, cabeceras `Authorization`, números de tarjeta, IBAN, cuerpos de request completos sin filtrar, prompts con datos personales.
- Redacta en el logger (procesadores/filters) con lista de claves (`password`, `token`, `secret`, `authorization`, `card`) y patrones (tarjeta, email) para no depender de cada desarrollador.
- PII (email, nombre, teléfono, IP): minimiza; usa IDs internos; si necesitas email para diagnóstico, hashea o enmascara (`n***@dominio.com`). Cumple retención (borrado a 30-90 días) y RGPD.
- Excepciones que incluyen input en el mensaje: saneadas antes de construir el mensaje.
- Tipos `SecretStr`/objetos con `__toString` que enmascaran para que un `dump` accidental no filtre.
- Revisa en code review cualquier `log(..., $request->all())`, `logger.info(payload)`, `console.log(req.body)`.

## Observabilidad mínima

- **Health**: `/health/live` (proceso vivo, sin dependencias) y `/health/ready` (BD, cache, colas accesibles) con timeouts cortos; sin auth, sin datos sensibles.
- **Métricas** (Prometheus/OpenTelemetry): requests por ruta y código, latencia p50/p95/p99, errores, tamaño de colas y jobs fallidos, latencia y tokens de LLM, pool de BD. Etiquetas con cardinalidad acotada (nunca `user_id` como label).
- **Trazas**: OpenTelemetry auto-instrumentado (HTTP, BD, colas) con spans manuales en operaciones de negocio caras.
- **Errores**: Sentry/Bugsnag con release y `request_id`; agrupa por `code`.
- **Alertas** sobre síntomas (tasa de 5xx, p95, cola creciendo, jobs fallidos), no sobre cada log de error. Cada alerta tiene un runbook.
- Dashboard por servicio con las 4 señales doradas: latencia, tráfico, errores, saturación.

## Timeouts

- Toda llamada externa (HTTP, BD, cache, cola, LLM) tiene timeout explícito; los defaults de librerías suelen ser infinitos.
- Timeout de conexión corto (1-3 s) y de lectura acorde a la operación (5-30 s; LLM 60-120 s con streaming).
- El timeout del cliente debe ser menor que el del servidor que lo llama (presupuesto en cascada), y el de la request entrante define el total.
- Jobs con `timeout` y `retry_after` coherentes (`retry_after > timeout`).
- Al vencer un timeout, propaga cancelación (`AbortController`, `asyncio.timeout`) y libera recursos.

## Reintentos con backoff

- Reintenta solo errores transitorios: timeouts, 429, 502/503/504, conexiones rechazadas, deadlocks. Nunca 4xx de validación/autorización ni errores de dominio.
- Solo operaciones idempotentes, o con `Idempotency-Key`.
- Backoff exponencial con jitter: `base * 2^n + random(0, base)`, tope de intentos (3-5) y tope de espera (30-60 s). Respeta `Retry-After`.
- Reintento total limitado por el presupuesto de tiempo de la request; en jobs, backoff largo (`[30, 300, 1800]`).
- Registra cada reintento en `WARNING` con `attempt`; tras agotar, `ERROR` y dead-letter/`failed_jobs` con compensación si procede.
- Librerías: `tenacity` (Python), `p-retry` (TS), `Http::retry()`/`$backoff` (Laravel).

## Circuit breaker básico

- Protege dependencias que fallan en cascada: tras N fallos consecutivos (o X% en ventana) el circuito se abre y las llamadas fallan rápido (o usan fallback) durante un tiempo; luego semi-abierto deja pasar una prueba.
- Parámetros iniciales: ventana 30-60 s, umbral 50% con mínimo 10 llamadas, abierto 30 s.
- Fallback explícito: cache stale, valor por defecto, degradación funcional (ocultar recomendaciones). Documenta qué se pierde.
- Expón estado del circuito como métrica y log `WARNING` al abrir/cerrar.
- Implementaciones: `opossum` (Node), `pybreaker`/`aiobreaker` (Python), en Laravel usa `Cache`/Redis para contador + `RateLimiter` o paquete específico. No lo escribas a mano en producción sin tests.

## Por stack: herramientas

| Stack | Logging | Errores | Resiliencia |
|---|---|---|---|
| Laravel | canal `stack` con formatter JSON, `Log::withContext`, `Context` facade | `bootstrap/app.php` `withExceptions()->render()` a `problem+json`; Sentry Laravel | `Http::retry()->timeout()`, jobs `$backoff`, `RateLimiter`, `Cache::lock` |
| TS/Node/Next | `pino` (JSON, redact paths), `AsyncLocalStorage` para request id | `Error` con `cause` y `code`; error boundaries en React; Sentry | `AbortSignal.timeout`, `p-retry`, `opossum` |
| Python | `structlog` + `contextvars`, procesadores de redacción | jerarquía `AppError`; handler FastAPI; Sentry SDK | `asyncio.timeout`, `httpx.Timeout`, `tenacity`, `aiobreaker` |
| Astro | `pino` en endpoints/middleware | `ActionError` tipado; página 500 propia | igual que Node |
| LangGraph | LangSmith + structlog con `run_id` | `with_structured_output` + validación; errores de tool capturados y devueltos al modelo con límite | timeouts por nodo, límite de iteraciones, semáforos |
