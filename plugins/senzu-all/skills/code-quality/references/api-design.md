# Diseño de APIs: REST pragmático

## Índice

- [Principios](#principios)
- [Recursos y URLs](#recursos-y-urls)
- [Verbos y códigos de estado](#verbos-y-códigos-de-estado)
- [Formato de respuesta](#formato-de-respuesta)
- [Errores: RFC 9457 problem+json](#errores-rfc-9457-problemjson)
- [Validación](#validación)
- [Paginación por cursor](#paginación-por-cursor)
- [Filtrado, orden y campos](#filtrado-orden-y-campos)
- [Versionado](#versionado)
- [Idempotencia](#idempotencia)
- [Autenticación y autorización](#autenticación-y-autorización)
- [Rate limiting y cabeceras](#rate-limiting-y-cabeceras)
- [Caching y concurrencia](#caching-y-concurrencia)
- [Operaciones largas y webhooks](#operaciones-largas-y-webhooks)
- [OpenAPI como contrato](#openapi-como-contrato)
- [Cuándo GraphQL, tRPC o RPC](#cuándo-graphql-trpc-o-rpc)
- [Checklist](#checklist)

## Principios

- La API es un contrato público: estable, predecible, documentada, versionada. Cambiarla cuesta más que diseñarla bien.
- Consistencia por encima de "perfección REST": mismas convenciones de nombres, errores, paginación y fechas en todos los endpoints.
- Diseña desde el caso de uso del cliente (qué pantalla/flujo lo consume), no desde las tablas.
- Todo en JSON (`application/json`), UTF-8, `snake_case` en claves (o `camelCase`, pero uno solo en toda la API; Laravel → `snake_case`, TS-first → `camelCase`).
- Fechas ISO 8601 con zona (`2026-08-25T10:12:03Z`); dinero como entero en la menor unidad + `currency`; IDs como strings (UUID v7/ULID) aunque internamente sean enteros.

## Recursos y URLs

- Sustantivos en plural, minúsculas, `kebab-case`: `/orders`, `/order-items`, `/users/{id}/addresses`.
- Anidación máxima de 2 niveles; para más, usa filtros: `/order-items?order_id=...`.
- Sin verbos en la URL salvo acciones que no encajan en CRUD, modeladas como sub-recurso o comando: `POST /orders/{id}/cancel`, `POST /invoices/{id}/send`. Alternativa: transición de estado con `PATCH` (`{"status": "cancelled"}`) si el estado es un atributo legítimo.
- Recursos singleton: `/me`, `/users/{id}/settings`.
- Búsquedas complejas: `GET` con query params; si supera límites de URL, `POST /orders/search` documentado como consulta (sin efectos).
- Sin extensiones (`.json`), sin IDs secuenciales expuestos si evitan enumeración.

## Verbos y códigos de estado

| Verbo | Uso | Éxito | Idempotente |
|---|---|---|---|
| `GET` | Leer | 200 | Sí |
| `POST` | Crear / comando | 201 (+ `Location`) / 200 / 202 | No (salvo `Idempotency-Key`) |
| `PUT` | Reemplazar completo | 200 / 204 | Sí |
| `PATCH` | Actualización parcial (JSON Merge Patch, RFC 7396) | 200 | Debería |
| `DELETE` | Borrar | 204 (o 200 con cuerpo) | Sí (segunda vez: 204 o 404, elige y documenta) |

- Errores: 400 sintaxis/JSON inválido, 401 no autenticado, 403 sin permiso, 404 no existe, 405 método no permitido, 409 conflicto de estado/versión, 410 eliminado definitivamente, 412 precondición fallida, 415 media type, 422 validación semántica, 429 rate limit, 500 interno, 503 mantenimiento/dependencia (+ `Retry-After`).
- `GET` y `HEAD` nunca mutan; `GET` con cuerpo no existe.
- No uses 200 para errores ni 500 para errores del cliente.

## Formato de respuesta

- Un recurso: objeto en la raíz (`{"id": ..., "status": ...}`). Colección: `{"data": [...], "meta": {...}, "links": {...}}` para dejar sitio a paginación.
- Nunca devuelvas el modelo de BD tal cual: serializa con Resource/schema (campos estables, sin internals, sin secretos).
- `null` explícito para ausencia, no omitir campos según el caso (rompe clientes tipados). Campos opcionales por `?include`/`?fields` sí pueden omitirse, pero documentados.
- Relaciones: por defecto IDs (`customer_id`); expansión bajo demanda (`?include=customer,items`) con límite.
- Enums como strings estables en `SCREAMING_SNAKE` o `snake_case` (uno solo); nunca enteros mágicos.
- Booleanos como booleanos, no `"1"`/`"yes"`.
- Envía `Content-Type: application/json; charset=utf-8` y `Cache-Control` explícito.

## Errores: RFC 9457 problem+json

```json
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "detail": "2 fields are invalid.",
  "instance": "/orders",
  "code": "VALIDATION_ERROR",
  "request_id": "c8f1d2...",
  "errors": [
    { "field": "email", "code": "INVALID_FORMAT", "message": "Must be a valid email." },
    { "field": "items", "code": "MIN_ITEMS", "message": "At least one item is required." }
  ]
}
```

- Un único formato de error para toda la API; `type` como URI estable (puede ser documentación), `code` máquina-legible y catalogado, `detail` humano sin internals, `request_id` para soporte.
- Errores de validación: lista por campo con `code` y path (`items[2].sku`).
- Errores de dominio: 409 o 422 con `code` propio (`INSUFFICIENT_STOCK`) y datos útiles (`missing_quantity`).
- Laravel: handler en `withExceptions()`; FastAPI: `exception_handler` + override del 422 por defecto; Next/Astro: helper `problem(status, code, detail)` compartido.

## Validación

- Schema estricto en servidor (Form Request, Pydantic, zod): tipos, longitudes, rangos, enums, formatos, campos desconocidos rechazados.
- Valida antes de autorizar solo lo sintáctico; autoriza antes de tocar datos; valida reglas de negocio (stock, estado) en el servicio y devuelve 409/422 con `code`.
- Payloads con límite de tamaño (1 MB por defecto), profundidad y número de ítems en arrays.
- Normaliza (trim, lowercase en email, NFC) antes de validar; documenta el comportamiento.
- Rechaza `PATCH` vacío y `PUT` incompleto.

## Paginación por cursor

- Por defecto cursor (keyset): estable con inserciones, escala con tablas grandes.

```json
GET /orders?limit=50&cursor=eyJjcmVhdGVkX2F0IjoiMjAyNi0wOC0yNVQxMDoxMjowM1oiLCJpZCI6IjAxSi4uLiJ9

{
  "data": [...],
  "meta": { "limit": 50, "has_more": true },
  "links": { "next": "/orders?limit=50&cursor=eyJ..." }
}
```

- Cursor opaco (base64 de los valores de orden + dirección), firmado si quieres evitar manipulación. `limit` con máximo (100) y por defecto (20-50).
- Orden por columnas únicas y monótonas (`created_at, id`). Documenta que el orden es fijo o restringido con cursor.
- Offset (`?page=3&per_page=20` con `total`) solo en tablas administrativas pequeñas donde se necesita saltar a una página. No devuelvas `total` en cursor (es una query extra cara) salvo que se pida `?include_total=true`.

## Filtrado, orden y campos

- Filtros como query params con operadores explícitos y acotados: `?status=paid&created_at[gte]=2026-01-01&customer_id=...`. Lista blanca de campos filtrables; rechaza desconocidos con 400.
- Múltiples valores: `?status=paid,shipped` o `?status[]=paid&status[]=shipped` (uno solo).
- Orden: `?sort=-created_at,total` (prefijo `-` para descendente); lista blanca; con cursor, el orden define el cursor.
- Selección de campos: `?fields=id,status,total` (sparse fieldsets) e `?include=customer` para relaciones; ambas con límites.
- Búsqueda libre: `?q=` sobre campos indexados (full-text), separada de filtros exactos.
- Laravel: `spatie/laravel-query-builder` implementa esto con listas blancas. FastAPI: dependencias `Query` con `Literal` y modelos de filtro.

## Versionado

- Versiona desde el día uno en la URL: `/v1/orders`. Simple, cacheable, visible en logs. Cabecera (`Accept: application/vnd.api.v2+json`) solo si ya tienes tooling para ello.
- Versión mayor solo para cambios incompatibles: eliminar/renombrar campo, cambiar tipo, cambiar semántica, cambiar códigos de error. Añadir campos opcionales o endpoints no es breaking (los clientes deben tolerar campos nuevos).
- Mantén N-1 con fecha de retirada anunciada (`Deprecation` y `Sunset` headers, RFC 8594/9745) y métricas de uso por versión.
- Evita versionar por recurso individual: confunde. Versión de API completa.
- Cambios internos (rendimiento, refactor) nunca cambian la versión.

## Idempotencia

- `GET`, `PUT`, `DELETE` idempotentes por diseño. `POST` de creación/pagos acepta `Idempotency-Key` (UUID generado por cliente).
- Servidor: guarda `(key, user/tenant, hash del request)` → respuesta (código + cuerpo) durante 24 h. Misma clave + mismo cuerpo → devuelve la respuesta original (mismo código); misma clave + cuerpo distinto → 422 `IDEMPOTENCY_KEY_REUSED`; clave en proceso → 409 `REQUEST_IN_PROGRESS`.
- Usa un lock (Redis `SET NX`) para la ventana de ejecución y guarda el resultado dentro de la misma transacción cuando sea posible.
- Documenta qué endpoints la soportan/exigen. Los clientes reintentan solo con la misma clave.
- Para webhooks salientes, incluye `event_id` único para que el receptor deduplique.

## Autenticación y autorización

- Bearer tokens (`Authorization: Bearer ...`): Sanctum/Passport tokens de API, JWT de corta vida (≤ 15 min) + refresh rotativo, o OAuth2 client credentials para máquina a máquina. Cookies `HttpOnly` para SPA en el mismo dominio.
- Scopes/permissions por token (`orders:read`, `orders:write`); un endpoint declara los scopes que exige y responde 403 con `code: INSUFFICIENT_SCOPE` y `WWW-Authenticate` con `scope`.
- Autoriza sobre el recurso concreto (propiedad/tenant) en cada operación; 404 si no se debe revelar existencia.
- Claves de API: prefijo identificable (`sk_live_`), almacenadas hasheadas, revocables, con `last_used_at`; nunca en query string.
- `401` con `WWW-Authenticate: Bearer` para token ausente/inválido/expirado (`error="invalid_token"`); `403` para permisos.
- TLS obligatorio; nunca tokens en logs ni en URLs.

## Rate limiting y cabeceras

- Límites por token/usuario y por IP (anónimo); más estrictos por endpoint caro. Devuelve 429 con `Retry-After` (segundos).
- Cabeceras estándar (IETF draft `RateLimit`): `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (o `X-RateLimit-*` si tu framework ya las emite; sé consistente).
- Ventana deslizante o token bucket en Redis; límites documentados en la API y visibles en la respuesta para que el cliente se adapte.
- Cuotas diarias/mensuales separadas del rate limit por segundo.
- Cabeceras siempre: `X-Request-Id` (eco o generado), `Content-Type`, `Cache-Control`, seguridad (`nosniff`, HSTS), y `Vary: Authorization` en respuestas personalizadas.

## Caching y concurrencia

- `GET` de recursos con `ETag` (hash del cuerpo o `updated_at` + versión) y `Last-Modified`; responde 304 a `If-None-Match`.
- Escrituras con control optimista: cliente envía `If-Match: "<etag>"`; si no coincide, 412 `PRECONDITION_FAILED`. Alternativa: campo `version` en el cuerpo → 409 en conflicto.
- `Cache-Control: private, max-age=0, must-revalidate` para datos personalizados; `public, s-maxage=...` solo para recursos realmente públicos.
- Listados con cursor: `Cache-Control: no-store` o TTL corto.

## Operaciones largas y webhooks

- Operación > 1-2 s: responde `202 Accepted` con `Location: /operations/{id}` y un recurso de operación (`status: pending|running|succeeded|failed`, `result`, `error`, `progress`). El cliente hace polling con `Retry-After` o se suscribe a webhook.
- Webhooks salientes: `POST` JSON con `id` de evento único, `type` (`order.paid`), `created_at`, `data`, y `api_version`. Firma HMAC-SHA256 en cabecera (`X-Signature: t=timestamp,v1=hex`) sobre `timestamp.body`; el receptor verifica con tolerancia de 5 min.
- Reintentos con backoff exponencial durante 24-72 h ante no-2xx; el receptor debe responder 2xx rápido y procesar en cola; deduplicar por `id`.
- Panel/endpoint para listar entregas y reenviar; secreto por endpoint rotable.
- Eventos con datos mínimos + ID para que el receptor consulte (evita filtrar datos y desincronización), salvo que la latencia exija payload completo.
- Alternativas para tiempo real hacia navegadores: SSE (`text/event-stream`) para streaming de LLM/progreso; WebSockets solo si es bidireccional.

## OpenAPI como contrato

- OpenAPI 3.1 es la fuente de verdad. Generado desde código (FastAPI nativo; Laravel `scramble`/`l5-swagger` con atributos; Next/Astro con zod → `zod-openapi`) o escrito a mano y validado contra la implementación en CI (`schemathesis`, `spectral` para lint).
- Cada operación: `operationId` único, descripción, parámetros con tipos y ejemplos, request/response schemas con `required`, todos los códigos de error posibles con el schema `Problem`.
- Schemas compartidos en `components` con nombres estables; enums explícitos; `format` (`uuid`, `date-time`, `int64`).
- Genera clientes tipados (`openapi-typescript` + `openapi-fetch`, `openapi-python-client`) en lugar de escribir fetches a mano; publica el spec en `/openapi.json` (protegido si la API es privada).
- Diff de OpenAPI en CI (`oasdiff`) para detectar breaking changes antes de fusionar.

## Cuándo GraphQL, tRPC o RPC

- **REST/OpenAPI**: API pública o multi-cliente, integraciones de terceros, cacheable por CDN, equipos separados. Por defecto.
- **tRPC** (o Server Actions/Astro Actions): frontend y backend TypeScript en el mismo repo y equipo, sin consumidores externos. Tipado end-to-end sin generar código. No para API pública.
- **GraphQL**: muchos clientes con necesidades de datos muy distintas, grafo de relaciones profundo, equipo con capacidad de mantener schema, resolvers con dataloaders, límites de complejidad y persisted queries. Coste alto de caching, seguridad (introspección, consultas costosas) y N+1; no lo elijas para un CRUD.
- **gRPC/Connect**: comunicación interna entre servicios con alto rendimiento y contratos Protobuf; no para navegadores sin gateway.
- Mezcla: REST público + tRPC/Server Actions interno es habitual y correcto; no expongas los internos.

## Checklist

- URLs de recursos en plural, sin verbos, anidación ≤ 2.
- Códigos correctos (201/204/404/409/422/429) y `problem+json` único con `code` y `request_id`.
- Validación estricta en servidor; campos desconocidos rechazados; límites de tamaño.
- Paginación por cursor con `limit` máximo; filtros/orden con lista blanca.
- `/v1` en la URL; cambios compatibles no rompen clientes; `Deprecation`/`Sunset` en retiradas.
- `Idempotency-Key` en `POST` de creación/pago; `ETag`/`If-Match` en actualizaciones concurrentes.
- Autenticación Bearer/cookie, scopes por endpoint, autorización por recurso.
- Rate limit con cabeceras `RateLimit-*` y 429 + `Retry-After`.
- 202 + recurso de operación para procesos largos; webhooks firmados, con `id`, reintentos y deduplicación.
- OpenAPI actualizado, validado en CI y con clientes generados.
