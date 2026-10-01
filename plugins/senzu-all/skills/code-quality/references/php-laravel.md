# PHP 8.3+ / Laravel 12-13: buenas prácticas

## Índice

- [Tipado estricto y lenguaje](#tipado-estricto-y-lenguaje)
- [readonly, enums y DTOs](#readonly-enums-y-dtos)
- [Arquitectura: controladores, Form Requests, Actions y Services](#arquitectura-controladores-form-requests-actions-y-services)
- [Eloquent](#eloquent)
- [Colas y jobs idempotentes](#colas-y-jobs-idempotentes)
- [Eventos y listeners](#eventos-y-listeners)
- [Autorización: políticas y gates](#autorización-políticas-y-gates)
- [API Resources y respuestas](#api-resources-y-respuestas)
- [Validación](#validación)
- [Excepciones de dominio](#excepciones-de-dominio)
- [Config, env, cache y rate limiting](#config-env-cache-y-rate-limiting)
- [Migraciones seguras](#migraciones-seguras)
- [Testing con Pest](#testing-con-pest)
- [Herramientas: Pint, PHPStan/Larastan, CI](#herramientas-pint-phpstanlarastan-ci)

## Tipado estricto y lenguaje

- `declare(strict_types=1);` en todos los archivos. Evita coerciones silenciosas (`"1" + 1`).
- Tipa siempre parámetros, retornos y propiedades. Usa tipos de unión y `?T` solo cuando el `null` es un estado real, no por pereza.
- Prefiere `final` por defecto en clases de aplicación; abre a herencia solo con intención.
- Usa `match` en lugar de `switch` (exhaustivo, sin fallthrough, devuelve valor).
- Named arguments para constructores con muchos parámetros; promoción de propiedades en el constructor.
- Evita `mixed`, arrays asociativos sin forma y `array` como tipo de retorno de servicios: devuelve objetos o colecciones tipadas. Documenta arrays con PHPDoc `array<string, int>` / `list<User>` para que PHPStan los entienda.
- Sin `compact()`/`extract()` ni variables dinámicas: rompen el análisis estático.

## readonly, enums y DTOs

- Value objects y DTOs como `final readonly class` con promoción de propiedades. Inmutables por construcción; para "modificar" crea uno nuevo (`with...`).
- Enums respaldados (`enum Status: string`) para estados y tipos. Añade métodos (`label()`, `canTransitionTo()`) al enum en lugar de `if` dispersos. Cast en Eloquent: `'status' => Status::class`.
- Nunca uses strings mágicos para estados: el enum es la única fuente de verdad.

```php
final readonly class CreateOrderData
{
    public function __construct(
        public int $customerId,
        public Money $total,
        public Currency $currency,
    ) {}

    public static function fromRequest(CreateOrderRequest $request): self
    {
        return new self(
            customerId: $request->integer('customer_id'),
            total: Money::fromCents($request->integer('total_cents')),
            currency: Currency::from($request->string('currency')->toString()),
        );
    }
}
```

## Arquitectura: controladores, Form Requests, Actions y Services

- Controlador delgado: recibe Form Request, llama a una Action/Service, devuelve Resource/redirect. Sin lógica de negocio ni queries complejas.
- Form Request por endpoint de escritura: `authorize()` + `rules()` + método `toData()` que devuelve el DTO. Nunca `$request->all()` a un `create()`.
- **Action**: una clase, un caso de uso, un método `handle()` (o `__invoke`). Se inyecta por constructor. Testable sin HTTP.
- **Service**: agrupa varias operaciones cohesionadas sobre un mismo concepto (p. ej. `PaymentGateway`). Si crece más de ~300 líneas, divídelo.
- Transacción en la Action, no en el controlador ni en el modelo.
- Nada de lógica en modelos más allá de relaciones, scopes, casts y accessors sencillos. Sin `boot()` con efectos secundarios de negocio (usa observers con criterio, o mejor eventos explícitos).

```php
// Malo
public function store(Request $request) {
    $order = Order::create($request->all());
    Mail::to($order->customer)->send(new OrderCreated($order));
    return $order;
}

// Bueno
public function store(CreateOrderRequest $request, CreateOrder $action): OrderResource {
    $order = $action->handle($request->toData(), $request->user());
    return OrderResource::make($order);
}
```

## Eloquent

- **N+1**: activa `Model::preventLazyLoading(! app()->isProduction())` en `AppServiceProvider`. Usa `with()` / `load()` explícitos; `withCount()` para contadores.
- Selecciona columnas cuando la tabla es ancha: `select(['id', 'name'])` con `with(['profile:id,user_id,avatar'])`.
- Grandes volúmenes: `chunkById()` / `lazyById()` (nunca `chunk()` si modificas la columna de orden). `cursor()` para lectura secuencial.
- Escrituras masivas: `upsert()`, `insert()`; evita bucles con `save()`.
- Transacciones: `DB::transaction(fn () => ...)` alrededor de escrituras múltiples. Dentro de una transacción, despacha jobs con `->afterCommit()` (o `ShouldDispatchAfterCommit`) para evitar procesar registros aún no confirmados.
- Bloqueos: `lockForUpdate()` para lógica de saldos/stock; cuidado con deadlocks (orden de bloqueo constante).
- Scopes locales con nombre de negocio (`scopeActive`, `scopePublishedBefore(Carbon $date)`). Evita scopes globales salvo multi-tenant/soft deletes.
- Casts: `datetime`, `decimal:2`, enums, `AsCollection`, `encrypted`. Casts custom para value objects (`Money`).
- `$fillable` explícito o `$guarded = []` solo si validas todo mediante DTOs (preferible pasar arrays construidos por ti, nunca input crudo).
- Sin queries en accessors ni en Blade. Sin `->get()->count()`: usa `->count()`.
- Fecha/hora siempre en UTC en BD; conversión en la capa de presentación.

## Colas y jobs idempotentes

- Un job = una unidad de trabajo reintentable. Pasa IDs (o modelos, que se serializan por ID), no objetos grandes.
- **Idempotencia**: ejecutar dos veces no debe duplicar efectos. Usa `ShouldBeUnique`/`WithoutOverlapping`, claves de idempotencia en BD (unique index) o `updateOrCreate`.
- Define `$tries`, `$backoff` (exponencial: `[10, 60, 300]`), `$timeout` y `retryUntil()` en jobs que llaman a APIs externas. `failed(Throwable $e)` para compensar y alertar.
- Cadena o batch (`Bus::chain`, `Bus::batch`) para flujos multi-paso; no anides `dispatch()` a ciegas.
- Horizon en producción; una cola por criticidad (`default`, `notifications`, `heavy`). Monitoriza `failed_jobs`.
- Jobs no deben depender de estado de sesión ni del request.

## Eventos y listeners

- Eventos para desacoplar efectos secundarios (mail, auditoría, webhooks) del caso de uso principal. Nombre en pasado: `OrderPlaced`.
- Listeners en cola (`ShouldQueue`) si tocan I/O. Un listener por responsabilidad.
- Evita cadenas de eventos que disparan eventos: se vuelve imposible de seguir. Si un flujo tiene >2 saltos, hazlo explícito en una Action.
- Registra listeners por descubrimiento automático (Laravel 11+) o explícitamente en `AppServiceProvider`; no mezcles ambas.

## Autorización: políticas y gates

- Una Policy por modelo; métodos `viewAny`, `view`, `create`, `update`, `delete`. Sin lógica de permisos en controladores o Blade más allá de `@can`.
- Aplica en controlador con `$this->authorize()` o `Gate::authorize()`, y en Form Request con `authorize()`. Ambas capas no sobran.
- Comprueba propiedad (IDOR): `return $user->id === $order->customer_id;`. Nunca confíes en que el ID de la URL pertenece al usuario.
- Roles/permisos: usa un paquete probado (spatie/laravel-permission) en lugar de columnas booleanas dispersas.

## API Resources y respuestas

- Toda respuesta JSON pasa por un `JsonResource`. Nunca devuelvas modelos crudos (filtra columnas sensibles y estabiliza el contrato).
- `whenLoaded('relation')` para no forzar N+1; `when($condition, ...)` para campos condicionales.
- Colecciones paginadas: `Resource::collection($paginator)`; deja los metadatos estándar.
- Fechas en ISO 8601 con zona (`->toIso8601String()`), dinero como entero en la menor unidad + código de moneda.
- Códigos HTTP correctos: 201 en creación, 204 sin cuerpo, 422 validación, 403 autorización, 404 inexistente (también cuando no eres dueño, si no quieres filtrar existencia).

## Validación

- Reglas en Form Requests; reglas reutilizables en clases `Rule` custom (`ValidationRule`).
- Valida el tipo real: `integer`, `uuid`, `email:rfc,dns`, `Rule::enum(Status::class)`, `Rule::exists('table', 'id')->where(...)` con restricción de tenant.
- `bail` en reglas costosas. `sometimes` para campos opcionales en update.
- Normaliza antes de validar (`prepareForValidation`): trim, lowercase de emails.
- Mensajes de error para el usuario; los detalles técnicos van al log.

## Excepciones de dominio

- Jerarquía propia: `abstract class DomainException extends \DomainException` y subclases concretas (`InsufficientStock`, `OrderAlreadyPaid`). Constructores estáticos con nombre: `InsufficientStock::for($product, $requested)`.
- Las excepciones de dominio llevan contexto (IDs, cantidades), no strings formateados a mano en cada throw.
- Mapea a HTTP en `bootstrap/app.php` (`->withExceptions()`): dominio → 409/422 con `problem+json`; técnicas → 500 sin detalles.
- No captures `\Throwable` para "seguir": captura la excepción concreta que sabes manejar y relanza el resto.
- `report()` para excepciones que quieres en el log sin interrumpir el flujo (raras). `rescue()` solo para operaciones realmente opcionales.

## Config, env, cache y rate limiting

- `env()` **solo** dentro de `config/*.php`. En código, `config('services.stripe.key')`. Con `config:cache`, `env()` fuera de config devuelve `null`.
- Valores por defecto seguros en config; `.env.example` completo y actualizado.
- Cache: `Cache::remember($key, $ttl, fn)` con claves con prefijo y versión (`orders:v2:{id}`); invalida por evento, no por TTL infinito. Tags solo en Redis. `Cache::lock()` para evitar estampidas en cálculos caros.
- Rate limiting: `RateLimiter::for('api', fn (Request $r) => Limit::perMinute(60)->by($r->user()?->id ?: $r->ip()))`. Límites más estrictos en login/reset/password y endpoints caros. Usa `throttle:` en rutas.
- Redis para cache, sesión y colas en producción; `database` driver solo para desarrollo.

## Migraciones seguras

- Una migración = un cambio pequeño y reversible (`down()` real). Nunca edites una migración ya desplegada.
- Índices para toda FK y para columnas de filtrado/orden frecuentes. Unique index para invariantes de negocio (no confíes solo en validación).
- Columnas nuevas: `nullable()` o con `default()`; rellena datos en un job/comando aparte, luego endurece (`NOT NULL`) en otra migración.
- Tablas grandes: evita `ALTER` bloqueante en horario pico; renombrar columna = añadir nueva + copiar + cambiar código + borrar antigua (expand/contract).
- No mezcles cambios de esquema con cambios de datos en la misma migración. Sin Eloquent en migraciones (usa `DB::table`).
- `php artisan migrate --pretend` en revisión; `schema:dump` para acotar el historial.

## Testing con Pest

- Feature tests para cada endpoint (happy path + validación + autorización), unit tests para Actions, value objects y reglas.
- `RefreshDatabase` con SQLite en memoria solo si no dependes de features de Postgres/MySQL; en caso contrario, BD real en contenedor.
- Factories con `states` de negocio (`->paid()`, `->cancelled()`); sin `create()` masivos innecesarios (usa `make()` en unit tests).
- Fakes de framework: `Queue::fake()`, `Event::fake([OrderPlaced::class])`, `Mail::fake()`, `Http::fake()`, `Storage::fake()`. Asegura que los fakes se afirman (`assertPushed`).
- Nombre descriptivo: `it('rejects an order when stock is insufficient')`. `dataset()` para variantes.
- Arquitectura: `arch()->expect('App\Domain')->not->toUse('Illuminate\Http')`.
- Comandos: `php artisan test --parallel`, `vendor/bin/pest --coverage --min=80` en CI.

## Herramientas: Pint, PHPStan/Larastan, CI

- Pint con preset `laravel` (o `per`), ejecutado en pre-commit y verificado en CI (`pint --test`).
- Larastan nivel **8** mínimo en código nuevo; baseline (`phpstan.neon` con `baseline`) para legado y reducirlo progresivamente. Sin `@phpstan-ignore` sin justificación en comentario.
- Rector para migraciones de versión de PHP/Laravel.
- `composer audit` y `composer outdated --direct` en CI semanal.
- Orden de CI: pint → phpstan → pest. Todo verde antes de pedir revisión.
