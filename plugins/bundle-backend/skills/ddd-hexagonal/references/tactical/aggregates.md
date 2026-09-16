# Agregados: límites de consistencia

## Índice

- [Qué protege un agregado](#qué-protege-un-agregado)
- [Reglas de diseño](#reglas-de-diseño)
- [Diseño paso a paso: Order y OrderLine](#diseño-paso-a-paso-order-y-orderline)
- [Referencia por id, no por objeto](#referencia-por-id-no-por-objeto)
- [Una transacción, un agregado](#una-transacción-un-agregado)
- [Consistencia eventual entre agregados](#consistencia-eventual-entre-agregados)
- [Concurrencia: versión optimista](#concurrencia-versión-optimista)
- [Tamaño: cuándo partir un agregado](#tamaño-cuándo-partir-un-agregado)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Profundiza [overview-concepts](overview-concepts.md) §4. Ver también [entities](entities.md),
[domain-events](domain-events.md), [repositories](repositories.md).

## Qué protege un agregado

Un agregado es la unidad mínima que debe ser consistente **en todo momento**, en una sola
transacción. No es "un grupo de entidades relacionadas": es el conjunto de datos que una
regla de negocio necesita ver junto para decidir. Pregunta guía: *¿qué invariante se
rompería si este dato y aquel se guardaran en transacciones distintas?* Si ninguno, son
agregados distintos.

Invariante: regla que debe cumplirse al terminar cada operación. Ejemplos en `Order`:
"el total es la suma de las líneas", "no hay dos líneas del mismo producto", "no se
modifica tras confirmar". Cada método público de la raíz deja el agregado cumpliéndolas.

## Reglas de diseño

1. **Una raíz** con identidad global; el resto (entidades hijas, VO) solo se alcanza a
   través de ella.
2. **Invariantes dentro; políticas fuera.** Lo que se cumple siempre va en el agregado;
   lo que se cumple "pronto" (stock, límites globales) va en otro agregado + evento.
3. **Referencia a otros agregados por id.**
4. **Pequeño**: la mayoría son una raíz + pocos VO. Un agregado con miles de hijos no se
   carga entero; entonces es otra cosa.
5. **Se carga y guarda completo** por su repositorio; sin lazy loading entre agregados.
6. **Registra eventos** para todo lo que otros deban saber.

## Diseño paso a paso: Order y OrderLine

**1. Lista los invariantes** con negocio, no los campos:

- Un pedido sin líneas no se confirma.
- La cantidad de una línea es > 0; el mismo producto no aparece dos veces.
- Tras `confirmed`, las líneas no cambian.
- El total se calcula a partir de las líneas (nunca se almacena como verdad).

**2. Decide qué queda dentro.** `OrderLine` (depende de las reglas 1-3): dentro, como
entidad hija. `Product`: fuera (tiene ciclo propio; solo necesitamos `ProductId`, nombre
y precio *en el momento del pedido*, copiados como VO). `Customer`: fuera, por id.
`Payment`: fuera (su vida sigue tras el pedido; se relaciona por evento).

**3. Escribe la raíz con métodos-verbo.**

```php
final class Order
{
    /** @var array<string, OrderLine> keyed by productId */ private array $lines = [];
    private OrderStatus $status = OrderStatus::Draft;
    private int $version = 0;
    /** @var list<object> */ private array $events = [];

    private function __construct(public readonly OrderId $id, private readonly CustomerId $customerId) {}

    public static function open(CustomerId $customer): self
    {
        $o = new self(OrderId::generate(), $customer);
        $o->record(new OrderOpened($o->id, $customer));
        return $o;
    }

    public function addProduct(ProductId $product, ProductSnapshot $snapshot, int $qty): void
    {
        $this->assertDraft();
        if ($qty <= 0) throw new InvalidQuantity($qty);
        $key = (string) $product;
        $this->lines[$key] = isset($this->lines[$key])
            ? $this->lines[$key]->withAddedQuantity($qty)
            : OrderLine::create($product, $snapshot, $qty);
    }

    public function confirm(Clock $clock): void
    {
        $this->assertDraft();
        if ($this->lines === []) throw OrderCannotBeConfirmed::withoutLines($this->id);
        $this->status = OrderStatus::Confirmed;
        $this->record(new OrderConfirmed($this->id, $this->customerId, $this->total(), $clock->now()));
    }

    public function total(): Money
    {
        return array_reduce($this->lines, fn (Money $c, OrderLine $l) => $c->add($l->total()), Money::zero(Currency::EUR));
    }

    private function assertDraft(): void
    {
        if ($this->status !== OrderStatus::Draft) throw OrderIsLocked::for($this->id, $this->status);
    }
    private function record(object $e): void { $this->events[] = $e; }
    /** @return list<object> */ public function pullEvents(): array { [$e, $this->events] = [$this->events, []]; return $e; }
}
```

**4. Escribe los tests como frases del glosario** antes de la persistencia:
`test_cannot_confirm_without_lines`, `test_adding_same_product_twice_merges_quantity`,
`test_confirmed_order_rejects_changes`. Si un test necesita un repositorio, el límite
está mal.

**5. Diseña la persistencia después**: tablas `orders`, `order_lines`; el repositorio
guarda ambas en una transacción ([repositories](repositories.md)).

## Referencia por id, no por objeto

```ts
// Mal: navegación entre agregados, carga en cascada, invariantes ajenos al alcance.
class Order { customer: Customer; lines: { product: Product }[] }

// Bien: ids + snapshot de lo que el pedido necesita "congelado".
class Order {
  private constructor(readonly id: OrderId, private readonly customerId: CustomerId) {}
}
class OrderLine {
  constructor(readonly productId: ProductId, readonly nameAtOrder: string, readonly unitPrice: Money, readonly qty: number) {}
}
```

Si el caso de uso necesita datos del otro agregado para decidir (precio actual, límite de
crédito), los carga y los pasa como argumento o como VO: `order.addProduct(id, snapshot, qty)`.
El agregado no busca nada por sí mismo.

## Una transacción, un agregado

El caso de uso carga un agregado, llama a un método, guarda. Si te ves guardando dos
agregados en la misma transacción, casi siempre es una de estas:

| Situación | Solución |
|---|---|
| Ambos deben ser consistentes de verdad, siempre | son un solo agregado (revisa invariantes) |
| El segundo "reacciona" al primero | evento de dominio + handler que carga el segundo ([domain-events](domain-events.md)) |
| Necesitas datos del segundo para decidir | léelos antes (query) y pásalos como argumento |
| Es una operación masiva | caso de uso por elemento, o proceso batch fuera del dominio |

Excepción pragmática: dos agregados pequeños del mismo contexto, mismo esquema, y el
negocio exige atomicidad real (transferencia entre cuentas). Documenta la excepción y
mantén el evento igualmente.

## Consistencia eventual entre agregados

`Order.confirm()` no descuenta stock: emite `OrderConfirmed`; el contexto Inventario
reserva y, si no puede, emite `StockReservationFailed`, y Ventas reacciona (cancela o
marca en espera). El proceso queda explícito, con estados intermedios visibles al usuario
("confirmado, pendiente de stock"). Diseña los estados de compensación desde el inicio:
un evento sin "qué pasa si falla" es un hueco de negocio.

```python
# Handler idempotente en el contexto Inventory
class ReserveStockOnOrderConfirmed:
    def __init__(self, stock: StockRepository, uow: UnitOfWork): ...

    def __call__(self, event: OrderConfirmed) -> None:
        with self.uow:
            item = self.stock.of_product(event.product_id)
            if item.already_reserved_for(event.order_id):   # idempotencia
                return
            item.reserve(event.order_id, event.quantity)     # puede lanzar InsufficientStock
            self.stock.save(item)
            self.uow.commit()
```

## Concurrencia: versión optimista

Dos usuarios cargan el mismo `Order`, ambos modifican, ambos guardan: el segundo pisa al
primero sin saberlo. Solución estándar: columna `version` que el repositorio incrementa y
comprueba en el `UPDATE ... WHERE id = ? AND version = ?`. Si afecta 0 filas, lanza
`ConcurrencyConflict` y el caso de uso decide (reintentar, informar).

```ts
// Prisma: updateMany devuelve count; 0 = alguien guardó antes.
const { count } = await tx.order.updateMany({
  where: { id: order.id.value, version: order.version },
  data: { ...toRow(order), version: order.version + 1 },
});
if (count === 0) throw new ConcurrencyConflict('Order', order.id.value);
```

Laravel: `Order::where('id', $id)->where('version', $v)->update([...])` y comprobar el
retorno. Bloqueo pesimista (`SELECT ... FOR UPDATE`) solo para agregados con contención
real y operaciones muy cortas (numeración correlativa, saldos).

## Tamaño: cuándo partir un agregado

Señales de agregado demasiado grande:

- Carga lenta o "necesitamos lazy loading" dentro del agregado.
- Conflictos de concurrencia frecuentes entre usuarios que tocan partes distintas.
- Métodos que solo tocan una sublista y no consultan el resto.
- Un `Customer` con pedidos, facturas, direcciones y tickets colgando.

Cómo partir: cada sublista con ciclo propio pasa a ser raíz (`Order` fuera de `Customer`)
con `CustomerId`. Lo que la regla original necesitaba se mantiene por evento o por un
contador desnormalizado en el agregado grande, aceptando consistencia eventual.

Señal de agregado demasiado pequeño: el caso de uso carga tres agregados para aplicar
una sola regla. Entonces esa regla define el límite real.

## Errores frecuentes

- **Agregado = tabla con sus relaciones**: se diseña por esquema, no por invariantes.
- **Navegación objeto a objeto entre agregados** (`order.customer.invoices`): carga en
  cascada y reglas ajenas al alcance.
- **Guardar hijos por separado** (`orderLineRepository.save(line)`) saltando la raíz.
- **Total almacenado y editable** en vez de derivado (o derivado y además persistido sin
  regla clara de quién manda).
- **Sin versión**: pérdida silenciosa de escrituras.
- **Eventos publicados dentro de la transacción** con IO externo.
- **Agregado que consulta el repositorio** para validar unicidad global: eso es un servicio
  de dominio o una restricción de BD ([domain-services](domain-services.md)).
- **Un agregado gigante "por seguridad"** que nadie puede cargar en producción.

## Checklist

- [ ] Invariantes listados en texto antes de escribir código.
- [ ] Raíz única; hijos solo a través de ella; sin repositorios de hijos.
- [ ] Otros agregados por id; snapshots inmutables de datos externos necesarios.
- [ ] Cada método público deja el agregado consistente y registra su evento.
- [ ] Un caso de uso = un agregado guardado; reacciones por evento.
- [ ] Columna `version` y `ConcurrencyConflict` gestionado en el caso de uso.
- [ ] Compensaciones diseñadas para cada consistencia eventual.
- [ ] Tests de dominio sin base de datos que leen como frases del glosario.
