# Recorrido completo: bounded context "Facturación"

## Índice
1. Brief de negocio
2. Glosario (lenguaje ubicuo)
3. Event storming resumido
4. Mapa de contextos
5. Diseño de agregados
6. Puertos
7. Casos de uso
8. Adaptadores
9. Tests por capa
10. Estructura de carpetas final y equivalentes TS/Python

---

## 1. Brief de negocio

"Necesitamos emitir facturas a clientes con varias líneas, numeración fiscal correlativa
por serie y año, registrar cobros (totales o parciales) que llegan por pasarela o
transferencia, y anular facturas emitidas generando una rectificativa. Una factura emitida
no se puede modificar. Contabilidad quiere enterarse de cada emisión y cobro."

Checklist de `SKILL.md` §1: invariantes reales, integración externa, vida > 1 año,
testear sin BD. Aplica DDD.

## 2. Glosario

| Término | Definición en Facturación | Sinónimo prohibido |
|---|---|---|
| Factura (Invoice) | Documento fiscal con líneas, emitido a un cliente | pedido, recibo |
| Borrador (Draft) | Factura aún editable, sin número | pendiente |
| Emitir (Issue) | Asignar número y fecha; pasa a inmutable | publicar, confirmar |
| Número de factura | Correlativo `AAAA-S-NNNNNN` por serie | id |
| Cobro (Payment) | Dinero recibido contra una factura | pago (ambiguo con Pagos) |
| Anular (Cancel) | Invalidar una emitida; requiere rectificativa | borrar |
| Rectificativa | Factura negativa que anula otra | abono, nota de crédito |
| Serie | Prefijo de numeración (A, R) | tipo |

## 3. Event storming resumido

| Comando | Agregado | Evento | Política (reacción) |
|---|---|---|---|
| CreateDraftInvoice | Invoice | InvoiceDrafted | - |
| AddInvoiceLine | Invoice | InvoiceLineAdded | - |
| IssueInvoice | Invoice + InvoiceSequence | InvoiceIssued | Enviar PDF por email; notificar a Contabilidad |
| RegisterPayment | Invoice | PaymentRegistered, InvoicePaid (si saldo 0) | Notificar a Contabilidad |
| CancelInvoice | Invoice (+ nueva Invoice rectificativa) | InvoiceCancelled | Emitir rectificativa; avisar a Pagos si había cobros |

Puntos calientes: numeración concurrente, cobro que supera el pendiente, anulación con
cobros. Cada uno se convierte en una invariante explícita.

## 4. Mapa de contextos

```
[Clientes] --(customer/supplier, published language: CustomerId + datos fiscales)--> [Facturación]
[Pagos]    --(ACL en Facturación: PaymentGateway)---------------------------------> [Facturación]
[Facturación] --(eventos InvoiceIssued/InvoicePaid v1)--> [Contabilidad] (conformist)
```

- Facturación guarda `CustomerId` y una copia de los datos fiscales en el momento de emitir
  (snapshot): si Clientes cambia la dirección, la factura emitida no cambia.
- Pagos es externo (Stripe/Redsys). Nada de `StripeCharge` en el dominio: puerto
  `PaymentGateway` + adaptador que traduce.
- Contabilidad consume eventos versionados; Facturación no sabe qué hace con ellos.

## 5. Diseño de agregados

**Invoice** (raíz): `InvoiceId`, `CustomerId`, `BillingSnapshot`, `InvoiceLine[]`,
`InvoiceStatus` (Draft, Issued, PartiallyPaid, Paid, Cancelled), `InvoiceNumber?`,
`Payment[]`, `issuedAt?`. Invariantes: solo Draft admite líneas; no se emite sin líneas;
un cobro no supera el pendiente; Cancelled es terminal.

**InvoiceSequence** (raíz aparte): `(Series, Year) -> last`. Es otro agregado porque su
consistencia (bloqueo por serie) no depende de una factura concreta.

**InvoiceLine** (entidad hija), **Money**, **InvoiceNumber**, **Series** (VO).
`Payment` dentro de Invoice es un VO (importe, fecha, referencia externa): no tiene ciclo
de vida propio en este contexto.

