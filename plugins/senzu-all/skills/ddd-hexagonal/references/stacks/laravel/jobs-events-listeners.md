# Jobs, eventos y listeners como adaptadores

## Índice

- [Tres cosas que Laravel llama "evento"](#tres-cosas-que-laravel-llama-evento)
- [Publicar eventos de dominio tras el commit](#publicar-eventos-de-dominio-tras-el-commit)
- [Listeners delgados: de evento a command](#listeners-delgados-de-evento-a-command)
- [Jobs como adaptadores driving](#jobs-como-adaptadores-driving)
- [Jobs como adaptadores driven](#jobs-como-adaptadores-driven)
- [Idempotencia](#idempotencia)
- [Reintentos, backoff y fallos definitivos](#reintentos-backoff-y-fallos-definitivos)
- [Outbox cuando la cola no basta](#outbox-cuando-la-cola-no-basta)
- [Tests](#tests)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza `overview.md` §5-§6. Plantillas: `templates/laravel/Domain/Event/InvoiceIssued.php`
y `templates/laravel/Application/IssueInvoice/IssueInvoiceHandler.php`. Registro de
listeners: `service-providers-and-bindings.md`. Transacciones Eloquent:
`../../persistence/eloquent-pitfalls.md`.

## Tres cosas que Laravel llama "evento"

| Tipo | Nace en | Uso en hexagonal |
|---|---|---|
| Evento de dominio (`InvoiceIssued`) | agregado, `record()` | hecho de negocio inmutable, `Domain/Event`; lo consumen listeners y proyectores |
| Evento de Eloquent (`saved`, `creating`) | ORM | solo infra técnica (`updated_at`, auditoría de columnas) |
| Evento de framework (`Login`, `JobFailed`) | Laravel | integración, fuera del módulo |

Los eventos de dominio se despachan **a través** del `Dispatcher` (`Event::dispatch`) sin
heredar nada ni usar `Dispatchable`: son `final readonly class` con primitivos y VO. El
`Dispatcher` acepta cualquier objeto; el nombre del evento es el FQCN.

## Publicar eventos de dominio tras el commit

```php
final class LaravelEventBus implements EventBus
{
    public function __construct(private readonly Dispatcher $dispatcher, private readonly ConnectionInterface $db) {}

    public function publish(DomainEvent ...$events): void
    {
        foreach ($events as $event) {
            // Con transacción abierta (job anidado, test) espera al commit; sin ella, despacha ya.
            $this->db->afterCommit(fn () => $this->dispatcher->dispatch($event));
        }
    }
}
```

Con `RefreshDatabase` (el test corre dentro de una transacción) los callbacks `afterCommit`
**no se ejecutan**: usa `DatabaseTruncation` cuando el test necesite ver el listener, o
`Event::fake([...])` para afirmar el despacho.

Los listeners en cola además no deben encolarse antes del commit:

```php
final class ProjectPendingInvoicesOnIssued implements ShouldQueue, ShouldHandleEventsAfterCommit { ... }
// o globalmente: config/queue.php -> 'after_commit' => true en la conexión
```

## Listeners delgados: de evento a command

Un listener es un adaptador driving disparado por un evento: traduce a un command de
otro caso de uso y no contiene reglas.

```php
// src/Sales/Infrastructure/Listeners/RegisterCommissionOnInvoiceIssued.php
final class RegisterCommissionOnInvoiceIssued implements ShouldQueue, ShouldHandleEventsAfterCommit
{
    public string $queue = 'sales';
    public int $tries = 5;

    public function __construct(private readonly RegisterCommissionHandler $handler) {}

    public function handle(InvoiceIssued $event): void
    {
        ($this->handler)(new RegisterCommissionCommand(
            sourceRef: 'invoice:' . $event->invoiceId,      // clave de idempotencia
            amountCents: $event->totalCents,
            currency: $event->currency,
            occurredAt: $event->occurredAt,
        ));
    }
}
```

Se registra en el provider del contexto **consumidor** (`Sales`):
`Event::listen(InvoiceIssued::class, RegisterCommissionOnInvoiceIssued::class)`. Que
`Sales` importe `Invoicing\Domain\Event\InvoiceIssued` es aceptable si `Invoicing` es
upstream y lo publica como contrato; si molesta, un evento de integración con primitivos
en `Shared/Contracts`. Un `if` de negocio en el listener ("solo si supera X") delata una
regla que pertenece al handler destino o al agregado.

## Jobs como adaptadores driving

Un job es un command serializado más un `handle()` que llama al caso de uso. Propiedades
primitivas; el handler se inyecta en `handle()`, nunca en el constructor (se serializaría).

```php
final class IssueInvoiceJob implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $tries = 3;
    public array $backoff = [10, 60, 300];

    public function __construct(public readonly string $invoiceId, public readonly string $actorId) {}

    public function handle(IssueInvoiceHandler $handler): void
    {
        try {
            $handler(new IssueInvoiceCommand($this->invoiceId, $this->actorId));
        } catch (InvoiceAlreadyIssued) {
            // reintento de una ejecución que sí llegó a commit: no es error
        }
    }

    public function uniqueId(): string { return $this->invoiceId; }
    public function middleware(): array { return [new DontRetryDomainErrors(), new WithoutOverlapping($this->invoiceId)]; }
}
```

Dispatch: `IssueInvoiceJob::dispatch($id, $actorId)->afterCommit()`. Nunca
`SerializesModels` con un Model: el job guarda ids, el handler carga por el repositorio.

## Jobs como adaptadores driven

Cuando un caso de uso necesita "pedir que algo ocurra después", el puerto es síncrono y el
adaptador encola:

```php
interface InvoicePdfScheduler { public function schedule(InvoiceId $id): void; }   // Application/Port

final class QueueInvoicePdfScheduler implements InvoicePdfScheduler                 // Infrastructure/Jobs
{
    public function schedule(InvoiceId $id): void { RenderInvoicePdfJob::dispatch($id->value)->afterCommit(); }
}
```

Prefiere, aun así, reaccionar a eventos: `RenderInvoicePdfOnIssued` como listener en cola
evita el puerto y mantiene el handler ignorante del PDF.

## Idempotencia

Las colas entregan **al menos una vez**. Tres defensas, de más barata a más robusta:

1. **`ShouldBeUnique` + `uniqueId()`**: evita duplicados *mientras el job está en cola*.
   No cubre reintentos tras fallo parcial ni dos dispatch separados en el tiempo.
2. **El agregado rechaza la repetición**: `issue()` sobre una emitida lanza
   `InvoiceAlreadyIssued`; el job la trata como "ya hecho" (código anterior).
3. **Clave persistida** para efectos sin agregado (llamadas externas): tabla
   `processed_messages(key, processed_at)` con `insertOrIgnore` en la misma transacción que
   el efecto; 0 filas insertadas = salir.

`WithoutOverlapping` evita concurrencia, no duplicados; combínalo con el punto 2.

## Reintentos, backoff y fallos definitivos

`DomainException` (un 409 semántico) no debe reintentarse; infraestructura (timeout,
deadlock) sí. Un middleware lo centraliza:

```php
final class DontRetryDomainErrors
{
    public function handle(object $job, Closure $next): void
    {
        try { $next($job); } catch (DomainException $e) { $job->fail($e); }
    }
}
```

```php
public int $maxExceptions = 2;
public function retryUntil(): DateTimeInterface { return now()->addHours(6); }
public function failed(Throwable $e): void
{
    Log::error('IssueInvoiceJob failed', ['invoice' => $this->invoiceId, 'error' => $e->getMessage()]); // informa, no decide
}
```

## Outbox cuando la cola no basta

`afterCommit` + cola pierde eventos si el proceso muere entre el commit y el `push` a
Redis. Si un evento **no puede perderse** (factura electrónica, contabilidad), guárdalo en
la misma transacción y entrégalo aparte:

```php
final class OutboxEventBus implements EventBus
{
    public function publish(DomainEvent ...$events): void
    {
        DB::table('outbox')->insert(array_map(fn (DomainEvent $e) => [
            'id' => Str::uuid7(), 'name' => $e::class, 'payload' => json_encode($e), 'occurred_at' => $e->occurredAt,
        ], $events));   // misma transacción que el save del agregado
    }
}
// Comando Artisan cada minuto: lee no publicados con lockForUpdate()->skipLocked(),
// Event::dispatch, marca published_at. Relay idempotente por id.
```

Para el 90 % de los módulos basta `afterCommit` + `ShouldHandleEventsAfterCommit`; el
outbox se paga en complejidad operativa.

## Tests

| Nivel | Qué se prueba | Herramienta |
|---|---|---|
| Aplicación | el handler publica `InvoiceIssued` correcto | `RecordingEventBus`, sin Laravel |
| Bus | `LaravelEventBus` despacha tras commit | Integration con `DatabaseTruncation` y listener espía |
| Listener / job | traduce a command correcto | instanciar y llamar `handle()` con fakes de puertos |
| Feature | el endpoint encola / despacha | `Queue::fake([...])`, `Event::fake([...])` |

```php
it('queues the PDF render after issuing', function () {
    Queue::fake([RenderInvoicePdfJob::class]);          // solo ese job; el resto corre de verdad
    $invoice = InvoiceModel::factory()->draft()->hasLines(1)->create();
    $this->actingAs(billingUser())->postJson(route('invoices.issue', $invoice->id), ['issue_date' => '2026-01-10']);
    Queue::assertPushed(RenderInvoicePdfJob::class, fn ($job) => $job->invoiceId === $invoice->id);
});
```

`Event::fake()` sin argumentos apaga **todos** los listeners, incluidos proyectores y
observers: el read model no se actualiza y el test siguiente falla de forma misteriosa.
Pasa siempre la lista. Ver `../../testing/adapter-tests.md`.

## Errores frecuentes

- **Evento despachado dentro de la transacción** sin `afterCommit`: el listener en cola
  lee un estado inexistente.
- **Listener con lógica de negocio**: la regla se pierde al cambiar el listener.
- **Job con `SerializesModels` y un Model**: acopla la cola al esquema. Ids y repositorio.
- **`ShouldBeUnique` como única idempotencia**: no cubre reintentos tras commit.
- **Reintentar `DomainException`**: cinco intentos del mismo 409.
- **Handler en el constructor del job**: se serializa con sus dependencias.
- **`Event::fake()` global**: apaga proyectores y observers.
- **Eventos de Eloquent para lógica** (`saved` → email): invisibles en el dominio.

## Checklist

- [ ] Eventos de dominio en `Domain/Event`, `final readonly`, sin traits de Laravel.
- [ ] Bus con `afterCommit`; listeners en cola con `ShouldHandleEventsAfterCommit`.
- [ ] Listeners en el provider del contexto consumidor; solo traducen a command.
- [ ] Jobs con primitivos, handler en `handle()`, `uniqueId()`, `backoff` explícito.
- [ ] Idempotencia en el agregado; repetición capturada como éxito.
- [ ] `DomainException` no se reintenta (middleware con `fail()`).
- [ ] Outbox solo para eventos que no pueden perderse; relay idempotente.
- [ ] `Queue::fake`/`Event::fake` siempre con lista explícita.
