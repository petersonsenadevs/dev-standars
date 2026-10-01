# Tests de adaptadores: repositorios, contratos, HTTP y colas

## Índice

- [Qué prueba un test de adaptador](#qué-prueba-un-test-de-adaptador)
- [Base de datos real: SQLite vs contenedor](#base-de-datos-real-sqlite-vs-contenedor)
- [Repositorios en Pest (Laravel)](#repositorios-en-pest-laravel)
- [Repositorios en Vitest (Prisma/Drizzle)](#repositorios-en-vitest-prismadrizzle)
- [Repositorios en pytest (SQLAlchemy)](#repositorios-en-pytest-sqlalchemy)
- [Contract tests: la misma suite para fake y real](#contract-tests-la-misma-suite-para-fake-y-real)
- [HTTP thin tests](#http-thin-tests)
- [Tests de jobs y colas](#tests-de-jobs-y-colas)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

La pirámide y el reparto por capas están en [overview.md](overview.md) §1 y §4. Aquí se
detalla cómo montar la infraestructura de test, qué asertar y cómo evitar que el fake mienta.

## Qué prueba un test de adaptador

Un adaptador traduce entre un puerto y una tecnología. El test verifica la traducción, no la
regla de negocio (esa ya está cubierta en dominio):

| Adaptador | Qué asertar | Qué NO asertar |
|---|---|---|
| Repositorio | round-trip `save -> ofId` igual al original; consultas con intención (`overdueAt`); concurrencia (`version`) | que `issue()` falle sin líneas |
| Read model | filas con la forma del DTO, filtros, orden, paginación | reglas del agregado |
| HTTP driving | ruta, auth, 422 de forma, código y shape en feliz, un error de dominio mapeado | todas las ramas del caso de uso |
| Job / listener | deserializa, construye el command y llama al caso de uso; idempotencia | orquestación interna |
| Gateway (ACL) | request enviado y respuesta mapeada a tipos del dominio, errores traducidos (servidor fake: WireMock, MSW, respx) | el SaaS real (test `@external` fuera de CI) |

## Base de datos real: SQLite vs contenedor

SQLite en memoria sirve si el SQL es portable (sin `FOR UPDATE`, sin `jsonb`, sin CTEs
dialectales). En cuanto un repositorio usa bloqueos, tipos nativos o funciones del motor,
el test en SQLite es un falso positivo: usa el mismo motor que producción.

| Caso | Motor de test | Coste |
|---|---|---|
| Repositorios CRUD, mapeo VO | SQLite `:memory:` | ms, sin infraestructura |
| Secuencias con `lockForUpdate`, `SKIP LOCKED`, `jsonb` | Postgres/MySQL en contenedor (Testcontainers o servicio CI) | 1-3 s de arranque por suite |
| Read models con SQL crudo | motor real | igual |

Regla: un contenedor por suite, no por test; limpia con transacción revertida o `TRUNCATE`
entre tests. Nunca `migrate:fresh` por test.

## Repositorios en Pest (Laravel)

```php
// tests/Integration/Invoicing/EloquentInvoiceRepositoryTest.php
uses(Tests\TestCase::class, RefreshDatabase::class);   // RefreshDatabase = transacción por test

beforeEach(fn () => $this->repo = app(InvoiceRepository::class));  // resuelto por el provider real

it('round-trips an issued invoice with its lines and money', function () {
    $invoice = anInvoice()->withLine(Money::eur(250), 2)->withLine(Money::eur(100))->issued()->build();
    $this->repo->save($invoice);

    $loaded = $this->repo->ofId($invoice->id);
    expect($loaded)->not->toBeNull()
        ->and($loaded->status())->toBe(InvoiceStatus::Issued)
        ->and($loaded->total())->toEqual(Money::eur(600))
        ->and($loaded->lines())->toHaveCount(2)
        ->and($loaded->pullEvents())->toBe([]);          // reconstituir no emite eventos
});
```

Añade "segundo `save` tras `addLine` deja exactamente N filas en `invoice_lines`" (detecta
duplicación de hijos). Versión optimista: carga dos copias, guarda la primera y aserta que la segunda lanza
`ConcurrencyConflict`; márcalo `->group('mysql')`. `phpunit.xml`: SQLite `:memory:` por
defecto; en CI un segundo paso `php artisan test --group=mysql` con `DB_CONNECTION=mysql`
apuntando al servicio del workflow para bloqueos y versión.

## Repositorios en Vitest (Prisma/Drizzle)

```ts
// tests/setup-db.ts — un contenedor por worker (pool: 'forks')
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
let container: StartedPostgreSqlContainer;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'inherit' });   // drizzle-kit migrate con Drizzle
}, 60_000);
afterAll(() => container.stop());

// src/modules/invoicing/infrastructure/PrismaInvoiceRepository.test.ts
const prisma = new PrismaClient();
const repo = new PrismaInvoiceRepository(prisma);
beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE invoices, invoice_lines CASCADE'));

it('round-trips and maps Money into two columns', async () => {
  const invoice = anInvoice().withLine(Money.of(250, 'EUR'), 2).build();
  await repo.save(invoice);
  expect((await repo.ofId(invoice.id))?.total()).toEqual(Money.of(500, 'EUR'));
  const raw = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  expect(raw).toMatchObject({ totalCents: 500, currency: 'EUR' });   // el esquema es parte del contrato
});
```

Añade un test de rollback: `tx.run(async () => { await repo.save(...); throw ... })` y
`count() === 0`. Si el CI ya expone Postgres como servicio, salta Testcontainers leyendo
`DATABASE_URL` (`describe.runIf(process.env.DATABASE_URL)`).

## Repositorios en pytest (SQLAlchemy)

```python
# tests/integration/conftest.py
@pytest.fixture(scope="session")
def engine():
    if os.environ.get("TEST_DB") == "sqlite":
        e = create_engine("sqlite+pysqlite:///:memory:", future=True); Base.metadata.create_all(e); yield e; return
    from testcontainers.postgres import PostgresContainer
    with PostgresContainer("postgres:16-alpine") as pg:
        e = create_engine(pg.get_connection_url(), future=True)
        Base.metadata.create_all(e)          # o `alembic upgrade head` para probar migraciones
        yield e

@pytest.fixture
def session(engine):
    conn = engine.connect(); outer = conn.begin()
    s = Session(bind=conn, join_transaction_mode="create_savepoint")   # commit() del repo -> savepoint
    yield s
    s.close(); outer.rollback(); conn.close()

# tests/integration/test_sqlalchemy_invoice_repository.py
@pytest.mark.integration
def test_round_trip(session):
    repo = SqlAlchemyInvoiceRepository(session)
    inv = an_invoice().with_line(Money(250, "EUR"), 2).build()
    repo.save(inv); session.expunge_all()          # fuerza relectura, no identity map
    loaded = repo.of_id(inv.id)
    assert loaded == inv and loaded.pull_events() == []
```

`session.expunge_all()` es el detalle que más falsos positivos evita: sin él, `of_id`
devuelve el mismo objeto del identity map y el mapeo nunca se ejecuta. Los tests de
`FOR UPDATE` (secuencia sin huecos con dos sesiones en threads) llevan
`skipif(TEST_DB == "sqlite")`.

## Contract tests: la misma suite para fake y real

El fake en memoria es código de producción de segunda: si diverge del real, los tests de
aplicación aprueban comportamientos que la BD rechaza. Se escribe el contrato una vez y se
parametriza con una factoría de implementación.

```php
// tests/Contracts/InvoiceRepositoryContract.php
function invoiceRepositoryContract(Closure $makeRepo): void
{
    it('returns null for unknown id', fn () => expect($makeRepo()->ofId(InvoiceId::of(Str::uuid7())))->toBeNull());
    it('round-trips', function () use ($makeRepo) {
        $repo = $makeRepo(); $inv = anInvoice()->withLine(Money::eur(10))->build();
        $repo->save($inv);
        expect($repo->ofId($inv->id))->toEqual($inv);
    });
    it('lists overdue invoices only', function () use ($makeRepo) { /* ... */ });
}
// tests/Unit/Support/InMemoryInvoiceRepositoryTest.php
invoiceRepositoryContract(fn () => new InMemoryInvoiceRepository());
// tests/Integration/Invoicing/EloquentInvoiceRepositoryContractTest.php
uses(Tests\TestCase::class, RefreshDatabase::class);
invoiceRepositoryContract(fn () => app(InvoiceRepository::class));
```

```ts
// tests/contracts/invoiceRepository.contract.ts — importado desde un test unit y otro integration
export function invoiceRepositoryContract(name: string, make: () => Promise<InvoiceRepository>) {
  describe(`InvoiceRepository contract: ${name}`, () => {
    it('round-trips', async () => { const r = await make(); const i = anInvoice().build(); await r.save(i); expect(await r.ofId(i.id)).toEqual(i); });
    it('returns null when missing', async () => expect(await (await make()).ofId(InvoiceId.of(crypto.randomUUID()))).toBeNull());
  });
}
```

En pytest, una fixture `repo` con `params=["memory", pytest.param("sqlalchemy",
marks=pytest.mark.integration)]` y los tests del contrato la reciben (ver overview §4).

Comparar agregados con `toEqual`/`==` exige igualdad estructural: en PHP `toEqual` compara
propiedades; en Python el `@dataclass` lo da; en TS `toEqual` ignora métodos. Si el
agregado guarda `_events`, vacíalos antes (`pullEvents()`) o excluye el campo.

## HTTP thin tests

Cuatro tests por endpoint bastan: auth (401/403), forma (422), feliz (código + shape), un
error de dominio mapeado (409). Usan la BD de test y el cableado real; solo se sustituyen
gateways externos.

```php
it('maps InvoiceCannotBeIssued to 409 with a stable error code', function () {
    $id = seedDraftInvoiceWithoutLines();                  // helper de infraestructura, no builder de dominio
    $this->actingAs(adminUser())->postJson("/api/invoices/{$id}/issue")
        ->assertStatus(409)->assertJsonPath('error', 'invoice_cannot_be_issued');
});
```

```python
def test_issue_returns_409_when_no_lines(client: TestClient, seed_draft_invoice):
    r = client.post(f"/invoices/{seed_draft_invoice}/issue", headers=auth())
    assert r.status_code == 409 and r.json()["error"] == "invoice_cannot_be_issued"
```

En Next, importa el route handler y llámalo como función con un `Request`. Con Inertia,
`assertInertia(fn (Assert $p) => $p->component('Invoices/Show')->has('invoice.number'))` y
para errores de dominio `assertSessionHasErrors('invoice')`.

## Tests de jobs y colas

Dos tests por job: el driving (quién lo encola y con qué payload) y el driven (qué hace al
ejecutarse). Nunca se ejecuta la cola real en tests.

```php
it('queues SendInvoiceEmail after commit when InvoiceIssued is published', function () {
    Queue::fake();
    ($this->handler)(new IssueInvoiceCommand($id, 'u1'));          // handler real con BD de test
    Queue::assertPushed(SendInvoiceEmail::class, fn ($job) => $job->invoiceId === $id);
});

it('is idempotent when redelivered', function () {
    $mailer = new RecordingMailer(); app()->instance(Mailer::class, $mailer);
    (new SendInvoiceEmail($id))->handle(app(SendInvoiceEmailHandler::class));
    (new SendInvoiceEmail($id))->handle(app(SendInvoiceEmailHandler::class));
    expect($mailer->sent)->toHaveCount(1);                          // clave de idempotencia en tabla
});
```

BullMQ: prueba el processor como función (`issueInvoiceProcessor(deps)({ data } as Job)`)
con `vi.fn()` en el caso de uso; nunca levantes Redis. arq/Celery: la task es un adaptador;
se invoca con `ctx`/deps fake y se aserta el command construido. Garantías "tras commit": ver
[../stacks/laravel/jobs-events-listeners.md](../stacks/laravel/jobs-events-listeners.md).

## Errores frecuentes

- Probar reglas de negocio a través del repositorio o del endpoint: duplicación lenta y frágil.
- SQLite para código con `lockForUpdate`/`jsonb`: pasa en test, falla en producción.
- Olvidar `expunge_all()`/`fresh()`: el identity map devuelve el mismo objeto y el mapeo no se prueba.
- Fake sin contract test: los tests de aplicación validan una BD imaginaria.
- Mockear el ORM (`Mockery::mock(InvoiceModel::class)`, `vi.mock('@prisma/client')`): no se prueba nada.
- Ejecutar la cola `sync` en tests HTTP y asertar efectos de listeners: oculta el "tras commit". Un contenedor por test: minutos en vez de segundos.

## Checklist

- [ ] Cada repositorio tiene round-trip completo (VO embebidos, colecciones hijas, `null`s, sin eventos tras reconstituir).
- [ ] Segundo `save` no duplica hijos; versión optimista probada si existe.
- [ ] El motor de test coincide con producción para cualquier test que use bloqueos o tipos nativos.
- [ ] Contract test compartido ejecutado contra fake y real, en suites distintas.
- [ ] Read models probados con datos que ejerzan filtros, orden y paginación.
- [ ] Endpoints: auth, 422, feliz, un error de dominio; nada más.
- [ ] Jobs: encolado verificado con `Queue::fake`/spy; processor probado como función; idempotencia cubierta.
- [ ] Gateways contra servidor fake (SaaS real fuera de CI); limpieza por transacción o `TRUNCATE`; un contenedor por suite; integración < 60 s.
