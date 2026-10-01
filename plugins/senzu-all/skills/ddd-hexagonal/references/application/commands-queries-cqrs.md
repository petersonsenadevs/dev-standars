# Commands, queries y CQRS

## Índice

- [Separación command/query](#separación-commandquery)
- [Handlers sin bus](#handlers-sin-bus)
- [Buses: cuándo sí y cuándo no](#buses-cuándo-sí-y-cuándo-no)
- [CQRS ligero vs CQRS completo](#cqrs-ligero-vs-cqrs-completo)
- [Read models y consistencia](#read-models-y-consistencia)
- [Ejemplos por stack](#ejemplos-por-stack)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../tactical/overview-concepts.md` §12-13, `use-cases.md`,
`read-models-projections.md`, `../integration/messaging-and-queues.md`.

## Separación command/query

Principio (CQS): un método o cambia estado o devuelve datos, no ambas cosas. Aplicado a la
capa de aplicación:

| | Command | Query |
|---|---|---|
| Intención | cambiar estado | leer |
| Nombre | imperativo: `IssueInvoice` | `ListPendingInvoices`, `GetInvoiceDetail` |
| Pasa por | agregado + repositorio + transacción | lector directo a BD (SQL/query builder) |
| Devuelve | `void`, id creado o `Result` | DTO/read model plano |
| Efectos | eventos de dominio | ninguno (salvo caché) |
| Test | unitario con fakes | integración con BD real |

Una excepción tolerada: un command devuelve el id generado o un pequeño DTO de
confirmación. Lo que no debe devolver es el estado completo para que la vista lo pinte;
para eso el adaptador hace una query después (o el cliente recarga).

## Handlers sin bus

El handler es una clase invocable (PHP/Python) o una función factoría (TS). El adaptador
driving lo obtiene por DI y lo llama. No hace falta más para el 90 % de los proyectos.

```php
// Laravel: el contenedor inyecta el handler en el controlador
public function __invoke(IssueInvoiceRequest $r, string $id, IssueInvoiceHandler $handle): JsonResponse
{
    $handle(new IssueInvoiceCommand($id, $r->user()->id));
    return response()->json(status: 202);
}
```

```ts
// TS: composición manual en el borde
const handlers = buildInvoicingHandlers(deps);            // { issueInvoice, listPending, ... }
export async function POST(req: Request, { params }: Ctx) {
  const r = await handlers.issueInvoice({ invoiceId: params.id, actorId: await currentUserId() });
  return r.ok ? new Response(null, { status: 202 }) : toHttpError(r.error);
}
```

## Buses: cuándo sí y cuándo no

Un command bus es un mapa `command -> handler` más una cadena de middlewares. Aporta:
middlewares transversales (transacción, logging, autorización, idempotencia), desacoplo del
adaptador respecto a la clase concreta, y un punto único para hacer commands asíncronos.

| Usa bus cuando | No lo uses cuando |
|---|---|
| Tienes > 20-30 handlers y repites transacción/log en cada uno | El proyecto tiene 5 casos de uso |
| Quieres que algunos commands se encolen sin cambiar el adaptador | Solo lo añades "porque CQRS lo dice" |
| Varios adaptadores (HTTP, CLI, listeners) despachan los mismos commands | El equipo no conoce el patrón y dificulta seguir el flujo |

Si lo adoptas, que sea mínimo: una interfaz `CommandBus { dispatch(object $c): mixed }` en
`Application/Port`, un adaptador en infraestructura (mapa sincrónico; Laravel `Bus::dispatchSync`;
en Python un `dict[type, Callable]`). Los middlewares se implementan como decoradores del
handler, así funcionan con o sin bus:

```php
final class TransactionalHandler
{
    public function __construct(private readonly callable $inner) {}
    public function __invoke(object $command): mixed
    {
        return DB::transaction(fn () => ($this->inner)($command));
    }
}
```

Alternativa a Symfony Messenger / tactician en Laravel: no la necesitas; el contenedor +
decoradores cubren el caso. Para asíncrono, un job que construye el command y llama al
handler (`../integration/messaging-and-queues.md`).

## CQRS ligero vs CQRS completo

| | Ligero (por defecto) | Completo |
|---|---|---|
| Bases de datos | una | escritura + lectura separadas (o event store) |
| Lecturas | consultas directas sobre las tablas de escritura, DTOs planos | proyecciones materializadas alimentadas por eventos |
| Consistencia | inmediata (misma transacción) | eventual (`../integration/eventual-consistency.md`) |
| Coste | casi nulo | infraestructura, reprocesado, monitorización, UX de estados pendientes |
| Cuándo | siempre como punto de partida | lecturas muy caras, modelos de lectura muy distintos, reporting cross-context, event sourcing |

Camino incremental: 1) commands por agregado, queries por lector directo; 2) una vista SQL
o tabla denormalizada para la pantalla lenta; 3) proyección por eventos solo para esa
pantalla. No saltes al paso 3 sin haber medido el 1.

## Read models y consistencia

- Un read model es un DTO diseñado para **una pantalla o un endpoint**, no un espejo de
  la tabla. `InvoiceRow { id, number, customerName, totalCents, status }`.
- La interfaz del lector (`PendingInvoicesReader`) vive en `Application/Query`; la
  implementación en `Infrastructure/Persistence/Query`. El dominio no la conoce.
- Paginación, filtros, ordenación, joins: en el lector. El repositorio no pagina.
- Consistencia: en CQRS ligero, tras un command el siguiente GET ya ve el cambio. Con
  proyecciones asíncronas, devuelve el id y muestra estado "procesando" o haz
  *read-your-writes* leyendo del modelo de escritura durante unos segundos.

## Ejemplos por stack

**Python 3.12 (FastAPI + SQLAlchemy), sin bus**

```python
# src/invoicing/application/queries/list_pending_invoices.py
@dataclass(frozen=True)
class ListPendingInvoices:
    customer_id: str
    page: int = 1

class PendingInvoicesReader(Protocol):
    def for_customer(self, customer_id: str, page: int) -> Page[InvoiceRow]: ...

# src/invoicing/infrastructure/query/sql_pending_invoices_reader.py
class SqlPendingInvoicesReader:
    def __init__(self, session: Session) -> None: self._s = session
    def for_customer(self, customer_id: str, page: int) -> Page[InvoiceRow]:
        rows = self._s.execute(text("""
            SELECT i.id, i.number, i.total_cents, c.name AS customer_name
            FROM invoices i JOIN customers c ON c.id = i.customer_id
            WHERE i.customer_id = :cid AND i.status = 'issued'
            ORDER BY i.due_at DESC LIMIT 20 OFFSET :off"""),
            {"cid": customer_id, "off": (page - 1) * 20}).mappings().all()
        return Page(items=[InvoiceRow(**r) for r in rows], page=page)
```

**TypeScript (Prisma) — lector con `select` plano**

```ts
export const prismaPendingInvoicesReader = (db: PrismaClient): PendingInvoicesReader => ({
  async forCustomer(customerId, page) {
    const rows = await db.invoice.findMany({
      where: { customerId, status: 'ISSUED' }, orderBy: { dueAt: 'desc' },
      skip: (page - 1) * 20, take: 20,
      select: { id: true, number: true, totalCents: true, customer: { select: { name: true } } },
    });
    return rows.map((r) => ({ id: r.id, number: r.number, totalCents: r.totalCents, customerName: r.customer.name }));
  },
});
```

**Laravel** — ver `../stacks/laravel/overview.md` §9 (`DbPendingInvoicesReader`).

## Errores frecuentes

- Query que rehidrata agregados para listar 200 filas: lento y deforma el agregado con
  getters de presentación.
- Command que devuelve el agregado o el modelo ORM "para no hacer otra consulta".
- Bus + middlewares antes de tener 5 handlers: ceremonia sin beneficio.
- Usar el repositorio como query builder (`findByStatusAndCustomerOrderedBy...`).
- Read model con lógica de negocio (`if status == 'issued' and due < today: 'overdue'`):
  calcula `overdue` en SQL o en el DTO como dato derivado documentado, no como regla que
  luego difiere del agregado.
- "CQRS completo" por moda: dos BD y proyecciones para una app con 50 usuarios.

## Checklist

- [ ] Cada operación es command **o** query; nombre y carpeta lo dejan claro.
- [ ] Commands: agregado + repositorio + transacción; queries: lector directo a BD.
- [ ] Lectores devuelven DTOs por pantalla; paginación y filtros viven ahí.
- [ ] Sin bus salvo necesidad demostrada; decoradores para lo transversal.
- [ ] CQRS ligero por defecto; proyecciones solo con medición previa.
- [ ] La consistencia elegida (inmediata/eventual) está documentada en el módulo.
