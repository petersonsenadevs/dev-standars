# Idempotencia

## Índice

- [Por qué importa](#por-qué-importa)
- [Tres niveles de idempotencia](#tres-niveles-de-idempotencia)
- [Claves de idempotencia en la API](#claves-de-idempotencia-en-la-api)
- [Idempotencia en handlers y agregados](#idempotencia-en-handlers-y-agregados)
- [Deduplicación de mensajes (inbox)](#deduplicación-de-mensajes-inbox)
- [Reintentos seguros](#reintentos-seguros)
- [Idempotencia hacia terceros](#idempotencia-hacia-terceros)
- [Ejemplos](#ejemplos)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `outbox-pattern.md`, `../application/transactions-unit-of-work.md`,
`messaging-and-queues.md`, `sagas-process-managers.md`.

## Por qué importa

Todo lo que puede repetirse se repetirá: el usuario hace doble clic, el cliente HTTP
reintenta tras un timeout cuya petición sí llegó, la cola reentrega tras un crash, el
relay de outbox publica dos veces, la saga reintenta un command. Sin idempotencia, cada
repetición es un cobro doble, un email duplicado o una línea de más.

Idempotente = ejecutar N veces produce el mismo estado (y, idealmente, la misma
respuesta) que ejecutarlo una vez.

## Tres niveles de idempotencia

| Nivel | Mecanismo | Protege contra |
|---|---|---|
| Natural (dominio) | la operación es idempotente por semántica: `issue()` sobre emitida es no-op o error; `setStatus(Paid)` | cualquier repetición, sin infraestructura |
| Clave de idempotencia (API) | el cliente envía `Idempotency-Key`; el servidor guarda clave -> respuesta | reintentos de cliente HTTP y doble clic |
| Inbox / dedupe de mensajes | tabla `processed_messages(consumer, message_id)` | reentrega de colas y outbox |

Usa el nivel natural siempre que el negocio lo permita; añade los otros dos donde la
operación no es naturalmente idempotente (crear, añadir línea, cobrar).

## Claves de idempotencia en la API

Para `POST` que crean recursos o disparan efectos:

- Cabecera `Idempotency-Key: <uuid>` generada por el cliente por intención (no por
  reintento). Los `PUT`/`DELETE` bien diseñados ya son idempotentes; los `POST` no.
- Tabla `idempotency_keys(key, actor_id, request_hash, status_code, response_body,
  created_at)` con clave única `(actor_id, key)`.
- Flujo: `INSERT` de la clave con estado `in_progress` **dentro de la transacción** del
  caso de uso; al terminar, guarda código y cuerpo. Si el `INSERT` choca: si hay
  respuesta guardada, devuélvela; si está `in_progress`, responde 409 "en curso".
- Compara `request_hash`: misma clave con payload distinto -> 422.
- TTL: 24 h suele bastar; job de limpieza.
- Es un adaptador driving (middleware HTTP) + un puerto `IdempotencyStore` si el handler
  lo necesita; no contamina el dominio.

```php
// Middleware Laravel (esquema)
public function handle(Request $r, Closure $next): Response
{
    $key = $r->header('Idempotency-Key'); if (!$key) return $next($r);
    $hash = hash('sha256', $r->getContent());
    $stored = $this->store->find($r->user()->id, $key);
    if ($stored && $stored->hash !== $hash) abort(422, 'Idempotency-Key reused with different payload');
    if ($stored?->response) return $stored->toResponse();
    if ($stored) abort(409, 'Request in progress');
    $this->store->start($r->user()->id, $key, $hash);
    $response = $next($r);
    $this->store->complete($r->user()->id, $key, $response->getStatusCode(), $response->getContent());
    return $response;
}
```

Para que la clave forme parte de la misma transacción que el efecto, el handler recibe
`idempotencyKey` en el command y el `IdempotencyStore` escribe dentro de
`DB::transaction`. El middleware puro es suficiente si aceptas una ventana pequeña.

## Idempotencia en handlers y agregados

- Comprueba el estado antes de mutar: `if ($this->status === Issued) return;` (no-op) o
  `throw AlreadyIssued` (error). Elige por semántica: no-op cuando el reintento es
  legítimo; error cuando indica bug del cliente. Documenta la elección en el método.
- Operaciones aditivas (`addLine`, `registerPayment`) necesitan identidad del elemento:
  `InvoiceLineId`/`PaymentId` generado por el cliente o derivado de la clave. Con
  identidad, repetir = mismo elemento = no-op.
- Contadores: `increment` no es idempotente; `set(value)` o `add(amount, byTransactionId)`
  con registro de ids sí.
- Commands llevan un `commandId` (uuid) cuando el adaptador es una cola o saga; el handler
  puede registrarlo en la inbox.

```ts
// Agregado: identidad del pago provista por el llamador -> repetir es no-op
registerPayment(payment: { id: PaymentId; amount: Money; at: Date }): Result<void, InvoiceError> {
  if (this.payments.some((p) => p.id.equals(payment.id))) return ok(undefined);   // ya registrado
  if (this.status !== 'issued') return err({ kind: 'NotIssued' });
  this.payments.push(payment);
  this.record(PaymentRegistered.from(this.id, payment));
  return ok(undefined);
}
```

## Deduplicación de mensajes (inbox)

```sql
CREATE TABLE processed_messages (
  consumer     VARCHAR(100) NOT NULL,     -- 'customers.balance_projector'
  message_id   UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, message_id)
);
```

Consumidor: en la misma transacción que el efecto, `INSERT` en `processed_messages`; si
viola la clave, salir sin hacer nada. Es la garantía real de "efectivamente una vez" por
consumidor sobre at-least-once. Limpieza tras 7-30 días (más que la retención del broker).

Un consumidor sin efectos en BD (envía email) no puede ser transaccionalmente
idempotente: usa `processed_messages` antes de enviar y acepta la ventana, o delega en
la idempotencia del proveedor (`Idempotency-Key` de Resend/SES).

## Reintentos seguros

| Fallo | Reintentar | Cómo |
|---|---|---|
| Timeout de red hacia un tercero | sí, con la misma clave de idempotencia del proveedor | backoff exponencial + jitter, máx. 3-5 |
| Deadlock / serialization failure | sí, transacción completa | inmediato, 2-3 veces |
| Error de validación / dominio (4xx) | no | dead-letter o descarte con log |
| Servicio caído (5xx, conexión rechazada) | sí, con backoff largo | circuit breaker si es sostenido |
| Mensaje malformado | no | dead-letter + alerta |

Regla: reintenta solo si la operación es idempotente en el receptor. Si no puedes
garantizarlo, no reintentes automáticamente; escala.

## Idempotencia hacia terceros

- Stripe, Adyen, Twilio, SES aceptan claves de idempotencia; genera la clave desde tu
  dominio (`payment:{paymentId}`), no aleatoria por intento, y guárdala con el agregado.
- Terceros sin soporte: consulta antes de crear (`GET by external_ref`), guarda el id
  externo en cuanto lo tengas (misma transacción o inmediatamente después), y reconcilia
  periódicamente.
- Webhooks entrantes: deduplica por `event.id` del proveedor en tu inbox; verifica firma;
  procesa por command idempotente.

## Ejemplos

**Python: consumidor con inbox**

```python
class OnInvoiceIssued:
    CONSUMER = "customers.balance"
    def __init__(self, uow: UnitOfWork): self._uow = uow
    def __call__(self, msg: Message) -> None:
        with self._uow as uow:
            if not uow.inbox.try_mark(self.CONSUMER, msg.id):   # INSERT ... ON CONFLICT DO NOTHING -> rowcount
                return
            balance = uow.balances.of_customer(CustomerId(msg.payload["customer_id"]))
            balance.add(Money(msg.payload["total_cents"], msg.payload["currency"]), InvoiceId(msg.payload["invoice_id"]))
            uow.balances.save(balance)
            uow.commit()
```

**TS: server action con clave generada en el cliente**

```ts
// Cliente: const key = useMemo(() => crypto.randomUUID(), []);  // una por formulario montado
export async function registerPaymentAction(input: unknown, idempotencyKey: string) {
  const parsed = RegisterPaymentSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  return container.registerPayment({ ...parsed.data, paymentId: PaymentId.fromKey(idempotencyKey).value, actorId: await currentUserId() });
}
```

`PaymentId.fromKey` deriva un UUID v5 determinista de la clave: el agregado obtiene
idempotencia natural sin tabla de claves.

## Errores frecuentes

- Clave de idempotencia generada por reintento (nueva en cada intento): inútil.
- Guardar la clave fuera de la transacción del efecto: ventana de duplicado.
- `increment()` en consumidores de eventos.
- Reintentar 4xx o mensajes malformados hasta el infinito.
- Confiar en "la cola entrega una vez" (ninguna lo garantiza end-to-end).
- Clave de idempotencia hacia Stripe aleatoria por intento: cobro doble.
- Deduplicar en memoria del worker (se pierde al reiniciar o con varias réplicas).
- Devolver 200 a un duplicado con una respuesta distinta a la original.

## Checklist

- [ ] Cada command tiene definida su semántica de repetición: no-op, error o dedupe.
- [ ] Operaciones aditivas llevan identidad del elemento provista por el llamador.
- [ ] `POST` con efectos aceptan `Idempotency-Key`; misma respuesta al repetir.
- [ ] Consumidores con tabla `processed_messages` en la misma transacción.
- [ ] Reintentos con backoff solo para fallos transitorios; dead-letter para el resto.
- [ ] Claves de idempotencia hacia terceros derivadas del dominio y persistidas.
- [ ] Webhooks deduplicados por id del proveedor.
- [ ] Limpieza de claves e inbox con TTL mayor que la retención del broker.
