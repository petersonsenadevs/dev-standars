# Python (FastAPI / LangGraph): hexagonal con Protocols

## Índice

- [Estructura de carpetas](#estructura-de-carpetas)
- [Dominio: dataclasses frozen y pydantic](#dominio-dataclasses-frozen-y-pydantic)
- [Puertos como Protocol](#puertos-como-protocol)
- [Casos de uso: callables con inyección explícita](#casos-de-uso-callables-con-inyección-explícita)
- [Transacciones: Unit of Work](#transacciones-unit-of-work)
- [Repositorios SQLAlchemy como adaptadores](#repositorios-sqlalchemy-como-adaptadores)
- [FastAPI: Depends solo en adaptadores](#fastapi-depends-solo-en-adaptadores)
- [Eventos de dominio](#eventos-de-dominio)
- [LangGraph: el LLM y las tools son puertos](#langgraph-el-llm-y-las-tools-son-puertos)
- [Reglas de dependencia: import-linter](#reglas-de-dependencia-import-linter)
- [pytest por capas](#pytest-por-capas)
- [Decisiones pragmáticas](#decisiones-pragmáticas)
- [Checklist](#checklist)

Este documento es el mapa del stack Python: estructura, convenciones y decisiones del
equipo. El detalle de cada tema está en los documentos de esta carpeta y en los
transversales enlazados.

## Estructura de carpetas

```
src/
  invoicing/
    domain/           invoice.py (agregado), money.py (VO), events.py, errors.py, ports.py (Protocols)
    application/      issue_invoice.py (Command + callable), queries.py (Reader Protocol + InvoiceRow), uow.py
    infrastructure/   orm.py, sqlalchemy_invoice_repository.py, sqlalchemy_uow.py, readers.py,
                      api.py (router FastAPI), deps.py (wiring), event_bus.py
    testing/          InMemoryInvoiceRepository, FakeUnitOfWork, builders
  shared/domain/      DomainEvent, Result (opcional), ids
  agents/             contextos LangGraph (misma estructura)
main.py               crea la app, incluye routers
tests/                unit/, integration/, e2e/
```

Cada contexto es un paquete importable (`invoicing.domain`, ...) con `src` layout en `pyproject.toml`.

Detalle: `../../hexagonal/folder-structures.md`.

## Dominio: dataclasses frozen y pydantic

- VO: `@dataclass(frozen=True, slots=True)` con `__post_init__` para validar. Igualdad
  por valor gratis; hashable.
- Entidades/agregados: `@dataclass` mutable con campos privados por convención
  (`_status`) y métodos de negocio. Eventos en `_events: list`.
- pydantic en dominio: solo `BaseModel(frozen=True)` para VO con validación rica. Nunca
  para agregados (los validadores por campo empujan al modelo anémico). pydantic manda en
  el adaptador HTTP (schemas de request/response).

```python
@dataclass(frozen=True, slots=True)
class Money:
    amount_cents: int
    currency: str
    def __post_init__(self) -> None:
        if self.amount_cents < 0: raise ValueError("negative money")
```

Errores de dominio: excepciones con jerarquía `DomainError` y `code` para el mapeo HTTP.
`Result` estilo TS es poco idiomático en Python; solo en agentes con flujo tras fallo esperado.

Detalle: `../../tactical/value-objects.md`, `../../tactical/invariants-and-errors.md`.

## Puertos como Protocol

```python
from typing import Protocol
class InvoiceRepository(Protocol):
    def of_id(self, id: InvoiceId) -> Invoice | None: ...
    def save(self, invoice: Invoice) -> None: ...
    def next_id(self) -> InvoiceId: ...

class Clock(Protocol):
    def now(self) -> datetime: ...
```

`Protocol` = tipado estructural: el adaptador solo cumple la firma; mypy/pyright lo
verifican. Prefiere `Protocol` a `ABC` salvo que compartas implementación base. Si el
adaptador es async, el Protocol es `async def`; no mezcles.

Detalle: `../../hexagonal/ports-and-adapters.md`.

## Casos de uso: callables con inyección explícita

```python
@dataclass(frozen=True)
class IssueInvoiceCommand:
    invoice_id: str
    actor_id: str

class IssueInvoice:
    def __init__(self, uow: UnitOfWork, clock: Clock, events: EventBus) -> None:
        self._uow, self._clock, self._events = uow, clock, events

    def __call__(self, cmd: IssueInvoiceCommand) -> InvoiceNumber:
        with self._uow as uow:
            invoice = uow.invoices.of_id(InvoiceId(cmd.invoice_id))
            if invoice is None: raise InvoiceNotFound(cmd.invoice_id)
            number = uow.sequences.next(self._clock.now())
            invoice.issue(number, self._clock.now())
            uow.invoices.save(invoice)
            uow.commit()
        self._events.publish(invoice.pull_events())   # fuera de la transacción
        return number
```

Alternativa funcional: `issue_invoice(cmd, *, uow, clock, events)` + `functools.partial`. Nunca importar `fastapi`, `sqlalchemy` ni `langgraph` aquí.

Detalle: `../../application/use-cases.md`.

## Transacciones: Unit of Work

El UoW es un `Protocol` con los repositorios que comparten sesión (`invoices`,
`sequences`), `__enter__`/`__exit__` (rollback si no hubo commit) y `commit()`. La
implementación SQLAlchemy abre la sesión en `__enter__`, construye los repositorios sobre
ella y hace `rollback()` + `close()` en `__exit__`. Un caso de uso = un `with`. Tests de
aplicación usan `FakeUnitOfWork` con repositorios en memoria y un flag `committed`.

Detalle: `../../persistence/sqlalchemy.md` (sesión por caso de uso, identity map, async)
y `../../application/transactions-unit-of-work.md`.

## Repositorios SQLAlchemy como adaptadores

Dos opciones válidas:

- Imperative mapping (`registry.map_imperatively(Invoice, invoices_table)`): la entidad
  se persiste sin clase ORM. Menos código; la entidad queda instrumentada (cuidado con
  `__slots__` y frozen).
- Modelos ORM separados + mapeo explícito (`InvoiceModel(Base)` + `to_domain/to_row`):
  más código, dominio 100 % puro. Recomendado con VO compuestos o `frozen=True`.

```python
class SqlAlchemyInvoiceRepository:
    def __init__(self, session: Session) -> None: self._s = session
    def of_id(self, id: InvoiceId) -> Invoice | None:
        row = self._s.get(InvoiceModel, id.value, options=[selectinload(InvoiceModel.lines)])
        return to_domain(row) if row else None
    def save(self, invoice: Invoice) -> None:
        self._s.merge(to_row(invoice))     # upsert de raíz + líneas (cascade all, delete-orphan)
```

Detalle: `../../persistence/sqlalchemy.md`, `../../persistence/orm-mapping.md`.

## FastAPI: Depends solo en adaptadores

```python
# infrastructure/deps.py: único sitio que conoce FastAPI y SQLAlchemy a la vez
def get_issue_invoice(uow=Depends(get_uow)) -> IssueInvoice: return IssueInvoice(uow, SystemClock(), bus)

# infrastructure/api.py: adaptador driving
@router.post("/{invoice_id}/issue", response_model=IssueInvoiceResponse)
def issue(invoice_id: UUID, user: User = Depends(current_user), use_case: IssueInvoice = Depends(get_issue_invoice)):
    return IssueInvoiceResponse(number=str(use_case(IssueInvoiceCommand(str(invoice_id), user.id))))
```

En `main.py`, un `@app.exception_handler(DomainError)` global devuelve 409 con
`{"error": exc.code, "message": str(exc)}`.

`Depends` nunca aparece en `application/` ni `domain/`. Los tests e2e usan
`app.dependency_overrides[get_uow] = lambda: FakeUnitOfWork()` o una BD de test.

Detalle: `fastapi-adapters.md` (router por contexto, schemas vs commands, lifespan,
async/sync, BackgroundTasks, paginación, tests).

## Eventos de dominio

Eventos como `@dataclass(frozen=True)` con `name: ClassVar[str] = "invoicing.invoice_issued.v1"`.
`InProcessEventBus` síncrono para listeners rápidos; con IO -> `BackgroundTasks`,
Celery/RQ/arq, u outbox si hace falta garantía. Los listeners son adaptadores: traducen
evento a command y llaman a otro caso de uso.

Detalle: `../../tactical/domain-events.md`, `../../integration/outbox-pattern.md`,
`../../integration/messaging-and-queues.md`.

## LangGraph: el LLM y las tools son puertos

Un agente es un caso de uso con un grafo dentro. El LLM y las tools son puertos driven;
el grafo (nodos, aristas, estado) es la orquestación; las decisiones de negocio que
puedas expresar sin el modelo van a funciones puras del dominio.

```
src/agents/support_triage/
  domain/         triage.py (reglas puras: decide_triage), state.py (TypedDict del grafo)
  application/    ports.py (LLM, TicketSearch: Protocols), graph.py (build_graph(deps)), run_triage.py
  infrastructure/ anthropic_llm.py, es_ticket_search.py, deps.py
```

```python
class LLM(Protocol):
    def classify(self, text: str, categories: Sequence[str]) -> Classification: ...   # tipado, no "invoke(prompt)"

def build_graph(llm: LLM, search: TicketSearch) -> CompiledGraph:   # nodos cierran sobre deps
    def classify(state: TriageState) -> TriageState: ...            # llama a llm.classify
    def decide(state: TriageState) -> TriageState: ...              # llama a decide_triage (puro)
    ...
```

Tests: `build_graph(FakeLLM(...), InMemoryTicketSearch([...]))` ejecuta el grafo entero
en ms. El prompt vive en el adaptador, versionado, con test de contrato. Tools de
LangChain (`@tool`) se definen en infraestructura envolviendo el puerto, no al revés.

Detalle: `langgraph-agents.md` (estado y reducers, structured output, checkpointers,
human-in-the-loop, tests) y `../../examples/walkthrough-agent-langgraph.md`.

## Reglas de dependencia: import-linter

Dos contratos en `.importlinter`: `layers` (`infrastructure` > `application` > `domain`
por contexto) y `forbidden` (`domain` y `application` no importan `fastapi`,
`sqlalchemy`, `pydantic`, `langgraph`, `langchain`, `httpx`). Un contrato `independence`
entre contextos evita cruces. `lint-imports` en CI junto a mypy `--strict` (o pyright)
para que los Protocols valgan.

Detalle: `../../hexagonal/dependency-rules-tooling.md`; archivo completo en `templates/python/.importlinter`.

## pytest por capas

```python
def test_issue_commits_and_publishes():
    uow, bus = FakeUnitOfWork(), RecordingEventBus()
    uow.invoices.save(an_invoice().with_line(Money(1000, "EUR")).build())
    IssueInvoice(uow, FixedClock(datetime(2026, 1, 10, tzinfo=UTC)), bus)(IssueInvoiceCommand("inv-1", "u1"))
    assert uow.committed and bus.of_type(InvoiceIssued)
```

Markers `unit`/`integration`/`e2e` en `pyproject.toml`; `integration` con `testcontainers`
Postgres o SQLite in-memory si el SQL es portable.

Detalle: `../../testing/overview.md`; `templates/python/tests/`.

## Decisiones pragmáticas

- CRUD: router + pydantic + SQLAlchemy directo. Sin capas.
- Async: si la API es async, puertos y repositorios async; el dominio sigue síncrono.
- Ids: `NewType` para distinguir tipos; dataclass frozen solo si hay validación.
- Contenedor DI (`dependency-injector`, `punq`): solo si `deps.py` supera ~100 líneas.
- Agentes: el grafo es aplicación; el LLM es un puerto; el prompt es infraestructura.

## Checklist

- [ ] Cada contexto es un paquete con `domain/`, `application/`, `infrastructure/`, `testing/`.
- [ ] VO como dataclass frozen; agregados sin pydantic; pydantic solo en el adaptador HTTP.
- [ ] Puertos como `Protocol`, sync o async sin mezclar; mypy/pyright en CI.
- [ ] Un caso de uso = un `with uow`; eventos publicados fuera de la transacción.
- [ ] `Depends` solo en `infrastructure/`; `DomainError` mapeado en un handler global.
- [ ] En agentes, el LLM y las tools son puertos; las reglas puras viven en `domain/`.
- [ ] import-linter con contratos de capas, frameworks prohibidos e independencia de contextos.
- [ ] `pytest -m unit` sin base de datos ni red.
