# Fábricas

## Índice

- [Cuándo hace falta una fábrica](#cuándo-hace-falta-una-fábrica)
- [Creación vs reconstitución](#creación-vs-reconstitución)
- [Fábricas estáticas en el agregado](#fábricas-estáticas-en-el-agregado)
- [Clases fábrica con dependencias](#clases-fábrica-con-dependencias)
- [Reconstitución desde persistencia](#reconstitución-desde-persistencia)
- [Builders de test](#builders-de-test)
- [Fábricas por stack](#fábricas-por-stack)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza el §8 de [overview-concepts](overview-concepts.md). Relacionado con
[entities.md](entities.md) (constructores privados), [aggregates.md](aggregates.md) y
[repositories.md](repositories.md) (rehidratación).

## Cuándo hace falta una fábrica

Una fábrica encapsula la creación de un objeto cuando **el constructor no basta** para
garantizar un objeto válido y completo. Señales:

- La creación exige **varios pasos o reglas**: generar id, fijar estado inicial, calcular
  valores derivados, registrar el evento `XCreated`.
- La creación necesita **dependencias** (numerador correlativo, política de precios,
  reloj) que no deben vivir en la entidad.
- Hay **varias formas de crear** el mismo tipo con semántica distinta: `Invoice::draftFor`
  vs `Invoice::rectifying(original)`.
- Hay que distinguir **crear** (evento, validación de negocio) de **reconstituir** (sin
  evento, datos ya validados).

Si el objeto es un VO simple o una entidad con dos campos, un constructor con validación
basta. No añadas `FooFactory` por costumbre.

## Creación vs reconstitución

| | Creación | Reconstitución |
|---|---|---|
| Quién | caso de uso, vía fábrica | repositorio/mapper de infraestructura |
| Valida | invariantes de negocio | nada (o solo forma); los datos ya fueron válidos |
| Eventos | registra `XCreated` | no registra nada |
| Id | lo genera (`nextIdentity`) | lo recibe |
| Estado | inicial (`Draft`) | el que haya en la fila |

Mezclar ambos en el mismo constructor es la causa habitual de "al cargar una factura se
vuelve a emitir el evento `InvoiceCreated`" o "no puedo cargar facturas antiguas porque la
regla nueva las rechaza".

## Fábricas estáticas en el agregado

Primera opción: **constructor privado** + métodos estáticos con nombre del negocio. La
propia clase decide su estado inicial y el evento.

```php
final class Invoice extends AggregateRoot
{
    private function __construct(
        public readonly InvoiceId $id,
        private readonly CustomerId $customerId,
        private InvoiceStatus $status,
        private array $lines,
    ) {}

    public static function draftFor(InvoiceId $id, CustomerId $customerId, Clock $clock): self
    {
        $invoice = new self($id, $customerId, InvoiceStatus::Draft, []);
        $invoice->record(new InvoiceDrafted($id->value, $customerId->value, $clock->now()));
        return $invoice;
    }

    public static function rectifying(Invoice $original, InvoiceId $id, Clock $clock): self
    {
        if (!$original->isIssued()) throw InvoiceCannotBeRectified::notIssued($original->id);
        $invoice = new self($id, $original->customerId, InvoiceStatus::Draft, $original->negatedLines());
        $invoice->record(new RectifyingInvoiceDrafted($id->value, $original->id->value, $clock->now()));
        return $invoice;
    }
}
```

Nombres: verbo o situación del negocio (`draftFor`, `rectifying`, `fromQuote`,
`openedBy`), nunca `create`/`make` genérico si existe un término mejor.

## Clases fábrica con dependencias

Cuando la creación necesita puertos (numeración, catálogo, políticas), sácala a una clase
en `Domain/` (si solo usa interfaces del dominio) o en `Application/` (si orquesta IO).

```ts
// domain/InvoiceFactory.ts
export class InvoiceFactory {
  constructor(
    private readonly invoices: InvoiceRepository,      // nextIdentity
    private readonly sequences: InvoiceSequenceRepository,
    private readonly clock: Clock,
  ) {}

  async draftFromOrder(order: OrderSnapshot): Promise<Invoice> {
    const id = this.invoices.nextIdentity();
    const invoice = Invoice.draftFor(id, CustomerId.of(order.customerId), this.clock);
    for (const line of order.lines) {
      invoice.addLine(InvoiceLine.of(line.description, Money.of(line.unitPriceCents, line.currency), line.qty));
    }
    return invoice;
  }
}
```

La fábrica **devuelve el objeto, no lo persiste**: guardar es del caso de uso. Si la
fábrica necesita consultar otro agregado (p. ej. límite de crédito del cliente), recibe un
snapshot o un id + puerto de lectura, no el agregado entero.

## Reconstitución desde persistencia

El repositorio necesita construir el agregado **sin** pasar por reglas de creación ni
emitir eventos. Opciones, de más explícita a más mágica:

1. **Método estático `reconstitute(...)`** (o `fromState`) que recibe primitivos ya
   válidos y no registra eventos. Se documenta como "solo infraestructura".
2. **Constructor público con todos los campos** y las fábricas de creación como estáticas
   que lo envuelven. Simple, pero permite crear estados inválidos desde cualquier sitio.
3. **Reflexión / hidratación del ORM** (Doctrine, `Reflection` en PHP, `Object.create` en
   TS). Evita exponer API, pero oculta el mapeo y rompe con `readonly` en algunos casos.

Recomendación: opción 1 en PHP y TS; en Python con dataclasses, un `classmethod
from_state`.

```php
// Domain/Invoice.php
/** @internal solo para repositorios */
public static function reconstitute(InvoiceId $id, CustomerId $c, InvoiceStatus $s, array $lines, int $version): self
{
    $i = new self($id, $c, $s, $lines);
    $i->version = $version;
    return $i;   // sin eventos, sin validación de negocio
}

// Infrastructure/Persistence/EloquentInvoiceRepository.php
private function toDomain(InvoiceModel $row): Invoice
{
    return Invoice::reconstitute(
        InvoiceId::of($row->id), CustomerId::of($row->customer_id),
        InvoiceStatus::from($row->status), $this->linesFrom($row->lines), $row->version,
    );
}
```

Los VO sí se validan al reconstituir (son baratos y la fila podría estar corrupta); lo que
se omite son las reglas de transición de estado.

## Builders de test

En tests, construir un agregado en un estado concreto por la vía "legal" (crear -> añadir
líneas -> emitir -> pagar) es lento de escribir y frágil. Un **builder de test** vive en
`tests/` (nunca en `src/`), usa `reconstitute` o las fábricas reales, y ofrece valores por
defecto válidos.

```ts
// tests/builders/InvoiceBuilder.ts
export class InvoiceBuilder {
  private status: InvoiceStatus = 'draft';
  private lines: InvoiceLine[] = [InvoiceLine.of('Consulting', Money.eur(10_000), 1)];
  private customerId = CustomerId.of('cust-1');

  static draft() { return new InvoiceBuilder(); }
  static issued() { return new InvoiceBuilder().withStatus('issued'); }
  withStatus(s: InvoiceStatus) { this.status = s; return this; }
  withLines(...l: InvoiceLine[]) { this.lines = l; return this; }
  withoutLines() { this.lines = []; return this; }
  build(): Invoice {
    return Invoice.reconstitute({ id: InvoiceId.of('inv-1'), customerId: this.customerId, status: this.status, lines: this.lines, version: 0 });
  }
}

// uso
const invoice = InvoiceBuilder.issued().withLines(line(500)).build();
```

Reglas: un builder por agregado; defaults que pasan las invariantes; métodos `with*` que
leen como el glosario; ninguna lógica de negocio dentro (si necesitas "una factura pagada",
llama a `.build()` y luego a `pay()`, o usa `reconstitute` con el estado final).

## Fábricas por stack

| Stack | Creación | Reconstitución | Builder de test |
|---|---|---|---|
| PHP 8.3 / Laravel | `private __construct` + `static draftFor()`; clase en `Domain/` con puertos inyectados por el contenedor | `static reconstitute()` usado por el repositorio Eloquent | `tests/Builders/InvoiceBuilder.php`; no confundir con `Model::factory()` de Eloquent, que fabrica filas, no agregados |
| TS (Node/Next) | `private constructor` + `static`; clase `XFactory` con deps por constructor | `static reconstitute(state)`; el mapper Prisma lo llama | `tests/builders/`; alternativa funcional `anInvoice({ status: 'issued' })` |
| Python 3.12 | `@classmethod draft_for(cls, ...)`; `__init__` con `__post_init__` solo validando forma | `@classmethod from_state(cls, row)` | `tests/builders.py` con `dataclasses.replace` para variantes |

En Python, si usas `@dataclass(frozen=True)` para VO y `@dataclass` mutable para
agregados, `from_state` se limita a `cls(**row)`, y la creación queda en el `classmethod`
con nombre de negocio.

## Errores frecuentes

- **Fábrica que persiste**: `InvoiceFactory::create()` guarda en base de datos. Crear y
  guardar son responsabilidades del caso de uso; la fábrica solo construye.
- **Un solo constructor para crear y rehidratar**: eventos duplicados al cargar, o cargas
  que fallan cuando cambia una regla.
- **`new Invoice()` disperso por la aplicación**: cada sitio inventa el estado inicial; al
  añadir un campo hay que tocar diez lugares. Constructor privado.
- **Fábricas en infraestructura**: la creación es conocimiento de dominio; en
  infraestructura solo va la reconstitución.
- **Builder de test con lógica**: si el builder "emite" y "paga" por dentro, los tests
  dejan de probar esas transiciones.
- **Usar `Model::factory()` de Eloquent como builder de dominio**: fabrica filas con datos
  aleatorios que a menudo violan invariantes del agregado.
- **Fábrica genérica `EntityFactory<T>`**: no hay reglas comunes de creación entre agregados
  distintos; es abstracción sin contenido.

## Checklist

- [ ] Cada agregado tiene constructor privado y fábricas estáticas con nombre del negocio.
- [ ] La creación registra el evento `XCreated`/`XDrafted`; la reconstitución no.
- [ ] Existe `reconstitute`/`from_state` y solo lo usa el repositorio.
- [ ] Las fábricas con dependencias reciben puertos, devuelven el objeto y no persisten.
- [ ] Los ids se generan con `nextIdentity` del repositorio, no en el controlador.
- [ ] Hay un builder de test por agregado en `tests/`, con defaults válidos y sin lógica.
- [ ] Ningún `new Aggregate(...)` fuera del propio agregado, su fábrica o su builder.
