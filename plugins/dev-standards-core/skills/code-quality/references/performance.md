# Rendimiento: medir, priorizar, optimizar

## Índice

- [Principio: medir antes de optimizar](#principio-medir-antes-de-optimizar)
- [Profilers y herramientas por stack](#profilers-y-herramientas-por-stack)
- [Base de datos: índices](#base-de-datos-índices)
- [Base de datos: N+1 y consultas](#base-de-datos-n1-y-consultas)
- [Paginación por cursor](#paginación-por-cursor)
- [Caching por capas](#caching-por-capas)
- [Colas para trabajo pesado](#colas-para-trabajo-pesado)
- [Frontend: Core Web Vitals](#frontend-core-web-vitals)
- [Frontend: bundle, imágenes, fuentes](#frontend-bundle-imágenes-fuentes)
- [Python: async y CPU-bound](#python-async-y-cpu-bound)
- [PHP/Laravel específico](#phplaravel-específico)
- [LLM y agentes](#llm-y-agentes)
- [Presupuestos de rendimiento](#presupuestos-de-rendimiento)
- [Checklist](#checklist)

## Principio: medir antes de optimizar

- Sin medición no hay optimización: define el síntoma (p95 de `/orders` = 1,8 s), mide, localiza el 20% que causa el 80%, cambia una cosa, vuelve a medir.
- Optimiza el camino crítico del usuario, no el código que "parece lento". El cuello de botella casi siempre es I/O (BD, red, disco), no CPU de tu código.
- Rendimiento es un requisito con número (presupuesto), no una fase final.
- Documenta en la PR: antes/después con la misma herramienta y datos representativos (no 10 filas en local).
- No sacrifiques legibilidad por microoptimizaciones sin evidencia (`foreach` vs `array_map`, `for` vs `map`).

## Profilers y herramientas por stack

| Stack | Local | Producción / CI |
|---|---|---|
| Laravel | Telescope, Debugbar (queries, N+1, tiempos), Xdebug/`xhprof` + `SPX`, `php artisan model:prune` | Laravel Pulse, OpenTelemetry, slow query log, `EXPLAIN ANALYZE` |
| Next/React | React DevTools Profiler, Chrome Performance + Lighthouse, `@next/bundle-analyzer`, `next build` (tamaños por ruta) | Vercel Speed Insights / `useReportWebVitals`, Lighthouse CI, RUM |
| Vue | Vue DevTools (timeline), `rollup-plugin-visualizer`, Lighthouse | RUM (web-vitals), Lighthouse CI |
| Astro | `astro build` (tamaños), visualizer, Lighthouse | Lighthouse CI |
| Python | `py-spy` (sin cambiar código, en prod también), `cProfile` + `snakeviz`, `scalene` (CPU/memoria), `asyncio` debug mode, SQLAlchemy `echo` | OpenTelemetry, `py-spy dump` en contenedor, slow query log |
| BD | `EXPLAIN (ANALYZE, BUFFERS)`, `pg_stat_statements`, `pt-query-digest` | Alertas por queries lentas, índices sin uso |

- Datos realistas: prueba con volúmenes de producción (anonimizados) o generados en escala (10^5-10^6 filas).
- Carga: `k6`, `oha`/`wrk` para HTTP; guarda resultados en el repo/CI para comparar.

## Base de datos: índices

- Índice en toda FK y en columnas de `WHERE`, `JOIN`, `ORDER BY` frecuentes. Índices compuestos en el orden de selectividad y de uso (`(tenant_id, status, created_at)`); la columna de igualdad primero, rango al final.
- Índices cubrientes (`INCLUDE`) para queries de lectura muy frecuentes; parciales (`WHERE deleted_at IS NULL`) para subconjuntos.
- Evita funciones sobre columnas indexadas en `WHERE` (`LOWER(email)`, `DATE(created_at)`): usa índice funcional o columna generada.
- `LIKE '%x%'` no usa índice B-tree: full-text (`tsvector`/`GIN`, MySQL FULLTEXT) o Meilisearch/Typesense.
- Cada índice cuesta en escritura y espacio: elimina los no usados (`pg_stat_user_indexes`).
- Crea índices en tablas grandes con `CONCURRENTLY` (Postgres) / `ALGORITHM=INPLACE` (MySQL) fuera de transacción.
- UUID v4 como PK fragmenta índices: usa UUID v7/ULID o `bigint` + UUID público.

## Base de datos: N+1 y consultas

- N+1 es el problema n.º 1 en Laravel y ORMs en general: eager loading (`with`, `selectinload`/`joinedload`, `include`), y detección automática (`preventLazyLoading`, `nplusone` en Python, `assertQueryCount` en tests).
- Selecciona solo columnas necesarias; evita `SELECT *` en tablas con `text`/`json` grandes.
- Cuenta en BD (`count()`, `withCount`), agrega en BD (`sum`, `group by`), filtra en BD: no traigas 10.000 filas para procesarlas en PHP/Python/JS.
- Batching: `whereIn` con lotes de ≤ 1000 IDs; `upsert`/`bulk insert` en vez de bucles.
- Transacciones cortas; sin llamadas HTTP dentro de una transacción; sin bloqueos largos.
- Pool de conexiones dimensionado (`pgbouncer`, `asyncpg` pool, Octane/persistent connections); una conexión por request en PHP-FPM es lo normal, no abras más.
- Timeouts de statement (`statement_timeout`) para que una query mala no tumbe el servicio.
- Cuidado con `OFFSET` grande (ver cursor), `DISTINCT` para arreglar joins duplicados y subconsultas correlacionadas.

## Paginación por cursor

- `OFFSET n` recorre y descarta n filas: a partir de decenas de miles se degrada y además duplica/salta ítems si hay inserciones. Usa cursor (keyset) en listados grandes, feeds, exportaciones y APIs.
- Ordena por columna(s) única(s) y monótona(s): `(created_at, id)`; el cursor codifica los últimos valores (base64 de JSON). Query: `WHERE (created_at, id) < (:c_at, :id) ORDER BY created_at DESC, id DESC LIMIT :n+1` (n+1 para saber si hay más).
- Laravel: `cursorPaginate()`; SQLAlchemy: construye la tupla; Prisma: `cursor` + `skip: 1`; Drizzle: `where(lt(...))`.
- Cursor opaco para el cliente; incluye la dirección y el orden para validar. Documenta en la API (`next_cursor`, `has_more`).
- Offset sigue siendo aceptable para tablas de admin pequeñas con salto a página N.

## Caching por capas

De más barata a más cara (invalida de fuera hacia dentro):

1. **Navegador/CDN**: `Cache-Control` correcto (`public, max-age, s-maxage, stale-while-revalidate`), `ETag`/`Last-Modified`, assets con hash y `immutable`. Estático en CDN (Astro/Next static).
2. **Full page / RSC / ISR**: Next `revalidate`/`"use cache"` por tag, Astro prerender + `server:defer`, Laravel response cache para páginas públicas.
3. **Aplicación (Redis)**: resultados de queries caras, agregados, respuestas de terceros, sesiones. `remember($key, $ttl)`, `cache.get_or_set`, `unstable_cache`/`cacheTag`. Claves con prefijo, versión y tenant; TTL siempre (nunca infinito sin invalidación por evento); `Cache::lock` / single-flight contra estampidas.
4. **Memoria de proceso**: LRU pequeñas para config, lookups estáticos (`functools.lru_cache`, `Map` en módulo, `once()` en Laravel). Cuidado con memoria en procesos largos (Octane, workers).
5. **BD**: materialized views, tablas de resumen actualizadas por job, columnas desnormalizadas con contador.

- Invalidación: por evento (al escribir, `forget`/`revalidateTag`) mejor que por TTL corto; combina ambos. Nunca caches datos por usuario en capas compartidas sin la clave de usuario.
- Mide hit ratio; una cache con < 80% de aciertos probablemente sobra.
- No cachees errores ni respuestas vacías sin intención (negative caching corto si aplica).

## Colas para trabajo pesado

- Todo lo que tarde > 100-200 ms y no sea necesario para responder va a cola: emails, PDFs, imágenes, webhooks salientes, importaciones, llamadas a LLM largas, sincronizaciones.
- Responde rápido (202 + ID de tarea) y notifica (polling, SSE, websockets, email) cuando termine.
- Divide trabajos grandes en jobs pequeños (batch), con idempotencia y límite de reintentos; `chunkById` para recorrer tablas.
- Dimensiona workers por cola y prioridad; monitoriza latencia de cola (tiempo en espera), no solo throughput.
- Programa tareas pesadas de mantenimiento en horas valle; evita cron que solapa (`withoutOverlapping`).
- Herramientas: Laravel Horizon; Python `arq`/Celery/Dramatiq o `TaskGroup` con semáforo para paralelismo puntual; Node: BullMQ. En Next, Server Actions no son colas: delega a un worker externo o servicio (Inngest, Trigger.dev, QStash).

## Frontend: Core Web Vitals

- Objetivos (p75 móvil): **LCP < 2,5 s**, **INP < 200 ms**, **CLS < 0,1**. Mide en campo (RUM) y en laboratorio (Lighthouse CI en cada PR).
- LCP: sirve HTML rápido (SSR/estático, TTFB < 800 ms), imagen LCP con `priority`/`fetchpriority="high"` y `preload`, sin lazy load en ella, fuentes con `preload` y `swap`, CSS crítico pequeño.
- INP: menos JS en el hilo principal (islas, RSC, `dynamic()`), evita re-renders masivos (estado local, virtualización), divide tareas largas (`scheduler.yield()`, `startTransition`), sin listeners pesados en `scroll`/`input` sin throttle.
- CLS: dimensiones en imágenes/vídeos/embeds, espacio reservado para contenido asíncrono (skeletons con altura), `font-display: swap` + `size-adjust`, no insertar banners encima del contenido.
- TTFB: cache/CDN, evitar cadenas de fetch en serie en el servidor (`Promise.all`), regiones cercanas al usuario, streaming (`Suspense`).

## Frontend: bundle, imágenes, fuentes

- Presupuesto: < 200 KB JS gz en la ruta inicial (Next/Vue), ~0 KB en páginas de contenido (Astro). Analiza cada PR que suba > 10 KB.
- Code splitting por ruta automático; componentes pesados con `dynamic()`/`defineAsyncComponent`/`client:visible`.
- Tree-shaking: imports con nombre de librerías ESM; sustituye pesadas (`moment` → `date-fns`/`Temporal`, `lodash` → `es-toolkit`, `axios` → `fetch`); revisa `sideEffects` en package.json.
- Sin polyfills innecesarios (`browserslist` moderno); sin duplicar librerías (una sola versión de React/Vue; revisa `pnpm why`).
- Imágenes: `next/image`, `astro:assets`, `<picture>` con AVIF/WebP, `sizes` correctos, lazy salvo LCP, dimensiones explícitas, CDN con resize.
- Fuentes: self-host (`next/font`, `@fontsource`, Astro fonts), variable fonts, subsets (`unicode-range`), máximo 2 familias × 2-3 pesos, `preload` solo la principal.
- Third-party: cada script se justifica; carga diferida (`lazyOnload`, Partytown), consent gating; mide su coste en Lighthouse.
- Prefetch de rutas probables (Next Link lo hace en viewport; Astro `prefetch`), no de todo.

## Python: async y CPU-bound

- I/O-bound (APIs, BD, LLM): `asyncio` con clientes async, `TaskGroup`, semáforos para limitar concurrencia, `httpx.AsyncClient` compartido con pool y HTTP/2.
- Cualquier bloqueo en un handler async (requests, `time.sleep`, ORM síncrono, CPU pesado) congela todo el worker: `await asyncio.to_thread()` o cliente async.
- CPU-bound (parsing pesado, cálculo, embeddings locales): `ProcessPoolExecutor` o cola de workers; el GIL impide paralelismo con threads (3.13 free-threaded es experimental).
- Perfila con `py-spy top --pid` en producción antes de decidir; muchas veces el "CPU" es serialización JSON (usa `orjson`/`msgspec`) o validación Pydantic redundante (valida una vez en la frontera).
- Servidor: `uvicorn` con `--workers N` (= núcleos) tras un proxy, o `gunicorn -k uvicorn.workers.UvicornWorker`; `uvloop` instalado.
- Streaming de respuestas grandes (`StreamingResponse`) y de LLM (SSE) en vez de acumular en memoria.
- Evita `pandas` para transformar 100 filas; evita bucles Python para 10^6 filas (vectoriza con `numpy`/`polars`).

## PHP/Laravel específico

- OPcache activado con `validate_timestamps=0` en producción y `preload` si aplica; `composer install --optimize-autoloader --no-dev`; `php artisan optimize` (config, route, view, event cache).
- PHP-FPM dimensionado (`pm.max_children` = memoria disponible / memoria por proceso); o Octane (Swoole/FrankenPHP) para apps con alto RPS: cuidado con estado estático entre requests.
- Evita `Collection` gigantes en memoria: `lazy()`, `cursor()`, `chunkById()`. `->toArray()` innecesarios y `json_decode` repetidos en accessors.
- Sesiones/cache/colas en Redis; nunca `file` o `database` driver en producción con carga.
- Vistas Blade: sin queries dentro (`@foreach($user->posts)` sin `with`), usa `@once`, fragmentos cacheados para bloques caros.
- Middleware y service providers ligeros: se ejecutan en cada request; carga perezosa (`defer`) de servicios pesados.
- Debugbar/Telescope desactivados en producción (coste alto).

## LLM y agentes

- Latencia: streaming siempre que haya usuario esperando; modelo más pequeño para clasificación/ruteo, grande solo donde importa; prompt caching del proveedor para prefijos largos (system + herramientas).
- Paraleliza llamadas independientes (`TaskGroup`, `Promise.all`), con semáforo por proveedor para respetar rate limits.
- Reduce tokens: contexto acotado (top-k relevante en RAG, resúmenes de historial), salidas estructuradas cortas, sin repetir instrucciones en cada turno.
- Cachea respuestas deterministas (embeddings por hash de texto, clasificaciones) en Redis.
- Límites de iteraciones y timeouts por nodo; mide tokens y latencia por nodo en LangSmith/OTel; coste por request como métrica.
- Embeddings en batch; índice vectorial con filtros por tenant antes de la búsqueda (`pgvector` con índice HNSW + `WHERE tenant_id`).

## Presupuestos de rendimiento

- Define por proyecto y escribe en el repo (`PERFORMANCE.md` o en el README): TTFB, LCP, INP, CLS, JS inicial por ruta, p95 de endpoints clave, tiempo de jobs críticos, coste/latencia por llamada LLM.
- Valores de partida: API p95 < 300 ms (lectura) / < 800 ms (escritura); páginas LCP < 2,5 s; JS inicial < 200 KB gz; job de email < 5 s; respuesta de agente primer token < 2 s.
- Hazlos cumplir en CI: Lighthouse CI con `assertions`, `size-limit`/`bundlesize` para JS, tests de carga con umbrales `k6` (`thresholds`), `assertQueryCount` en tests de integración.
- Regresión = bug: una PR que rompe el presupuesto no se fusiona sin justificación y plan.
- Revisa los presupuestos trimestralmente con datos RUM.

## Checklist

- ¿Hay medición antes/después con datos representativos?
- ¿Las queries nuevas tienen índice y `EXPLAIN` razonable? ¿Sin N+1 (test de conteo de queries)?
- ¿Listados grandes usan cursor y límite máximo?
- ¿Lo pesado (> 200 ms, terceros, LLM) va a cola o se hace en paralelo con timeout?
- ¿Se cachea con clave correcta, TTL y estrategia de invalidación?
- ¿Cabeceras de cache/CDN correctas para lo estático y lo público?
- ¿JS añadido justificado y dentro del presupuesto? ¿Isla/`dynamic` cuando procede?
- ¿Imágenes optimizadas, dimensionadas y lazy salvo LCP? ¿Fuentes self-hosted y acotadas?
- ¿Sin I/O bloqueante en código async? ¿Sin bucles sobre colecciones enormes en memoria?
- ¿Presupuestos verificados en CI (Lighthouse, size-limit, k6)?
