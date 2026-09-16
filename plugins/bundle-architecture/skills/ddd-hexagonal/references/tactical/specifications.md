# Especificaciones

## Índice

- [Qué resuelve una especificación](#qué-resuelve-una-especificación)
- [Interfaz mínima y composición](#interfaz-mínima-y-composición)
- [Uso en el dominio](#uso-en-el-dominio)
- [Uso en repositorios: traducción a query](#uso-en-repositorios-traducción-a-query)
- [Especificaciones parametrizadas y con reloj](#especificaciones-parametrizadas-y-con-reloj)
- [Cuándo es sobreingeniería](#cuándo-es-sobreingeniería)
- [Testing](#testing)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza el §9 de [overview-concepts](overview-concepts.md). Relacionado con
[repositories.md](repositories.md) y [invariants-and-errors.md](invariants-and-errors.md).

## Qué resuelve una especificación

Una especificación es un **predicado de negocio con nombre**: `OverdueInvoice`,
`CustomerEligibleForCredit`, `ShippableOrder`. Encapsula una regla que de otro modo
quedaría repetida en ifs de varios casos de uso, o acabaría en el controlador.

Tres usos, y solo estos:
1. **Validar** un objeto: "¿puede este pedido enviarse?".
2. **Seleccionar** objetos de una colección o de la base de datos: "dame las facturas vencidas".
3. **Construir a medida**: "crea un descuento que cumpla esta regla" (raro; suele bastar una fábrica).

Ventaja real: la misma regla se usa en memoria (dominio, tests) y se traduce a SQL
(repositorio) sin duplicar la lógica en dos lenguajes.

## Interfaz mínima y composición

```ts
// domain/Specification.ts
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
}

export const and = <T>(...specs: Specification<T>[]): Specification<T> =>
  ({ isSatisfiedBy: (c) => specs.every((s) => s.isSatisfiedBy(c)) });
export const or = <T>(...specs: Specification<T>[]): Specification<T> =>
  ({ isSatisfiedBy: (c) => specs.some((s) => s.isSatisfiedBy(c)) });
export const not = <T>(spec: Specification<T>): Specification<T> =>
  ({ isSatisfiedBy: (c) => !spec.isSatisfiedBy(c) });
```

En PHP, una clase abstracta con `and()/or()/not()` que devuelven composites:

```php
abstract class Specification
{
    abstract public function isSatisfiedBy(object $candidate): bool;
    public function and(Specification $o): Specification { return new AndSpecification($this, $o); }
    public function or(Specification $o): Specification  { return new OrSpecification($this, $o); }
    public function not(): Specification                 { return new NotSpecification($this); }
}
```

Regla de composición: las especificaciones compuestas no saben nada del negocio; solo
combinan. Toda la regla vive en las hojas (`OverdueInvoice`, `AboveAmount`).

## Uso en el dominio

La especificación se evalúa sobre el agregado o VO ya cargado. El agregado puede usarla en
una transición para decidir si la permite; un servicio de dominio puede combinarlas.

```php
// Domain/Specification/EligibleForEarlyPaymentDiscount.php
final readonly class EligibleForEarlyPaymentDiscount extends Specification
{
    public function __construct(private \DateTimeImmutable $today) {}

    public function isSatisfiedBy(object $candidate): bool
    {
        assert($candidate instanceof Invoice);
        return $candidate->isIssued()
            && $candidate->daysSinceIssue($this->today) <= 10
            && $candidate->total()->greaterThan(Money::eur(50_00));
    }
}

// Domain/Service/DiscountPolicy.php
public function discountFor(Invoice $invoice): Money
{
    $eligible = (new EligibleForEarlyPaymentDiscount($this->clock->today()))
        ->and((new CustomerInGoodStanding($invoice->customerId(), $this->standing))->not()->not());
    return $eligible->isSatisfiedBy($invoice) ? $invoice->total()->percent(2) : Money::zero('EUR');
}
```

La especificación solo consulta la API pública del agregado. Si necesita exponer un getter
nuevo cada vez, quizá la regla pertenece al propio agregado como método (`isOverdue()`).

## Uso en repositorios: traducción a query

Pasar una especificación al repositorio y filtrar en memoria (`findAll()->filter(spec)`)
no escala. La alternativa útil: cada especificación de selección **también sabe
traducirse** a un criterio de consulta, y el repositorio la aplica.

Opción A, la más pragmática: interfaz doble, con el método de traducción **por adaptador**
(la especificación del dominio no importa el ORM; la traducción vive en infraestructura).

```ts
// domain/specs/OverdueInvoice.ts (dominio, puro)
export class OverdueInvoice implements Specification<Invoice> {
  constructor(readonly today: Date) {}
  isSatisfiedBy(i: Invoice) { return i.status === 'issued' && i.dueDate < this.today; }
}

// infrastructure/prisma/specToWhere.ts (infraestructura)
export const toWhere = (spec: Specification<Invoice>): Prisma.InvoiceWhereInput => {
  if (spec instanceof OverdueInvoice) return { status: 'issued', dueDate: { lt: spec.today } };
  if (spec instanceof AndSpec) return { AND: spec.parts.map(toWhere) };
  if (spec instanceof OrSpec)  return { OR: spec.parts.map(toWhere) };
  if (spec instanceof NotSpec) return { NOT: toWhere(spec.inner) };
  throw new Error(`No query translation for ${spec.constructor.name}`);
};

// infrastructure/prisma/PrismaInvoiceRepository.ts
async matching(spec: Specification<Invoice>): Promise<Invoice[]> {
  const rows = await this.prisma.invoice.findMany({ where: toWhere(spec), include: { lines: true } });
  return rows.map(toDomain);
}
```

Opción B: un objeto **Criteria** neutral (`field`, `operator`, `value`, `and/or`) que la
especificación produce y cada adaptador traduce. Más genérico, más código; úsalo solo si
tienes varios adaptadores de persistencia.

Limita `matching(spec)` a **selecciones de escritura** (cargar agregados para operar). Los
listados de UI van por read models, no por especificaciones (ver
[repositories.md](repositories.md)).

## Especificaciones parametrizadas y con reloj

- Una especificación que depende de "hoy" recibe la fecha en el constructor; **nunca**
  llama a `new Date()`/`now()` por dentro. Así es determinista y traducible a SQL.
- Parámetros de negocio (umbral de importe, días de gracia) van al constructor; si vienen
  de configuración, el caso de uso los inyecta.
- Nombres: adjetivo o participio sobre el sujeto (`OverdueInvoice`, `ShippableOrder`,
  `CustomerWithUnpaidInvoices`). Evita `InvoiceSpecification1` o `CheckInvoice`.

```python
# domain/specs.py
@dataclass(frozen=True)
class OverdueInvoice:
    today: date
    grace_days: int = 0
    def is_satisfied_by(self, invoice: Invoice) -> bool:
        return invoice.status is InvoiceStatus.ISSUED and invoice.due_date + timedelta(self.grace_days) < self.today
```

## Cuándo es sobreingeniería

| Situación | Alternativa más simple |
|---|---|
| La regla es una línea y se usa en un sitio | método en la entidad (`isOverdue(today)`) |
| Solo se usa para filtrar en base de datos | método con intención en el repositorio (`overdueAt(today)`) |
| Solo se usa para validar entrada | validación en el request/DTO, no es regla de dominio |
| No hay composición (`and/or/not`) en ningún sitio | no hace falta la infraestructura de composites |
| Una única especificación en todo el módulo | probablemente prematuro; espera a la segunda |

Introduce especificaciones cuando **una misma regla** (a) aparece en dos casos de uso, o
(b) se necesita tanto en memoria como en consulta, o (c) se combina con otras. Antes de
eso, un método bien nombrado es más legible.

## Testing

- Cada hoja se prueba con tablas de casos: candidato que cumple, candidato en el límite,
  candidato que no cumple. Sin base de datos.
- La traducción a query se prueba con un test de integración por especificación: inserta
  filas, ejecuta `matching(spec)`, y compara con el filtro en memoria sobre las mismas filas
  (garantiza que ambas versiones dicen lo mismo).

```php
/** @dataProvider cases */
public function test_overdue(string $status, string $due, string $today, bool $expected): void
{
    $invoice = InvoiceBuilder::withStatus($status)->dueOn($due)->build();
    self::assertSame($expected, (new OverdueInvoice(new \DateTimeImmutable($today)))->isSatisfiedBy($invoice));
}
public static function cases(): iterable
{
    yield 'issued, past due'   => ['issued', '2026-01-01', '2026-01-02', true];
    yield 'issued, due today'  => ['issued', '2026-01-02', '2026-01-02', false];
    yield 'draft, past due'    => ['draft',  '2026-01-01', '2026-01-02', false];
}
```

## Errores frecuentes

- **Especificación que hace IO** (consulta un repositorio dentro de `isSatisfiedBy`):
  deja de ser predicado puro; carga los datos antes y pásalos.
- **Filtrar colecciones enteras en memoria** con `findAll()` + spec: funciona en el demo,
  muere en producción.
- **Traducción a SQL dentro del dominio** (`toEloquentQuery()` en `Domain/`): acopla el
  dominio al ORM. La traducción va en infraestructura.
- **Reglas en el composite**: `AndSpecification` con un `if` de negocio. Los composites
  solo combinan.
- **Usarlas como validación de formularios**: "email válido" no es una especificación de
  dominio, es un VO ([value-objects.md](value-objects.md)).
- **Divergencia entre versión en memoria y versión SQL**: sin el test de equivalencia,
  acaban diciendo cosas distintas.
- **`Specification<any>`** genérica reutilizada entre agregados: cada regla tiene un sujeto.

## Checklist

- [ ] Cada especificación tiene nombre de negocio y un único sujeto (`Specification<Invoice>`).
- [ ] `isSatisfiedBy` es puro: sin IO, sin reloj interno, sin efectos.
- [ ] Composición con `and/or/not` solo si realmente se combinan.
- [ ] La traducción a query vive en infraestructura y cubre los composites.
- [ ] Test de equivalencia memoria vs SQL por cada especificación traducida.
- [ ] No se usan para listados de UI ni para validar input.
- [ ] Antes de crearla: la regla se repite, se combina o se necesita en dos medios. Si no, método en la entidad.
