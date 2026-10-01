# Adaptadores HTTP e Inertia

## Índice

- [Anatomía de un controlador adaptador](#anatomía-de-un-controlador-adaptador)
- [Form Request: solo forma, y `toCommand()`](#form-request-solo-forma-y-tocommand)
- [Mapeo de excepciones de dominio a HTTP](#mapeo-de-excepciones-de-dominio-a-http)
- [Respuestas JSON: Resources desde DTOs](#respuestas-json-resources-desde-dtos)
- [Inertia: GET desde read model, POST a caso de uso](#inertia-get-desde-read-model-post-a-caso-de-uso)
- [Flash y errores de dominio](#flash-y-errores-de-dominio)
- [Paginación y filtros en el read model](#paginación-y-filtros-en-el-read-model)
- [Autorización: Policy antes del caso de uso](#autorización-policy-antes-del-caso-de-uso)
- [Tests finos del adaptador](#tests-finos-del-adaptador)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza `overview.md` §6-§8. Plantillas:
`templates/laravel/Infrastructure/Http/IssueInvoiceController.php` y
`templates/laravel/Application/IssueInvoice/IssueInvoiceHandler.php`. Lado cliente en
`../vue-front/inertia-and-spa-usecases.md`.

## Anatomía de un controlador adaptador

Un controlador invocable por intención. Responsabilidades, en este orden y ninguna más:
autorizar, validar forma (Form Request), construir el command, invocar el handler,
traducir el resultado a respuesta.

```php
final class IssueInvoiceController
{
    public function __construct(private readonly IssueInvoiceHandler $handler) {}

    public function __invoke(IssueInvoiceRequest $request, string $invoiceId): RedirectResponse|JsonResponse
    {
        $number = ($this->handler)($request->toCommand($invoiceId));

        return $request->wantsJson()
            ? response()->json(['number' => $number->value])
            : redirect()->route('invoices.show', $invoiceId)->with('success', __('invoices.issued', ['number' => $number->value]));
    }
}
```

Si un controlador necesita dos handlers, casi siempre falta un caso de uso que orqueste o
sobra un endpoint. Excepción aceptable: un GET que combina dos readers para una pantalla.

## Form Request: solo forma, y `toCommand()`

```php
final class IssueInvoiceRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()->can('issue', [Invoice::class, $this->route('invoiceId')]); }

    public function rules(): array
    {
        return ['issue_date' => ['required', 'date_format:Y-m-d'], 'notes' => ['nullable', 'string', 'max:500']];
    }

    public function toCommand(string $invoiceId): IssueInvoiceCommand
    {
        return new IssueInvoiceCommand(
            invoiceId: $invoiceId,
            actorId: (string) $this->user()->id,
            issuedOn: $this->date('issue_date')->toDateTimeImmutable(),
            notes: $this->string('notes')->toString() ?: null,
        );
    }
}
```

Lo que **no** va en `rules()`: closures que consultan `status`, cálculos, consultas a
otros agregados. Un `exists:invoices,id` simple es aceptable (ahorra un 404); una regla
"solo si es draft" es dominio disfrazado y se duplicará con la del agregado.

`toCommand()` es la única traducción de nombres HTTP (`issue_date`) a nombres de dominio
(`issuedOn`). Usa helpers tipados (`date()`, `string()`, `boolean()`), nunca `all()`. El
command es `final readonly` con primitivos y `DateTimeImmutable`; los VO se construyen en
el handler. Precognition (`HandlePrecognitiveRequests`) ejecuta solo el Form Request: errores
de formato en vivo; las reglas de dominio siguen saliendo como 409 en el POST real.

## Mapeo de excepciones de dominio a HTTP

Un solo punto: `bootstrap/app.php`. Cada excepción expone `code()` estable (snake_case,
parte del contrato de API) y `httpStatus()` por defecto.

```php
abstract class DomainException extends \DomainException
{
    abstract public function code(): string;          // 'invoice_cannot_be_issued'
    public function httpStatus(): int { return 409; }
}
abstract class NotFoundException extends DomainException { public function httpStatus(): int { return 404; } }

// bootstrap/app.php
->withExceptions(function (Exceptions $exceptions) {
    $exceptions->render(fn (DomainException $e, Request $request) => $request->wantsJson()
        ? response()->json(['error' => $e->code(), 'message' => $e->getMessage()], $e->httpStatus())
        : back()->withInput()->withErrors(['domain' => $e->getMessage()]));
    $exceptions->dontReport([DomainException::class]);
})
```

| Situación | Status | Origen |
|---|---|---|
| Forma inválida | 422 | Form Request, automático |
| Regla de negocio violada | 409 | `DomainException` |
| Agregado inexistente | 404 | `NotFoundException` |
| Sin permiso | 403 | Policy / `authorize()` |
| Infraestructura | 500 | no se mapea; se reporta |

No devuelvas 422 para reglas de dominio: mezcla "corrige el formulario" con "esta
operación no procede". El `error` estable permite al front mensajes por código.

## Respuestas JSON: Resources desde DTOs

`JsonResource` se construye desde el DTO del read model (`InvoiceRow`), nunca desde el
agregado ni desde un Model con relaciones a medias.

```php
final class InvoiceRowResource extends JsonResource
{
    /** @var InvoiceRow */ public $resource;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'number' => $this->resource->number,
            'total' => ['amount' => $this->resource->totalCents / 100, 'currency' => $this->resource->currency],
            'due_at' => $this->resource->dueAt?->format(DATE_ATOM),
        ];
    }
}
return InvoiceRowResource::collection($reader->forCustomer($customerId, $filters));
```

Tras un command responde con lo mínimo (`{ number }` o `202`) o redirige a la lectura.

## Inertia: GET desde read model, POST a caso de uso

```php
public function index(Request $request, PendingInvoicesReader $reader): Response
{
    $filters = InvoiceFilters::fromArray($request->only(['status', 'search', 'page']));
    return Inertia::render('Invoices/Index', [
        'invoices' => fn () => $reader->paginated($request->user()->customerId, $filters), // lazy prop
        'filters' => $filters->toArray(),
        'can' => ['issue' => $request->user()->can('issue', Invoice::class)],
    ]);
}
```

Props: DTOs planos (`JsonSerializable`) o arrays; nunca `InvoiceModel` (N+1, expone
columnas). Props costosas como closures para que `router.reload({ only })` no las
recalcule. Permisos como booleanos calculados en servidor: el front no decide.

## Flash y errores de dominio

Convención: `success` en flash; `errors.domain` para reglas violadas; `errors.<campo>`
para forma. El handler de excepciones ya devuelve `back()->withErrors(['domain' => ...])`,
que Inertia entrega en `page.props.errors.domain`.

```php
// app/Http/Middleware/HandleInertiaRequests.php
public function share(Request $request): array
{
    return [...parent::share($request), 'flash' => ['success' => fn () => $request->session()->get('success')]];
}
```

## Paginación y filtros en el read model

Paginar es del reader, no del repositorio ni del controlador. Devuelve un DTO `Page`, no
`LengthAwarePaginator`, para que la interfaz no dependa de Laravel.

```php
final readonly class Page { public function __construct(public array $items, public int $total, public int $page, public int $perPage) {} }

// DbPendingInvoicesReader::paginated
$query = DB::table('invoices as i')->where('i.customer_id', $customerId)
    ->when($filters->status, fn ($q, $s) => $q->where('i.status', $s))
    ->when($filters->search, fn ($q, $s) => $q->where('i.number', 'like', "{$s}%"));
$total = (clone $query)->count();
$rows = $query->orderByDesc('i.due_at')->forPage($filters->page, 25)->get()->map(InvoiceRow::fromRow(...))->all();
return new Page($rows, $total, $filters->page, 25);
```

`InvoiceFilters` es un DTO de aplicación con defaults saneados (`page >= 1`, `status` en
enum).

## Autorización: Policy antes del caso de uso

Policy responde "¿puede este usuario intentar esto?" (rol, tenant). El agregado responde
"¿procede ahora?" (estado). Preguntas distintas, capas distintas.

```php
public function issue(User $user, string $invoiceId): bool   // InvoicePolicy
{
    return $user->hasRole('billing') && InvoiceModel::whereKey($invoiceId)->where('tenant_id', $user->tenant_id)->exists();
}
```

La Policy es adaptador y puede usar Eloquent. No inyectes el usuario en el handler: pasa
`actorId` en el command y, si la regla depende del actor, un VO `Actor` resuelto aquí.

## Tests finos del adaptador

```php
it('issues and redirects with a flash message', function () {
    $invoice = InvoiceModel::factory()->draft()->hasLines(2)->create();
    $this->actingAs(billingUser())
        ->post(route('invoices.issue', $invoice->id), ['issue_date' => '2026-01-10'])
        ->assertRedirectToRoute('invoices.show', $invoice->id)->assertSessionHas('success');
});

it('maps a domain rule to 409 in JSON', function () {
    $invoice = InvoiceModel::factory()->draft()->create();   // sin líneas
    $this->actingAs(billingUser())
        ->postJson(route('invoices.issue', $invoice->id), ['issue_date' => '2026-01-10'])
        ->assertStatus(409)->assertJsonPath('error', 'invoice_cannot_be_issued');
});

it('renders the index component', fn () => $this->actingAs(billingUser())->get(route('invoices.index'))
    ->assertInertia(fn (Assert $page) => $page->component('Invoices/Index')->has('invoices.items')));
```

Más en `../../testing/adapter-tests.md`.

## Errores frecuentes

- **Lógica en el controlador** (`if ($invoice->status === 'draft')`): la regla vive en el agregado.
- **Form Request con reglas de negocio**: duplicación y 422 donde toca 409.
- **Devolver el Model** como prop o resource: expone esquema y provoca N+1.
- **`try/catch DomainException` por controlador**: centraliza en `withExceptions`.
- **Handler que recibe `Request` o `Auth::user()`**: acopla aplicación a HTTP.
- **Props Inertia gigantes** recalculadas en cada `reload`: lazy props y `only`.
- **Códigos de error como texto libre**: `code()` estable por excepción.

## Checklist

- [ ] Controlador invocable: autoriza, `toCommand()`, invoca handler, traduce.
- [ ] Form Request solo forma; Policy autoriza; agregado decide.
- [ ] `DomainException` → 409, `NotFoundException` → 404, con `code()` y `dontReport`.
- [ ] Resources y props desde DTOs de read models.
- [ ] Paginación y filtros en el reader; devuelve `Page`.
- [ ] Flash `success` compartido; errores de dominio en `errors.domain`.
- [ ] Tests finos: feliz, 422, 409, `assertInertia`.
