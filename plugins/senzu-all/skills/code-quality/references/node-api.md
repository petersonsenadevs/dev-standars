# Node API (Express / NestJS): recetas de APIs y servicios

Índice: 1 Estructura · 2 Validación en el borde · 3 Errores centralizados · 4 Async sin trampas ·
5 Config y arranque · 6 Nest específico · 7 Express específico · 8 Observabilidad · 9 Errores típicos

## 1. Estructura
- Por recurso/feature: `src/pedidos/{pedidos.router,pedidos.service,pedidos.repo}.ts` — no carpetas
  `controllers/` gigantes por tipo. El controlador traduce HTTP↔dominio; el servicio no conoce `req`/`res`.
- DTO de entrada y de salida por endpoint; la entidad del ORM no sale del repositorio/servicio.

## 2. Validación en el borde
```ts
// Express + zod
const CrearPedido = z.object({ productoId: z.string().uuid(), cantidad: z.number().int().positive() });
router.post('/pedidos', (req, res, next) => {
  const parsed = CrearPedido.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ errores: parsed.error.flatten().fieldErrors });
  // parsed.data ya está tipado
});
```
- Nest: `ValidationPipe` GLOBAL con `{ whitelist: true, transform: true }` + class-validator en DTOs.
- Valida también params, query y headers que uses; y los mensajes que llegan de colas/webhooks.

## 3. Errores centralizados
- Excepciones de dominio propias (`PedidoNoEncontrado`) → un único mapper a HTTP (middleware de errores en
  Express, ExceptionFilter en Nest): código correcto + mensaje accionable + request-id. Stack solo al log.
- Express: handlers async envueltos (o Express 5, que propaga rejections) — un `throw` perdido no puede tumbar el proceso.
- `unhandledRejection`/`uncaughtException`: loguear y salir (el process manager reinicia); nunca "tragar y seguir".

## 4. Async sin trampas
- Ninguna promesa sin `await`/`return`/`.catch` (activa `@typescript-eslint/no-floating-promises`).
- IO independiente en paralelo: `Promise.all`; secuencial solo si hay dependencia real.
- CPU pesada (imágenes, PDFs, crypto) fuera del request: cola (BullMQ) o `worker_threads`.
- Timeouts SIEMPRE en llamadas externas: `fetch(url, { signal: AbortSignal.timeout(5000) })`.

## 5. Config y arranque
- Un módulo `config.ts` que valida `process.env` con zod al arrancar y exporta un objeto tipado:
  si falta una variable, el proceso muere al inicio con mensaje claro, no a las 3 AM en un request.
- Graceful shutdown: en SIGTERM cerrar servidor HTTP, esperar requests en vuelo, cerrar pool de BD y colas.
- `/health`: 200 con checks de BD/cola (lo usan uptime y orquestador).

## 6. Nest específico
- Módulos cohesivos con `providers` privados; lo compartido en módulos propios importados, no en `@Global` por pereza.
- DI por constructor con interfaces + tokens para lo intercambiable (repos, clients externos) — testeable.
- Guards (auth) → Interceptors (logging, serialización) → Pipes (validación): cada cosa en su pieza.

## 7. Express específico
- `helmet()`, `express.json({ limit })`, rate limit y CORS explícito montados al inicio, en ese orden lógico.
- Un `Router` por recurso montado en `app.use('/api/pedidos', pedidosRouter)`; versionado en el prefijo si hace falta.

## 8. Observabilidad
- pino con request-id (pino-http): cada log de un request comparte id. Niveles reales (info/warn/error).
- Sentry (o similar) con contexto; métricas mínimas: latencia por ruta y errores 5xx.

## 9. Errores típicos del agente
- `console.log` (bloqueado) · devolver la entidad del ORM con campos sensibles · `res.json` sin código en errores.
- Falta de paginación ("de momento devuelvo todo") · webhooks sin idempotencia · `catch (e) {}` vacío.
- Mezclar `require` y `import` · usar `any` para "avanzar rápido" · secretos en el repo "temporalmente".
