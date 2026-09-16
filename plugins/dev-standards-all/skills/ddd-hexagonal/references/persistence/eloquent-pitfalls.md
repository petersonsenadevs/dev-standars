# Eloquent como adaptador: trampas y soluciones

## Índice

- [El modelo Eloquent como esquema anémico](#el-modelo-eloquent-como-esquema-anémico)
- [Mapeo entidad a Model sin fugas](#mapeo-entidad-a-model-sin-fugas)
- [Transacciones y afterCommit](#transacciones-y-aftercommit)
- [Eventos de Eloquent frente a eventos de dominio](#eventos-de-eloquent-frente-a-eventos-de-dominio)
- [Observers, scopes globales y casts](#observers-scopes-globales-y-casts)
- [Scopes y query builder para read models](#scopes-y-query-builder-para-read-models)
- [N+1 dentro de repositorios](#n1-dentro-de-repositorios)
- [Concurrencia: lockForUpdate y versión optimista](#concurrencia-lockforupdate-y-versión-optimista)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Contexto general en `../stacks/laravel/overview.md` §4-5 y §12; estrategias de mapeo en
`orm-mapping.md`. Código de referencia:
`templates/laravel/Infrastructure/Persistence/Eloquent/EloquentInvoiceRepository.php`.

## El modelo Eloquent como esquema anémico

Eloquent es Active Record: el modelo sabe persistirse. En hexagonal lo degradamos a
**descripción de tabla con accesores tipados** y nada más.

```php
// src/Invoicing/Infrastructure/Persistence/Eloquent/InvoiceModel.php
final class InvoiceModel extends Model
{
    protected $table = 'invoices';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];                     // solo lo rellena el repositorio, nunca un request
    protected $casts = [
        'issued_at' => 'immutable_datetime',
        'due_at' => 'immutable_datetime',
        'total_cents' => 'integer',
        'version' => 'integer',
    ];

    public function lines(): HasMany { return $this->hasMany(InvoiceLineModel::class, 'invoice_id'); }
}
```

Lo que **no** lleva: métodos de negocio, accessors con cálculos, `$appends`, `boot()` con hooks,
`SoftDeletes`, traits de terceros con lógica (`HasStatuses`, `LogsActivity`) y `$fillable`
pensado para `$request->validated()`. Nombre con sufijo `Model` para que nadie lo confunda con la
entidad `Invoice`. Namespace `Infrastructure\Persistence\Eloquent`, protegido por deptrac
(`templates/laravel/deptrac.yaml`).

Si `app/Models/Invoice.php` ya existe: mover a `Infrastructure`, renombrar a `InvoiceModel`,
`class_alias` temporal y vaciar métodos de negocio uno a uno (`../checklists/migration-from-mvc.md`).

## Mapeo entidad a Model sin fugas

Reglas concretas sobre lo que hace la plantilla:

- `findOrNew` + asignación columna a columna en `save`. No `fill($invoice->toArray())`: la
  entidad no tiene `toArray` y no debe tenerla.
- `Carbon` -> `DateTimeImmutable` en `toDomain` (`$m->issued_at?->toDateTimeImmutable()`); en
  `save` Eloquent acepta `DateTimeInterface` directamente.
- `Money` -> `total_cents` + `currency`. El `total_cents` de la raíz es una desnormalización para
  listados; la fuente de verdad son las líneas. Recalcula siempre desde el agregado, nunca lo
  edites por SQL.
- `Invoice::reconstitute` recibe VO ya construidos. Si una fila trae un estado inválido,
  `InvoiceStatus::from` lanza `ValueError` en el repositorio: preferible a un agregado corrupto.
- Nunca devuelvas `Collection` de modelos ni un `InvoiceModel` desde un método del repositorio.
  Si un caso de uso "necesita el modelo", necesita un read model (`read-models-and-projections.md`).
- Métodos de consulta del repositorio (`overdueAt`) devuelven agregados completos cargados con
  `with('lines')`. Si solo hace falta un id o un total, no es método del repositorio.

## Transacciones y afterCommit

`DB::transaction` en el handler (tolerado en `Application/`) o un puerto `TransactionRunner`:

```php
// src/Shared/Infrastructure/Persistence/LaravelTransactionRunner.php
final class LaravelTransactionRunner implements TransactionRunner
{
    public function run(Closure $fn): mixed
    {
        return DB::transaction($fn, attempts: 3);   // reintenta deadlocks en MySQL/Postgres
    }
}
```

Puntos que fallan en producción:

- **Publicar eventos dentro de la transacción**: un listener `ShouldQueue` sin `afterCommit`
  puede ejecutarse en otro worker antes del commit y no encontrar la fila. Dos defensas
  complementarias: publicar tras `DB::transaction` (como hace `IssueInvoiceHandler`) **y**
  `public bool $afterCommit = true;` en cada listener y job encolado. En `config/queue.php`,
  `'after_commit' => true` por conexión lo hace global.
- **Transacciones anidadas**: `DB::transaction` anidado usa savepoints; `DB::afterCommit` se
  difiere hasta el commit más externo. Si un job ejecuta un handler que abre su propia
  transacción, sigue funcionando; si el test usa `RefreshDatabase` (que envuelve en transacción),
  los callbacks `afterCommit` **no** se disparan salvo que uses `DatabaseTruncation` o
  `Event::fake` con aserciones sobre `dispatch`.
- **Conexiones múltiples**: `DB::transaction` solo cubre la conexión por defecto. Un repositorio
  en otra conexión no participa; hazlo explícito con `DB::connection('x')->transaction`.
- **`Model::save()` fuera de transacción en `save` del repositorio**: raíz y líneas se escriben en
  varias sentencias; sin transacción externa, un fallo deja la raíz sin líneas. El repositorio no
  abre transacciones; asume que el caso de uso lo hizo (documéntalo en la interfaz del puerto).

## Eventos de Eloquent frente a eventos de dominio

| | Evento de Eloquent (`creating`, `saved`) | Evento de dominio (`InvoiceIssued`) |
|---|---|---|
| Lo dispara | El ORM al persistir | El agregado al cumplirse una intención |
| Contiene | El modelo entero, mutable | Datos inmutables del hecho (id, número, total, fecha) |
| Cuándo | Antes/después de cada `save`, incluso en seeds y tests | Una vez, cuando `issue()` tiene éxito |
| Transacción | Dentro; los listeners ven estado no confirmado | Tras commit |
| Uso legítimo | `updated_at`, generar id técnico | Todo efecto secundario de negocio |

Consecuencia práctica: `InvoiceModel` no tiene `$dispatchesEvents`, ni `booted()` con
`static::saved(...)`. Si un módulo legacy escucha `saved` del modelo, sustitúyelo por un listener
de `InvoiceIssued` en el `ServiceProvider`. `LaravelEventBus` traduce evento de dominio a
`Event::dispatch`; el evento de dominio es una clase `final readonly` sin traits de Laravel
(`Dispatchable`, `SerializesModels` van en un envoltorio si hace falta encolar).

```php
final class LaravelEventBus implements EventBus
{
    public function publish(DomainEvent ...$events): void
    {
        foreach ($events as $event) {
            DB::afterCommit(fn () => Event::dispatch($event));   // seguro dentro o fuera de transacción
        }
    }
}
```

Fuera de transacción `DB::afterCommit` ejecuta inmediatamente, así que el bus funciona en ambos
contextos. Ver `../stacks/laravel/jobs-events-listeners.md` para listeners e idempotencia.

## Observers, scopes globales y casts

- **Observers**: eventos de Eloquent con la lógica escondida en otra clase. Prohibidos para
  negocio; tolerables para auditoría técnica, aunque un listener de dominio es más explícito.
- **Global scopes**: `SoftDeletingScope`, `TenantScope` afectan a **todas** las consultas, con
  `withoutGlobalScope` disperso como escape. Multi-tenant: el repositorio recibe `TenantId` y lo
  aplica en cada `where`; "eliminados": estado del dominio (`voided`) que el read model filtra.
- **Casts a VO** (`'total' => MoneyCast::class`): acoplan el VO al ciclo de vida del modelo
  (`toArray`, serialización de colas, `factory()`). Casts solo para primitivos
  (`immutable_datetime`, `integer`, `AsArrayObject`); el mapeo a VO vive en el repositorio.
- **`$with` por defecto**: carga relaciones en cualquier consulta, incluidas las de read models.
  Declara el eager load en cada método del repositorio.
- **`$guarded = []`**: seguro aquí porque solo el repositorio rellena el modelo; peligroso si el
  modelo se reutiliza en un controlador CRUD.

## Scopes y query builder para read models

Los scopes locales (`scopeIssued`) son útiles para **lecturas**, no para el repositorio del
agregado. El query builder sobre tablas es más directo y no arrastra casts ni relaciones:

```php
public function summary(string $customerId, int $year): InvoiceSummary
{
    $row = DB::table('invoices')
        ->selectRaw('count(*) as issued, coalesce(sum(total_cents), 0) as total_cents, currency')
        ->where('customer_id', $customerId)->where('status', 'issued')
        ->whereYear('issued_at', $year)->groupBy('currency')->first();
    return $row ? InvoiceSummary::fromRow($row) : InvoiceSummary::empty();
}
```

`paginate()` devuelve `LengthAwarePaginator`, tipo de Laravel: aceptable en `Infrastructure` y en
el controlador; en `Application` un DTO `Page<InvoiceRow>` propio. Proyecciones y tablas de
lectura en `read-models-and-projections.md`.

## N+1 dentro de repositorios

Lugares típicos donde aparece aunque el repositorio "haga `with`":

- Hijas anidadas dos niveles (`lines.taxes`) en métodos que devuelven listas (`overdueAt`):
  declara la cadena completa `with('lines.taxes')`.
- Acceso a una relación no cargada en `toDomain` (`$m->customer->name`): el mapper no navega
  fuera del agregado; ese dato pertenece a un read model.
- `lines()->delete()` + `createMany` en bucle de agregados: para lotes (importaciones), un
  `saveAll` que agrupe `whereIn` + `insert`.

Detección: `Model::shouldBeStrict(! app()->isProduction())` en `AppServiceProvider` lanza
excepción ante lazy loading, atributos inexistentes y asignación silenciosa. Un test de
integración con `DB::enableQueryLog()` y aserción de número máximo de consultas protege los
métodos que devuelven colecciones (`../testing/adapter-tests.md`).

## Concurrencia: lockForUpdate y versión optimista

**Pesimista** (secuencias, saldos, cupos): `lockForUpdate` dentro de la transacción del caso de
uso, en el repositorio que gestiona el recurso disputado.

```php
final class DbInvoiceSequenceRepository implements InvoiceSequenceRepository
{
    public function next(Series $series, DateTimeImmutable $at): InvoiceNumber
    {
        $row = DB::table('invoice_sequences')->where('series', $series->value)->where('year', $at->format('Y'))
            ->lockForUpdate()->first();
        $last = $row?->last ?? 0;
        DB::table('invoice_sequences')->updateOrInsert(
            ['series' => $series->value, 'year' => (int) $at->format('Y')], ['last' => $last + 1]);
        return InvoiceNumber::compose($series, (int) $at->format('Y'), $last + 1);
    }
}
```

Sin transacción abierta `lockForUpdate` no bloquea: el test de integración ejecuta el caso de uso completo.

**Optimista** (edición concurrente de un agregado): columna `version`, comprobación en `save`.

```php
public function save(Invoice $invoice): void
{
    $expected = $invoice->version();
    $affected = InvoiceModel::query()->whereKey($invoice->id->value)->where('version', $expected)
        ->update([...InvoiceMapper::columns($invoice), 'version' => $expected + 1]);

    if ($affected === 0 && $expected > 0) {
        throw ConcurrencyConflict::forAggregate('Invoice', $invoice->id->value);
    }
    if ($expected === 0) { InvoiceModel::query()->create([...InvoiceMapper::columns($invoice), 'version' => 1]); }
    $this->replaceLines($invoice);
}
```

`ConcurrencyConflict` -> 409 en HTTP. No uses `updated_at` como versión: precisión de segundo
y lo toca cualquier `touch()`.

## Errores frecuentes

- `InvoiceModel::factory()->create()` en tests de dominio o aplicación: la factory es para tests
  de adaptador; el builder de dominio para el resto (`../testing/test-data-builders.md`).
- `$request->validated()` -> `Model::create()` en un módulo con agregado: dos caminos de
  escritura, invariantes saltadas.
- `Event::dispatch` directo dentro de `DB::transaction`, con listener encolado sin `afterCommit`.
- `RefreshDatabase` en un test que espera efectos de `afterCommit`: nunca se disparan.
- `->toArray()` del modelo como respuesta de API: expone `version` y acopla HTTP al esquema.
- `firstOrFail` en el repositorio dejando escapar `ModelNotFoundException` (404 automático) en
  vez de `null` para que el caso de uso lance `InvoiceNotFound`.
- Mutar `$model->lines` y esperar que `save()` lo persista: Eloquent no rastrea relaciones.

## Checklist

- [ ] Modelos en `Infrastructure\Persistence\Eloquent`, sufijo `Model`, sin métodos de negocio ni hooks.
- [ ] Repositorio asigna columnas explícitas; `toDomain` usa `reconstitute` y convierte Carbon.
- [ ] Ningún `Model` ni `Collection` de modelos sale del repositorio.
- [ ] Transacción en el caso de uso; eventos publicados con `DB::afterCommit`; listeners con `afterCommit = true`.
- [ ] Sin `$dispatchesEvents`, observers ni global scopes con lógica de negocio.
- [ ] `Model::shouldBeStrict()` activo fuera de producción; test de número de consultas en métodos que devuelven listas.
- [ ] `lockForUpdate` solo dentro de transacción; `version` para agregados editados concurrentemente.
- [ ] Read models con query builder o scopes de lectura, nunca hidratando agregados.
