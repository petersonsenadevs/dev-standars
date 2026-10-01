# Sagas y process managers

## Índice

- [Qué problema resuelven](#qué-problema-resuelven)
- [Coreografía vs orquestación](#coreografía-vs-orquestación)
- [El process manager como agregado](#el-process-manager-como-agregado)
- [Timeouts y pasos que no responden](#timeouts-y-pasos-que-no-responden)
- [Compensación](#compensación)
- [Ejemplo: pedido -> pago -> envío](#ejemplo-pedido---pago---envío)
- [Implementación por stack](#implementación-por-stack)
- [Observabilidad y operación](#observabilidad-y-operación)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `eventual-consistency.md`, `outbox-pattern.md`, `idempotency.md`,
`messaging-and-queues.md`.

## Qué problema resuelven

Un proceso de negocio que atraviesa varios agregados o contextos y **dura más que una
transacción**: confirmar pedido, cobrar, reservar stock, preparar envío. Cada paso es un
caso de uso con su transacción; el proceso necesita saber en qué paso va, qué hacer si un
paso falla y qué hacer si nadie responde.

Una saga es esa secuencia de transacciones locales con compensaciones. El process manager
es el componente que la coordina cuando hay orquestación.

## Coreografía vs orquestación

| | Coreografía | Orquestación |
|---|---|---|
| Mecanismo | cada contexto reacciona a eventos y emite los suyos | un process manager recibe eventos y envía commands |
| Estado del proceso | implícito, repartido | explícito, en una tabla |
| Acoplamiento | bajo entre contextos; alto hacia el flujo global | contextos ignoran el flujo; el PM los conoce todos |
| Trazabilidad | difícil ("¿por qué no se envió?") | fácil: una fila con el estado |
| Cambiar el flujo | tocar varios contextos | tocar el PM |
| Cuándo | 2-3 pasos, sin compensaciones ni timeouts | > 3 pasos, compensaciones, timeouts, necesidad de "ver dónde está" |

Regla práctica: empieza con coreografía para reacciones simples (factura emitida ->
email). En cuanto aparezca "si falla X hay que deshacer Y" o "si en 15 minutos no ha
llegado Z", pasa a orquestación.

## El process manager como agregado

El PM **es un agregado** del contexto que posee el proceso (normalmente el que lo inicia:
`Sales` para el pedido). Tiene id (`OrderFulfillmentId` o el `OrderId`), estado, versión,
y transiciones con invariantes. No contiene lógica de los otros contextos: solo decide
**qué command enviar a continuación** según el evento recibido.

```
tabla order_fulfillments
  order_id | state | payment_ref | shipment_ref | started_at | updated_at | version | timeout_at
  estados: Started -> PaymentRequested -> Paid -> StockReserved -> ShipmentRequested -> Completed
                                     \-> PaymentFailed -> Cancelled
                    Paid -> StockUnavailable -> RefundRequested -> Refunded -> Cancelled
```

Cada transición: cargar PM (con lock), aplicar evento, persistir nuevo estado, escribir
en outbox los commands/eventos siguientes. Misma transacción; misma disciplina que
cualquier agregado. Idempotente por `message_id` (`idempotency.md`).

Los commands hacia otros contextos viajan como mensajes (`ReservePayment`,
`ReserveStock`) o como llamadas directas a casos de uso si es un monolito y aceptas el
acoplamiento in-process (más simple; sigue siendo orquestación).

## Timeouts y pasos que no responden

Un evento que no llega no dispara nada: el PM necesita **relojes**.

- Al enviar un command, el PM registra `timeout_at`. Un job periódico (`sagas:check-timeouts`)
  busca PMs con `timeout_at < now()` y les entrega un evento sintético `StepTimedOut(step)`.
- Alternativa: mensaje diferido en la cola (BullMQ `delay`, Laravel `->delay()`) que
  al llegar pregunta al PM si el paso sigue pendiente. Elegante, pero el estado de
  "timer pendiente" vive en el broker; el job periódico es más robusto.
- Ante timeout: reintentar el command (idempotente), escalar a revisión humana o
  compensar. Cada paso define su política y su número máximo de reintentos.
- Timeouts de negocio (reserva de stock expira en 30 min) son eventos de dominio del
  otro contexto (`ReservationExpired`), no timeouts del PM.

## Compensación

Compensar = ejecutar la acción de negocio inversa de los pasos ya completados, en orden
inverso. Reglas:

- Cada paso compensable tiene su command inverso definido antes de implementar el paso.
- La compensación puede fallar: se reintenta; si falla permanentemente, estado
  `CompensationFailed` + alerta + revisión humana. No hay "rollback de la compensación".
- Pasos **pivote** (irreversibles: envío físico, email al cliente) van los últimos; tras
  el pivote no se compensa, se sigue adelante con reintentos.
- Los pasos de solo lectura o idempotentes no necesitan compensación.

## Ejemplo: pedido -> pago -> envío

```
OrderConfirmed  -> PM: Started -> envía RequestPayment(orderId, amount)         [timeout 10 min]
PaymentSucceeded -> PM: Paid -> envía ReserveStock(orderId, lines)              [timeout 5 min]
PaymentFailed    -> PM: Cancelled -> envía CancelOrder(reason)
StockReserved    -> PM: StockReserved -> envía RequestShipment(orderId, address) [pivote]
StockUnavailable -> PM: RefundRequested -> envía RefundPayment(paymentRef)
PaymentRefunded  -> PM: Cancelled -> envía CancelOrder('stock')
ShipmentRequested -> PM: Completed
StepTimedOut(payment) -> reintento x2 -> Cancelled
```

```php
// Sales/Domain/Fulfillment/OrderFulfillment.php (agregado PM)
final class OrderFulfillment extends AggregateRoot
{
    public static function start(OrderId $id, Money $total, \DateTimeImmutable $now): self
    {
        $pm = new self($id, FulfillmentState::Started);
        $pm->send(new RequestPayment($id, $total), $now->modify('+10 minutes'));
        return $pm;
    }

    public function onPaymentSucceeded(PaymentReference $ref, array $lines, \DateTimeImmutable $now): void
    {
        $this->assertState(FulfillmentState::Started);
        $this->paymentRef = $ref;
        $this->transitionTo(FulfillmentState::Paid);
        $this->send(new ReserveStock($this->id, $lines), $now->modify('+5 minutes'));
    }

    public function onStockUnavailable(): void
    {
        $this->assertState(FulfillmentState::Paid);
        $this->transitionTo(FulfillmentState::RefundRequested);
        $this->send(new RefundPayment($this->paymentRef), null);     // compensación
    }

    private function send(object $command, ?\DateTimeImmutable $timeoutAt): void
    {
        $this->pendingCommands[] = $command; $this->timeoutAt = $timeoutAt;
    }
    /** @return object[] */ public function pullCommands(): array { [$c, $this->pendingCommands] = [$this->pendingCommands, []]; return $c; }
}
```

El handler `HandleFulfillmentEvent` carga el PM con lock, llama al método `onX`, guarda,
y escribe `pullCommands()` en la outbox. Nada más.

## Implementación por stack

- **Laravel**: PM como agregado en `Sales/Domain`; handler como listener en cola con
  `afterCommit`; commands salientes via outbox o `Bus::dispatch` de jobs (menos garantía);
  timeouts con `schedule()->everyMinute()` sobre `timeout_at`. No hace falta librería.
- **TypeScript**: PM como clase de dominio; consumidor BullMQ por tipo de evento; commands
  salientes como jobs con `jobId` determinista (`fulfillment:{orderId}:reserve-stock`)
  para deduplicar; timeouts con job repetible o `delay`. Temporal.io solo si hay decenas
  de flujos largos y el equipo asume su infraestructura.
- **Python**: igual; arq/Celery; `with_for_update` al cargar el PM. Librerías de sagas
  no necesarias.

Tests: el PM se prueba como agregado puro: dado estado + evento -> nuevo estado +
commands emitidos. Sin colas, sin BD.

## Observabilidad y operación

- Tabla del PM = panel de estado: `SELECT state, COUNT(*) ... GROUP BY state` y edad por
  estado. Alerta si hay PMs en un estado intermedio más de X.
- `correlation_id` = `order_id` en todos los mensajes del flujo; `causation_id` = id del
  mensaje que provocó cada uno. Búsqueda en logs por correlación.
- Comando admin para forzar transición o reintentar (`fulfillment:retry {orderId}`), con
  auditoría.
- Métrica de negocio: tiempo de `Started` a `Completed`, tasa de `Cancelled` por causa.

## Errores frecuentes

- Coreografía con 6 pasos y compensaciones: nadie sabe por qué un pedido está atascado.
- PM con lógica de otros contextos (calcula el precio o decide stock).
- Sin timeouts: procesos zombis para siempre.
- Compensación como `DELETE`/`rollback` en vez de acción de negocio.
- PM no idempotente: el mismo `PaymentSucceeded` llega dos veces y reserva stock dos veces.
- Pivote irreversible en medio del flujo (email "pedido confirmado" antes de reservar stock).
- Adoptar Temporal/Step Functions para un flujo de tres pasos.
- Llamar a servicios externos dentro de la transacción del PM.

## Checklist

- [ ] Coreografía solo para reacciones simples; orquestación con PM para flujos con compensación/timeouts.
- [ ] PM modelado como agregado con estados, versión y tests unitarios.
- [ ] Cada paso: command, evento de éxito, evento de fallo, compensación, timeout y política de reintento.
- [ ] Pasos irreversibles al final.
- [ ] Handlers del PM idempotentes por `message_id`; commands salientes por outbox.
- [ ] Job de timeouts y comando admin de reintento.
- [ ] `correlation_id` y `causation_id` en todos los mensajes; panel por estado.
