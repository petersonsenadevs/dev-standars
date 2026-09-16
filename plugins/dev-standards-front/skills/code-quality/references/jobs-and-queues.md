# Jobs, colas y tareas programadas (nivel aplicación)

## Índice
- [Cuándo va algo a una cola](#cuándo-va-algo-a-una-cola)
- [Anatomía de un job bien hecho](#anatomía-de-un-job-bien-hecho)
- [Reintentos y fallos](#reintentos-y-fallos)
- [Idempotencia (el job llegará dos veces)](#idempotencia-el-job-llegará-dos-veces)
- [Colas, prioridades y timeouts](#colas-prioridades-y-timeouts)
- [Cron / tareas programadas](#cron--tareas-programadas)
- [Por stack](#por-stack)
- [Checklist](#checklist)

Para arquitectura de mensajería entre módulos/servicios (outbox, eventos de dominio):
`ddd-hexagonal §references/integration/` — esto es la versión de aplicación, suficiente en el 90 % de casos.

## Cuándo va algo a una cola
- SIEMPRE: emails, notificaciones, llamadas a APIs externas, generación de PDFs/imágenes, imports/exports,
  webhooks salientes. Regla: si tarda > 100-200 ms o puede fallar por un tercero, fuera de la request.
- La request solo hace: validar → persistir → encolar → responder. El usuario no espera al SMTP.
- NUNCA a la cola: lo que el usuario necesita ver en la respuesta (calcula síncrono o rediseña la UX con estado "procesando").

## Anatomía de un job bien hecho
- **Payload mínimo**: IDs, no modelos/objetos serializados enteros (el dato puede cambiar entre encolar y ejecutar;
  recarga de BD al ejecutar y maneja "ya no existe" sin explotar).
- Un job = una unidad de trabajo con nombre de verbo (`SendInvoiceEmail`, no `InvoiceJob`).
- Sin estado compartido: todo lo que necesita va en el payload o se lee de BD.
- Loguea inicio/fin/fallo con el ID de la entidad y un correlation id (el de la request que lo encoló).

## Reintentos y fallos
- Reintentos con **backoff exponencial + jitter** (p. ej. 30s, 2m, 10m) y máximo 3-5; distingue error
  transitorio (red, 5xx, rate limit → reintenta) de permanente (validación, 4xx → NO reintentes, falla ya).
- `failed jobs` van a una tabla/cola de muertos CON alerta; un job fallido silencioso es un pedido sin email
  que nadie descubre. Revisa y reprocesa desde ahí.
- Timeout del job < timeout del worker; si un job puede tardar 10 min, trocéalo (batch de N + re-encolar resto).

## Idempotencia (el job llegará dos veces)
Toda cola es "al menos una vez": el mismo job PUEDE ejecutarse dos veces (reintento tras timeout, redeploy).
- Efecto con clave natural: `updateOrCreate` por clave única, no `create` a secas.
- Efectos externos (email, cobro): guarda una marca `sent_at`/`processed_at` y comprueba antes de actuar
  (o clave de idempotencia del proveedor, p. ej. Stripe `idempotency_key`).
- Si el job procesa lotes, que cada elemento sea re-procesable sin duplicar.
- Profundidad: `ddd-hexagonal §references/integration/idempotency.md`.

## Colas, prioridades y timeouts
- Separa colas por criticidad: `default`, `emails`, `heavy` (imports/PDF). Un import de 10k filas no puede
  retrasar los emails de reset de contraseña.
- Workers dimensionados por cola; monitoriza profundidad de cola (si crece sin parar, algo está caído).
- Rate limit hacia terceros EN el job (respeta los límites del proveedor; si no, reintentos en cascada).

## Cron / tareas programadas
- Un solo punto de verdad (scheduler del framework: Laravel `schedule`, cron llamando a un comando; no crontabs
  dispersos). Cada tarea: lock para no solaparse (`withoutOverlapping`), log de ejecución y alerta si no corre.
- Idempotentes también: un cron que se ejecuta dos veces no puede duplicar facturación (marca el periodo procesado).
- Cron NO hace el trabajo pesado: encola jobs (el cron solo decide qué toca).

## Por stack
| Stack | Usa |
|---|---|
| Laravel | Queues + Horizon (Redis); `ShouldQueue`, `tries`/`backoff`, `failed()`; Scheduler con `withoutOverlapping` |
| Next/Node | BullMQ (Redis) para colas reales; en serverless (Netlify/Vercel): background functions o Inngest/QStash — un `setTimeout` NO sobrevive a la request |
| Astro SSR (Netlify) | Igual que Node serverless: funciones en background o servicio de colas externo; nunca trabajo pesado en el handler |
| Python | Celery o RQ; `acks_late` + idempotencia; beat para programadas |

## Checklist
- [ ] Nada lento ni de terceros dentro de la request; la cola responde por ello.
- [ ] Payload = IDs; el job recarga y tolera "ya no existe".
- [ ] Backoff + máximo de intentos; 4xx no se reintenta; muertos con alerta.
- [ ] Ejecutar dos veces el mismo job no duplica nada (marca o clave de idempotencia).
- [ ] Colas separadas por criticidad; profundidad monitorizada.
- [ ] Cron con lock, idempotente, y que encola en vez de trabajar.
