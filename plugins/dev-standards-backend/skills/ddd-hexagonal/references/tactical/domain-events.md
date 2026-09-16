# Eventos de dominio

## Índice

- [Qué es y qué no es un evento de dominio](#qué-es-y-qué-no-es-un-evento-de-dominio)
- [Nombrado y forma](#nombrado-y-forma)
- [Contenido: ids más lo estrictamente necesario](#contenido-ids-más-lo-estrictamente-necesario)
- [Registrar en el agregado, publicar tras el commit](#registrar-en-el-agregado-publicar-tras-el-commit)
- [Handlers idempotentes](#handlers-idempotentes)
- [Síncrono vs asíncrono](#síncrono-vs-asíncrono)
- [Eventos de dominio vs eventos de integración](#eventos-de-dominio-vs-eventos-de-integración)
- [Versionado básico](#versionado-básico)
- [Testing](#testing)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza el §7 de [overview-concepts](overview-concepts.md). Se apoya en
[aggregates.md](aggregates.md) (dónde nacen los eventos) y en
[../strategic/context-mapping.md](../strategic/context-mapping.md) (published language).

## Qué es y qué no es un evento de dominio

Un evento de dominio es un **hecho de negocio que ya ocurrió** y que a alguien del negocio
le importa: "factura emitida", "pago recibido", "pedido cancelado". Lo emite un agregado
como consecuencia de un comando que tuvo éxito.

No es un evento de dominio:
- Un cambio técnico (`RowUpdated`, `CacheInvalidated`, `UserEntitySaved`).
- Una intención (`SendInvoiceEmail`): eso es un comando; el evento es lo que ya pasó.
- Un CRUD disfrazado (`InvoiceUpdated` con el objeto entero). Si el negocio no tiene un
  verbo para ello, probablemente no es un evento.

Prueba rápida: ¿aparecería como post-it naranja en un event storming? Si no, no lo modeles.

## Nombrado y forma

- **Sustantivo + verbo en pasado**: `InvoiceIssued`, `OrderLineRemoved`, `PaymentFailed`.
  Prefijo con el agregado, no con el contexto (`Invoicing\InvoiceIssued` vía namespace).
- **Inmutable**: todas las propiedades `readonly`; sin setters; sin métodos que muten.
- **Serializable a datos planos**: ids como string/int, fechas ISO-8601, importes como
  enteros + moneda. Nada de entidades ni objetos del ORM dentro.
- **Metadatos comunes**: `eventId` (UUID, para deduplicar), `occurredOn`, `aggregateId`,
  y opcionalmente `correlationId`/`causationId` para trazabilidad.

```php
// Domain/Event/InvoiceIssued.php
final readonly class InvoiceIssued implements DomainEvent
{
    public function __construct(
        public string $eventId,
        public string $invoiceId,
        public string $customerId,
        public int $totalCents,
        public string $currency,
        public \DateTimeImmutable $occurredOn,
    ) {}

    public static function now(Invoice $invoice, Clock $clock): self { /* ... */ }
    public function aggregateId(): string { return $this->invoiceId; }
}
```

## Contenido: ids más lo estrictamente necesario

Regla: el evento lleva **los ids implicados** y **los datos que un consumidor razonable
necesita sin volver a consultar** (importe, fecha, estado nuevo). No lleva el agregado
completo ni datos que otro contexto no debería conocer.

| Incluir | Excluir |
|---|---|
| `invoiceId`, `customerId`, `total`, `issuedAt` | líneas completas, dirección fiscal, notas internas |
| estado resultante (`status: issued`) | estado anterior salvo que sea parte del hecho |
| el dato que motivó el hecho (`reason` en una cancelación) | datos derivables por el consumidor |

Si dos consumidores necesitan conjuntos muy distintos, emite dos eventos (uno por hecho)
antes que un evento gordo.

## Registrar en el agregado, publicar tras el commit

El agregado **registra** (no publica): acumula en una lista privada. El caso de uso o el
Unit of Work **publica** cuando la transacción se ha confirmado. Así un fallo de commit
nunca deja un email enviado ni un evento fantasma en el bus.

```ts
// domain/AggregateRoot.ts
export abstract class AggregateRoot {
  private pending: DomainEvent[] = [];
  protected record(event: DomainEvent): void { this.pending.push(event); }
  pullEvents(): DomainEvent[] { const e = this.pending; this.pending = []; return e; }
}

// domain/Invoice.ts
issue(now: Date): void {
  if (this.lines.length === 0) throw new InvoiceCannotBeIssued(this.id);
  this.status = 'issued';
  this.record(new InvoiceIssued({ invoiceId: this.id.value, total: this.total().toJSON(), occurredOn: now }));
}
```

Tres estrategias de publicación, de más simple a más robusta:

1. **Handler publica tras `save`** (in-process, síncrono o cola): suficiente cuando
   perder un evento ante un crash entre commit y publish es tolerable.
2. **`afterCommit` del framework**: Laravel `DB::afterCommit(fn () => ...)` o
   `ShouldDispatchAfterCommit`; Prisma/TypeORM: publicar tras resolver `$transaction`.
3. **Outbox**: el evento se inserta en una tabla `outbox` **dentro** de la misma
   transacción; un worker lo lee y lo publica al bus, marcándolo como enviado. Es la única
   opción con garantía "al menos una vez". Úsala para eventos de integración (ver más abajo).

```php
// Application/IssueInvoiceHandler.php (Laravel, outbox)
DB::transaction(function () use ($invoice) {
    $this->invoices->save($invoice);
    $this->outbox->append(...$invoice->pullEvents());   // misma transacción
});
// Worker: php artisan outbox:relay -> lee pendientes, publica, marca published_at
```

## Handlers idempotentes

Con "al menos una vez" un handler **verá el mismo evento dos veces**. Diseña cada handler
para que la segunda ejecución no tenga efecto:

- **Operación natural idempotente**: `markAsPaid` sobre una factura ya pagada no hace nada.
- **Tabla de procesados**: `processed_events(event_id, handler)` con clave única; insertar
  antes de actuar, en la misma transacción que el efecto local.
- **Claves de idempotencia hacia fuera**: al llamar a Stripe/SendGrid, pasa `eventId`
  como `Idempotency-Key`.

```python
# application/policies/draft_invoice_on_order_confirmed.py
class DraftInvoiceOnOrderConfirmed:
    def __call__(self, event: OrderConfirmed) -> None:
        with self.uow:
            if self.processed.contains(event.event_id, handler=type(self).__name__):
                return                                   # ya visto: salir sin efecto
            if self.invoices.exists_for_order(OrderId(event.order_id)):
                return                                   # idempotencia por regla de negocio
            self.invoices.save(Invoice.draft_for_order(...))
            self.processed.mark(event.event_id, handler=type(self).__name__)
            self.uow.commit()
```

## Síncrono vs asíncrono

| Modo | Cuándo | Riesgo |
|---|---|---|
| **Síncrono in-process** (mismo request, tras commit) | el efecto es rápido, local y el usuario espera verlo (actualizar un read model) | latencia acumulada; un handler roto rompe el request |
| **Asíncrono in-process** (cola: Laravel jobs, BullMQ, Celery) | IO externo (email, webhooks), efectos lentos, efectos en otro módulo | consistencia eventual: la UI debe tolerar "todavía no" |
| **Asíncrono entre procesos** (Rabbit, SQS, Kafka) | otro servicio consume | contrato público, versionado, outbox obligatorio |

Regla: un handler **nunca** hace IO externo dentro de la transacción del comando. Dos
agregados no se modifican en el mismo handler de comando: el segundo se actualiza en
reacción al evento del primero (consistencia eventual; ver [aggregates.md](aggregates.md)).

## Eventos de dominio vs eventos de integración

| | Evento de dominio | Evento de integración |
|---|---|---|
| Audiencia | el propio contexto (módulo) | otros contextos o servicios |
| Forma | clase del dominio, tipos ricos permitidos (VO) | published language: JSON plano con esquema versionado |
| Estabilidad | puede cambiar con el modelo | contrato público; cambios compatibles o nueva versión |
| Transporte | in-process | outbox + bus |

Traduce explícitamente: un handler interno escucha `InvoiceIssued` (dominio) y publica
`invoicing.invoice-issued.v1` (integración). Nunca expongas la clase del dominio a otro
contexto: acopla su modelo al tuyo (ver [../strategic/context-mapping.md](../strategic/context-mapping.md)).

```ts
// infrastructure/integration/PublishInvoiceIssued.ts
export const publishInvoiceIssued = (bus: IntegrationBus) => async (e: InvoiceIssued) =>
  bus.publish('invoicing.invoice-issued.v1', {
    eventId: e.eventId, invoiceId: e.invoiceId, customerId: e.customerId,
    total: { amount: e.total.amount, currency: e.total.currency }, occurredOn: e.occurredOn.toISOString(),
  });
```

## Versionado básico

- El nombre del evento de integración lleva versión: `invoice-issued.v1`. Añadir campos
  opcionales no cambia versión; renombrar, quitar o cambiar semántica sí (`v2`).
- Publica `v1` y `v2` en paralelo mientras haya consumidores de `v1`; retira `v1` con fecha.
- Guarda el esquema (JSON Schema o tipo TS exportado) en el módulo emisor y valida en tests
  de contrato que lo publicado cumple el esquema.
- Los eventos de dominio internos no se versionan: se refactorizan con el código. Si haces
  event sourcing, eso cambia (upcasters); fuera del alcance de este documento.

## Testing

- **Agregado**: tras ejecutar el método, `pullEvents()` contiene exactamente el evento
  esperado con los datos esperados. Es la mejor forma de testear comportamiento.
- **Handler**: dado un evento, produce el efecto; dado el mismo evento dos veces, el
  efecto ocurre una vez.
- **Caso de uso**: con un `EventBus` en memoria, comprueba que se publica tras `save` y
  que no se publica si `save` lanza.

```php
public function test_issuing_records_invoice_issued(): void
{
    $invoice = InvoiceBuilder::draft()->withLine(Money::eur(1000))->build();
    $invoice->issue(new \DateTimeImmutable('2026-01-10'));
    $events = $invoice->pullEvents();
    self::assertCount(1, $events);
    self::assertInstanceOf(InvoiceIssued::class, $events[0]);
    self::assertSame(1000, $events[0]->totalCents);
    self::assertSame([], $invoice->pullEvents()); // se vacía al extraer
}
```

## Errores frecuentes

- **Publicar desde el agregado** (inyectar el bus en la entidad): mezcla IO en el dominio y
  publica antes del commit.
- **Eventos con la entidad dentro**: no serializa, filtra datos y acopla consumidores al modelo.
- **Usar eventos de dominio para flujo síncrono obligatorio**: si el comando no puede tener
  éxito sin el efecto, no es un evento, es parte del caso de uso.
- **`InvoiceUpdated` genérico**: los consumidores acaban inspeccionando diffs; emite hechos.
- **Handlers no idempotentes con colas con reintento**: emails duplicados, cargos duplicados.
- **Un handler que modifica tres agregados**: rompe la regla de transacción por agregado.
- **Exponer la clase de dominio al bus externo**: cada refactor rompe a los consumidores.
- **Olvidar `occurredOn` y `eventId`**: imposible ordenar, deduplicar ni depurar.

## Checklist

- [ ] Nombre en pasado, prefijado por el agregado, sin verbos técnicos.
- [ ] Clase inmutable (`readonly`), serializable a primitivos, con `eventId` y `occurredOn`.
- [ ] Contenido = ids + datos necesarios; sin entidades ni datos ajenos al hecho.
- [ ] El agregado registra; el handler/UoW publica tras el commit.
- [ ] Eventos de integración vía outbox y con nombre versionado (`*.v1`).
- [ ] Ningún handler hace IO externo dentro de la transacción del comando.
- [ ] Cada handler es idempotente (regla de negocio o tabla `processed_events`).
- [ ] Traducción explícita dominio -> integración; el esquema público está documentado.
- [ ] Tests: el agregado emite el evento esperado; el handler tolera duplicados.
