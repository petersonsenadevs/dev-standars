# Invariantes y errores de dominio

## Índice

- [Invariantes vs validación de entrada](#invariantes-vs-validación-de-entrada)
- [Dónde vive cada comprobación](#dónde-vive-cada-comprobación)
- [Excepciones de dominio: jerarquía, nombres y códigos](#excepciones-de-dominio-jerarquía-nombres-y-códigos)
- [Result vs excepciones por stack](#result-vs-excepciones-por-stack)
- [Traducción a HTTP en adaptadores](#traducción-a-http-en-adaptadores)
- [Mensajes para el usuario vs para logs](#mensajes-para-el-usuario-vs-para-logs)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Se apoya en [aggregates.md](aggregates.md) (dónde se protegen las invariantes),
[value-objects.md](value-objects.md) (validación en construcción) y
[overview-concepts](overview-concepts.md) §4 y §12.

## Invariantes vs validación de entrada

| | Validación de entrada | Invariante de dominio |
|---|---|---|
| Pregunta | ¿los datos tienen la forma correcta? | ¿el negocio permite esta operación en este estado? |
| Ejemplos | campo obligatorio, formato de email, entero positivo, enum conocido | no emitir sin líneas, no pagar una factura anulada, stock no negativo |
| Dónde | adaptador driving (FormRequest, zod, pydantic) y VO | agregado, VO compuesto, servicio de dominio |
| Cuándo | antes de construir el comando | al ejecutar el comando |
| Necesita estado | no | sí (el agregado cargado) |
| Resultado | 400/422 con lista de campos | error de dominio con nombre de negocio |

La validación de entrada **no sustituye** a la invariante: aunque el formulario impida
enviar una factura sin líneas, el agregado sigue comprobándolo, porque llegarán comandos
desde jobs, CLI o tests. La invariante **no sustituye** a la validación: el agregado no
debe recibir un `string` que pueda ser un email mal formado; recibe un `Email`.

## Dónde vive cada comprobación

```
HTTP/CLI  ->  validación de forma (schema)  ->  Command con VO ya válidos
          ->  Handler: carga agregado         ->  Agregado: invariantes de estado
          ->  Servicio de dominio: reglas entre agregados
```

- **VO** ([value-objects.md](value-objects.md)): validez intrínseca del valor (`Money` no
  negativo, `DateRange` con `from <= to`). Falla en el constructor.
- **Entidad/agregado**: reglas de estado y transición. Cada método público comprueba lo
  suyo **antes** de mutar; nunca deja el agregado a medias.
- **Servicio de dominio**: reglas que cruzan agregados (`TransferFunds` verifica saldo y límites).
- **Caso de uso**: existencia (`NotFound`), autorización de negocio (no técnica), y
  conflictos de concurrencia. No reimplementa invariantes del agregado.

```php
public function pay(Money $amount, \DateTimeImmutable $on): void
{
    if ($this->status === InvoiceStatus::Voided) throw InvoiceCannotBePaid::voided($this->id);
    if (!$amount->equals($this->total()))         throw InvoiceCannotBePaid::amountMismatch($this->id, $amount, $this->total());
    $this->status = InvoiceStatus::Paid;          // solo tras todas las comprobaciones
    $this->record(new InvoicePaid($this->id->value, $amount->amountCents, $on));
}
```

## Excepciones de dominio: jerarquía, nombres y códigos

Jerarquía plana y corta, una base por contexto:

```
DomainException (abstracta, del shared kernel o del módulo)
├── InvoiceCannotBeIssued          (regla violada)
├── InvoiceCannotBePaid
├── InvoiceNotFound                (opcional: algunos la ponen en Application)
└── InvalidMoney                   (desde VO)
```

Convenciones:
- **Nombre = frase del negocio**: `InvoiceCannotBeIssued`, `InsufficientFunds`,
  `OrderAlreadyShipped`. No `InvoiceException`, `ValidationError`, `BusinessRuleViolation`.
- **Constructores estáticos con el motivo**: `::withoutLines($id)`, `::amountMismatch(...)`.
  El motivo queda en el nombre del método, no en un string libre.
- **Código estable** (`code(): string`), en `snake_case` namespaced por contexto:
  `invoicing.invoice_cannot_be_issued.without_lines`. Lo usan la API, el frontend y los
  logs; el mensaje puede cambiar, el código no.
- **Datos estructurados** (`context(): array`): ids y valores implicados, para logs y para
  que el adaptador construya la respuesta sin parsear el mensaje.
- **Sin dependencias de framework**: extienden `\DomainException`/`Error`, no
  `HttpException`.

```php
abstract class DomainException extends \DomainException
{
    abstract public function code(): string;
    /** @return array<string, scalar> */
    public function context(): array { return []; }
}

final class InvoiceCannotBeIssued extends DomainException
{
    private function __construct(string $message, private readonly string $reason, private readonly array $ctx)
    { parent::__construct($message); }

    public static function withoutLines(InvoiceId $id): self
    { return new self("Invoice {$id->value} has no lines", 'without_lines', ['invoiceId' => $id->value]); }

    public function code(): string { return "invoicing.invoice_cannot_be_issued.{$this->reason}"; }
    public function context(): array { return $this->ctx; }
}
```

## Result vs excepciones por stack

Ambos son válidos; lo importante es **una sola convención por módulo** y que el error
esperado de negocio se distinga del fallo técnico.

| Stack | Recomendación | Motivo |
|---|---|---|
| PHP 8.3 / Laravel | **Excepciones** de dominio tipadas; `Result` no es idiomático, y el handler de excepciones de Laravel ya centraliza la traducción | sin tipos union ergonómicos para `Result`; `try/catch` es el estándar del ecosistema |
| TS (Node/Next/Vue) | **`Result<T, E>`** en dominio y aplicación (`E` = unión discriminada); excepciones solo para fallos técnicos (DB caída, bug) | el compilador obliga a manejar cada `kind`; en server actions y handlers de Next se devuelven como datos |
| Python 3.12 | **Excepciones** de dominio (jerarquía), con `match` en el adaptador; `Result` solo si el equipo ya lo usa (`returns`) | `raise` es idiomático; `except DomainError` centraliza; `match` cubre los casos |

```ts
// domain/errors.ts — unión discriminada, no clases sueltas
export type InvoiceError =
  | { kind: 'InvoiceNotFound'; invoiceId: string }
  | { kind: 'InvoiceCannotBeIssued'; invoiceId: string; reason: 'without_lines' | 'already_issued' }
  | { kind: 'InvoiceCannotBePaid'; invoiceId: string; reason: 'voided' | 'amount_mismatch' };

// domain/Invoice.ts
issue(now: Date): Result<void, InvoiceError> {
  if (this.lines.length === 0) return err({ kind: 'InvoiceCannotBeIssued', invoiceId: this.id.value, reason: 'without_lines' });
  this.status = 'issued';
  this.record(new InvoiceIssued(/* ... */));
  return ok(undefined);
}
```

```python
# domain/errors.py
class DomainError(Exception):
    code: str = "domain_error"
    def __init__(self, message: str, **context: object) -> None:
        super().__init__(message); self.context = context

class InvoiceCannotBeIssued(DomainError):
    code = "invoicing.invoice_cannot_be_issued"
    @classmethod
    def without_lines(cls, invoice_id: str) -> "InvoiceCannotBeIssued":
        return cls(f"Invoice {invoice_id} has no lines", invoice_id=invoice_id, reason="without_lines")
```

En cualquier stack: un VO inválido **siempre** lanza (o devuelve `err`) en construcción;
un `Result` con `ok: true` y un objeto a medias no existe.

## Traducción a HTTP en adaptadores

El dominio no conoce HTTP. El adaptador driving (controlador, exception handler, server
action) traduce **código de dominio -> status + cuerpo**. Una tabla por módulo, no un
`if` por controlador.

| Tipo | HTTP | Cuerpo |
|---|---|---|
| Validación de entrada | 422 | `{ errors: { field: [msg] } }` |
| `XNotFound` | 404 | `{ code, message }` |
| Regla de negocio violada (`XCannotBeY`) | 409 (conflicto de estado) o 422 si prefieres uniformidad; elige una y documenta | `{ code, message, context }` |
| Concurrencia optimista | 409 | `{ code: 'concurrency_conflict' }` |
| Autorización de negocio | 403 | `{ code }` |
| Fallo técnico (`\Throwable` no de dominio) | 500 | `{ code: 'internal_error', traceId }` sin detalles |

```php
// app/Exceptions/Handler.php (Laravel)
$this->renderable(function (DomainException $e, Request $request) {
    $status = match (true) {
        $e instanceof NotFoundInDomain      => 404,
        $e instanceof ConcurrencyConflict   => 409,
        default                             => 409,
    };
    return response()->json(['code' => $e->code(), 'message' => __("errors.{$e->code()}"), 'context' => $e->context()], $status);
});
```

```ts
// app/api/invoices/[id]/issue/route.ts (Next)
const r = await issueInvoice({ invoiceId: params.id });
if (!r.ok) return Response.json({ code: toCode(r.error), context: r.error }, { status: toStatus(r.error.kind) });
return new Response(null, { status: 204 });
```

Para GraphQL o server actions de Next, el mismo mapa produce `errors[].extensions.code`
o un objeto `{ ok: false, code }` devuelto al cliente. El frontend traduce `code` a texto
localizado; nunca muestra `message` tal cual.

## Mensajes para el usuario vs para logs

| Destino | Contenido | Fuente |
|---|---|---|
| Usuario final | frase localizada, accionable ("La factura no tiene líneas; añade al menos una") | traducción por `code` en el adaptador o el frontend |
| API pública | `code` estable + `message` en inglés técnico + `context` | excepción/`Result` |
| Log | `code`, `context`, `traceId`, stack solo en 5xx | exception handler + logger estructurado |

Reglas:
- El mensaje de la excepción es **técnico, en inglés, con ids**: sirve para depurar, no
  para pintar en pantalla.
- Los errores de dominio se loguean a nivel `info`/`warning`, no `error`: son flujo
  esperado. `error` queda para lo técnico.
- Nunca filtres `context` con datos sensibles (importes de terceros, emails ajenos) a la
  respuesta HTTP de un usuario que no debería verlos.
- Un mismo `code` siempre produce el mismo status HTTP: el cliente puede confiar en él.

## Errores frecuentes

- **Invariantes en el FormRequest/zod y no en el agregado**: el job nocturno crea facturas
  inválidas.
- **Validación de forma en el agregado** (regex de email dentro de `Invoice`): pertenece al VO.
- **Excepción genérica con string** (`throw new \Exception('cannot issue')`): imposible de
  traducir, de testear por tipo o de mapear a HTTP.
- **`HttpException` o `abort(422)` en el dominio**: acopla al framework y rompe CLI/jobs.
- **Mapear a HTTP en cada controlador**: inconsistencia; un solo handler por módulo.
- **`Result` y excepciones mezclados en el mismo módulo**: nadie sabe qué debe capturar.
- **Mutar y luego comprobar**: si la segunda comprobación falla, el agregado queda corrupto
  en memoria (y a veces persistido).
- **Mensaje de excepción mostrado al usuario**: filtra ids internos y no está localizado.
- **`catch (\Throwable)` que convierte fallos técnicos en 409**: oculta bugs.

## Checklist

- [ ] Validación de forma en adaptador + VO; invariantes de estado en el agregado.
- [ ] Cada método público del agregado comprueba todo antes de mutar.
- [ ] Excepciones/errores con nombre de negocio, constructor estático por motivo, `code` estable y `context`.
- [ ] Una sola convención por módulo: excepciones (PHP, Python) o `Result` (TS).
- [ ] Ninguna clase del dominio importa nada de HTTP ni del framework.
- [ ] Tabla única código -> status HTTP por módulo, aplicada en un solo handler.
- [ ] Errores de dominio se loguean como `warning`; fallos técnicos como `error` con `traceId`.
- [ ] El frontend traduce por `code`; no muestra `message` técnico.
- [ ] Tests: cada invariante tiene un test que espera el error concreto por tipo/`kind`.
