# Builders y object mothers para datos de test

## Índice

- [Por qué no basta con constructores](#por-qué-no-basta-con-constructores)
- [Builder: anatomía y reglas](#builder-anatomía-y-reglas)
- [Object mother: escenarios con nombre](#object-mother-escenarios-con-nombre)
- [Builders de VO y de commands](#builders-de-vo-y-de-commands)
- [Datos determinísticos](#datos-determinísticos)
- [Factories de dominio vs factories del ORM](#factories-de-dominio-vs-factories-del-orm)
- [Dónde viven y cómo se comparten](#dónde-viven-y-cómo-se-comparten)
- [Ejemplo completo por stack](#ejemplo-completo-por-stack)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza el §7 de [overview.md](overview.md). Los builders son la base de
[domain-tests.md](domain-tests.md) y [use-case-tests.md](use-case-tests.md); las
factories del ORM, de [adapter-tests.md](adapter-tests.md).

## Por qué no basta con constructores

Un agregado válido exige pasar por su API de negocio: `draftFor()` + `addLine()` +
`issue()`. Repetirlo en cada test genera ruido, fragilidad ante cambios de firma y estados
imposibles construidos con `reconstitute()` a mano. El builder centraliza la construcción
**a través del dominio**: nunca produce un agregado que el dominio no podría producir.

| Necesidad | Herramienta |
|---|---|
| Variar uno o dos atributos sobre un default válido | builder (`anInvoice()->withLine(...)`) |
| Escenario de negocio con nombre reutilizado en muchos tests | object mother (`Invoices::overdueBy30Days()`) |
| Fila en BD para un test de adaptador o HTTP | factory del ORM (`InvoiceModel::factory()`) |
| Command/DTO de entrada | función `aCommand(overrides)` |

## Builder: anatomía y reglas

1. **Default válido**: `build()` sin llamadas intermedias devuelve un agregado que pasa
   todas las invariantes (un borrador vacío es válido; una factura emitida sin líneas no).
2. **Inmutable**: cada `with...()` devuelve una copia; así se pueden definir builders base
   en un `beforeEach` sin contaminación.
3. **Métodos por intención**, no por campo: `issued()` en vez de `withStatus('issued')`,
   porque emitir implica número y fecha, y el builder lo hace por el camino de negocio.
4. **Construye vía dominio** y **limpia eventos** al final: `build()` llama a `pullEvents()`
   para que el test empiece con la lista vacía.
5. **Sin conocimiento de BD**: nada de `Model`, `prisma`, `Session`.

```ts
// src/modules/invoicing/testing/InvoiceBuilder.ts
type LineSpec = { unitPrice: Money; quantity: number; description: string };

export class InvoiceBuilder {
  private constructor(
    private readonly id = 'inv-1',
    private readonly customerId = 'cust-1',
    private readonly currency = 'EUR',
    private readonly lines: LineSpec[] = [],
    private readonly issuedAt: Date | null = null,
  ) {}

  static anInvoice() { return new InvoiceBuilder(); }
  withId(id: string) { return new InvoiceBuilder(id, this.customerId, this.currency, this.lines, this.issuedAt); }
  withLine(unitPrice: Money, quantity = 1, description = 'line') {
    return new InvoiceBuilder(this.id, this.customerId, this.currency, [...this.lines, { unitPrice, quantity, description }], this.issuedAt);
  }
  withLines(n: number) { return Array.from({ length: n }).reduce<InvoiceBuilder>((b) => b.withLine(Money.eur(100)), this); }
  issued(at = new Date('2026-01-01T00:00:00Z')) {
    const b = this.lines.length ? this : this.withLine(Money.eur(100));   // emitida implica al menos una línea
    return new InvoiceBuilder(b.id, b.customerId, b.currency, b.lines, at);
  }

  build(): Invoice {
    const invoice = Invoice.draft(InvoiceId.of(this.id), CustomerId.of(this.customerId), this.currency);
    this.lines.forEach((l, i) => invoice.addLine(invoiceLine({ id: `${this.id}-l${i + 1}`, ...l })));
    if (this.issuedAt) { const r = invoice.issue(this.issuedAt); if (!r.ok) throw new Error(`builder: ${r.error.kind}`); }
    invoice.pullEvents();
    return invoice;
  }
}
export const anInvoice = InvoiceBuilder.anInvoice;
```

`issued()` sin líneas añade una por defecto: el builder resuelve la precondición porque el
test quiere hablar de "una factura emitida", no de sus líneas; si importan, se declaran antes.

## Object mother: escenarios con nombre

Cuando el mismo escenario aparece en decenas de tests y tiene significado de negocio,
dale nombre en una clase de escenarios. Se implementa **encima** del builder.

```php
// tests/support/Invoices.php
final class Invoices
{
    public static function draftWithoutLines(): Invoice { return anInvoice()->build(); }
    public static function readyToIssue(): Invoice { return anInvoice()->withLine(Money::eur(1000))->build(); }
    public static function overdueBy(int $days, DateTimeImmutable $today): Invoice
    {
        return anInvoice()->withLine(Money::eur(500))->issued(at: $today->modify("-{$days} days -30 days"))->build();
    }
    public static function paid(): Invoice { $i = self::readyToIssue(); $i->issue(number('2026-A-1'), at('2026-01-01')); $i->markPaid(at('2026-01-05')); $i->pullEvents(); return $i; }
}
```

Regla: un escenario usado en un solo test vuelve al builder inline; las mothers crecen
sin control si se admiten escenarios de un solo uso.

## Builders de VO y de commands

Los VO no necesitan builder: constructores nombrados (`Money::eur(100)`) ya son
expresivos. Los commands/DTOs de entrada, con muchos campos, sí se benefician de una
función con overrides parciales:

```python
def a_create_invoice_command(**overrides) -> CreateInvoiceCommand:
    defaults = dict(customer_id="cust-1", currency="EUR", actor_id="u1",
                    lines=[LineInput(description="consulting", unit_price_cents=1000, quantity=1)])
    return CreateInvoiceCommand(**{**defaults, **overrides})
```

En TS: `const aCommand = (o: Partial<IssueInvoiceCommand> = {}): IssueInvoiceCommand => ({ invoiceId: 'inv-1', actorId: 'u1', ...o })`.

## Datos determinísticos

Los tests de dominio y aplicación **no usan Faker**. Valores fijos y legibles: `'inv-1'`,
`'cust-1'`, `'2026-01-10'`, `Money::eur(1000)`. Razones: aserciones con literales,
fallos reproducibles, diffs pequeños. Si necesitas variedad (propiedades, fuzzing), usa
`fast-check`/`hypothesis` con semilla fija y de forma explícita, no Faker escondido en el
builder.

Ids: secuencia del builder (`inv-1`, `inv-1-l1`) o `nextId()` del fake en memoria
(secuencial). Fechas: siempre con zona horaria y siempre relativas a un `today` que el
test declara. Faker queda para las factories del ORM en tests de adaptador y para seeds
de desarrollo, con `Faker::seed(42)` / `faker.seed(42)` en CI.

## Factories de dominio vs factories del ORM

Son artefactos distintos con propósitos distintos; no intentes unificarlos.

| | Builder de dominio | Factory del ORM |
|---|---|---|
| Produce | agregado en memoria vía API de negocio | filas en BD (o modelo ORM) |
| Respeta invariantes | siempre | solo las de esquema (NOT NULL, FK) |
| Usa | dominio | Eloquent `Factory`, Prisma `create`, SQLAlchemy `Session` |
| Sirve para | dominio, aplicación, sembrar fakes | adaptadores, HTTP, seeds |
| Ejemplo | `anInvoice()->issued()->build()` | `InvoiceModel::factory()->issued()->create()` |

```php
// src/Invoicing/Infrastructure/Persistence/Eloquent/Factories/InvoiceModelFactory.php
final class InvoiceModelFactory extends Factory
{
    protected $model = InvoiceModel::class;
    public function definition(): array
    { return ['id' => Str::uuid7(), 'customer_id' => 'cust-1', 'status' => 'draft', 'currency' => 'EUR', 'total_cents' => 0]; }
    public function issued(): static
    {
        return $this->state(['status' => 'issued', 'number' => '2026-A-000001', 'issued_at' => '2026-01-01 00:00:00', 'total_cents' => 1000])
            ->has(InvoiceLineModel::factory()->state(['unit_price_cents' => 1000, 'quantity' => 1]), 'lines');
    }
}
```

Puente cuando un test de adaptador necesita un agregado persistido: guarda el builder vía
el **repositorio real** (`$repo->save(anInvoice()->issued()->build())`); garantiza filas
coherentes con el dominio. Factory del ORM solo para volumen o estados legacy. Prisma:
`insertInvoiceRow(prisma, overrides)` en `infrastructure/testing/`; SQLAlchemy:
`factory_boy` sobre `InvoiceModel`, nunca sobre la dataclass de dominio.

## Dónde viven y cómo se comparten

| Stack | Builders y fakes de dominio | Factories del ORM |
|---|---|---|
| Laravel | `tests/support/` (autoload-dev `Tests\Support\`) | `src/Invoicing/Infrastructure/Persistence/Eloquent/Factories/` |
| TS | `src/modules/invoicing/testing/index.ts` (exportado) | `src/modules/invoicing/infrastructure/testing/rows.ts` |
| Python | `src/invoicing/testing/` (paquete instalable, sin pytest) | `tests/integration/factories.py` (factory_boy) |

El código de `testing/` es código de producción de segunda: tipado estricto, revisado en
PR, sin lógica condicional. Se exporta desde el módulo para que otro contexto pueda
sembrar una factura sin conocer su constructor. Las reglas de dependencia lo permiten
explícitamente (`testing/` importa `domain/`, nada más); ver
[architecture-tests.md](architecture-tests.md).

## Ejemplo completo por stack

```php
// tests/support/InvoiceBuilder.php — ver overview.md §7 para la versión base
final class InvoiceBuilder
{
    private function __construct(private string $id = 'inv-1', private array $lines = [], private ?DateTimeImmutable $issuedAt = null) {}
    public static function anInvoice(): self { return new self(); }
    public function withId(string $id): self { $c = clone $this; $c->id = $id; return $c; }
    public function withLine(Money $price, int $qty = 1): self { $c = clone $this; $c->lines[] = [$price, $qty]; return $c; }
    public function withLines(int $n): self { $c = $this; for ($i = 0; $i < $n; $i++) { $c = $c->withLine(Money::eur(100)); } return $c; }
    public function issued(?DateTimeImmutable $at = null): self { $c = $this->lines ? clone $this : $this->withLine(Money::eur(100)); $c->issuedAt = $at ?? new DateTimeImmutable('2026-01-01'); return $c; }

    public function build(): Invoice
    {
        $invoice = Invoice::draftFor(InvoiceId::of($this->id), CustomerId::of('cust-1'));
        foreach ($this->lines as $i => [$price, $qty]) { $invoice->addLine(new InvoiceLine("{$this->id}-l" . ($i + 1), 'line', $price, $qty)); }
        if ($this->issuedAt) { $invoice->issue(new InvoiceNumber('2026-A-000001'), $this->issuedAt); }
        $invoice->pullEvents();
        return $invoice;
    }
}
```

```python
# src/invoicing/testing/builders.py
@dataclass(frozen=True)
class InvoiceBuilder:
    id: str = "inv-1"
    lines: tuple[tuple[Money, int], ...] = ()
    issued_at: datetime | None = None

    def with_line(self, price: Money, qty: int = 1) -> "InvoiceBuilder": return replace(self, lines=(*self.lines, (price, qty)))
    def issued(self, at: datetime = datetime(2026, 1, 1, tzinfo=UTC)) -> "InvoiceBuilder":
        return replace(self if self.lines else self.with_line(Money(100, "EUR")), issued_at=at)

    def build(self) -> Invoice:
        invoice = Invoice.draft(InvoiceId(self.id), CustomerId("cust-1"))
        for i, (price, qty) in enumerate(self.lines, 1):
            invoice.add_line(InvoiceLine(f"{self.id}-l{i}", "line", price, qty))
        if self.issued_at: invoice.issue("2026-A-000001", self.issued_at)
        invoice.pull_events()
        return invoice

def an_invoice() -> InvoiceBuilder: return InvoiceBuilder()
```

`@dataclass(frozen=True)` + `replace` da la inmutabilidad gratis. En Pest, registra
`function anInvoice()` en `tests/Pest.php`; en Vitest, exporta desde `testing/index.ts`.

## Errores frecuentes

- **Builder que usa `reconstitute()`**: crea estados que el dominio no permite y los tests pasan sobre agregados imposibles.
- **Builder mutable** reutilizado en `beforeEach`: un `withLine` en un test contamina al siguiente.
- **`withStatus('issued')`** en vez de `issued()`: salta el camino de negocio y deja número/fecha en `null`.
- **Faker en builders de dominio**: aserciones con valores que no puedes escribir en el test; fallos intermitentes.
- **Default que no es válido** (`issued()` sin líneas que lanza): el builder debe resolver precondiciones.
- **Olvidar `pullEvents()` en `build()`**: los tests de eventos cuentan de más.
- **Factory del ORM para tests de dominio**: arrastra BD y framework a la capa rápida.
- **Builders con lógica de negocio** (calcular totales, decidir vencimientos): eso es del dominio; el builder solo llama.

## Checklist

- [ ] Un builder por agregado, inmutable, default válido, `build()` vía API de negocio y limpia eventos.
- [ ] Métodos por intención (`issued()`, `overdue()`), que resuelven sus precondiciones.
- [ ] Object mothers solo para escenarios con nombre de negocio usados en varios tests.
- [ ] Datos fijos y legibles; Faker solo en factories del ORM y seeds, con semilla en CI.
- [ ] Factories del ORM separadas, junto al modelo, sin usarse en dominio/aplicación.
- [ ] `testing/` exportado por el módulo, tipado estricto, sin dependencias de infraestructura.
- [ ] Helper global (`anInvoice()` / `an_invoice()`) registrado una vez.
