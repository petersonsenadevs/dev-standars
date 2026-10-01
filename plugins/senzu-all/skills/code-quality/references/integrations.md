# Integraciones: APIs externas, webhooks, pagos y email

## Índice
- [Llamar a APIs externas](#llamar-a-apis-externas)
- [Recibir webhooks](#recibir-webhooks)
- [Emitir webhooks](#emitir-webhooks)
- [Pagos](#pagos)
- [Email transaccional](#email-transaccional)
- [Checklist](#checklist)

Versión arquitectónica (outbox, mensajería entre servicios): `ddd-hexagonal §references/integration/`.

## Llamar a APIs externas
- **Timeout SIEMPRE** (conexión 3-5s, total 10-30s según caso). Sin timeout, un tercero caído cuelga tus workers.
- Reintentos solo en transitorios (timeout, 429, 5xx) con backoff+jitter y máximo 3; 4xx no se reintenta.
  Respeta `Retry-After` en 429.
- Toda llamada desde un job/cola, no desde la request del usuario (`jobs-and-queues.md`), salvo que la
  respuesta sea imprescindible para responder — y entonces con timeout corto y fallback definido.
- Envuelve el cliente en una clase propia (un adaptador por proveedor): firma tuya, tipos tuyos, errores tuyos
  (`PaymentProviderDown`, no `GuzzleException` por toda la app). Facilita test (fake del adaptador) y cambio de proveedor.
- Circuit breaker simple si el proveedor es crítico: tras N fallos seguidos, corta X segundos y responde
  fallback (contador en Redis/caché basta; no hace falta librería).
- Loguea request-id del proveedor, latencia y status; NUNCA loguees API keys ni payloads con PII/tarjetas.

## Recibir webhooks
1. **Verifica la firma** (HMAC del proveedor: Stripe `Stripe-Signature`, etc.) con el secreto del entorno;
   rechaza sin firma válida ANTES de parsear. Verifica sobre el body CRUDO (no re-serializado).
2. **Responde 200 rápido y encola**: el handler valida firma → guarda evento → encola job → responde.
   Si tardas, el proveedor reintenta y duplica.
3. **Idempotencia por event id**: guarda el `event.id` procesado (tabla con UNIQUE); si llega repetido, 200 y
   no re-proceses. Los proveedores REENVÍAN eventos.
4. No confíes en el orden de llegada (puede llegar `payment.succeeded` antes que `payment.created`): decide por
   el estado actual del objeto (mejor aún: re-consulta al proveedor por API en el job y actúa sobre esa verdad).
5. Endpoint sin CSRF (es server-to-server) pero con firma; en local, túnel (`stripe listen`, ngrok) para probar.

## Emitir webhooks
- Firma HMAC con secreto por suscriptor + timestamp (rechazo de replays); documenta el esquema del payload.
- Envío desde cola con reintentos/backoff y baja automática tras N días fallando; log por entrega.
- Da al receptor un event id único para SU idempotencia.

## Pagos
- **Regla de oro: el número de tarjeta jamás toca tu servidor.** Checkout hospedado o elementos embebidos del
  proveedor (Stripe Checkout/Elements, Redsys redirección); tu backend solo ve tokens/ids. Así el alcance
  PCI queda en SAQ-A.
- **La verdad del pago llega por webhook**, no por la redirección del navegador (el usuario puede cerrar la
  pestaña tras pagar): el pedido se marca pagado en `checkout.session.completed`/notificación firmada, con
  idempotencia por event id.
- Guarda: id del proveedor, importe y moneda cobrados (verifícalos contra lo esperado — no confíes en el
  cliente), estado, y el snapshot de lo comprado. El importe se calcula SIEMPRE en servidor.
- Reembolsos/disputas: también por webhook; estados de pedido que los contemplen (`refunded`, `disputed`).
- Suscripciones: maneja al menos `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`;
  el acceso se corta por estado de suscripción en BD, sincronizado por webhooks.
- España: Redsys vía librería mantenida (verifica `Ds_Signature`); Bizum suele ir como método dentro de
  Redsys/Stripe. Ticket/factura según normativa (VeriFactu cuando aplique).

## Email transaccional
- Proveedor con API (Resend, Postmark, SES, Brevo) — no SMTP de hosting; SPF + DKIM + DMARC configurados o
  acabas en spam.
- Desde cola, con plantillas versionadas en el repo (mjml/blade/react-email) y texto plano alternativo.
- Idempotencia: un email por evento (marca `sent_at`); cuidado con reintentos de jobs que reenvían.
- Transaccional ≠ marketing: no mezcles remitentes ni listas; los transaccionales no llevan "darse de baja"
  obligatorio, los de marketing sí (y consentimiento RGPD).
- En dev/staging: trampa de correo (Mailpit/Mailtrap) SIEMPRE; enviar a clientes reales desde staging es un
  incidente clásico.

## Checklist
- [ ] Todo cliente externo: timeout + reintentos con backoff solo en transitorios + adaptador propio.
- [ ] Webhooks entrantes: firma sobre body crudo, 200 rápido + job, idempotencia por event id, sin fiarse del orden.
- [ ] Pagos: tarjeta nunca en tu servidor; importes calculados y verificados en servidor; verdad por webhook.
- [ ] Estados de reembolso/disputa/suscripción contemplados.
- [ ] Email: proveedor API + SPF/DKIM/DMARC, cola, plantillas en repo, trampa en no-producción.
- [ ] Ni claves ni PII en logs de integraciones.
