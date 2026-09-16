# Entidades: identidad, ciclo de vida y comportamiento

## Índice

- [Qué hace entidad a una entidad](#qué-hace-entidad-a-una-entidad)
- [Identidad: tipo propio, generación y ciclo de vida](#identidad-tipo-propio-generación-y-ciclo-de-vida)
- [Igualdad por identidad](#igualdad-por-identidad)
- [Constructor privado y factorías estáticas](#constructor-privado-y-factorías-estáticas)
- [Métodos con intención, sin setters](#métodos-con-intención-sin-setters)
- [Estado vs comportamiento: qué exponer](#estado-vs-comportamiento-qué-exponer)
- [Entidad hija dentro de un agregado](#entidad-hija-dentro-de-un-agregado)
- [Persistencia sin contaminar la entidad](#persistencia-sin-contaminar-la-entidad)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Este documento profundiza en la definición de [overview-concepts](overview-concepts.md) §2.
Para invariantes y errores, ver [invariants-and-errors](invariants-and-errors.md); para
creación compleja, [factories](factories.md); para límites, [aggregates](aggregates.md).

## Qué hace entidad a una entidad

Una entidad es un objeto cuya identidad importa más que sus atributos: la misma `Invoice`
sigue siendo "esa factura" aunque cambie de estado, total o cliente. Lo contrario es un
value object ([value-objects](value-objects.md)): dos `Money(100, EUR)` son intercambiables.

Prueba rápida: si dos instancias con los mismos atributos deben tratarse como distintas
(dos pedidos idénticos de la misma persona siguen siendo dos pedidos), es entidad. Si el
negocio necesita "seguirla" a lo largo del tiempo (historial, transiciones), es entidad.

## Identidad: tipo propio, generación y ciclo de vida

Reglas:

- El id es un VO tipado (`InvoiceId`), nunca `int|string` suelto. Evita pasar un
  `CustomerId` donde se esperaba un `InvoiceId`, y documenta la intención en firmas.
- Se genera **antes** de persistir (UUID v7 / ULID) desde `repository.nextIdentity()` o
  desde la factoría. Nada de "la entidad no tiene id hasta que la base de datos la inserte":
  rompe la igualdad, los eventos (necesitan el id) y los tests.
- Inmutable durante toda la vida del objeto: `readonly`.

```php
final readonly class InvoiceId
{
    private function __construct(public string $value) {}

    public static function generate(): self { return new self(Uuid::v7()->toRfc4122()); }

    public static function fromString(string $value): self
    {
        if (!Uuid::isValid($value)) throw new InvalidInvoiceId($value);
        return new self($value);
    }

    public function equals(self $other): bool { return $this->value === $other->value; }
    public function __toString(): string { return $this->value; }
}
```

Ciclo de vida típico: creación (factoría) -> transiciones por métodos de negocio ->
archivado/borrado lógico. Modela los estados como enum y las transiciones como métodos;
no como `setStatus()`.

## Igualdad por identidad

`equals()` compara solo el id (y, si hay dudas, la clase). Nunca compares atributos: dos
instancias cargadas en momentos distintos de la misma factura son iguales aunque una esté
desactualizada.

```ts
export abstract class Entity<Id extends { equals(o: Id): boolean }> {
  protected constructor(readonly id: Id) {}
  equals(other: Entity<Id>): boolean {
    if (other === this) return true;
    return other.constructor === this.constructor && this.id.equals(other.id);
  }
}
```

En PHP no sobrescribas `==`; ofrece `equals()` explícito. En Python, `__eq__` y `__hash__`
basados en `id` para poder meter entidades en `set`/`dict` (no las hagas `frozen`, mutan).

## Constructor privado y factorías estáticas

El constructor público con N parámetros invita a construir estados inválidos y a
"rellenar después". Alternativa: constructor privado + factorías estáticas con nombre de
negocio, una por forma legítima de nacer.

```php
final class Invoice
{
    private InvoiceStatus $status;
    /** @var list<InvoiceLine> */ private array $lines = [];
    /** @var list<object> */ private array $events = [];

    private function __construct(
        public readonly InvoiceId $id,
        private readonly CustomerId $customerId,
        private readonly \DateTimeImmutable $createdAt,
    ) { $this->status = InvoiceStatus::Draft; }

    public static function draftFor(CustomerId $customer, Clock $clock): self
    {
        $invoice = new self(InvoiceId::generate(), $customer, $clock->now());
        $invoice->record(new InvoiceDrafted($invoice->id, $customer));
        return $invoice;
    }
}
```

`draftFor` expresa "cómo nace una factura en este negocio" y registra el evento. La
reconstitución desde base de datos usa otra vía que no emite eventos
([factories](factories.md) §reconstitución).

```ts
export class Invoice extends Entity<InvoiceId> {
  private status: InvoiceStatus = 'draft';
  private readonly lines: InvoiceLine[] = [];

  private constructor(id: InvoiceId, private readonly customerId: CustomerId) { super(id); }

  static draftFor(customerId: CustomerId, ids: IdGenerator): Invoice {
    return new Invoice(ids.next(), customerId);
  }
}
```

## Métodos con intención, sin setters

Cada método público es un verbo del glosario ([ubiquitous-language](../strategic/ubiquitous-language.md))
y protege los invariantes del cambio que hace. Un setter (`setStatus`, `setLines`) delega
la regla en quien llama y la duplica en cada llamador.

| Setter (evitar) | Método con intención | Qué protege |
|---|---|---|
| `setStatus(Issued)` | `issue(Clock)` | no emitir sin líneas; asigna número y fecha |
| `setLines([...])` | `addLine(Line)`, `removeLine(LineId)` | solo en borrador; sin duplicados |
| `setDueDate(d)` | `extendDueDate(d, reason)` | solo hacia adelante; registra motivo |
| `setDeleted(true)` | `void(reason)` | no anular una pagada sin rectificativa |

```ts
extendDueDate(newDate: LocalDate, reason: string): void {
  if (this.status !== 'issued') throw new InvoiceNotIssued(this.id);
  if (!newDate.isAfter(this.dueDate)) throw new DueDateMustMoveForward(this.id, newDate);
  this.dueDate = newDate;
  this.record(new InvoiceDueDateExtended(this.id, newDate, reason));
}
```

Si un cambio no tiene regla alguna (una nota libre), un método `annotate(text)` sigue
siendo preferible a `setNote`: documenta que el cambio es legítimo y deja sitio para un
evento futuro.

## Estado vs comportamiento: qué exponer

- Expón lo que el caso de uso o el test necesita **preguntar**: `isOverdue(today)`,
  `total()`, `status()`. Métodos de consulta, no propiedades públicas mutables.
- No expongas colecciones internas por referencia: devuelve copia o lista de solo lectura
  (`readonly InvoiceLine[]` en TS, `list<...>` copiada en PHP, `tuple` en Python).
- Getters "de todo" para serializar son un olor: la serialización va en un mapper de
  infraestructura o en un `toSnapshot()` explícito (ver persistencia).
- Nada de framework dentro: sin `Model`, sin decoradores de ORM, sin `Carbon`. Reloj por
  parámetro (`Clock` o `DateTimeImmutable $now`), nunca `new DateTime()` dentro.

## Entidad hija dentro de un agregado

Una entidad que no es raíz (`InvoiceLine`) tiene identidad **local** al agregado: su id
solo tiene sentido dentro de `Invoice`. Consecuencias:

- No tiene repositorio propio; se carga y guarda con la raíz.
- Solo la raíz la crea y la modifica; sus métodos pueden ser package-private o recibir la
  raíz como argumento en lenguajes sin esa visibilidad.
- Su igualdad sigue siendo por id, pero el id puede ser un entero secuencial dentro de la
  raíz o un UUID; lo que importa es que sea estable.

```python
@dataclass(eq=False)
class InvoiceLine:
    id: InvoiceLineId
    description: str
    unit_price: Money
    quantity: int

    def __eq__(self, other: object) -> bool:
        return isinstance(other, InvoiceLine) and other.id == self.id

    def __hash__(self) -> int:
        return hash(self.id)

    def total(self) -> Money:
        return self.unit_price.multiply(self.quantity)
```

## Persistencia sin contaminar la entidad

La entidad no sabe cómo se guarda. Tres vías, de menos a más intrusiva:

1. **Mapper explícito** en infraestructura que lee propiedades por reflexión o por un
   método `toSnapshot()`/`fromSnapshot()` con un DTO plano. Preferida en PHP y TS.
2. **Constructor de reconstitución** (`Invoice::reconstitute(...)`) que acepta el estado
   completo sin validar transiciones ni emitir eventos.
3. **ORM mapeando la clase directamente** (Doctrine attributes, SQLAlchemy imperative
   mapping). Aceptable si el mapeo vive fuera de la clase (XML/imperative) o si asumes el
   acoplamiento conscientemente. En Laravel, Eloquent **no** es la entidad: es el adaptador.

```ts
// infrastructure/InvoiceMapper.ts
export const toRow = (i: Invoice): InvoiceRow => i.toSnapshot();
export const toDomain = (r: InvoiceRow): Invoice => Invoice.reconstitute(r);
```

Ver [repositories](repositories.md) para dónde vive el mapper y cómo testearlo.

## Errores frecuentes

- **Entidad anémica**: solo getters/setters; la lógica vive en servicios. Señal: un
  `InvoiceService` con `if ($invoice->getStatus() === 'draft')` repetido.
- **Id nulo hasta insertar**: entidades "a medias" y eventos sin id. Genera el id antes.
- **Igualdad por atributos** o por referencia (`===`): dos cargas del mismo agregado
  no son iguales cuando deberían.
- **Constructor público de 8 parámetros**: tests que construyen estados imposibles.
- **Exponer colecciones mutables**: `$invoice->lines()[] = ...` salta las reglas.
- **Fechas y aleatoriedad dentro**: `now()`, `uuid()` en la entidad la hacen intesteable.
- **Modelo Eloquent/Prisma como entidad de dominio**: el dominio arrastra el esquema, y
  cualquier `save()` fuera de un caso de uso salta los invariantes.
- **Entidad hija con repositorio propio**: se puede modificar sin pasar por la raíz.

## Checklist

- [ ] Id como VO tipado, generado antes de persistir, `readonly`.
- [ ] `equals()` compara solo id (y clase).
- [ ] Constructor privado; factorías estáticas con nombre de negocio; reconstitución separada.
- [ ] Sin setters: cada cambio es un método-verbo del glosario que valida y registra evento.
- [ ] Colecciones internas no se exponen por referencia.
- [ ] Reloj e ids inyectados; sin framework, ORM ni HTTP en la clase.
- [ ] Entidades hijas solo accesibles a través de la raíz; sin repositorio propio.
- [ ] Tests de dominio construyen la entidad con sus factorías y prueban transiciones, no atributos.
