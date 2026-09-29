# Realtime: WebSockets, SSE y broadcasting sin sustos

Índice: 1 Elegir transporte · 2 Broadcasting por stack · 3 Diseño de eventos · 4 Reconexión y presencia ·
5 Escalado · 6 Errores típicos

## 1. Elegir transporte (de simple a complejo)
- **Polling corto** (cada 10–30 s): para "casi-realtime" barato (badge de notificaciones). No lo descartes por orgullo.
- **SSE (Server-Sent Events)**: solo servidor→cliente (streaming de LLM, progreso de un job, feed). HTTP
  normal, reconexión nativa (`EventSource`), sin librería. Elige esto si el cliente no necesita EMITIR.
- **WebSockets**: bidireccional (chat, colaboración, juego, dashboards vivos). Más infra: proceso
  persistente, sticky/pub-sub al escalar.
- Regla: el transporte más simple que cumpla. La mayoría de "necesito websockets" son SSE o polling.

## 2. Broadcasting por stack
- **Laravel**: eventos con `ShouldBroadcast` + **Reverb** (self-host, primera opción) o Pusher/Ably (gestionado).
  Cliente: Echo. Canales privados/presencia con auth en `routes/channels.php` — SIEMPRE autorizar el canal.
- **Node**: socket.io (rooms, fallbacks, reconexión) o `ws` a pelo si es simple; en Nest, gateways
  (`@WebSocketGateway`) con guards para auth.
- **Next/serverless**: no mantengas sockets en funciones — usa gestionado (Pusher/Ably) o un servicio Node aparte.
- **FastAPI**: `WebSocket` nativo para pocas conexiones; para fan-out, Redis pub/sub detrás.
- SSE en cualquiera: respuesta `text/event-stream` + `data:` por línea; en Nginx `proxy_buffering off`.

## 3. Diseño de eventos
- Evento = hecho de dominio con payload MÍNIMO (`pedido.pagado` + id): el cliente pide el detalle por API
  si lo necesita. Así no filtras campos sensibles por el canal.
- Nombres versionables y consistentes (`recurso.accion`); un canal por contexto (`pedidos.{tenantId}`), no "global".
- Todo lo crítico que viaja por socket tiene camino alternativo por HTTP: el realtime MEJORA la UX, no es
  la única fuente de verdad (si el socket cae, la app sigue funcionando al recargar).

## 4. Reconexión y presencia
- El cliente SIEMPRE maneja: desconexión (indicador discreto), reconexión con backoff (socket.io/Echo lo
  traen — no lo reimplementes), y **resincronización al reconectar** (pedir estado actual por API; los
  eventos perdidos durante el corte no llegan solos).
- Presencia ("quién está aquí"): canales de presencia del proveedor, no un array casero que se desincroniza.
- Idempotencia en el cliente: un evento duplicado no debe duplicar filas en la UI (key por id).

## 5. Escalado
- Más de 1 proceso/instancia → pub/sub compartido: Redis adapter (socket.io), Reverb ya lo trae con Redis.
- El proceso de sockets se supervisa como una cola (systemd/supervisor + reinicio) — deploy-ops §production-runtime.
- Métricas mínimas: conexiones activas y errores de auth de canal. Load balancer con soporte de upgrade
  (websocket) y timeouts largos para SSE.

## 6. Errores típicos del agente
- WebSockets para algo que era un SSE o un polling · canal público con datos privados (autoriza SIEMPRE).
- Payload gordo con el modelo entero serializado (fuga de campos + acoplamiento).
- Sin manejo de reconexión ("en mi máquina nunca se corta") · estado solo en el socket, sin resync por API.
- Emitir desde el request en vez de tras el commit de la transacción (evento de algo que hizo rollback).
- Olvidar `proxy_buffering off`/timeouts en Nginx y "el SSE no funciona en producción".
