# SQLAlchemy 2 como adaptador de persistencia

## Índice

- [Alcance](#alcance)
- [Declarativo con mapeo explícito](#declarativo-con-mapeo-explícito)
- [Imperative mapping sobre el dominio](#imperative-mapping-sobre-el-dominio)
- [Sesión por caso de uso y Unit of Work](#sesión-por-caso-de-uso-y-unit-of-work)
- [Identity map, flush y expire](#identity-map-flush-y-expire)
- [Concurrencia](#concurrencia)
- [Variante async](#variante-async)
- [Alembic](#alembic)
- [Tests contra base de datos real](#tests-contra-base-de-datos-real)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

## Alcance

Profundiza en los §5-6 de [`../stacks/python/overview.md`](../stacks/python/overview.md). Repositorio,
secuencia con `with_for_update` y UoW completos en `templates/python/infrastructure/sqlalchemy_invoice_repository.py`;
aquí lo que la plantilla decide sin explicar: estilo de mapeo, comportamiento de la sesión, async y
migraciones. Estrategias generales en [`orm-mapping.md`](orm-mapping.md).

## Declarativo con mapeo explícito

Modelos `DeclarativeBase` en `infrastructure/orm.py`, dominio en dataclasses, `_to_domain` en el
repositorio. Opción por defecto: dominio sin instrumentar (`frozen=True`, `__slots__` posibles) y esquema
que puede divergir del modelo (desnormalizados, auditoría) sin tocar `domain/`.

```python
# infrastructure/orm.py
class InvoiceModel(Base):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    currency: Mapped[str] = mapped_column(String(3))
    total_cents: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer, default=0)
    lines: Mapped[list["InvoiceLineModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="InvoiceLineModel.position"
    )
    __mapper_args__ = {"version_id_col": version}
```

Decisiones:

- `lazy="selectin"` en las colecciones del agregado: cargar la raíz implica cargar hijos, siempre. Un
  agregado a medio hidratar es un bug; `lazy="select"` (por defecto) lo produce en cuanto la sesión se
  cierra (`DetachedInstanceError`).
- `order_by` en la relación si el orden de las líneas es parte del estado del agregado; persiste
  `position`.
- `cascade="all, delete-orphan"`: reasignar `row.lines = [...]` borra las que sobran. Reemplazo completo
  vale para decenas de líneas; para diff por id, recorre `row.lines` y actualiza en sitio.
- Un `Mapped[...]` por columna, sin `Column()` legacy: mypy y pyright validan los tipos.

## Imperative mapping sobre el dominio

`registry.map_imperatively(Invoice, invoices_table)` persiste la dataclass del dominio sin clase ORM.
Menos código, pero SQLAlchemy instrumenta la entidad: añade `_sa_instance_state`, exige `__init__`
compatible y rompe con `frozen=True` y `slots=True`.

```python
# infrastructure/orm.py
mapper_registry = registry()
invoices = Table("invoices", mapper_registry.metadata,
    Column("id", String(36), primary_key=True), Column("status", String(16)), Column("currency", String(3)),
    Column("amount_cents", Integer), Column("version", Integer, nullable=False, default=0))

def start_mappers() -> None:
    mapper_registry.map_imperatively(Invoice, invoices, properties={
        "_status": invoices.c.status,                       # atributo privado del dominio -> columna
        "_lines": relationship(InvoiceLine, cascade="all, delete-orphan", lazy="selectin"),
        "total": composite(Money, invoices.c.amount_cents, invoices.c.currency),   # VO embebido
    }, version_id_col=invoices.c.version)
```

Cuándo usarlo: dominio con dataclasses mutables, VO mapeables con `composite`, sin `__slots__`, y equipo
cómodo con el ciclo de vida de la sesión. Cuándo no: VO `frozen`, colecciones con lógica de orden,
esquema legacy que no coincide con el modelo, o si el dominio se comparte con código sin SQLAlchemy.
`composite` requiere que el VO exponga `__composite_values__` o sea dataclass con campos en el mismo
orden. `start_mappers()` se llama una vez en el arranque y en `conftest.py`; el dominio nunca lo importa.

## Sesión por caso de uso y Unit of Work

La regla: **una sesión = una transacción = un caso de uso**. Nada de `scoped_session` global ni sesión
por request compartida entre casos de uso.

```python
# infrastructure/sqlalchemy_uow.py
class SqlAlchemyUnitOfWork:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._sf = session_factory

    def __enter__(self) -> Self:
        self.session = self._sf()
        self.invoices = SqlAlchemyInvoiceRepository(self.session)
        self.sequences = SqlAlchemyInvoiceNumberSequence(self.session)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.session.rollback()     # no-op tras commit
        self.session.close()

    def commit(self) -> None:
        self.session.commit()

SessionLocal = sessionmaker(engine, expire_on_commit=False, autoflush=False)
```

- `expire_on_commit=False`: tras `commit()` los objetos siguen legibles; el caso de uso publica eventos
  con datos de la entidad ya confirmada sin disparar `SELECT` implícitos.
- `autoflush=False`: los `SELECT` del repositorio no vacían cambios pendientes a mitad de camino; el
  repositorio hace `flush()` explícito en `save` para que fallen las restricciones ahí y no en `commit`.
- Los eventos se recogen dentro del `with` (`invoice.pull_events()`) pero se publican fuera, ver
  `templates/python/application/issue_invoice.py`.
- El caso de uso no ve `Session`: solo `uow.invoices`, `uow.commit()`.

## Identity map, flush y expire

Comportamientos de la sesión que afectan al repositorio:

| Comportamiento | Efecto | Qué hacer |
|---|---|---|
| Identity map | `session.get()` dos veces devuelve el mismo objeto ORM | Con mapeo explícito da igual: cada `of_id` crea una entidad nueva; no mezcles dos entidades del mismo id en un caso de uso |
| `flush()` | Envía SQL sin confirmar; dispara errores de integridad | Llamarlo en `save()` para que `IntegrityError` salga cerca del origen |
| Expire | Tras `commit()` con `expire_on_commit=True` cada acceso relanza SQL | Desactivar; leer lo que haga falta antes de cerrar |
| `merge()` | Copia estado a la instancia persistente; hace `SELECT` extra | Evitar en `save`; usar `get` + asignar o `add` |
| Lazy load fuera de sesión | `DetachedInstanceError` | `selectin`/`joined` para todo lo que el agregado necesite |

El repositorio traduce `IntegrityError` a errores de dominio solo cuando la restricción representa una
regla (`UniqueViolation` en `number` -> `DuplicateInvoiceNumber`). El resto se propaga.

## Concurrencia

- **Optimista**: `version_id_col` en `__mapper_args__`. SQLAlchemy añade `WHERE version = :old` a cada
  `UPDATE` y lanza `StaleDataError` si `rowcount == 0`. El repositorio lo convierte en
  `ConcurrencyConflict`; la aplicación decide reintentar o devolver 409.
- **Pesimista**: `select(...).with_for_update()` dentro de la transacción del UoW para secuencias,
  saldos y cualquier lectura-modificación-escritura. `with_for_update(skip_locked=True)` para colas de
  trabajo (proyectores, outbox).
- Aislamiento: `READ COMMITTED` + bloqueos explícitos por defecto; `REPEATABLE READ` solo si el caso
  de uso decide sobre un conjunto de filas.

## Variante async

Si la API es async (FastAPI + asyncpg), todo el adaptador es async y los `Protocol` de los puertos
declaran `async def`. El dominio sigue síncrono.

```python
engine = create_async_engine(url, pool_size=10)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

class AsyncSqlAlchemyUnitOfWork:
    async def __aenter__(self) -> Self:
        self.session = AsyncSessionLocal()
        self.invoices = AsyncSqlAlchemyInvoiceRepository(self.session)
        return self
    async def __aexit__(self, *exc) -> None:
        await self.session.rollback(); await self.session.close()
    async def commit(self) -> None: await self.session.commit()

class AsyncSqlAlchemyInvoiceRepository:
    async def of_id(self, id: InvoiceId) -> Invoice | None:
        row = await self._s.get(InvoiceModel, id, options=[selectinload(InvoiceModel.lines)])
        return _to_domain(row) if row else None
```

Con async **no hay lazy loading implícito** (`MissingGreenlet`): obliga a declarar `selectinload` para
todo lo que el agregado necesita. No compartas una `AsyncSession` entre tareas concurrentes.

## Alembic

- `alembic init -t async migrations` si el engine es async. `target_metadata = Base.metadata` (o
  `mapper_registry.metadata`) importando `infrastructure/orm.py` de cada contexto.
- `alembic revision --autogenerate` genera un borrador; revísalo siempre: no detecta renombrados
  (produce drop+add), ni cambios en `CHECK`, ni índices parciales. Edita el archivo a mano.
- Una revisión por cambio de esquema, con `downgrade` real. Los backfills de datos van en revisiones
  separadas que usan `op.execute()` con SQL, no importan el dominio ni los modelos ORM (cambian; la
  migración debe seguir funcionando dentro de un año).
- Varios contextos en un mismo esquema: un solo árbol de revisiones con prefijo de tabla
  (`invoicing_invoices`) o `version_table` distinta por contexto si van a bases de datos separadas.
- Estrategia expand/contract y compatibilidad en [`migrations-and-domain.md`](migrations-and-domain.md).
- En CI: `alembic upgrade head` sobre Postgres vacío, después `alembic check` (2.x) para verificar que
  no quedan cambios sin migrar.

## Tests contra base de datos real

```python
# tests/integration/conftest.py
@pytest.fixture(scope="session")
def engine():
    with PostgresContainer("postgres:16-alpine") as pg:
        engine = create_engine(pg.get_connection_url())
        command.upgrade(Config("alembic.ini"), "head")     # el esquema real, no metadata.create_all
        yield engine

@pytest.fixture
def session(engine):
    conn = engine.connect(); tx = conn.begin()
    s = Session(bind=conn, join_transaction_mode="create_savepoint")
    yield s
    s.close(); tx.rollback(); conn.close()               # cada test parte de tablas vacías

# tests/integration/test_sqlalchemy_invoice_repository.py
def test_round_trip(session):
    repo = SqlAlchemyInvoiceRepository(session)
    invoice = an_invoice().issued().with_lines(2).build()
    repo.save(invoice)
    session.expunge_all()                                  # fuerza relectura, no identity map
    assert repo.of_id(invoice.id) == invoice

def test_stale_version_raises(session):
    repo = SqlAlchemyInvoiceRepository(session)
    repo.save(an_invoice().build()); session.commit()
    session.execute(text("UPDATE invoices SET version = version + 1"))
    with pytest.raises(ConcurrencyConflict):
        loaded = repo.of_id(InvoiceId("inv-1")); loaded.add_line(a_line()); repo.save(loaded)
```

`join_transaction_mode="create_savepoint"` permite que el repositorio haga `commit()`/`rollback()`
internos sin romper la transacción externa que el fixture deshace. La misma suite de contrato se ejecuta
contra `InMemoryInvoiceRepository` ([`../testing/overview.md`](../testing/overview.md) §4). SQLite en
memoria solo si no usas `with_for_update`, tipos JSONB ni `TIMESTAMPTZ` reales.

## Errores frecuentes

- `scoped_session` o `Depends(get_db)` compartido por varios casos de uso en una request: dos
  transacciones lógicas en una física; un fallo del segundo deshace el primero.
- `metadata.create_all()` en tests: el esquema de test diverge del de producción. Usa Alembic.
- Imperative mapping con `@dataclass(frozen=True)`: SQLAlchemy no puede asignar atributos; error
  críptico en `load`.
- `relationship(lazy="select")` en colecciones del agregado y acceso tras cerrar sesión.
- `session.merge(entity)` como "upsert" universal: hace `SELECT` extra, ignora `delete-orphan` en
  algunos casos y devuelve una instancia distinta.
- `DateTime` sin `timezone=True`: el dominio recibe `datetime` naive y `datetime.now(UTC)` no compara.
- Migraciones que importan `domain/` u `orm.py` actuales: se rompen cuando el modelo cambia.
- `except Exception` alrededor de `commit()`: oculta `StaleDataError` e `IntegrityError`, que tienen
  semántica de negocio.

## Checklist

- [ ] Estilo elegido y documentado: declarativo + mapeo explícito (por defecto) o imperative mapping.
- [ ] Colecciones del agregado con `lazy="selectin"` y `cascade="all, delete-orphan"`.
- [ ] `sessionmaker(expire_on_commit=False, autoflush=False)`; `flush()` explícito en `save`.
- [ ] Un UoW por caso de uso; `commit()` dentro del `with`, eventos publicados fuera.
- [ ] `version_id_col` o `with_for_update` donde haya escritura concurrente; `StaleDataError` traducido.
- [ ] Puertos async si el adaptador es async; sin lazy loads implícitos.
- [ ] Alembic con revisiones revisadas a mano, `downgrade` real y backfills en SQL.
- [ ] Tests de integración con Postgres en contenedor, esquema por `alembic upgrade head`, rollback por test.
- [ ] `import-linter` prohíbe `sqlalchemy` y `alembic` fuera de `infrastructure`.
