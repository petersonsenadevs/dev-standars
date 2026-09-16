# Tests de dominio: agregados y value objects puros

## Índice

- [Qué prueba un test de dominio](#qué-prueba-un-test-de-dominio)
- [Naming por comportamiento](#naming-por-comportamiento)
- [Dado-cuando-entonces sin ceremonia](#dado-cuando-entonces-sin-ceremonia)
- [Cubrir invariantes: la matriz de transiciones](#cubrir-invariantes-la-matriz-de-transiciones)
- [Verificar eventos emitidos](#verificar-eventos-emitidos)
- [Value objects: igualdad, validación y operaciones](#value-objects-igualdad-validación-y-operaciones)
- [Tablas de casos y parametrización](#tablas-de-casos-y-parametrización)
- [Tiempo, ids y aleatoriedad](#tiempo-ids-y-aleatoriedad)
- [Ejemplo completo por stack](#ejemplo-completo-por-stack)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza el §2 de [overview.md](overview.md). Los builders usados aquí (`anInvoice()`,
`an_invoice()`) se explican en [test-data-builders.md](test-data-builders.md).

## Qué prueba un test de dominio

Un test de dominio ejercita **una regla del lenguaje ubicuo** sobre un agregado o VO
construido en memoria. No hay puertos, ni fakes, ni contenedor. Si necesitas inyectar algo
que no sea un valor (fecha, número, otro VO), la regla está mal ubicada.

| Sujeto | Qué comprobar | Qué NO comprobar |
|---|---|---|
| Agregado | transiciones válidas/inválidas, invariantes, eventos registrados, cálculos derivados | que "llama al repositorio", campos privados |
| VO | rechazo de valores inválidos, igualdad por valor, operaciones cerradas (`add`, `times`) | representación en BD |
| Servicio de dominio | política que cruza agregados (`PricingPolicy`) | orquestación (eso es caso de uso) |
| Evento | payload completo y tipado | serialización JSON (adaptador) |

Referencia: `templates/laravel/tests/Unit/Domain/InvoiceTest.php`.

## Naming por comportamiento

El nombre describe **contexto + acción + resultado observable**, en presente, sin nombres
de método. Leer el listado de tests debe equivaler a leer la especificación del agregado.

```
Mal:   test_issue / testIssueThrowsException / 'issue() works'
Bien:  'cannot be issued without lines'
       'issuing a draft assigns the number and records InvoiceIssued'
       'lines cannot be added once issued'
       'total sums line price times quantity in the invoice currency'
```

Agrupa por estado de partida (`describe('a draft invoice')`, `describe('an issued invoice')`)
para que la matriz de transiciones sea visible en el output del runner.

## Dado-cuando-entonces sin ceremonia

Tres bloques separados por línea en blanco; sin comentarios `// Given`. El "dado" lo
resuelve el builder; el "cuando" es **una** llamada; el "entonces" verifica estado
observable o excepción, nunca ambos en el mismo test.

```php
it('issuing a draft assigns the number and the issue date', function () {
    $invoice = anInvoice()->withLine(Money::eur(1000))->build();

    $invoice->issue(new InvoiceNumber('2026-A-000001'), new DateTimeImmutable('2026-01-10'));

    expect($invoice->status())->toBe(InvoiceStatus::Issued)
        ->and($invoice->number()?->value)->toBe('2026-A-000001')
        ->and($invoice->issuedAt())->toEqual(new DateTimeImmutable('2026-01-10'));
});
```

Regla práctica: si el "cuando" necesita más de una llamada al sujeto, o bien el builder
debe absorber los pasos previos (`->issued()`), o estás probando un flujo (caso de uso).

## Cubrir invariantes: la matriz de transiciones

Para cada agregado escribe primero la tabla estado × acción y conviértela en tests. Cada
celda prohibida = un test que espera la excepción de dominio concreta (no `Exception`).

| Estado \ Acción | `addLine` | `issue` | `void` | `markPaid` |
|---|---|---|---|---|
| Draft | ok | ok si hay líneas | error | error |
| Issued | error | error | ok | ok |
| Void | error | error | error | error |
| Paid | error | error | error | error |

```ts
describe('an issued invoice', () => {
  const issued = () => anInvoice().issued().build();

  it('rejects new lines', () => {
    expect(issued().addLine(invoiceLine({ unitPrice: Money.eur(100) })))
      .toEqual(err({ kind: 'AlreadyIssued', invoiceId: 'inv-1' }));
  });

  it('cannot be issued twice', () => {
    expect(issued().issue(new Date('2026-02-01')).ok).toBe(false);
  });
});
```

Verifica también que el estado **no cambia** tras un rechazo: `expect(invoice.lines()).toHaveLength(0)`
después del `addLine` fallido. Un agregado que muta y luego lanza es un bug frecuente.

## Verificar eventos emitidos

Comprueba tres cosas: cantidad, tipo y payload. `pullEvents()` vacía la lista, así que
guarda el resultado en una variable. Verifica también que **no** se emiten eventos en
operaciones que no deben (rehidratación, rechazos).

```python
def test_issuing_records_invoice_issued_with_total():
    invoice = an_invoice().with_line(Money(1000, "EUR")).with_line(Money(500, "EUR"), qty=2).build()

    invoice.issue("2026-A-000001", datetime(2026, 1, 10, tzinfo=UTC))

    events = invoice.pull_events()
    assert events == [InvoiceIssued(invoice_id="inv-1", number="2026-A-000001",
                                    total=Money(2000, "EUR"), issued_at=datetime(2026, 1, 10, tzinfo=UTC))]
    assert invoice.pull_events() == []          # pull vacía


def test_reconstitute_emits_nothing():
    assert an_invoice().issued().build().pull_events() == []
```

Dataclasses `frozen` y `readonly class` permiten comparar el evento entero por igualdad;
es más robusto que comprobar campo a campo. En TS usa `toEqual` con el objeto literal.

## Value objects: igualdad, validación y operaciones

Un test por regla de construcción, uno por operación, uno de igualdad. Los VO con
aritmética merecen tests de propiedades (identidad, conmutatividad) si son críticos.

```php
describe('Money', function () {
    it('rejects negative amounts', fn () => expect(fn () => new Money(-1, 'EUR'))->toThrow(InvalidArgumentException::class));
    it('rejects mixing currencies', fn () => expect(fn () => Money::eur(1)->add(Money::usd(1)))->toThrow(CurrencyMismatch::class));
    it('is equal by value', fn () => expect(Money::eur(100)->equals(Money::eur(100)))->toBeTrue());
    it('multiplies rounding half up', fn () => expect(Money::eur(333)->times(3))->toEqual(Money::eur(999)));
});
```

Propiedades (`fast-check`, `hypothesis`): `add` conmutativa, `times(1)` identidad; solo en VO con aritmética crítica.

## Tablas de casos y parametrización

Cuando una regla tiene varios umbrales (descuentos por tramo, vencimientos por tipo de
cliente), una tabla es más legible que N tests casi iguales. Cada fila lleva su etiqueta.

```php
it('applies the volume discount', function (int $qty, int $expectedCents) {
    expect(VolumeDiscount::for($qty, Money::eur(1000))->amountCents)->toBe($expectedCents);
})->with([
    'below threshold' => [9, 0],
    'first tier'      => [10, 500],
    'second tier'     => [100, 1500],
]);
```

```ts
it.each([
  { status: 'draft',  action: 'void',  ok: false },
  { status: 'issued', action: 'void',  ok: true },
  { status: 'paid',   action: 'void',  ok: false },
])('$status invoice: void -> ok=$ok', ({ status, action, ok }) => {
  expect(anInvoice().inStatus(status).build()[action]().ok).toBe(ok);
});
```

Python: `@pytest.mark.parametrize(..., ids=["on time", "one day", "one month"])`. No parametrices la matriz completa de transiciones: las celdas "ok" tienen efectos
distintos (número, evento) y merecen tests propios; parametriza solo las prohibidas.

## Tiempo, ids y aleatoriedad

El dominio **recibe** el tiempo (`issue(number, now)`) y los ids (`InvoiceId::of('inv-1')`).
En tests usa valores literales fijos: `'2026-01-10'`, `'inv-1'`. Nunca `now()`, `Date.now()`,
`uuid()` dentro de un test de dominio: si aparece, el agregado tiene una dependencia oculta
(ver [../stacks/laravel/overview.md](../stacks/laravel/overview.md) §12 sobre `Carbon`).

Excepción aceptable: `Invoice::draftFor(InvoiceId::random(), ...)` en el builder cuando el
id no importa; el test que sí verifica el id lo fija con `->withId('inv-1')`.

## Ejemplo completo por stack

```php
// tests/Unit/Invoicing/Domain/InvoiceTest.php — sin TestCase de Laravel
describe('a draft invoice', function () {
    it('cannot be issued without lines', fn () =>
        expect(fn () => anInvoice()->build()->issue(number('2026-A-1'), at('2026-01-10')))
            ->toThrow(InvoiceCannotBeIssued::class));

    it('computes the total from its lines', fn () =>
        expect(anInvoice()->withLine(Money::eur(250), qty: 2)->withLine(Money::eur(100))->build()->total())
            ->toEqual(Money::eur(600)));
});
```

```ts
// src/modules/invoicing/domain/Invoice.test.ts
describe('a draft invoice', () => {
  it('records InvoiceIssued once issued', () => {
    const invoice = anInvoice().withLine(Money.eur(1000)).build();
    const result = invoice.issue(new Date('2026-01-10T00:00:00Z'));
    expect(result.ok).toBe(true);
    expect(invoice.pullEvents()).toEqual([
      { name: 'InvoiceIssued', invoiceId: 'inv-1', totalCents: 1000, currency: 'EUR', issuedAt: new Date('2026-01-10T00:00:00Z') },
    ]);
  });
});
```

```python
# tests/unit/domain/test_invoice.py
class TestDraftInvoice:
    def test_lines_can_be_added(self):
        invoice = an_invoice().build()
        invoice.add_line(InvoiceLine("l1", "consulting", Money(1000, "EUR"), 2))
        assert invoice.total() == Money(2000, "EUR")

    def test_cannot_be_issued_without_lines(self):
        with pytest.raises(InvoiceCannotBeIssued, match="no lines"):
            an_invoice().build().issue("2026-A-1", datetime(2026, 1, 10, tzinfo=UTC))
```

Estos tests corren sin bootstrap (Pest `Unit` sin `TestCase`, Vitest proyecto `unit`,
pytest marker `unit`): cientos por segundo. Las reglas de dependencia que garantizan que
sigan siendo puros están en [architecture-tests.md](architecture-tests.md).

## Errores frecuentes

- **Probar getters**: `expect($invoice->id)->toBe('inv-1')` tras construir con `'inv-1'` no prueba nada.
- **Un test, varias reglas**: si falla, no sabes cuál; separa por comportamiento.
- **Excepción genérica**: `toThrow(Exception::class)` pasa con un `TypeError`; usa la clase de dominio y, si aporta, el mensaje.
- **Verificar solo el camino feliz**: la mitad de los tests de un agregado deben ser rechazos.
- **Llamar a `pullEvents()` dos veces** y sorprenderse de que la segunda esté vacía.
- **Mocks en dominio** (`Mockery`, `vi.mock`): señal de dependencia mal ubicada.
- **Reutilizar el mismo agregado entre tests** (`beforeAll`): estado compartido y tests que dependen del orden.
- **Reflejar el orden de las líneas en asserts** cuando el dominio no lo garantiza; compara conjuntos o totales.
- **Fechas naive en Python**: `datetime(2026, 1, 10)` sin `tzinfo` vs `UTC` en el agregado rompe igualdades.

## Checklist

- [ ] Cada invariante del agregado tiene al menos un test de rechazo con su excepción/`Result` concreto.
- [ ] La matriz estado × acción está cubierta (las celdas prohibidas, parametrizadas).
- [ ] Cada evento se verifica por tipo, cantidad y payload completo; la rehidratación no emite.
- [ ] Tras un rechazo se comprueba que el estado no cambió.
- [ ] VO: construcción inválida, igualdad por valor y cada operación.
- [ ] Nombres de test legibles como especificación; agrupados por estado de partida.
- [ ] Sin reloj, ids aleatorios, framework ni mocks; fechas con zona horaria explícita.
- [ ] La suite de dominio del módulo corre en menos de un segundo.
