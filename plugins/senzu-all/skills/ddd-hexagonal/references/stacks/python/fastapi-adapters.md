# FastAPI como adaptador driving

## Índice

- [Alcance](#alcance)
- [Un router por contexto](#un-router-por-contexto)
- [Depends solo en infrastructure](#depends-solo-en-infrastructure)
- [Schemas pydantic frente a commands y DTOs](#schemas-pydantic-frente-a-commands-y-dtos)
- [Errores de dominio a HTTP](#errores-de-dominio-a-http)
- [Wiring con lifespan](#wiring-con-lifespan)
- [Async y sync sin mezclar](#async-y-sync-sin-mezclar)
- [BackgroundTasks como adaptador](#backgroundtasks-como-adaptador)
- [Lecturas paginadas desde readers](#lecturas-paginadas-desde-readers)
- [Tests con dependency_overrides](#tests-con-dependency_overrides)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

## Alcance

Profundiza el §7 de [`overview.md`](overview.md): el router traduce HTTP a commands y
resultados a JSON; todo vive en `infrastructure/` (`api.py`, `deps.py`, `schemas.py`).
Persistencia en [`../../persistence/sqlalchemy.md`](../../persistence/sqlalchemy.md); tests en
[`../../testing/adapter-tests.md`](../../testing/adapter-tests.md). Plantilla: `templates/python/infrastructure/api.py`.

## Un router por contexto

Cada contexto expone un `APIRouter` con prefijo, tags y dependencias transversales
(auth) declaradas una vez. `main.py` solo incluye routers.

```python
# invoicing/infrastructure/api.py
router = APIRouter(prefix="/invoices", tags=["invoicing"], dependencies=[Depends(require_auth)])

@router.post("/{invoice_id}/issue", response_model=IssueInvoiceResponse, status_code=200)
def issue(invoice_id: UUID, actor: Actor = Depends(current_actor),
          use_case: IssueInvoice = Depends(get_issue_invoice)) -> IssueInvoiceResponse:
    number = use_case(IssueInvoiceCommand(invoice_id=str(invoice_id), actor_id=actor.id))
    return IssueInvoiceResponse(number=str(number))

# main.py
app.include_router(invoicing_router)
app.include_router(sales_router)
```

Una función de ruta = una llamada a caso de uso o reader. Un `if` de negocio o dos casos
de uso encadenados delatan un caso de uso o servicio de dominio que falta.

## Depends solo en infrastructure

`Depends` es el contenedor de FastAPI; solo `infrastructure/deps.py` y `api.py` lo importan.
Los casos de uso reciben sus puertos por constructor (`templates/python/application/issue_invoice.py`).

```python
# invoicing/infrastructure/deps.py
def get_session_factory(request: Request) -> sessionmaker[Session]:
    return request.app.state.session_factory          # creado en lifespan

def get_uow(sf: sessionmaker[Session] = Depends(get_session_factory)) -> UnitOfWork:
    return SqlAlchemyUnitOfWork(sf)

def get_event_bus(request: Request) -> EventBus:
    return request.app.state.event_bus

def get_issue_invoice(uow: UnitOfWork = Depends(get_uow), bus: EventBus = Depends(get_event_bus)) -> IssueInvoice:
    return IssueInvoice(uow=uow, clock=SystemClock(), events=bus)
```

Los retornos se anotan con los `Protocol` de `templates/python/domain/ports.py`, no con las
clases concretas: la ruta no sabe que hay SQLAlchemy. `Annotated[IssueInvoice, Depends(...)]`
como alias reduce ruido cuando se repite.

## Schemas pydantic frente a commands y DTOs

pydantic valida forma; el command es una dataclass frozen sin validadores de negocio.
La conversión es explícita en el schema, nunca `Command(**body.dict())`.

```python
# invoicing/infrastructure/schemas.py
class AddLineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(min_length=1, max_length=255)
    unit_price_cents: int = Field(ge=0)
    quantity: int = Field(ge=1)

    def to_command(self, invoice_id: UUID, actor_id: str) -> AddLineCommand:
        return AddLineCommand(invoice_id=str(invoice_id), actor_id=actor_id,
                              description=self.description,
                              unit_price_cents=self.unit_price_cents, quantity=self.quantity)

class InvoiceRowResponse(BaseModel):
    id: str; number: str | None; customer_name: str; total_cents: int; currency: str; due_at: datetime | None

    @classmethod
    def from_dto(cls, row: InvoiceRow) -> "InvoiceRowResponse":
        return cls(**asdict(row))       # el DTO es una dataclass plana; si divergen, mapea campo a campo
```

No reutilices el DTO de aplicación como `response_model`: el contrato HTTP cambia por
razones de API (versionar, ocultar) y el DTO por razones de aplicación. `extra="forbid"`
evita que campos desconocidos entren silenciosamente.

## Errores de dominio a HTTP

Un handler global por rama de la jerarquía; nunca `try/except` por ruta.

```python
# shared/domain/errors.py
class DomainError(Exception):
    code: ClassVar[str] = "domain_error"
class NotFoundError(DomainError): code = "not_found"
class ConflictError(DomainError): code = "conflict"          # transición inválida, invariante roto
class ValidationError(DomainError): code = "validation"      # VO inválido construido desde entrada

# invoicing/domain/errors.py
class InvoiceCannotBeIssued(ConflictError):
    code = "invoice_cannot_be_issued"
    @classmethod
    def without_lines(cls, invoice_id: str) -> "InvoiceCannotBeIssued":
        return cls(f"invoice {invoice_id} has no lines")

# main.py
STATUS = {NotFoundError: 404, ConflictError: 409, ValidationError: 422}

@app.exception_handler(DomainError)
def domain_error(_: Request, exc: DomainError) -> JSONResponse:
    status = next((s for t, s in STATUS.items() if isinstance(exc, t)), 400)
    return JSONResponse(status_code=status, content={"error": exc.code, "message": str(exc)})
```

El 422 de forma lo genera `RequestValidationError`; para un cuerpo homogéneo registra
también su handler. Errores de infraestructura (`OperationalError`, timeouts) no se mapean: 500 y log.

## Wiring con lifespan

Los recursos de proceso (engine, bus, clientes HTTP) se crean una vez en `lifespan` y se
cuelgan de `app.state`; `deps.py` los lee del request. Los tests sustituyen el estado sin parches globales.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    app.state.session_factory = sessionmaker(engine, expire_on_commit=False)
    app.state.event_bus = InProcessEventBus(listeners=build_listeners(app.state.session_factory))
    yield
    engine.dispose()

app = FastAPI(lifespan=lifespan)
```

`build_listeners` registra adaptadores que convierten eventos en commands de otros casos
de uso. Nada de `SessionLocal = sessionmaker(...)` a nivel de módulo.

## Async y sync sin mezclar

Con SQLAlchemy sync la ruta es `def` (FastAPI la ejecuta en threadpool) y los puertos son
sync; con `AsyncSession`/httpx la ruta es `async def` y los Protocols son `async def` de
arriba abajo. Nunca un caso de uso sync desde `async def` (bloquea el event loop) ni un
puerto async desde uno sync. El dominio (agregados, VO) es síncrono y puro en ambos casos.

## BackgroundTasks como adaptador

Ejecuta tras enviar la respuesta, en proceso, sin reintentos: solo efectos best-effort
(email de cortesía, métricas). Es un adaptador del puerto `EventBus`; nunca llega al caso de uso.

```python
class BackgroundTasksEventBus:
    def __init__(self, tasks: BackgroundTasks, listeners: Listeners) -> None:
        self._tasks, self._listeners = tasks, listeners
    def publish(self, events: Sequence[DomainEvent]) -> None:
        for e in events:
            for listener in self._listeners.for_event(type(e)):
                self._tasks.add_task(listener, e)

def get_issue_invoice(tasks: BackgroundTasks, uow=Depends(get_uow)) -> IssueInvoice:
    return IssueInvoice(uow, SystemClock(), BackgroundTasksEventBus(tasks, LISTENERS))
```

Si el efecto debe ocurrir sí o sí, usa outbox + worker (arq/Celery), no `BackgroundTasks`.

## Lecturas paginadas desde readers

Las pantallas leen de un `Reader` (Protocol en `application/queries.py`) que devuelve DTOs
planos con la página ya resuelta. El router solo traduce query params.

```python
@dataclass(frozen=True)
class Page(Generic[T]):
    items: list[T]; total: int; page: int; size: int

class PendingInvoicesReader(Protocol):
    def for_customer(self, customer_id: str, *, page: int, size: int) -> Page[InvoiceRow]: ...

@router.get("", response_model=PageResponse[InvoiceRowResponse])
def list_pending(customer_id: str, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                 reader: PendingInvoicesReader = Depends(get_pending_reader)):
    result = reader.for_customer(customer_id, page=page, size=size)
    return PageResponse(items=[InvoiceRowResponse.from_dto(r) for r in result.items],
                        total=result.total, page=result.page, size=result.size)
```

`PageResponse` es `BaseModel, Generic[T]`. Filtros y ordenación se tipan como un
`Filters` dataclass, no como `**kwargs` que acaban en SQL.

## Tests con dependency_overrides

Dos niveles: ruta con fakes (cableado y mapeo de errores, ms) y ruta con BD real en `tests/e2e/`
(`templates/python/tests/test_issue_invoice.py` cubre el caso de uso).

```python
@pytest.fixture
def client(fake_uow: FakeUnitOfWork) -> Iterator[TestClient]:
    app.dependency_overrides[get_uow] = lambda: fake_uow
    app.dependency_overrides[current_actor] = lambda: Actor(id="u1")
    with TestClient(app) as c:          # el `with` ejecuta lifespan
        yield c
    app.dependency_overrides.clear()

def test_issue_maps_conflict_to_409(client, fake_uow):
    fake_uow.invoices.save(an_invoice().draft().build())      # sin líneas
    r = client.post("/invoices/inv-1/issue")
    assert r.status_code == 409
    assert r.json()["error"] == "invoice_cannot_be_issued"
```

Sobrescribe la dependencia hoja (`get_uow`, `current_actor`), no `get_issue_invoice`: así
el caso de uso real sigue cableado y el test detecta errores de construcción.

## Errores frecuentes

- `Depends` o `Request` en `application/` o `domain/`: ata los casos de uso al framework.
- `Command(**body.model_dump())`: acopla nombres del contrato HTTP a los del command.
- `response_model=Invoice` con el agregado: expone estado interno del dominio.
- `try/except DomainError` en cada ruta con `HTTPException`: duplicación; usa handlers.
- Sesión SQLAlchemy global a nivel de módulo, compartida entre requests y tests.
- Caso de uso sync llamado desde `async def`: event loop bloqueado bajo carga.
- `BackgroundTasks` para efectos con garantía (cobros, integraciones).
- Reader que devuelve modelos ORM; tests que sobrescriben `get_issue_invoice` con un mock.

## Checklist

- [ ] Un `APIRouter` por contexto, incluido desde `main.py`; auth como dependencia del router.
- [ ] Cada ruta llama a un caso de uso o a un reader; sin lógica condicional de negocio.
- [ ] Schemas con `to_command()` / `from_dto()` explícitos y `extra="forbid"`.
- [ ] Handlers globales mapean `NotFoundError`/`ConflictError`/`ValidationError` a 404/409/422.
- [ ] Recursos de proceso en `lifespan` y `app.state`; `deps.py` los lee del request.
- [ ] Contexto sync o async completo; el dominio siempre síncrono.
- [ ] `BackgroundTasks` solo detrás de un puerto y solo para efectos best-effort.
- [ ] Lecturas paginadas con `Page[T]` desde readers; nada de ORM en respuestas.
- [ ] Tests de ruta con `dependency_overrides` sobre dependencias hoja y `TestClient` en `with`.
- [ ] `lint-imports` en verde: `fastapi` solo aparece bajo `infrastructure/`.
