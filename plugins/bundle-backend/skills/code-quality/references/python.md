# Python 3.12+ (FastAPI / LangGraph): buenas prácticas

## Índice

- [Tipado estricto](#tipado-estricto)
- [Pydantic v2](#pydantic-v2)
- [dataclasses y value objects](#dataclasses-y-value-objects)
- [Estructura de paquetes (src layout)](#estructura-de-paquetes-src-layout)
- [Dependencias con uv y tooling con ruff](#dependencias-con-uv-y-tooling-con-ruff)
- [asyncio correcto](#asyncio-correcto)
- [Excepciones propias](#excepciones-propias)
- [Logging estructurado](#logging-estructurado)
- [Settings](#settings)
- [FastAPI](#fastapi)
- [LangGraph](#langgraph)
- [pytest](#pytest)
- [Antipatrones frecuentes](#antipatrones-frecuentes)

## Tipado estricto

- Anota todo: parámetros, retornos, atributos. `pyright` en modo `strict` (o `mypy --strict`) en CI; sin `# type: ignore` sin código de error y motivo.
- Sintaxis moderna: `list[str]`, `X | None`, `type Alias = ...` (3.12), genéricos PEP 695 (`def first[T](xs: Sequence[T]) -> T`).
- `Protocol` para interfaces estructurales (puertos): permite fakes en tests sin herencia.
- `TypedDict` solo para datos que realmente son dicts (JSON de terceros, estado de LangGraph); para el dominio, dataclasses/Pydantic.
- `Literal` y `Enum` (`StrEnum`) para conjuntos cerrados; `Final` para constantes; `@override` (3.12) en métodos sobrescritos.
- `Any` prohibido salvo en fronteras con librerías sin tipos; envuelve y tipa en tu adaptador.
- `assert_never()` de `typing` en `match` exhaustivos.

```python
type Result[T] = Ok[T] | Err

def handle(r: Result[User]) -> str:
    match r:
        case Ok(value=u): return u.name
        case Err(code=c): return f"error: {c}"
        case _: assert_never(r)
```

## Pydantic v2

- `BaseModel` para todo lo que cruza una frontera: request/response de API, mensajes de cola, config, salidas estructuradas de LLM.
- `model_config = ConfigDict(frozen=True, extra="forbid", strict=True)` en modelos de entrada; `from_attributes=True` para mapear desde ORM.
- Validadores: `@field_validator` para un campo, `@model_validator(mode="after")` para invariantes entre campos. Sin lógica de negocio en validadores.
- `Annotated[int, Field(gt=0)]` y tipos reutilizables (`PositiveInt`, `EmailStr`, `SecretStr` para secretos: no se imprime en logs).
- `model_validate` / `model_validate_json` / `model_dump(mode="json")`; nunca `dict(model)`.
- `TypeAdapter` para validar tipos sueltos (`list[Item]`) sin crear un modelo.
- Discriminated unions con `Field(discriminator="kind")` para polimorfismo en JSON.
- No uses modelos Pydantic como entidades de dominio mutables ni como ORM: son DTOs.

## dataclasses y value objects

- `@dataclass(frozen=True, slots=True, kw_only=True)` para entidades y value objects de dominio (sin validación de tipos en runtime, pero rápidos y explícitos).
- Invariantes en `__post_init__` lanzando excepciones de dominio.
- `NamedTuple` solo para tuplas de retorno pequeñas e inmutables.
- Evita clases con `__init__` a mano que solo asignan atributos: eso es un dataclass.

## Estructura de paquetes (src layout)

```
project/
  pyproject.toml
  src/app/
    __init__.py
    main.py            # create_app()
    api/               # routers, dependencias, schemas HTTP
    domain/            # entidades, value objects, excepciones, puertos (Protocol)
    services/          # casos de uso
    infra/             # adaptadores: db, http clients, llm, colas
    agents/            # grafos LangGraph, nodos, estado
    core/              # settings, logging, errors comunes
  tests/
    unit/  integration/  e2e/  conftest.py
```

- `src/` layout evita importar el paquete sin instalar (tests contra el código instalado, no el cwd).
- Regla de dependencias: `api → services → domain ← infra`. `domain` no importa de `infra` ni de FastAPI.
- Sin `from x import *`; imports absolutos; sin side effects al importar (no conexiones en nivel de módulo).
- `__all__` en módulos públicos; privados con `_prefijo`.

## Dependencias con uv y tooling con ruff

- `uv` para todo: `uv init`, `uv add fastapi`, `uv add --dev pytest`, `uv sync --frozen` en CI, `uv run pytest`. `uv.lock` commiteado.
- `requires-python = ">=3.12"` y grupos de dependencias (`[dependency-groups] dev = [...]`) en `pyproject.toml`.
- `uv lock --upgrade` de forma controlada; `pip-audit` (o `uv audit` cuando esté disponible) en CI.
- Ruff sustituye a black, isort, flake8, pyupgrade: `ruff format` + `ruff check --fix`.

```toml
[tool.ruff]
target-version = "py312"
line-length = 100
[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "B", "ASYNC", "S", "C4", "SIM", "RET", "PTH", "RUF", "T20"]
ignore = ["S101"]  # assert en tests
[tool.pyright]
typeCheckingMode = "strict"
```

- `pre-commit` con ruff y pyright; CI: `ruff check`, `ruff format --check`, `pyright`, `pytest`.

## asyncio correcto

- No mezcles: en un servidor async, cualquier I/O bloqueante (requests, psycopg2 síncrono, `time.sleep`, CPU pesado) bloquea el event loop. Usa clientes async (`httpx.AsyncClient`, `asyncpg`/SQLAlchemy async) o `await asyncio.to_thread(func)`.
- CPU-bound: `ProcessPoolExecutor` o un worker separado (Celery/arq/RQ), nunca en el loop.
- Concurrencia estructurada: `async with asyncio.TaskGroup() as tg:` (3.11+). Sin `create_task` sueltos sin guardar referencia ni manejar excepciones.
- Limita concurrencia con `asyncio.Semaphore` al llamar a APIs externas/LLM.
- Timeouts siempre: `async with asyncio.timeout(10):` o `httpx.Timeout`. Cancelación: no captures `CancelledError` sin relanzar.
- Reutiliza clientes (`httpx.AsyncClient` en lifespan de la app), no uno por request.
- Generadores async para streaming (SSE, tokens de LLM); cierra recursos con `async with`.

```python
async def fetch_all(urls: list[str], client: httpx.AsyncClient) -> list[Page]:
    sem = asyncio.Semaphore(10)
    async def one(u: str) -> Page:
        async with sem, asyncio.timeout(15):
            r = await client.get(u); r.raise_for_status()
            return Page.model_validate_json(r.text)
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(one(u)) for u in urls]
    return [t.result() for t in tasks]
```

## Excepciones propias

- Jerarquía: `class AppError(Exception)` → `DomainError`, `NotFoundError`, `ConflictError`, `ExternalServiceError`. Cada una con `code: str` y `context: dict` opcional.
- Lanza excepciones concretas con datos, no `raise Exception("...")`. Usa `raise ... from e` para conservar la causa.
- `except Exception` solo en fronteras (handler global, worker loop) y siempre con log + relanzar o respuesta de error. Nunca `except: pass`.
- `ExceptionGroup` / `except*` cuando uses `TaskGroup`.
- No uses excepciones para control de flujo esperado en bucles calientes; devuelve `None`/`Result` si es el caso normal.

## Logging estructurado

- `structlog` (o `logging` con formatter JSON) con salida JSON en producción y consola legible en dev.
- Contexto por request con `contextvars` (`structlog.contextvars.bind_contextvars(request_id=..., user_id=...)`) en middleware; los logs posteriores lo heredan.
- Niveles: `DEBUG` detalle técnico, `INFO` eventos de negocio, `WARNING` degradación recuperable, `ERROR` fallo de operación, `CRITICAL` servicio caído.
- Un evento por línea, con clave-valor, no f-strings: `log.info("order_created", order_id=o.id, total=o.total)`.
- `logger.exception()` dentro de `except` para incluir traceback. Nunca loguees secretos, tokens, PII cruda ni prompts completos con datos de usuario (trunca/redacta).
- Sin `print()` en código de aplicación (ruff `T20` lo detecta).

## Settings

- `pydantic-settings`: `class Settings(BaseSettings)` con `model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")`.
- Tipos concretos (`PostgresDsn`, `SecretStr`, `HttpUrl`, `Literal["dev","prod"]`); validación al arrancar, no en la primera request.
- Una única instancia con `@lru_cache` `get_settings()`, inyectada por `Depends` en FastAPI para poder sobreescribir en tests.
- Sin valores por defecto para secretos; sí para puertos, timeouts y flags.

## FastAPI

- `app = create_app()` factory con `lifespan` (async context manager) para abrir/cerrar pool de BD, clientes HTTP, modelos.
- Routers por recurso (`APIRouter(prefix="/orders", tags=["orders"])`); handlers delgados que llaman a servicios.
- Dependencias (`Depends`) para sesión de BD, usuario actual, settings, clientes. `Annotated[Session, Depends(get_db)]` como alias reutilizable. `yield` dependencies para cleanup.
- Schemas separados: `OrderCreate` (entrada), `OrderOut` (salida, `response_model`), nunca la entidad ORM directa. `response_model_exclude_none` con criterio.
- Handlers `async def` solo si todo dentro es async; si usan I/O bloqueante, `def` (FastAPI lo lleva a threadpool).
- Errores: `@app.exception_handler(AppError)` que mapea a `problem+json` con `status`, `code`, `detail`, `instance`; 422 de validación conservado; 500 sin detalles internos.
- `status_code=201` en creación, `204` sin cuerpo; `Response` de streaming (`StreamingResponse`, SSE) para LLM.
- Autorización dentro de dependencias (`require_role("admin")`), y comprobación de propiedad en el servicio.
- Rate limit y timeouts en el gateway o con middleware (`slowapi`); CORS explícito por origen.

```python
DbDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[User, Depends(get_current_user)]

@router.post("", status_code=201, response_model=OrderOut)
async def create_order(payload: OrderCreate, db: DbDep, user: UserDep) -> OrderOut:
    order = await OrderService(db).create(payload, owner=user)
    return OrderOut.model_validate(order)
```

## LangGraph

- Estado tipado: `TypedDict` (o Pydantic) con `Annotated[list[AnyMessage], add_messages]` para mensajes y reducers explícitos para listas; el resto se sobreescribe.
- Nodos como funciones puras: `(state) -> dict` con **solo** las claves que cambian. Sin efectos secundarios ocultos; el I/O va en tools o nodos claramente marcados.
- Edges condicionales con funciones que devuelven `Literal[...]` de nombres de nodo; `END` explícito. Evita grafos con ciclos sin límite: añade contador de iteraciones en el estado y corta.
- Tools con `@tool` y schema Pydantic de argumentos; valida y sanitiza lo que el LLM te pasa (es entrada no confiable). Sin tools que ejecuten shell/SQL libre.
- Checkpointers: `MemorySaver` solo en tests; `PostgresSaver`/`SqliteSaver` en producción con `thread_id` por conversación. `interrupt()` para human-in-the-loop.
- Configura el modelo por `RunnableConfig`/inyección, no hardcodeado en el nodo: facilita tests y cambio de proveedor.
- Streaming: `graph.astream(..., stream_mode="updates" | "messages")`; propaga cancelación.
- Observabilidad: LangSmith o callbacks propios; loguea `run_id`, tokens y latencia por nodo. Límites de tokens y timeouts en cada llamada.
- Salidas estructuradas con `with_structured_output(Schema)`; valida y reintenta una vez si el parseo falla; después, error controlado.

## pytest

- Estructura por tipo: `tests/unit` (rápidos, sin I/O), `tests/integration` (BD/HTTP reales en contenedor), `tests/e2e`.
- Fixtures en `conftest.py` por nivel; `scope="session"` para recursos caros (contenedor de Postgres con `testcontainers`), `function` para sesión/transacción con rollback.
- `@pytest.mark.parametrize` con `ids` legibles; `pytest.raises(NotFoundError, match="...")`.
- Async: `pytest-asyncio` con `asyncio_mode = "auto"`; `httpx.AsyncClient(transport=ASGITransport(app=app))` para FastAPI.
- Sobrescribe dependencias con `app.dependency_overrides[get_db] = ...`; limpia al final de la fixture.
- **LLM**: nunca llames al proveedor real en unit tests. Usa `FakeListChatModel`/`GenericFakeChatModel` de LangChain o un `Protocol` propio con fake que devuelve respuestas fijadas. Tests contra el modelo real solo en un job nocturno marcado `@pytest.mark.llm`.
- **I/O**: `respx` para `httpx`, `freezegun`/`time-machine` para tiempo, `monkeypatch.setenv` para settings. Sin `unittest.mock.patch` de rutas profundas si puedes inyectar un fake.
- Grafos LangGraph: prueba nodos como funciones puras (estado de entrada → parche esperado) y el grafo completo con modelo fake y `MemorySaver`.
- Cobertura con `pytest-cov`; `--cov-fail-under=80`; `-x -q` en local, `-n auto` (xdist) en CI.

## Antipatrones frecuentes

- Argumentos mutables por defecto (`def f(items=[])`). Usa `None` o `field(default_factory=list)`.
- Lógica en `__init__.py`; imports circulares resueltos con imports dentro de funciones (síntoma de mala capa).
- `requests` dentro de un handler `async def`.
- Devolver dicts sin forma desde servicios; `Optional` sin manejar el `None`.
- Globals mutables (`db = ...` a nivel de módulo) en lugar de lifespan + inyección.
- `os.environ["X"]` disperso por el código en vez de `Settings`.
- Prompts como f-strings con datos de usuario sin delimitar ni escapar.