```php
// Domain/Model/Invoice.php (fragmento; base en templates/laravel/Domain/Model/Invoice.php)
public function registerPayment(Money $amount, DateTimeImmutable $at, string $reference): void
{
    if (!in_array($this->status, [InvoiceStatus::Issued, InvoiceStatus::PartiallyPaid], true)) {
        throw PaymentNotAllowed::forStatus($this->id, $this->status);
    }
    if ($amount->greaterThan($this->outstanding())) {
        throw PaymentNotAllowed::exceedsOutstanding($this->id, $amount, $this->outstanding());
    }
    $this->payments[] = new Payment($amount, $at, $reference);
    $this->record(new PaymentRegistered($this->id->value, $amount, $at, $reference));
    if ($this->outstanding()->isZero()) {
        $this->status = InvoiceStatus::Paid;
        $this->record(new InvoicePaid($this->id->value, $this->number->value, $at));
    } else {
        $this->status = InvoiceStatus::PartiallyPaid;
    }
}

public function cancel(InvoiceId $creditNoteId, DateTimeImmutable $at): Invoice
{
    if ($this->status === InvoiceStatus::Cancelled) throw InvoiceCannotBeCancelled::alreadyCancelled($this->id);
    if ($this->status === InvoiceStatus::Draft) throw InvoiceCannotBeCancelled::isDraft($this->id);
    $this->status = InvoiceStatus::Cancelled;
    $this->record(new InvoiceCancelled($this->id->value, $this->number->value, $at, $this->paid()));
    return Invoice::creditNoteFor($this, $creditNoteId); // nueva raíz, serie R, líneas negadas
}
```

`cancel()` devuelve un segundo agregado que el caso de uso guarda en la misma transacción:
excepción aceptada a "un agregado por transacción", documentada en ADR (`templates/docs/adr.md`).

## 6. Puertos

