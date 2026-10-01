# Laravel (PHP 8.3+): monolito modular hexagonal

## Índice

- [Estructura de carpetas](#estructura-de-carpetas)
- [ServiceProvider por módulo](#serviceprovider-por-módulo)
- [Dominio: entidades, VO, excepciones, eventos](#dominio-entidades-vo-excepciones-eventos)
- [Eloquent como adaptador driven](#eloquent-como-adaptador-driven)
- [Casos de uso, transacción y eventos tras commit](#casos-de-uso-transacción-y-eventos-tras-commit)
- [Adaptadores driving: HTTP, Inertia, jobs, Artisan](#adaptadores-driving-http-inertia-jobs-artisan)
- [Validación: forma vs reglas](#validación-forma-vs-reglas)
- [Read models con el query builder](#read-models-con-el-query-builder)
- [Reglas de dependencia: deptrac y PHPStan](#reglas-de-dependencia-deptrac-y-phpstan)
- [Pest por capas](#pest-por-capas)
- [Decisiones pragmáticas](#decisiones-pragmáticas)
- [Checklist](#checklist)

Este documento es el mapa del stack Laravel: dónde va cada pieza y qué decisiones ha
tomado el equipo. El detalle de cada tema está en los documentos de esta carpeta y en
los transversales enlazados.

## Estructura de carpetas

`app/` sigue siendo la aplicación Laravel (adaptadores HTTP, consola, providers globales).
Los módulos de negocio viven en `src/` (alternativa equivalente: `app/Modules/<Context>`).

```
src/
  Invoicing/
    Domain/             Model/ (Invoice, InvoiceLine, enum InvoiceStatus), ValueObject/ (Money, InvoiceId),
                        Event/ (InvoiceIssued), Repository/ (interfaz), Exception/, Service/
    Application/        IssueInvoice/ (Command + Handler), Query/ (query, Reader interfaz, InvoiceRow DTO),
                        Port/ (Clock, EventBus)
    Infrastructure/     Persistence/Eloquent/ (Model, Repository, Mapper), Persistence/Query/ (DbReader),
                        Bus/, Http/ (Controller, Request, Resource), Console/, Jobs/, Providers/
  Shared/
    Domain/             AggregateRoot, DomainEvent, DomainException, Uuid
    Infrastructure/     SystemClock
app/                    Http/Kernel, Providers globales, mapeo de DomainException
routes/                 apunta a controladores de Infrastructure/Http de cada módulo
tests/                  Unit/<Context>/Domain, Unit/<Context>/Application, Integration, Feature, Builders
```

Agrupar `Application/` por caso de uso (`IssueInvoice/`) escala mejor que por tipo porque
todo lo de una intención está junto.

Detalle: `laravel-modules-layout.md` (src vs app/Modules, rutas y migraciones por módulo,
Shared, comunicación entre módulos).

## ServiceProvider por módulo

PSR-4: `"Invoicing\\": "src/Invoicing/"`, `"Shared\\": "src/Shared/"` en `composer.json`.

```php
final class InvoicingServiceProvider extends ServiceProvider
{
    public array $bindings = [
        InvoiceRepository::class => EloquentInvoiceRepository::class,
        PendingInvoicesReader::class => DbPendingInvoicesReader::class,
        EventBus::class => LaravelEventBus::class,
        Clock::class => SystemClock::class,
    ];

    public function boot(): void { $this->loadRoutesFrom(__DIR__ . '/../Http/routes.php'); }
}
```

Los handlers no necesitan binding: el contenedor los autoresuelve por constructor.

Detalle: `service-providers-and-bindings.md` (contextual binding, selección por
configuración, deferred providers, cachés, sustitución en tests).

## Dominio: entidades, VO, excepciones, eventos

- Clases `final`, sin `extends Model`, sin facades, sin `Carbon` (usa `DateTimeImmutable`).
- VO como `final readonly class` con validación en constructor y métodos `equals`.
- Enums nativos para estados (`enum InvoiceStatus: string`), con la transición validada
  en el agregado, no en el enum.
- Ids como VO (`InvoiceId`) sobre UUID v7 (`Str::uuid7()` solo en infraestructura;
  el dominio recibe el string).
- `AggregateRoot` base mínima con `record(DomainEvent)` y `pullEvents()`.
- Excepciones extienden `Shared\Domain\DomainException` con constructores nombrados
  (`InvoiceCannotBeIssued::withoutLines($id)`).

Detalle: `../../tactical/overview-concepts.md` y `templates/laravel/Domain/*`.

## Eloquent como adaptador driven

El modelo Eloquent vive en `Infrastructure/Persistence/Eloquent` y solo lo conoce el
repositorio. El mapeo es explícito:

```php
final class EloquentInvoiceRepository implements InvoiceRepository
{
    public function ofId(InvoiceId $id): ?Invoice
    {
        $row = InvoiceModel::with('lines')->find($id->value);
        return $row ? InvoiceMapper::toDomain($row) : null;
    }

    public function save(Invoice $invoice): void
    {
        $model = InvoiceModel::findOrNew($invoice->id->value);
        InvoiceMapper::fillModel($model, $invoice);
        $model->save();
        $model->lines()->delete();
        $model->lines()->createMany(InvoiceMapper::linesToRows($invoice));
    }
}
```

Reglas: rehidratar por `Invoice::reconstitute(...)` sin emitir eventos; `Money` en dos
columnas; nada de `$fillable` desde el request; columna `version` si hay concurrencia real.

Detalle: `../../persistence/eloquent-pitfalls.md`, `../../persistence/orm-mapping.md`.

## Casos de uso, transacción y eventos tras commit

```php
final class IssueInvoiceHandler
{
    public function __construct(
        private readonly InvoiceRepository $invoices,
        private readonly EventBus $events,
        private readonly Clock $clock,
    ) {}

    public function __invoke(IssueInvoiceCommand $command): void
    {
        $invoice = $this->invoices->ofId(InvoiceId::of($command->invoiceId))
            ?? throw InvoiceNotFound::withId($command->invoiceId);

        DB::transaction(function () use ($invoice) {
            $invoice->issue($this->clock->now());
            $this->invoices->save($invoice);
        });

        $this->events->publish(...$invoice->pullEvents()); // fuera de la transacción
    }
}
```

`DB::transaction` en `Application/` es una dependencia de framework tolerada por
pragmatismo (deptrac la permite explícitamente). Alternativa purista: puerto
`TransactionRunner`. Listeners con IO -> `ShouldQueue` con `afterCommit = true`.

Detalle: `jobs-events-listeners.md` (publicación tras commit, listeners delgados, outbox)
y `../../application/transactions-unit-of-work.md`.

## Adaptadores driving: HTTP, Inertia, jobs, Artisan

Controlador: valida forma (Form Request), construye command, invoca handler, mapea
respuesta. Sin `if` de negocio, sin `DB::`, sin `Mail::`.

```php
final class IssueInvoiceController
{
    public function __invoke(IssueInvoiceRequest $request, string $id, IssueInvoiceHandler $handler): JsonResponse
    {
        $handler(new IssueInvoiceCommand(invoiceId: $id, actorId: $request->user()->id));
        return response()->json(status: 202);
    }
}
```

- Excepciones -> HTTP en el handler global: `DomainException` -> 409/422 con
  `['error' => $e->code(), 'message' => $e->getMessage()]`; `NotFound` de dominio -> 404.
- Inertia no cambia las capas internas: GET renderiza props desde el read model, POST
  invoca el caso de uso y redirige. Props = DTOs/arrays, nunca modelos Eloquent.
- Jobs y comandos Artisan: construyen el command desde sus propiedades/argumentos y
  llaman al handler. Nada más.

Detalle: `http-and-inertia-adapters.md` (Form Request `toCommand()`, Resources, flash,
paginación, Policies) y `jobs-events-listeners.md` (jobs driving y driven, idempotencia).

## Validación: forma vs reglas

| Dónde | Qué valida | Ejemplo |
|---|---|---|
| Form Request | tipo, presencia, formato, existencia de referencia | `invoice_id: required|uuid|exists:invoices,id` |
| VO / entidad | invariantes de negocio | `Money` no negativo; `issue()` sin líneas |
| Policy | autorización de acceso | `can('issue', $invoice)` |

Duplicar comprobaciones sencillas (formato de email) en Form Request y VO es correcto.
No pongas `exists:` de negocio complejo en Form Request; eso es del caso de uso.

Detalle: `../../application/validation-layers.md`, `../../application/authorization.md`.

## Read models con el query builder

`DbPendingInvoicesReader implements PendingInvoicesReader` usa `DB::table('invoices')`
con sus `join`/`where`/`select` y devuelve `InvoiceRow[]` (DTO plano), sin rehidratar
agregados. Paginación, filtros y ordenación viven aquí, no en el repositorio. Los
`Resource` de API se construyen desde `InvoiceRow`.

Detalle: `../../application/read-models-projections.md`, `../../persistence/read-models-and-projections.md`.

## Reglas de dependencia: deptrac y PHPStan

Capas `Domain`, `Application`, `Infrastructure` y `Laravel` (`Illuminate|Inertia|Laravel`)
por directorio; ruleset `Domain: []`, `Application: [Domain]` (con `DB::transaction`
tolerado), `Infrastructure: [Domain, Application, Laravel]`. Una capa por contexto con
cruces prohibidos salvo `Shared`. PHPStan nivel 8+ con `phpstan-strict-rules`; `larastan`
solo para `app/` e `Infrastructure/`. CI: `vendor/bin/deptrac analyse --fail-on-uncovered`.

Detalle: `../../hexagonal/dependency-rules-tooling.md`; archivo completo en `templates/laravel/deptrac.yaml`.

## Pest por capas

```php
// tests/Pest.php
pest()->extend(Tests\TestCase::class)->use(RefreshDatabase::class)->in('Feature', 'Integration');
// Unit no extiende TestCase de Laravel: sin bootstrap, ms por test
function anInvoice(): InvoiceBuilder { return InvoiceBuilder::anInvoice(); }
```

`php artisan test --testsuite=Unit` en pre-commit; `Integration` y `Feature` en PR.

Detalle: `../../testing/overview.md` y `laravel-modules-layout.md` (tests por módulo y `phpunit.xml`).

## Decisiones pragmáticas

- CRUD sin reglas (maestros, ajustes): controlador resource + Eloquent en `app/`. No módulo.
- `Collection` de Laravel en Application: permitido; es una estructura de datos.
- `Carbon` en Domain: no; `DateTimeImmutable` + `Clock`. Convertir en el adaptador con
  `->toDateTimeImmutable()`.
- Bus de comandos: no hace falta; inyectar el handler es suficiente. Si un día necesitas
  middlewares (transacción, logging), envuelve con un decorador.
- Eventos de Eloquent (`creating`, `saved`): prohibidos para lógica de negocio.
- Observers y global scopes con lógica: no; multi-tenant se resuelve en el repositorio y
  en el read model con el `TenantId` recibido en el command.
- `lorisleiva/laravel-actions`: compatible como paso 1 de la migración; a la larga el
  handler plano es más claro.

## Checklist

- [ ] Cada contexto es un módulo en `src/` con su ServiceProvider y sus bindings.
- [ ] `Domain/` sin `Model`, facades ni `Carbon`; excepciones con constructores nombrados.
- [ ] Eloquent solo dentro del repositorio; mapeo explícito y reconstitución sin eventos.
- [ ] Transacción en el handler; eventos publicados tras el commit.
- [ ] Controladores, jobs e Inertia sin lógica de negocio; props y respuestas desde DTOs.
- [ ] Form Request valida forma; el dominio valida reglas; Policy autoriza.
- [ ] Listados por readers con query builder, no por repositorios.
- [ ] deptrac y PHPStan en CI; suite `Unit` sin bootstrap de Laravel.
