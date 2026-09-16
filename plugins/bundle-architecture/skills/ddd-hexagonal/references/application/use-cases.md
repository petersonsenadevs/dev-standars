# Casos de uso (servicios de aplicación)

## Índice

- [Qué es y qué no es un caso de uso](#qué-es-y-qué-no-es-un-caso-de-uso)
- [Anatomía: input, orquestación, salida](#anatomía-input-orquestación-salida)
- [Naming y granularidad](#naming-y-granularidad)
- [Transacción, autorización y logging](#transacción-autorización-y-logging)
- [Ejemplo PHP (Laravel)](#ejemplo-php-laravel)
- [Ejemplo TypeScript (Node/Next)](#ejemplo-typescript-nodenext)
- [Resultado: excepciones vs Result](#resultado-excepciones-vs-result)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../tactical/overview-concepts.md` §6 y §14, `commands-queries-cqrs.md`,
`transactions-unit-of-work.md`, `authorization.md`.

## Qué es y qué no es un caso de uso

Un caso de uso es **una intención de usuario o sistema**: "emitir factura", "cancelar
pedido", "registrar pago". Es el puerto driving de la aplicación: cualquier adaptador
(HTTP, CLI, job, server action, listener) lo invoca con un command o query y no sabe nada
más.

| Es | No es |
|---|---|
| Una clase/función por acción, con un único método público | Un `InvoiceService` con 15 métodos |
| Orquestación: cargar, delegar al dominio, guardar, publicar | Lugar de reglas de negocio (`if ($invoice->total > 1000)`) |
| Dependiente solo de puertos (interfaces) | Cliente directo de Eloquent, Prisma, Mail, SDKs |
| Testeable con fakes en memoria, sin framework | Algo que necesita HTTP request o contenedor para probarse |

Regla rápida: si al leer el handler entiendes **qué** ocurre en el negocio pero no **cómo**
se calcula nada, está bien. Si ves aritmética, comparaciones de estado o construcción de
emails, esa lógica pertenece al agregado, a un servicio de dominio o a un adaptador.

## Anatomía: input, orquestación, salida

```
Command/Query DTO  -->  Handler  -->  void | DTO de salida | Result
                         |
                         +-- carga agregados (repositorio)
                         +-- llama a métodos de dominio
                         +-- guarda (dentro de transacción)
                         +-- publica eventos (tras commit)
```

- **Input**: un DTO plano e inmutable, con primitivos o VO ya validados en forma. El
  adaptador driving lo construye; el handler no lee `Request`, `argv` ni `process.env`.
- **Orquestación**: máximo 10-15 líneas. Si crece, o hay un servicio de dominio escondido
  o el caso de uso hace dos cosas.
- **Salida**: `void` para commands que no necesitan devolver nada (el adaptador responde
  202/redirect); un DTO plano cuando el cliente necesita el id creado o un resumen. Nunca
  un agregado ni un modelo de persistencia.

## Naming y granularidad

- Verbo + sustantivo en imperativo: `IssueInvoice`, `RegisterPayment`, `ArchiveProject`.
- Un caso de uso por transición de estado relevante. `UpdateInvoice` que acepta 12 campos
  opcionales es una señal de CRUD disfrazado: o bien es CRUD (y no necesita módulo, ver
  `../stacks/laravel/overview.md` §12) o bien se descompone en `ChangeDueDate`,
  `AddInvoiceLine`, etc.
- Nombres de archivo por stack: `IssueInvoiceHandler.php` + `IssueInvoiceCommand.php`
  en la carpeta `Application/IssueInvoice/`; `issueInvoice.ts` exportando la factoría y el
  tipo `IssueInvoiceCommand`; `issue_invoice.py` con `IssueInvoice` y `IssueInvoiceCommand`.
- Queries: `ListPendingInvoices`, `GetInvoiceDetail`, `SearchCustomers`. Devuelven read
  models, no agregados (ver `read-models-projections.md`).

## Transacción, autorización y logging

Estas tres responsabilidades son transversales y hay dos formas válidas de colocarlas:

1. **Dentro del handler**, explícitas. Preferible con pocos casos de uso; se ve todo.
2. **Decorador/middleware** alrededor del handler (`TransactionalHandler`,
   `AuthorizedHandler`, `LoggedHandler`). Preferible cuando hay más de ~15 handlers y la
   repetición molesta. No requiere bus: un decorador es una clase que implementa la misma
   firma y envuelve.

Reglas:
- La transacción envuelve **solo** escrituras; la publicación de eventos con IO externo
  queda fuera (`transactions-unit-of-work.md`).
- La autorización de "quién puede invocar" va antes de cargar nada pesado; la de "puede
  hacerlo con este agregado" tras cargarlo (`authorization.md`).
- Logging estructurado con `use_case`, `actor_id`, ids del agregado y `correlation_id`.
  Nunca el payload completo (PII). El log de negocio ("factura emitida") suele ser un
  evento de dominio, no una línea de log.

## Ejemplo PHP (Laravel)

```php
// src/Invoicing/Application/RegisterPayment/RegisterPaymentCommand.php
final readonly class RegisterPaymentCommand
{
    public function __construct(
        public string $invoiceId,
        public int $amountCents,
        public string $currency,
        public string $actorId,
        public string $idempotencyKey,
    ) {}
}

// src/Invoicing/Application/RegisterPayment/RegisterPaymentHandler.php
final class RegisterPaymentHandler
{
    public function __construct(
        private readonly InvoiceRepository $invoices,
        private readonly Authorizer $authorizer,        // puerto de aplicación
        private readonly EventBus $events,
        private readonly Clock $clock,
        private readonly LoggerInterface $logger,
    ) {}

    public function __invoke(RegisterPaymentCommand $cmd): PaymentRegistered
    {
        $this->authorizer->assert($cmd->actorId, 'invoice.pay', $cmd->invoiceId);

        $invoice = $this->invoices->ofId(InvoiceId::of($cmd->invoiceId))
            ?? throw InvoiceNotFound::withId($cmd->invoiceId);

        $paymentId = DB::transaction(function () use ($invoice, $cmd) {
            $payment = $invoice->registerPayment(   // regla de negocio en el agregado
                new Money($cmd->amountCents, $cmd->currency),
                $this->clock->now(),
            );
            $this->invoices->save($invoice);
            return $payment->id;
        });

        $this->events->publish(...$invoice->pullEvents());
        $this->logger->info('invoice.payment_registered', ['invoice_id' => $cmd->invoiceId, 'actor' => $cmd->actorId]);

        return new PaymentRegistered($paymentId->value, $invoice->outstanding()->amountCents);
    }
}
```

El controlador solo hace `new RegisterPaymentCommand(...$request->validated(), actorId:
$request->user()->id)` y devuelve `response()->json($result, 201)`.

## Ejemplo TypeScript (Node/Next)

Sin clases ni contenedor: función factoría que recibe dependencias y devuelve el caso de
uso. Encaja con server actions, route handlers y workers de BullMQ por igual.

```ts
// src/modules/invoicing/application/registerPayment.ts
export type RegisterPaymentCommand = {
  invoiceId: string; amountCents: number; currency: string; actorId: string;
};
export type RegisterPaymentResult = { paymentId: string; outstandingCents: number };

type Deps = { invoices: InvoiceRepository; authz: Authorizer; clock: Clock; events: EventBus; tx: TransactionRunner };

export const registerPayment = (d: Deps) =>
  async (cmd: RegisterPaymentCommand): Promise<Result<RegisterPaymentResult, InvoiceError>> => {
    const allowed = await d.authz.can(cmd.actorId, 'invoice.pay', cmd.invoiceId);
    if (!allowed) return err({ kind: 'Forbidden' });

    const invoice = await d.invoices.ofId(InvoiceId.of(cmd.invoiceId));
    if (!invoice) return err({ kind: 'NotFound' });

    const r = invoice.registerPayment(Money.of(cmd.amountCents, cmd.currency), d.clock.now());
    if (!r.ok) return r;                                   // error de dominio tipado

    await d.tx.run(async (ctx) => d.invoices.save(invoice, ctx));
    await d.events.publish(invoice.pullEvents());
    return ok({ paymentId: r.value.id, outstandingCents: invoice.outstanding().cents });
  };
```

Wiring en el borde (`src/modules/invoicing/composition.ts`) y uso desde un route handler:
`const result = await registerPayment(deps)(parsed.data)` (ver
`../hexagonal/dependency-injection.md`).

## Resultado: excepciones vs Result

| | Excepciones de dominio | `Result<T, E>` |
|---|---|---|
| Idiomático en | PHP, Python | TypeScript |
| Mapeo a HTTP | handler global de excepciones (`DomainException` -> 409/422) | `switch (result.error.kind)` en el adaptador |
| Ventaja | handler limpio, sin `if` de propagación | errores en el tipo, exhaustividad con `never` |
| Riesgo | usar excepciones para flujo esperado (stock insuficiente en cada compra) | olvidar comprobar `ok` |

Elige uno por stack y sé consistente. Mezclar los dos en un mismo módulo confunde más
que cualquiera de ellos por separado. Los errores **inesperados** (BD caída) siempre son
excepciones, en ambos modelos.

## Errores frecuentes

- Handler que recibe `Request`, `Illuminate\Http\Request` o `NextRequest`: acopla el caso
  de uso al transporte y lo vuelve intesteable sin HTTP.
- Handler que devuelve un modelo Eloquent/Prisma "porque el controlador lo necesita para
  el Resource": fuga de persistencia a la vista. Devuelve un DTO.
- Lógica de negocio en el handler porque "es solo un if". Al tercer `if` tienes un servicio
  de dominio anémico repartido por handlers.
- Un handler que llama a otro handler. Extrae lo común a un servicio de dominio o emite
  un evento; encadenar casos de uso crea transacciones anidadas y dependencias circulares.
- `UpdateXCommand` con 20 campos nullable: CRUD disfrazado.
- Loguear el command completo (contiene PII, tokens, importes).
- Autorizar en el controlador y no en el handler: el job o el CLI que invoquen el mismo
  caso de uso se saltan la regla.

## Checklist

- [ ] Un handler por intención, con un único método público (`__invoke` / función).
- [ ] Input = DTO plano construido por el adaptador; el handler no conoce el transporte.
- [ ] Sin reglas de negocio en el handler: delega en agregado o servicio de dominio.
- [ ] Solo depende de puertos; se prueba con fakes en memoria en < 10 ms.
- [ ] Transacción alrededor de las escrituras; eventos publicados tras commit.
- [ ] Autorización dentro del caso de uso (o decorador), no solo en el controlador.
- [ ] Salida = `void`, DTO o `Result`; nunca entidad ni modelo ORM.
- [ ] Log estructurado con ids y `correlation_id`, sin payload completo.
