# Tests de casos de uso: fakes en memoria y orquestación

## Índice

- [Qué prueba un test de caso de uso](#qué-prueba-un-test-de-caso-de-uso)
- [Fakes con comportamiento, no mocks](#fakes-con-comportamiento-no-mocks)
- [Un fake por puerto: catálogo mínimo](#un-fake-por-puerto-catálogo-mínimo)
- [Verificar eventos publicados](#verificar-eventos-publicados)
- [Errores de dominio: propagación y mapeo](#errores-de-dominio-propagación-y-mapeo)
- [Verificar la transacción](#verificar-la-transacción)
- [Cuándo un spy sí está bien](#cuándo-un-spy-sí-está-bien)
- [Ejemplo completo por stack](#ejemplo-completo-por-stack)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza el §3 de [overview.md](overview.md). El caso de uso de referencia es
`IssueInvoice` (`templates/*/application/`); los fakes que se muestran aquí viven en
`tests/support` (PHP), `src/modules/<ctx>/testing/` (TS) o `<ctx>/testing/` (Python).

## Qué prueba un test de caso de uso

Orquestación: **cargar → aplicar regla → persistir → publicar**, y las decisiones que el
caso de uso toma por sí mismo (qué hacer si no existe, si el actor no puede, qué devuelve).
Las reglas de negocio ya están probadas en [domain-tests.md](domain-tests.md): aquí solo se
comprueba que el caso de uso las **invoca** y reacciona al resultado.

Un caso de uso típico necesita entre 4 y 8 tests:

| Caso | Qué se afirma |
|---|---|
| Camino feliz | estado persistido, evento publicado, valor devuelto |
| Agregado no encontrado | error `NotFound`, nada persistido, nada publicado |
| Regla de dominio rechaza | error de dominio propagado, nada persistido ni publicado |
| Fallo de un puerto al guardar | transacción no confirmada, evento no publicado |
| Idempotencia (si aplica) | segunda ejecución no duplica efectos |
| Autorización (si el caso de uso la decide) | error `Forbidden` antes de cargar nada |

## Fakes con comportamiento, no mocks

Un fake implementa el puerto **con memoria real**: lo que guardas lo recuperas. El test
afirma resultados ("la factura queda emitida"), no interacciones ("se llamó a `save`").
Ventajas: los tests sobreviven a refactors internos del handler, y el mismo fake sirve
para el contract test de [adapter-tests.md](adapter-tests.md).

```php
// tests/support/InMemoryInvoiceRepository.php
final class InMemoryInvoiceRepository implements InvoiceRepository
{
    /** @var array<string, Invoice> */
    private array $rows = [];
    private int $nextId = 1;

    public function nextId(): InvoiceId { return InvoiceId::of('inv-' . $this->nextId++); }   // determinístico
    public function ofId(InvoiceId $id): ?Invoice { return isset($this->rows[$id->value]) ? clone $this->rows[$id->value] : null; }
    public function save(Invoice $invoice): void { $this->rows[$invoice->id->value] = clone $invoice; }
    public function overdueAt(DateTimeImmutable $at): array
    { return array_values(array_filter($this->rows, fn (Invoice $i) => $i->isOverdueAt($at))); }
}
```

Detalles que importan: `clone` en `ofId`/`save` (si no, el test ve mutaciones antes del
`save` y pasa por accidente); ids secuenciales; consultas del puerto reimplementadas con
la misma semántica que el SQL (lo verifica el contract test).

## Un fake por puerto: catálogo mínimo

Para un módulo con `Invoice` bastan cinco dobles reutilizables:

```ts
// src/modules/invoicing/testing/index.ts
export class InMemoryInvoiceRepository implements InvoiceRepository { /* Map<string, Invoice> */ }

export class RecordingEventBus implements EventBus {
  readonly published: DomainEvent[] = [];
  async publish(events: DomainEvent[]) { this.published.push(...events); }
  ofType<E extends DomainEvent>(name: E['name']): E[] { return this.published.filter((e) => e.name === name) as E[]; }
}

export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });

export class FakeTransactionRunner implements TransactionRunner {
  committed = 0; rolledBack = 0;
  async run<T>(fn: () => Promise<T>) {
    try { const r = await fn(); this.committed++; return r; }
    catch (e) { this.rolledBack++; throw e; }
  }
}

export class FailingInvoiceRepository extends InMemoryInvoiceRepository {
  async save(): Promise<void> { throw new Error('db down'); }
}
```

`FailingX` como subclase del fake prueba el camino de fallo sin mock. Python:
`FakeUnitOfWork` con `committed: bool` ([../stacks/python/overview.md](../stacks/python/overview.md) §5).

## Verificar eventos publicados

Afirma **qué** se publicó, **cuántos** y **cuándo** (después de persistir). Tres asserts que
se suelen olvidar: cero eventos cuando el caso de uso falla; el agregado guardado tiene la
lista de eventos vacía (se hizo `pullEvents`); el payload del evento coincide con el estado
persistido.

```python
def test_issue_publishes_invoice_issued_after_commit():
    uow, bus = FakeUnitOfWork(), RecordingEventBus()
    uow.invoices.save(an_invoice().with_line(Money(1000, "EUR")).build())

    IssueInvoice(uow, FixedClock(datetime(2026, 1, 10, tzinfo=UTC)), bus)(IssueInvoiceCommand("inv-1", "u1"))

    [event] = bus.of_type(InvoiceIssued)
    assert event.number == uow.invoices.of_id(InvoiceId("inv-1")).number
    assert bus.published_after_commit is True     # el fake registra si commit precedió a publish


def test_nothing_is_published_when_the_invoice_has_no_lines():
    uow, bus = FakeUnitOfWork(), RecordingEventBus()
    uow.invoices.save(an_invoice().build())

    with pytest.raises(InvoiceCannotBeIssued):
        IssueInvoice(uow, FixedClock(...), bus)(IssueInvoiceCommand("inv-1", "u1"))

    assert bus.published == [] and uow.committed is False
```

`published_after_commit` se implementa dejando que `FakeUnitOfWork.commit()` marque un
flag que `RecordingEventBus.publish()` lee (los dos fakes comparten una referencia). Es
la única forma barata de probar "publicar tras commit" sin BD.

## Errores de dominio: propagación y mapeo

El caso de uso no traduce errores de dominio a HTTP; los deja pasar (PHP/Python:
excepción; TS: `Result`). Prueba que **llegan intactos** al llamador, con su tipo concreto,
y que el caso de uso añade los suyos propios (`NotFound`, `Forbidden`) con el mismo
mecanismo.

```ts
it('returns NotFound without touching the event bus', async () => {
  const { sut, events } = makeSut();                                      // makeSut: ver ejemplo completo
  expect(await sut({ invoiceId: 'nope', actorId: 'u1' })).toEqual(err({ kind: 'NotFound', invoiceId: 'nope' }));
  expect(events.published).toHaveLength(0);
});

it('propagates the domain error as-is', async () => {
  const { sut } = makeSut([anInvoice().withId('inv-1').build()]);        // sin líneas
  expect(await sut({ invoiceId: 'inv-1', actorId: 'u1' })).toEqual(err({ kind: 'NoLines', invoiceId: 'inv-1' }));
});
```

El mapeo a 409/422 se prueba una vez en el test HTTP fino ([adapter-tests.md](adapter-tests.md)).

## Verificar la transacción

Lo que hay que demostrar: (1) todo lo que el caso de uso escribe ocurre dentro de la
transacción; (2) si algo falla dentro, nada queda confirmado; (3) los eventos se publican
fuera. Con `FakeTransactionRunner`/`FakeUnitOfWork` se cubre sin BD:

```php
it('does not publish when saving fails inside the transaction', function () {
    $invoices = new FailingInvoiceRepository();
    $invoices->seed(anInvoice()->withLine(Money::eur(100))->build());
    $events = new RecordingEventBus();
    $handler = new IssueInvoiceHandler($invoices, new InMemorySequence(), $events, new FixedClock('2026-01-10'));

    expect(fn () => $handler(new IssueInvoiceCommand('inv-1', 'u1')))->toThrow(RuntimeException::class)
        ->and($events->published)->toBeEmpty();
});
```

Si el handler usa `DB::transaction` directamente (decisión pragmática de
[../stacks/laravel/overview.md](../stacks/laravel/overview.md) §5), el test de aplicación
necesita el TestCase de Laravel con `RefreshDatabase` solo por el `DB::` facade; el
atomicidad real (rollback en Postgres/MySQL) se prueba una vez en integración. Es el coste
de no tener puerto `TransactionRunner`: decídelo conscientemente.

## Cuándo un spy sí está bien

Puertos de **salida pura** cuyo único efecto observable es la llamada: `Mailer`,
`WebhookNotifier`, `AuditLog`. Un `RecordingMailer` con `sent: list[Email]` es a la vez
fake y spy y permite `assert [e.to for e in mailer.sent] == ["ana@example.com"]`; evita
`Mockery::mock()->shouldReceive()` porque acopla al nombre del método.

Casos de uso de lectura (`ListPendingInvoices`) que solo delegan en un `Reader`: sin test
unitario; el test de integración del reader más el HTTP fino los cubren.

## Ejemplo completo por stack

```php
// tests/Unit/Invoicing/Application/IssueInvoiceHandlerTest.php
beforeEach(function () {
    $this->invoices = new InMemoryInvoiceRepository();
    $this->events = new RecordingEventBus();
    $this->handler = new IssueInvoiceHandler($this->invoices, new InMemorySequence('2026-A-'), $this->events, new FixedClock('2026-01-10'));
});

it('issues a draft with lines and publishes InvoiceIssued', function () {
    $this->invoices->save(anInvoice()->withLine(Money::eur(1000))->build());

    ($this->handler)(new IssueInvoiceCommand('inv-1', 'u1'));

    $saved = $this->invoices->ofId(InvoiceId::of('inv-1'));
    expect($saved->status())->toBe(InvoiceStatus::Issued)
        ->and($saved->number()->value)->toBe('2026-A-000001')
        ->and($this->events->ofType(InvoiceIssued::class))->toHaveCount(1);
});

it('fails with InvoiceNotFound for unknown ids', fn () =>
    expect(fn () => ($this->handler)(new IssueInvoiceCommand('nope', 'u1')))->toThrow(InvoiceNotFound::class));
```

```ts
// Ver templates/typescript/application/issueInvoice.test.ts para la versión completa
const makeSut = (seed: Invoice[] = []) => {
  const invoices = new InMemoryInvoiceRepository(); invoices.seed(...seed);
  const events = new RecordingEventBus(); const tx = new FakeTransactionRunner();
  return { invoices, events, tx, sut: issueInvoice({ invoices, events, tx, clock: fixedClock('2026-01-10T00:00:00Z') }) };
};

it('commits exactly one transaction on the happy path', async () => {
  const { sut, tx } = makeSut([anInvoice().withLine(Money.eur(100)).build()]);
  await sut({ invoiceId: 'inv-1', actorId: 'u1' });
  expect(tx.committed).toBe(1);
});
```

Python: fixture `sut` que devuelve `(uow, bus, IssueInvoice(...))`; ver
`templates/python/tests/test_issue_invoice.py`. Una función `makeSut`/fixture por archivo
evita repetir el cableado; expone los fakes para poder afirmar sobre ellos.

## Errores frecuentes

- **Mockear el repositorio** (`shouldReceive('save')->once()`): el test se rompe con cada refactor y no detecta que se guarda mal.
- **Fake sin `clone`/copia**: el test pasa aunque el handler olvide `save`, porque comparte la referencia.
- **Re-probar reglas de dominio** a través del caso de uso: duplicación; un test de rechazo por regla basta para ver la propagación.
- **Olvidar el caso de fallo intermedio**: guardado que falla, evento que no debe salir.
- **`beforeEach` que siembra datos que la mitad de los tests no usa**: dificulta leer qué importa en cada caso.
- **Fakes con lógica condicional compleja**: si el fake necesita tests, simplifícalo o divide el puerto.
- **Importar `container.ts`/`deps.py`** en un test de aplicación: arrastra Prisma/SQLAlchemy y deja de ser unitario.
- **Reloj real** (`new Date()`) en el handler: el test no puede afirmar sobre `issuedAt`.

## Checklist

- [ ] Camino feliz: estado persistido + evento publicado + valor devuelto, en un solo test.
- [ ] Cada rama de decisión del caso de uso (no encontrado, no autorizado, regla rechazada) tiene su test.
- [ ] Al menos un test de fallo dentro de la transacción: nada confirmado, nada publicado.
- [ ] Eventos verificados por tipo, cantidad y payload; cero eventos en fallos.
- [ ] Fakes con comportamiento real y copia defensiva; spies solo para salida pura.
- [ ] Ids y reloj determinísticos (`FixedClock`, secuencia en memoria).
- [ ] Ningún import de infraestructura ni del contenedor real.
- [ ] El fake de cada puerto pasa el mismo contract test que el adaptador real ([adapter-tests.md](adapter-tests.md)).