| Puerto | Tipo | Dónde | Implementación |
|---|---|---|---|
| `InvoiceRepository` | driven | Domain/Repository | Eloquent |
| `InvoiceSequenceRepository` | driven | Domain/Repository | Eloquent con `lockForUpdate` |
| `CustomerBillingData` | driven (ACL a Clientes) | Application/Port | consulta al módulo Customers |
| `PaymentGateway` | driven (ACL a Pagos) | Application/Port | Stripe SDK |
| `Clock`, `EventBus` | driven | Application/Port | SystemClock, LaravelEventBus |
| `PendingInvoicesReader`, `InvoiceDetailReader` | read model | Application/Query | query builder |
| Casos de uso | driving | Application/* | controladores, jobs, listeners |

```php
// Application/Port/PaymentGateway.php — habla en VO propios, no en tipos de Stripe
interface PaymentGateway
{
    public function charge(InvoiceId $invoice, Money $amount, PaymentMethodToken $token): PaymentReceipt;
}
```

## 7. Casos de uso

`IssueInvoice` está en `templates/laravel/Application/IssueInvoice/`. Los otros dos:

```php
final class RegisterPaymentHandler
{
    // constructor: InvoiceRepository $invoices, PaymentGateway $gateway, EventBus $events, Clock $clock

    public function __invoke(RegisterPaymentCommand $c): void
    {
        $invoice = $this->invoices->ofId(InvoiceId::of($c->invoiceId)) ?? throw InvoiceNotFound::withId($c->invoiceId);
        $amount = new Money($c->amountCents, $invoice->currency());
        // IO externo ANTES de la transacción: si falla el cobro, no hay nada que deshacer
        $receipt = $c->methodToken !== null
            ? $this->gateway->charge($invoice->id, $amount, PaymentMethodToken::of($c->methodToken))
            : PaymentReceipt::manual($c->reference);
        DB::transaction(function () use ($invoice, $amount, $receipt) {
            $invoice->registerPayment($amount, $this->clock->now(), $receipt->reference);
            $this->invoices->save($invoice);
        });
        $this->events->publish(...$invoice->pullEvents());
    }
}
```

```php
final class CancelInvoiceHandler
{
    public function __invoke(CancelInvoiceCommand $c): InvoiceNumber
    {
        $invoice = $this->invoices->ofId(InvoiceId::of($c->invoiceId)) ?? throw InvoiceNotFound::withId($c->invoiceId);
        $now = $this->clock->now();
        $creditNote = DB::transaction(function () use ($invoice, $now) {
            $creditNote = $invoice->cancel($this->invoices->nextId(), $now);
            $creditNote->issue($this->sequences->next(Series::rectifying(), $now), $now);
            $this->invoices->save($invoice);
            $this->invoices->save($creditNote);
            return $creditNote;
        });
        $this->events->publish(...$invoice->pullEvents(), ...$creditNote->pullEvents());
        return $creditNote->number();
    }
}
```

En los tres: cargar, mutar en el agregado, guardar en transacción, publicar fuera.

## 8. Adaptadores

- **HTTP/Inertia** (`Infrastructure/Http`): `RegisterPaymentController` valida forma con
  Form Request (`amount_cents: required|integer|min:1`), construye el command con
  `$request->user()->id` como `actorId`, invoca el handler, `redirect()->back()`.
  `PaymentNotAllowed` -> 422 en el handler global de excepciones.
- **Eloquent** (`Infrastructure/Persistence/Eloquent`): `InvoiceModel` con `lines()` y
  `payments()`; `InvoiceMapper::toDomain` llama a `Invoice::reconstitute`. La secuencia:
  `InvoiceSequenceModel::where(...)->lockForUpdate()->first()` dentro de la transacción.
- **Cola**: `SendInvoicePdfListener implements ShouldQueue` (`afterCommit = true`) escucha
  `InvoiceIssued`, carga el read model `InvoiceDetailReader` y envía el email. Ningún
  listener llama a otro caso de uso de escritura de este contexto.
- **Pasarela con ACL**: `StripePaymentGateway implements PaymentGateway`; traduce
  `PaymentIntent` a `PaymentReceipt`, y `CardException` a `PaymentDeclined` (excepción
  de aplicación). El webhook de Stripe es otro adaptador driving que construye
  `RegisterPaymentCommand` con `methodToken = null` y `reference = $event->id`
  (idempotente por referencia: el agregado rechaza un cobro con referencia repetida).

## 9. Tests por capa

| Capa | Test | Ejemplo |
|---|---|---|
| Domain (Pest, sin TestCase) | invariantes | cobro que excede el pendiente lanza `PaymentNotAllowed`; cobro exacto pasa a `Paid` y registra `InvoicePaid`; `cancel()` devuelve rectificativa con total negado |
| Application (fakes) | orquestación | `RegisterPaymentHandler` con `InMemoryInvoiceRepository`, `FakePaymentGateway`, `RecordingEventBus`: guarda y publica; si la pasarela lanza, no guarda ni publica |
| Infrastructure (RefreshDatabase) | mapeo y locks | `save` + `ofId` devuelve el mismo agregado con pagos; dos `next()` concurrentes no repiten número |
| Feature (HTTP fino) | contrato | `POST /invoices/{id}/payments` con importe excesivo -> 422 y `error: payment_exceeds_outstanding` |
| Contract | ACL | `StripePaymentGateway` contra respuesta grabada mapea a `PaymentReceipt` |

## 10. Estructura de carpetas final y equivalentes

```
src/Invoicing/
  Domain/
    Model/          Invoice.php, InvoiceLine.php, InvoiceStatus.php, InvoiceSequence.php, Payment.php
    ValueObject/    Money.php, InvoiceId.php, InvoiceNumber.php, Series.php, BillingSnapshot.php
    Event/          InvoiceIssued.php, PaymentRegistered.php, InvoicePaid.php, InvoiceCancelled.php
    Repository/     InvoiceRepository.php, InvoiceSequenceRepository.php
    Exception/      InvoiceCannotBeIssued.php, PaymentNotAllowed.php, InvoiceCannotBeCancelled.php, InvoiceNotFound.php
  Application/
    IssueInvoice/     IssueInvoiceCommand.php, IssueInvoiceHandler.php
    RegisterPayment/  RegisterPaymentCommand.php, RegisterPaymentHandler.php
    CancelInvoice/    CancelInvoiceCommand.php, CancelInvoiceHandler.php
    Port/             Clock.php, EventBus.php, PaymentGateway.php, CustomerBillingData.php
    Query/            PendingInvoicesReader.php, InvoiceDetailReader.php, InvoiceRow.php
  Infrastructure/
    Persistence/Eloquent/   InvoiceModel.php, InvoiceLineModel.php, PaymentModel.php, EloquentInvoiceRepository.php, InvoiceMapper.php
    Persistence/Query/      DbPendingInvoicesReader.php, DbInvoiceDetailReader.php
    Http/                   IssueInvoiceController.php, RegisterPaymentController.php, CancelInvoiceController.php, StripeWebhookController.php
    Listeners/              SendInvoicePdfListener.php
    Payment/                StripePaymentGateway.php
    Acl/                    CustomersModuleBillingData.php
    Providers/              InvoicingServiceProvider.php
```

| Laravel | TypeScript (`templates/typescript/`) | Python (`templates/python/`) |
|---|---|---|
| `Domain/Model/Invoice.php` | `domain/Invoice.ts` (Result en vez de excepciones) | `domain/invoice.py` |
| `Domain/ValueObject/Money.php` | `domain/Money.ts` | `domain/money.py` |
| `Domain/Repository/InvoiceRepository.php` | `domain/InvoiceRepository.ts` | `domain/ports.py` (Protocol) |
| `Application/IssueInvoice/*Handler.php` | `application/issueInvoice.ts` (función con deps) | `application/issue_invoice.py` (callable + UoW) |
| `Infrastructure/Persistence/Eloquent/*` | `infrastructure/PrismaInvoiceRepository.ts` | `infrastructure/sqlalchemy_invoice_repository.py` |
| `Infrastructure/Http/*Controller.php` | `app/actions/issueInvoice.ts` (Server Action) | `infrastructure/api.py` (router FastAPI) |
| `Providers/InvoicingServiceProvider.php` | `infrastructure/container.ts` | `infrastructure/deps.py` |
| `deptrac.yaml` | `.dependency-cruiser.cjs` | `.importlinter` |

Los casos de uso nuevos se derivan de las plantillas cambiando el command y el método
del agregado invocado; la forma del handler no cambia. Tests base:
`templates/laravel/tests/Unit/Domain/InvoiceTest.php` y `references/testing/overview.md`.
