# Laravel: monolito modular, un módulo por contexto

## Índice

- [Dos ubicaciones válidas: src/ vs app/Modules](#dos-ubicaciones-válidas-src-vs-appmodules)
- [Anatomía completa de un módulo](#anatomía-completa-de-un-módulo)
- [composer.json y autoload](#composerjson-y-autoload)
- [Rutas por módulo](#rutas-por-módulo)
- [Migraciones por módulo](#migraciones-por-módulo)
- [Tests por módulo y phpunit.xml](#tests-por-módulo-y-phpunitxml)
- [Comandos Artisan del módulo](#comandos-artisan-del-módulo)
- [Generador make:module](#generador-makemodule)
- [Shared: qué entra y qué no](#shared-qué-entra-y-qué-no)
- [Comunicación entre módulos](#comunicación-entre-módulos)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

La estructura base y el provider están en [overview.md](overview.md) §1-2 y en
`templates/laravel/Infrastructure/Providers/InvoicingServiceProvider.php`. Este documento
resuelve lo que queda alrededor: rutas, migraciones, tests, comandos y generación.

## Dos ubicaciones válidas: src/ vs app/Modules

| Criterio | `src/<Context>/` + namespace propio | `app/Modules/<Context>/` bajo `App\Modules` |
|---|---|---|
| Señal de frontera | fuerte: no es "la app Laravel", es un paquete interno | débil: parece una carpeta más de `app/` |
| Autoload | entrada PSR-4 por módulo (o comodín) | ya cubierto por `App\` |
| Extracción futura a paquete | trivial (mover carpeta + composer) | renombrar namespace en todo el módulo |
| `php artisan make:*` | genera en `app/`; hay que mover o usar el generador propio | genera dentro con `--path` en algunos comandos |
| Deptrac/Pest arch | regex `src/.*/Domain` | regex `app/Modules/.*/Domain` |

Recomendación: `src/` con namespace por contexto (`Invoicing\`, `Sales\`, `Shared\`).
`app/Modules` es aceptable en equipos que rechazan salir de `app/`; las reglas son las
mismas. Lo que no vale es mezclar: unos módulos en `src/` y otros en `app/Modules`.

## Anatomía completa de un módulo

```
src/Invoicing/
  Domain/                        (ver overview §3)
  Application/                   (ver overview §5)
  Infrastructure/
    Http/
      routes.php                 rutas del módulo (web y api), sin prefijo global
      Controllers/ Requests/ Resources/
    Persistence/
      Eloquent/                  InvoiceModel.php, InvoiceLineModel.php, EloquentInvoiceRepository.php
      Query/                     DbPendingInvoicesReader.php
      Migrations/                2026_01_10_000000_create_invoices_table.php
      Factories/                 InvoiceModelFactory.php (factory de Eloquent, no de dominio)
    Console/ Jobs/ Listeners/    adaptadores driving; Listeners escucha eventos de otros módulos
    Providers/                   InvoicingServiceProvider.php
  Api/                           contratos públicos: InvoiceIssued (evento de integración), InvoiceSummaryDto, InvoicingFacade
tests/
  Unit/Invoicing/{Domain,Application}/  Integration/Invoicing/  Feature/Invoicing/
  Builders/Invoicing/  Fakes/Invoicing/  (InvoiceBuilder, InMemoryInvoiceRepository, RecordingEventBus)
```

`Api/` es la única carpeta que otro módulo puede importar. Si un módulo no expone nada,
no existe. Las vistas Inertia viven en `resources/js/Pages/Invoicing/` (ver
[../vue-front/overview.md](../vue-front/overview.md) §9), no dentro de `src/`.

## composer.json y autoload

```json
"autoload": {
  "psr-4": {
    "App\\": "app/",
    "Shared\\": "src/Shared/",
    "Invoicing\\": "src/Invoicing/",
    "Sales\\": "src/Sales/"
  }
},
"autoload-dev": {
  "psr-4": { "Tests\\": "tests/" }
}
```

Una entrada por módulo, explícita: `composer dump-autoload -o` en despliegue. Un comodín
tipo `"": "src/"` funciona pero desactiva la optimización de classmap y oculta la lista de
módulos; evítalo. Las factories de Eloquent dentro del módulo necesitan
`protected static function newFactory(): InvoiceModelFactory` en el modelo.

## Rutas por módulo

```php
// src/Invoicing/Infrastructure/Http/routes.php
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth'])->prefix('invoices')->name('invoices.')->group(function () {
    Route::get('/', InvoicesPageController::class . '@index')->name('index');
    Route::post('{id}/issue', IssueInvoiceController::class)->name('issue')->whereUuid('id');
});
Route::middleware(['api', 'auth:sanctum'])->prefix('api/invoices')->name('api.invoices.')->group(function () {
    Route::post('{id}/issue', IssueInvoiceController::class)->name('issue');
});
```

```php
// InvoicingServiceProvider::boot()
$this->loadRoutesFrom(__DIR__ . '/../Http/routes.php');
```

Los middlewares se declaran en el archivo del módulo, no se heredan de `routes/web.php`.
`php artisan route:cache` funciona igual: los closures están prohibidos, usa controladores.
`routes/web.php` de la aplicación queda para la home, auth y páginas sin módulo. Para
listar solo un módulo: `php artisan route:list --path=invoices`.

## Migraciones por módulo

```php
// InvoicingServiceProvider::boot()
$this->loadMigrationsFrom(__DIR__ . '/../Persistence/Migrations');
```

- Orden global por timestamp. Evita FKs entre módulos; referencia por id sin constraint (el
  agregado de otro contexto no es tuyo).
- `php artisan make:migration create_invoices_table --path=src/Invoicing/Infrastructure/Persistence/Migrations`.
- Seeders en `Persistence/Seeders/`, invocados desde `DatabaseSeeder::call([...])`; solo
  datos maestros, nunca fixtures de test. Cambios de esquema guiados por agregados: ver
  [../../persistence/migrations-and-domain.md](../../persistence/migrations-and-domain.md).

## Tests por módulo y phpunit.xml

```xml
<!-- phpunit.xml -->
<testsuites>
  <testsuite name="Unit"><directory>tests/Unit</directory><directory>tests/Architecture</directory></testsuite>
  <testsuite name="Integration"><directory>tests/Integration</directory></testsuite>
  <testsuite name="Feature"><directory>tests/Feature</directory></testsuite>
</testsuites>
<php>
  <env name="DB_CONNECTION" value="sqlite"/>
  <env name="DB_DATABASE" value=":memory:"/>
  <env name="QUEUE_CONNECTION" value="sync"/>
  <env name="CACHE_STORE" value="array"/>
</php>
```

```php
// tests/Pest.php
pest()->extend(Tests\TestCase::class)->use(RefreshDatabase::class)->in('Feature', 'Integration');
// Unit y Architecture: sin TestCase de Laravel
pest()->group('invoicing')->in('Unit/Invoicing', 'Integration/Invoicing', 'Feature/Invoicing');
pest()->group('sales')->in('Unit/Sales', 'Integration/Sales', 'Feature/Sales');
```

`php artisan test --group=invoicing` ejecuta todo lo del módulo; `--testsuite=Unit` lo
rápido. En CI, un job por módulo cuando la suite supera ~5 min, con
`paths-filter` para correr solo los módulos tocados. Los builders y fakes se comparten
entre suites desde `tests/Builders` y `tests/Fakes`; ver
[../../testing/test-data-builders.md](../../testing/test-data-builders.md).

## Comandos Artisan del módulo

Un comando es un adaptador driving: parsea argumentos, construye el command, llama al
handler, imprime. Nada más.

```php
// src/Invoicing/Infrastructure/Console/IssueOverdueRemindersCommand.php
final class IssueOverdueRemindersCommand extends Command
{
    protected $signature = 'invoicing:overdue-reminders {--dry-run}';

    public function handle(SendOverdueRemindersHandler $handler, Clock $clock): int
    {
        $result = $handler(new SendOverdueRemindersCommand(asOf: $clock->now(), dryRun: (bool) $this->option('dry-run')));
        $this->info("Reminders queued: {$result->count}");
        return self::SUCCESS;
    }
}
// Provider: $this->commands([IssueOverdueRemindersCommand::class]);
// routes/console.php: Schedule::command('invoicing:overdue-reminders')->dailyAt('07:00');
```

Prefijo `invoicing:` siempre. Test thin: `$this->artisan('invoicing:overdue-reminders')->assertSuccessful()`.

## Generador make:module

Un generador propio evita que cada módulo nazca distinto. Vive en `app/Console/Commands`
(no en un módulo) y copia stubs desde `stubs/module/`.

```php
final class MakeModuleCommand extends Command
{
    protected $signature = 'make:module {name : PascalCase context name}';

    public function handle(Filesystem $fs): int
    {
        $name = Str::studly($this->argument('name'));
        $base = base_path("src/{$name}");
        if ($fs->exists($base)) { $this->error("Module {$name} already exists"); return self::FAILURE; }
        foreach ($fs->allFiles(base_path('stubs/module')) as $stub) {
            $target = $base . '/' . str_replace('.stub', '', $stub->getRelativePathname());
            $fs->ensureDirectoryExists(dirname($target));
            $fs->put($target, str_replace(['{{ Module }}', '{{ module }}'], [$name, Str::snake($name)], $fs->get($stub)));
        }
        $this->registerAutoload($name);   // "Name\\": "src/Name/" en composer.json
        $this->registerProvider($name);   // línea en bootstrap/providers.php
        return self::SUCCESS;
    }
}
```

Stubs mínimos: `Infrastructure/Providers/{{ Module }}ServiceProvider.php.stub`,
`Infrastructure/Http/routes.php.stub`, `Domain/.gitkeep`, `Application/.gitkeep`,
`Api/.gitkeep`, y `tests/Unit/{{ Module }}/.gitkeep`. Añade la capa a `deptrac.yaml` en
el mismo comando o falla el CI por `--fail-on-uncovered` (ver
[../../testing/architecture-tests.md](../../testing/architecture-tests.md)).

## Shared: qué entra y qué no

Entra: `AggregateRoot`, `DomainEvent`, `DomainException`, `Uuid`, `Clock` + `SystemClock`,
`EventBus` + `LaravelEventBus`, `Money` solo si es idéntico en todos los contextos. No
entra: nombres de negocio (`Customer`), helpers "útiles", traits de Eloquent. Con matices
distintos entre contextos, cada uno su copia: duplicar es más barato que acoplar.

## Comunicación entre módulos

1. **Evento de integración** (preferido): `Sales` publica `Sales\Api\OrderConfirmed`;
   `Invoicing\Infrastructure\Listeners\OnOrderConfirmedCreateDraft` lo escucha y llama a
   `CreateDraftInvoiceHandler`. El evento lleva ids y datos planos, no entidades.
2. **Puerto implementado con el otro módulo**: `Invoicing\Application\Port\CustomerDirectory`
   implementado por `Invoicing\Infrastructure\Acl\SalesCustomerDirectory`, que llama a
   `Sales\Api\SalesFacade`. Solo lecturas síncronas.
3. **Read model cruzado**: un `Reader` de `Invoicing` puede hacer `JOIN` a `customers` si la
   tabla es estable y está documentada como parte del contrato. Sin Eloquent del otro módulo.

Nunca: importar `Sales\Domain\*`, instanciar handlers de otro módulo desde Application,
compartir modelos Eloquent.

## Errores frecuentes

- `App\Models\Invoice` global que "de momento" usa el módulo: el módulo nunca se cierra. `routes/web.php` con `require` de cada módulo: el provider ya lo hace.
- FKs con `constrained()` entre tablas de módulos distintos: bloquea extracción y borrados.
- Factories de Eloquent usadas como builders de dominio en tests unitarios: arrastran bootstrap de Laravel.
- Carpeta `Shared` con `Helpers.php`: cajón de sastre.
- Módulo sin `Api/` que otros importan por `Application`: frontera rota.
- `make:model`/`make:controller` sin ruta crean en `app/` y quedan huérfanos; provider que registra bindings de otro módulo.

## Checklist

- [ ] Todos los módulos en la misma ubicación (`src/` o `app/Modules`), entrada PSR-4 explícita cada uno.
- [ ] Provider por módulo registra: bindings, rutas, migraciones, comandos, listeners, factories.
- [ ] Rutas con prefijo y `name` del módulo; sin closures; `route:cache` en verde.
- [ ] Migraciones dentro del módulo; sin FK cruzadas entre contextos.
- [ ] Suites `Unit`/`Integration`/`Feature` + grupo Pest por módulo; `Unit` sin bootstrap.
- [ ] Comandos con prefijo `<module>:`, thin, programados en `routes/console.php`.
- [ ] `make:module` genera estructura, autoload, provider y capa de deptrac.
- [ ] `Shared` solo con primitivos técnicos; cruces entre módulos solo por `Api/`, eventos o puertos con ACL.
