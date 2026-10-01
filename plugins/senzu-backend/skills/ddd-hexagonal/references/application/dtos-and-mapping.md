# DTOs y mapeo entre capas

## Índice

- [Tipos de DTO y dónde viven](#tipos-de-dto-y-dónde-viven)
- [Tres modelos, tres responsabilidades](#tres-modelos-tres-responsabilidades)
- [Mappers explícitos vs automappers](#mappers-explícitos-vs-automappers)
- [Mapeo entidad <-> persistencia](#mapeo-entidad---persistencia)
- [Mapeo hacia la vista: Inertia, JSON API, FastAPI](#mapeo-hacia-la-vista-inertia-json-api-fastapi)
- [Evitar la fuga de entidades](#evitar-la-fuga-de-entidades)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../tactical/overview-concepts.md` §12, `use-cases.md`,
`validation-layers.md`, `../stacks/laravel/overview.md` §4 y §7.

## Tipos de DTO y dónde viven

| DTO | Dirección | Vive en | Lo construye | Lo consume |
|---|---|---|---|---|
| Command / Query | entrada | `Application/<UseCase>` | adaptador driving | handler |
| DTO de salida / read model | salida | `Application/<UseCase>` o `Application/Query` | handler o lector | adaptador driving |
| Modelo de persistencia | interno | `Infrastructure/Persistence` | repositorio | repositorio |
| Payload de API externa | interno | `Infrastructure/<Vendor>` | adaptador driven | adaptador driven |
| Mensaje de evento de integración | salida | `Application/Event` o contrato compartido | publicador | otro contexto |

Propiedades comunes: inmutables, sin comportamiento (a lo sumo un constructor nombrado o
`fromRow`), solo primitivos y otros DTOs. En PHP: `final readonly class` con promoción de
constructor. En TS: `type` o `interface` (no clases). En Python: `@dataclass(frozen=True)`
o modelo pydantic solo en el adaptador.

## Tres modelos, tres responsabilidades

```
   HTTP/JSON  <-- DTO salida -->  Handler  <-- Entidad -->  Repositorio  <-- Modelo ORM -->  BD
   (forma)                        (intención)              (invariantes)                     (filas)
```

- La **entidad** protege invariantes y expone comportamiento. Sus atributos son privados.
- El **modelo ORM** (Eloquent, Prisma row, SQLAlchemy model) refleja tablas: columnas
  planas, relaciones, timestamps. Es un detalle del adaptador de persistencia.
- El **DTO de salida** refleja lo que la vista necesita, ni más ni menos.

Cuando los tres "se parecen mucho" es tentador unificarlos. Se parecen al principio; en
seis meses la entidad tiene VO y reglas, la tabla tiene columnas de auditoría y la vista
quiere campos calculados. Mantenerlos separados desde el inicio cuesta un mapper de 20
líneas; unificarlos cuesta un refactor.

## Mappers explícitos vs automappers

**Explícito** (recomendado): una clase o módulo de funciones puras por agregado,
`InvoiceMapper::toDomain(row)`, `toRow(invoice)`, `toSummary(invoice)`. Ventajas: el
compilador/PHPStan/tsc detecta campos nuevos; no hay reflexión ni magia; el mapeo de VO
(`Money` -> dos columnas) es trivial.

**Automapper** (AutoMapper+, `class-transformer`, `pydantic.from_attributes`): reduce
código repetitivo pero: rompe en silencio ante renombrados; requiere getters públicos en
la entidad (rompiendo el encapsulado); fuerza convenciones de nombres entre capas. Úsalo
solo entre dos estructuras planas de la misma capa (fila SQL -> read model) y nunca para
entidades.

```php
// Infrastructure/Persistence/Eloquent/InvoiceMapper.php
final class InvoiceMapper
{
    public static function toDomain(InvoiceModel $m): Invoice
    {
        return Invoice::reconstitute(
            id: InvoiceId::of($m->id),
            customerId: CustomerId::of($m->customer_id),
            status: InvoiceStatus::from($m->status),
            lines: $m->lines->map(fn ($l) => new InvoiceLine(
                InvoiceLineId::of($l->id), $l->description,
                new Money($l->unit_price_cents, $l->currency), $l->quantity,
            ))->all(),
            issuedAt: $m->issued_at?->toDateTimeImmutable(),
        );
    }

    public static function fillModel(InvoiceModel $m, Invoice $i): void
    {
        $s = $i->snapshot();                    // array/struct de solo lectura expuesto por la raíz
        $m->id = $s->id; $m->customer_id = $s->customerId; $m->status = $s->status->value;
        $m->total_cents = $s->total->amountCents; $m->currency = $s->total->currency;
        $m->issued_at = $s->issuedAt;
    }
}
```

`reconstitute()` es un constructor nombrado que no valida transiciones ni emite eventos;
`snapshot()` expone estado como DTO interno sin abrir setters. Alternativa en PHP:
`Closure::bind` o reflexión en el mapper; funciona pero es más frágil.

## Mapeo entidad <-> persistencia

**TypeScript (Prisma)**

```ts
// infrastructure/persistence/invoiceMapper.ts
export const toDomain = (row: InvoiceRow & { lines: InvoiceLineRow[] }): Invoice =>
  Invoice.reconstitute({
    id: InvoiceId.of(row.id), customerId: CustomerId.of(row.customerId),
    status: row.status as InvoiceStatus,
    lines: row.lines.map((l) => InvoiceLine.reconstitute({ ...l, unitPrice: Money.of(l.unitPriceCents, l.currency) })),
    issuedAt: row.issuedAt,
  });

export const toRow = (inv: Invoice): Prisma.InvoiceUncheckedCreateInput => {
  const s = inv.snapshot();
  return { id: s.id, customerId: s.customerId, status: s.status, totalCents: s.total.cents, currency: s.total.currency, issuedAt: s.issuedAt };
};
```

**Python (SQLAlchemy)**: mismo patrón; evita el "mapeo imperativo clásico" de SQLAlchemy
sobre la entidad de dominio salvo en agregados triviales, porque acopla la entidad al
ORM (lazy loading, sesión) aunque no importe nada de él.

Reglas:
- Un VO con varios campos -> varias columnas (`total_cents`, `currency`), no JSON, salvo
  colecciones de VO sin consulta (`metadata`).
- Colecciones hijas: reemplazo completo (`delete + insert`) es correcto y simple para
  agregados pequeños; diff por id cuando las filas tienen identidad externa (FK desde
  otras tablas).
- Ids se generan **antes** de persistir (UUID v7 desde `repository.nextId()`), nunca
  autoincrement que obligue a un `save` para conocer el id.

## Mapeo hacia la vista: Inertia, JSON API, FastAPI

| Adaptador | Mecanismo | Entrada al mapeo |
|---|---|---|
| Inertia (Laravel) | props = arrays/DTOs serializables | read model o DTO de salida |
| JSON API (Laravel) | `JsonResource` construido desde el DTO | DTO, nunca el modelo Eloquent del módulo |
| Next route handler / server action | `Response.json(dto)` / return del DTO | DTO ya plano |
| FastAPI | `response_model=InvoiceOut` (pydantic) | `InvoiceOut.model_validate(dto)` |

```python
# infrastructure/http/schemas.py — pydantic solo aquí
class InvoiceOut(BaseModel):
    id: str; number: str | None; total_cents: int; currency: str; status: str
    model_config = ConfigDict(from_attributes=True)

@router.get("/invoices/{id}", response_model=InvoiceOut)
def get_invoice(id: str, q: GetInvoiceDetail = Depends(get_invoice_detail)) -> InvoiceOut:
    return InvoiceOut.model_validate(q(id))     # q devuelve el dataclass InvoiceDetail
```

En Inertia, un DTO PHP `readonly` con propiedades públicas se serializa a JSON sin
esfuerzo; en Vue tipa las props con el tipo TS espejo (`InvoiceRow`) generado o escrito a
mano (ver `../stacks/vue-front/overview.md`).

## Evitar la fuga de entidades

Síntomas de fuga: `$invoice->lines` en una plantilla Blade; `invoice.status` de la entidad
en un componente React; un `JsonResource` que recibe `Invoice` y llama a métodos de
negocio; un modelo Eloquent con `->load('customer.addresses')` viajando a la vista y
disparando N+1 en el render.

Consecuencias: la vista fija la forma de la entidad (no puedes renombrar un método sin
tocar 12 plantillas), la serialización expone campos internos y las lazy relations
ejecutan SQL fuera de la transacción.

Remedio: el handler devuelve DTO; las pantallas consumen read models; los `Resource`,
`response_model` y props se construyen desde DTOs. Test de arquitectura: ninguna clase
en `Infrastructure/Http` importa `Domain\Model\*` (ver
`../hexagonal/dependency-rules-tooling.md`).

## Errores frecuentes

- Un solo "modelo" que es entidad, fila y respuesta a la vez (el modelo Eloquent con
  `$appends` y `$hidden` para "ocultar" lo que no debe salir).
- Getters públicos en la entidad solo para que el mapper los lea: usa `snapshot()` o
  `reconstitute()` y mantén el encapsulado.
- Automapper por reflexión que "funciona" hasta que renombras `dueAt` por `dueDate`.
- Guardar VO como JSON para "no crear columnas": pierdes índices y consultas.
- DTOs anidados que reproducen todo el agregado para la lista: el read model de la lista
  tiene 6 campos.
- `toArray()` de Eloquent como DTO: expone todas las columnas, incluidas las nuevas que
  añadirán mañana.

## Checklist

- [ ] Command/Query/DTO de salida inmutables, planos, sin lógica.
- [ ] Mapper explícito por agregado en `Infrastructure/Persistence`.
- [ ] `reconstitute()` para rehidratar sin eventos; `snapshot()` para persistir sin setters.
- [ ] VO -> columnas; ids generados antes de persistir.
- [ ] Vistas y APIs consumen DTOs/read models; nunca entidades ni modelos ORM.
- [ ] pydantic / zod / Form Request solo en adaptadores.
- [ ] Regla de dependencia verificada: `Infrastructure/Http` no importa `Domain\Model`.
