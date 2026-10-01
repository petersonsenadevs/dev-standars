# Service providers y bindings por contexto

## Índice

- [Un provider por bounded context](#un-provider-por-bounded-context)
- [Autoload PSR-4 y registro del provider](#autoload-psr-4-y-registro-del-provider)
- [Bindings: `$bindings`, `$singletons`, `scoped`](#bindings-bindings-singletons-scoped)
- [Contextual binding y primitivos desde config](#contextual-binding-y-primitivos-desde-config)
- [Selección de adaptador por configuración](#selección-de-adaptador-por-configuración)
- [Tagged bindings para proyectores](#tagged-bindings-para-proyectores)
- [Deferred providers](#deferred-providers)
- [Cachés de Laravel y sus trampas](#cachés-de-laravel-y-sus-trampas)
- [Sustituir bindings en tests](#sustituir-bindings-en-tests)
- [Testear el wiring](#testear-el-wiring)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza `overview.md` §2. Plantilla completa:
`templates/laravel/Infrastructure/Providers/InvoicingServiceProvider.php`. Disposición de
módulos, rutas y migraciones: `laravel-modules-layout.md`.

## Un provider por bounded context

El provider es el único lugar del módulo que conoce a la vez los puertos (`Domain/`,
`Application/`) y sus adaptadores (`Infrastructure/`): el composition root del contexto.
Si necesitas abrir el provider para entender un caso de uso, el caso de uso está mal; si
necesitas abrir el caso de uso para saber qué adaptador usa, el provider está mal.

```php
final class InvoicingServiceProvider extends ServiceProvider
{
    public array $bindings = [
        InvoiceRepository::class => EloquentInvoiceRepository::class,
        InvoiceSequenceRepository::class => EloquentInvoiceSequenceRepository::class,
        PendingInvoicesReader::class => DbPendingInvoicesReader::class,
    ];

    public array $singletons = [
        Clock::class => SystemClock::class,
        EventBus::class => LaravelEventBus::class,
    ];

    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config.php', 'invoicing');
        $this->app->bind(PdfRenderer::class, fn (Application $app) => new GotenbergPdfRenderer(
            baseUrl: $app['config']->get('invoicing.gotenberg.url'),
            http: $app->make(HttpFactory::class),
        ));
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__ . '/../Http/routes.php');
        $this->loadMigrationsFrom(__DIR__ . '/../Persistence/Migrations');
    }
}
```

Los handlers (`IssueInvoiceHandler`) no se registran: el contenedor los resuelve por
reflexión del constructor. Registrar solo interfaces mantiene el provider corto.

## Autoload PSR-4 y registro del provider

```json
"autoload": {
  "psr-4": { "App\\": "app/", "Invoicing\\": "src/Invoicing/", "Sales\\": "src/Sales/", "Shared\\": "src/Shared/" }
}
```

Un prefijo por contexto (no `Src\\` genérico): el namespace es parte del lenguaje ubicuo y
habilita reglas de deptrac por contexto. Tras editar, `composer dump-autoload`.

```php
// bootstrap/providers.php (Laravel 11+)
return [
    App\Providers\AppServiceProvider::class,
    Invoicing\Infrastructure\Providers\InvoicingServiceProvider::class,
    Sales\Infrastructure\Providers\SalesServiceProvider::class,
];
```

El orden solo importa para `register()` que hace `make()` de otro módulo: evítalo con
closures perezosas. En `boot()` todos los `register()` ya han corrido.

## Bindings: `$bindings`, `$singletons`, `scoped`

| Tipo | Ciclo de vida | Usar para |
|---|---|---|
| `bind` / `$bindings` | instancia por resolución | repositorios, readers, handlers |
| `singleton` / `$singletons` | una por proceso | reloj, bus, clientes HTTP, config parseada |
| `scoped` | una por request/job (Octane y colas la limpian) | UoW, `TenantContext`, `RequestId` |

Con Octane o workers de cola, un `singleton` con estado (identity map, eventos pendientes)
contamina la siguiente petición: usa `scoped`.

```php
$this->app->scoped(TenantContext::class, fn () => TenantContext::empty());
```

Un repositorio Eloquent sin estado podría ser `singleton`, pero `bind` cuesta microsegundos
y evita sorpresas: por defecto, `bind`.

## Contextual binding y primitivos desde config

Dos casos de uso que necesitan el mismo puerto con adaptadores distintos:

```php
$this->app->when(IssueInvoiceHandler::class)->needs(Notifier::class)->give(MailNotifier::class);
$this->app->when(VoidInvoiceHandler::class)->needs(Notifier::class)->give(SlackNotifier::class);

// El handler recibe int, no Config
$this->app->when(IssueInvoiceHandler::class)->needs('$graceDays')->giveConfig('invoicing.grace_days');
```

Un tercer `when()` para el mismo puerto indica un puerto demasiado genérico: divide en
`InvoiceIssuedNotifier` e `InvoiceVoidedNotifier`.

## Selección de adaptador por configuración

Los adaptadores reciben primitivos, nunca `Config` ni `env()`. `env()` solo en
`config/*.php` o en la `config.php` del módulo (con `config:cache`, `env()` fuera de ahí
devuelve `null`). El entorno se decide en el provider, no con `app()->environment()`
dentro del adaptador:

```php
$this->app->bind(PaymentGateway::class, fn (Application $app) => match ($app['config']->get('invoicing.payments.driver')) {
    'stripe' => $app->make(StripePaymentGateway::class),
    'fake' => new InMemoryPaymentGateway(),
    default => throw new LogicException('Unknown payments driver'),
});
```

## Tagged bindings para proyectores

N implementaciones de un puerto que se ejecutan todas (proyectores de read models):

```php
$this->app->tag([PendingInvoicesProjector::class, CustomerBalanceProjector::class], 'invoicing.projectors');
$this->app->bind(ProjectorRegistry::class, fn (Application $app) => new ProjectorRegistry(
    iterator_to_array($app->tagged('invoicing.projectors')),
));
```

`tagged()` devuelve un generador perezoso. Patrón de proyector en
`../../persistence/read-models-and-projections.md`.

## Deferred providers

Un provider que solo registra bindings puede implementar `DeferrableProvider` con
`provides()`; Laravel lo carga solo cuando alguien resuelve uno de esos servicios. Separa
ahí lo caro (SDKs con clientes pesados). El provider principal nunca es deferrable: carga
rutas y `boot()` debe ejecutarse siempre.

```php
final class InvoicingPdfServiceProvider extends ServiceProvider implements DeferrableProvider
{
    public function register(): void { $this->app->bind(PdfRenderer::class, GotenbergPdfRenderer::class); }
    public function provides(): array { return [PdfRenderer::class]; }
}
```

`provides()` incompleto es la causa clásica de "Target is not instantiable" solo en
producción.

## Cachés de Laravel y sus trampas

| Comando | Rompe cuando |
|---|---|
| `config:cache` | `env()` fuera de config; `mergeConfigFrom` en `boot()` (debe ir en `register()`) |
| `route:cache` | closures como handler en `routes.php` del módulo: usa controladores invocables |
| `event:cache` | el auto-discovery no mira `src/`; añade las rutas en `bootstrap/app.php` |

```php
// bootstrap/app.php
->withEvents(discover: [__DIR__ . '/../src/*/Infrastructure/Listeners'])
```

Regla: al menos un job de CI ejecuta `php artisan optimize` antes de la suite Feature para
que las trampas de caché salten antes del despliegue.

## Sustituir bindings en tests

En Feature se sustituyen adaptadores de IO externo por fakes del puerto, nunca por mocks
de casos de uso:

```php
beforeEach(function () {
    $this->app->instance(PaymentGateway::class, $this->payments = new InMemoryPaymentGateway());
    $this->app->instance(Clock::class, new FixedClock(new DateTimeImmutable('2026-01-10')));
});
```

`instance()` gana sobre `$bindings` porque corre después del `register()`. Fakes en
`src/<Context>/Testing/`; ver `../../testing/use-case-tests.md`.

## Testear el wiring

Un test por módulo comprueba que cada puerto resuelve a la implementación esperada y que
todos los handlers son instanciables. Detecta puertos sin binding antes que producción.

```php
uses(Tests\TestCase::class);

it('binds every port of the Invoicing context', function (string $port, string $adapter) {
    expect(app($port))->toBeInstanceOf($adapter);
})->with([
    [InvoiceRepository::class, EloquentInvoiceRepository::class],
    [PendingInvoicesReader::class, DbPendingInvoicesReader::class],
    [EventBus::class, LaravelEventBus::class],
]);

it('can instantiate every handler', function (string $handler) {
    expect(app($handler))->toBeInstanceOf($handler);
})->with(fn () => array_map(
    fn (string $f) => [Str::of($f)->after('src/')->before('.php')->replace('/', '\\')->toString()],
    glob(base_path('src/Invoicing/Application/*/*Handler.php')),
));
```

## Errores frecuentes

- **`app()->make()` / `resolve()` dentro de un handler**: service locator; oculta la
  dependencia y rompe los tests con fakes. Inyecta por constructor.
- **`DB::` o `Cache::` en `register()`**: el contenedor no está completo; a `boot()` o
  closure perezosa.
- **`env()` en un adaptador**: `null` con `config:cache`. Valor por constructor.
- **`singleton` con estado** bajo Octane/colas: fuga entre requests. `scoped` o `bind`.
- **`AppServiceProvider` con 40 bindings de todos los contextos**: se pierde la
  frontera. Un provider por contexto.
- **Interfaz en `Infrastructure/`**: el binding funciona, la capa es la equivocada;
  deptrac lo marca.
- **Listeners registrados en dos sitios**: se ejecutan dos veces. Solo en el provider del
  contexto consumidor; ver `jobs-events-listeners.md`.

## Checklist

- [ ] Un provider por bounded context; bindings solo de interfaces.
- [ ] Prefijo PSR-4 por contexto; provider en `bootstrap/providers.php`.
- [ ] `bind` por defecto; `singleton` solo sin estado; `scoped` para estado por request.
- [ ] `mergeConfigFrom` en `register()`; `env()` solo en config.
- [ ] Contextual binding máximo 2 por puerto.
- [ ] Deferrables solo para SDKs caros, con `provides()` completo.
- [ ] CI ejecuta `optimize` antes de la suite Feature.
- [ ] Test de wiring que resuelve cada puerto y cada handler.
