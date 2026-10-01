# Repositorios: colección de agregados, no DAO

## Índice

- [Qué es y qué no es](#qué-es-y-qué-no-es)
- [Interfaz en el dominio, con intención](#interfaz-en-el-dominio-con-intención)
- [nextIdentity y generación de ids](#nextidentity-y-generación-de-ids)
- [Colección vs persistencia explícita](#colección-vs-persistencia-explícita)
- [Consultas: qué entra y qué no](#consultas-qué-entra-y-qué-no)
- [Implementación en memoria para tests](#implementación-en-memoria-para-tests)
- [Implementación por stack](#implementación-por-stack)
- [Transacciones y eventos](#transacciones-y-eventos)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Amplía [overview-concepts](overview-concepts.md) §5 y §13. Ver [aggregates](aggregates.md)
para el límite que persiste y [domain-events](domain-events.md) para la publicación.

## Qué es y qué no es

Un repositorio simula una **colección en memoria de agregados**: añades, buscas por id,
recuperas y el agregado vuelve tal como lo dejaste. Uno por agregado, nunca por entidad
hija ni por tabla.

| Repositorio | DAO / query builder / Eloquent model |
|---|---|
| Devuelve agregados completos | devuelve filas, arrays, modelos ORM |
| Métodos con vocabulario de negocio | `findBy`, `where`, `join` |
| Interfaz en `Domain`, implementación en `Infrastructure` | pertenece al framework |
| Solo lo que necesitan los casos de uso de escritura | cualquier lectura |

Las lecturas para pantallas no pasan por aquí ([CQRS ligero](overview-concepts.md#13-cqrs-ligero-read-models)).

## Interfaz en el dominio, con intención

```php
namespace App\Sales\Domain;

interface OrderRepository
{
    public function nextIdentity(): OrderId;
    public function ofId(OrderId $id): ?Order;
    /** @throws OrderNotFound */
    public function get(OrderId $id): Order;
    public function save(Order $order): void;
    /** @return list<Order> Solo si un caso de uso de escritura lo necesita. */
    public function openedBy(CustomerId $customer): array;
}
```

Convenciones:

- `ofId`/`find` devuelve `null`; `get` lanza `XNotFound`. Ofrece ambos y usa `get` en casos
  de uso que exigen existencia (menos `if` repetidos).
- `save` es upsert: el caso de uso no distingue crear de actualizar.
- Métodos de búsqueda nombrados por el concepto (`overdueAt(date)`, `openedBy(customer)`),
  no por columnas (`findByStatusAndCustomerId`).
- `remove(Order)` solo si el negocio borra de verdad; si no, un método de la raíz (`cancel`).
- Sin paginación, ordenación ni proyecciones: eso es lectura.

```ts
export interface OrderRepository {
  nextIdentity(): OrderId;
  ofId(id: OrderId): Promise<Order | null>;
  get(id: OrderId): Promise<Order>;          // throws OrderNotFound
  save(order: Order): Promise<void>;
}
```

## nextIdentity y generación de ids

El id se genera antes de persistir ([entities](entities.md)). Tres opciones:

| Opción | Cuándo |
|---|---|
| `repository.nextIdentity()` | quieres que la implementación decida el formato (UUID v7, ULID, secuencia) |
| `OrderId.generate()` estático | ids UUID sin dependencia; más simple, ligeramente menos testeable |
| `IdGenerator` como puerto | necesitas ids deterministas en tests o secuencias legibles |

Si la implementación real usa una secuencia de BD (`invoice_number`), es un concepto de
negocio aparte (`InvoiceSequence`, agregado) y no un id técnico.

## Colección vs persistencia explícita

Dos estilos válidos; elige uno por proyecto:

- **Colección** (ORM con Unit of Work: Doctrine, SQLAlchemy): `add(order)` una vez; los
  cambios posteriores se detectan y se persisten en `commit()`. No hay `save` tras cada
  cambio. Requiere que el ORM rastree el objeto de dominio o su mapeo.
- **Persistencia explícita** (Laravel/Eloquent, Prisma, SQL a mano): `save(order)`
  siempre, al final del caso de uso. Sin magia; el mapper decide qué `INSERT/UPDATE`.

En los stacks del equipo, por defecto **persistencia explícita**: un `save` al final del
caso de uso, dentro de la transacción. Es más verboso pero predecible y testeable.

## Consultas: qué entra y qué no

Entra en el repositorio: búsquedas que un **caso de uso de escritura** necesita para
cargar el agregado que va a modificar (`ofId`, `openedBy`, `activeSubscriptionOf`).

No entra: listados, filtros de UI, contadores, exportaciones, dashboards. Esas consultas
van a un **reader** en `Application` (interfaz) implementado con SQL/Eloquent/Prisma
directo que devuelve DTOs planos.

```php
// Application/Query/OrderListReader.php
interface OrderListReader
{
    /** @return Page<OrderRow> */
    public function search(OrderFilter $filter, int $page, int $perPage): Page;
}
// Infrastructure: DB::table('orders')->where(...)->paginate() -> map a OrderRow
```

Regla práctica: si el método devuelve algo que no es el agregado (o lista de agregados),
no va en el repositorio. Si devuelve agregados pero para pintar una tabla, tampoco:
cargar 200 agregados completos para mostrar 4 columnas es el error de rendimiento más
común en proyectos DDD.

Para reglas de selección reutilizables (`OverdueInvoices`), ver
[specifications](specifications.md) y su traducción a query.

## Implementación en memoria para tests

Un `InMemoryOrderRepository` permite testear casos de uso sin base de datos y sin mocks
frágiles. Debe respetar el contrato: devolver **copias** (o instancias distintas) para
que un test detecte si el caso de uso olvidó `save`.

```ts
export class InMemoryOrderRepository implements OrderRepository {
  private rows = new Map<string, OrderSnapshot>();
  nextIdentity(): OrderId { return OrderId.generate(); }
  async ofId(id: OrderId): Promise<Order | null> {
    const row = this.rows.get(id.value);
    return row ? Order.reconstitute(structuredClone(row)) : null;
  }
  async get(id: OrderId): Promise<Order> {
    const o = await this.ofId(id);
    if (!o) throw new OrderNotFound(id);
    return o;
  }
  async save(order: Order): Promise<void> { this.rows.set(order.id.value, order.toSnapshot()); }
}
```

Añade un **test de contrato** compartido que se ejecuta contra la implementación en
memoria y la real: `save` + `ofId` devuelve el mismo estado; `ofId` de un id
inexistente devuelve `null`; guardar dos veces no duplica; `version` se incrementa.
Así la de memoria no se convierte en un mock que miente.

## Implementación por stack

**Laravel (PHP 8.3)**: Eloquent como adaptador de persistencia, nunca como entidad.

```php
final class EloquentOrderRepository implements OrderRepository
{
    public function ofId(OrderId $id): ?Order
    {
        $row = OrderModel::with('lines')->find($id->value);
        return $row ? OrderMapper::toDomain($row) : null;
    }

    public function save(Order $order): void
    {
        $data = OrderMapper::toRow($order);
        $updated = OrderModel::where('id', $order->id->value)->where('version', $data['version'] - 1)->update($data);
        if ($updated === 0 && OrderModel::whereKey($order->id->value)->exists()) {
            throw new ConcurrencyConflict('Order', $order->id->value);
        }
        if ($updated === 0) OrderModel::create($data);
        OrderLineModel::where('order_id', $order->id->value)->delete();   // hijos: reemplazo completo
        OrderLineModel::insert(OrderMapper::linesToRows($order));
    }
}
```

**TypeScript (Prisma)**: repositorio recibe el cliente o la transacción (`tx`) por
constructor o por parámetro; el mapper vive en `infrastructure/persistence/`.

```ts
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly db: Prisma.TransactionClient | PrismaClient) {}
  async ofId(id: OrderId) {
    const row = await this.db.order.findUnique({ where: { id: id.value }, include: { lines: true } });
    return row ? toDomain(row) : null;
  }
}
```

**Python (SQLAlchemy 2)**: sesión inyectada; `Session.get()` + mapper, o imperative
mapping sobre la clase de dominio si el equipo acepta ese acoplamiento.

```python
class SqlAlchemyOrderRepository(OrderRepository):
    def __init__(self, session: Session) -> None: self._s = session
    def of_id(self, id: OrderId) -> Order | None:
        row = self._s.get(OrderRow, id.value)
        return to_domain(row) if row else None
    def save(self, order: Order) -> None:
        self._s.merge(to_row(order))   # commit lo hace el UnitOfWork
```

## Transacciones y eventos

- El repositorio **no abre transacciones**: las abre el caso de uso o el UoW
  ([overview-concepts](overview-concepts.md#14-unit-of-work--transacción-por-caso-de-uso)).
- El repositorio **no publica eventos**. Los recoge el caso de uso con `pullEvents()`
  tras el commit, o el UoW los persiste en una tabla outbox en la misma transacción.
- Guardar hijos: reemplazo completo (delete + insert) es simple y correcto para
  colecciones pequeñas; diff por id cuando la colección es grande o tiene FK entrantes.
- Si el agregado no cambió, `save` puede ser no-op; no lo optimices hasta medirlo.

## Errores frecuentes

- **Repositorio genérico** `Repository<T>` con `findAll`, `findBy(array)`, `count`:
  es un DAO. Cada agregado tiene su interfaz con sus métodos.
- **Devolver modelos Eloquent/Prisma** desde el repositorio: el dominio se llena de ORM.
- **Repositorio por tabla o por entidad hija**: rompe el límite del agregado.
- **Paginación y filtros de UI en el repositorio**: se cargan agregados para listar.
- **Mocks de repositorio con `expects(save)->once()`** en cada test: frágiles; usa la
  implementación en memoria y verifica estado.
- **Transacción abierta dentro de `save`**: no se puede componer con otros writes.
- **Publicar eventos desde el repositorio**: ocurre antes del commit.
- **Ignorar el retorno del `UPDATE`** con versión: conflictos silenciosos.

## Checklist

- [ ] Una interfaz por agregado en `Domain`; implementación en `Infrastructure`.
- [ ] `nextIdentity`, `ofId`/`get`, `save`; búsquedas solo para casos de uso de escritura.
- [ ] Devuelve agregados de dominio; el mapper traduce filas/modelos.
- [ ] Sin paginación, filtros de UI ni DTOs: eso va a readers de `Application`.
- [ ] Implementación en memoria que devuelve copias + test de contrato compartido.
- [ ] Sin transacciones ni publicación de eventos dentro del repositorio.
- [ ] Control de versión optimista en `save`, conflicto propagado como excepción de dominio.
- [ ] Hijos persistidos con la raíz (reemplazo o diff), nunca por repositorio propio.
