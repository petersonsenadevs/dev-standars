# Estructuras de carpetas por stack

## Índice

- [Principios comunes](#principios-comunes)
- [Por capa vs por feature](#por-capa-vs-por-feature)
- [Laravel](#laravel)
- [TypeScript (Next/Node)](#typescript-nextnode)
- [Python (FastAPI)](#python-fastapi)
- [Naming](#naming)
- [Dónde van los tests](#dónde-van-los-tests)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../stacks/laravel/overview.md` §1-2, `../stacks/typescript/overview.md`,
`../stacks/python/overview.md`, `clean-vs-hexagonal-vs-vertical-slices.md`.

## Principios comunes

1. **Primer nivel = contexto de negocio** (`Invoicing`, `Sales`, `Identity`), no capa
   técnica. Abrir el repositorio debe contar qué hace el sistema (screaming architecture).
2. **Segundo nivel = capa** (`Domain`, `Application`, `Infrastructure`). Suficiente para que
   las herramientas de dependencias funcionen con una regex.
3. **Tercer nivel = tipo o caso de uso**, según capa: Domain por tipo (`Model`,
   `ValueObject`, `Event`), Application por caso de uso (`IssueInvoice/`), Infrastructure
   por tecnología (`Persistence/Eloquent`, `Http`).
4. **El framework vive fuera** de `src/<Context>/{Domain,Application}` y dentro de
   `Infrastructure` o del directorio propio del framework (`app/`, `app/` de Next, `api/`).
5. `Shared/` solo para lo transversal real (`AggregateRoot`, `DomainEvent`, `Clock`,
   `Money`); nunca una papelera de utilidades.

## Por capa vs por feature

| | Por capa (`Domain/`, `Application/`, `Infrastructure/` dentro del contexto) | Por feature (`IssueInvoice/` con todo dentro) |
|---|---|---|
| Ventaja | reglas de dependencia triviales de verificar; lo mismo en todos los stacks | todo lo de una intención junto; borrar una feature es borrar una carpeta |
| Desventaja | una feature toca 3-4 carpetas | verificar dependencias requiere convención de sufijos; agregados compartidos entre features |
| Recomendación | **por defecto** para el contexto | **dentro de Application** (carpeta por caso de uso) |

Combinación adoptada: contexto -> capa -> (en Application) caso de uso. Ver
`clean-vs-hexagonal-vs-vertical-slices.md` para el razonamiento.

## Laravel

Estructura completa en `../stacks/laravel/overview.md` §1. Resumen:

```
src/
  Invoicing/
    Domain/{Model,ValueObject,Event,Repository,Exception,Service}/
    Application/{IssueInvoice,RegisterPayment,Query,Port}/
    Infrastructure/{Persistence/Eloquent,Persistence/Query,Persistence/Migrations,Http,Console,Jobs,Bus,Providers}/
  Shared/{Domain,Application,Infrastructure}/
app/                  Http/Kernel, Providers globales, Exceptions, Models (solo CRUD sin reglas)
routes/               web.php / api.php -> require de src/*/Infrastructure/Http/routes.php
tests/                Unit/<Context>/{Domain,Application}, Integration/<Context>, Feature/<Context>, Fakes, Builders
```

```json
// composer.json
"autoload": { "psr-4": { "App\\": "app/", "Invoicing\\": "src/Invoicing/", "Shared\\": "src/Shared/" } },
"autoload-dev": { "psr-4": { "Tests\\": "tests/" } }
```

Alternativa `app/Modules/<Context>` con namespace `App\Modules\Invoicing`: válida si el
equipo prefiere no salir de `app/`; deptrac usa la misma regex cambiando el prefijo.
Migraciones del módulo en `Infrastructure/Persistence/Migrations` cargadas desde el
provider; o todas en `database/migrations` si el equipo lo prefiere (menos puro, más
estándar).

## TypeScript (Next/Node)

```
src/
  modules/
    invoicing/
      domain/           Invoice.ts, InvoiceLine.ts, Money.ts, InvoiceId.ts, events.ts, InvoiceRepository.ts, errors.ts
      application/      issueInvoice.ts, registerPayment.ts, ports/{Clock.ts,Mailer.ts,EventBus.ts}, queries/{listPendingInvoices.ts,types.ts}
      infrastructure/   persistence/{prismaInvoiceRepository.ts,invoiceMapper.ts,prismaPendingInvoicesReader.ts}, mail/, http/toHttpError.ts
      composition.ts    buildInvoicing()
      index.ts          exporta SOLO la API pública del módulo (casos de uso, DTOs, errores)
    sales/
    shared/
      domain/           Result.ts, AggregateRoot.ts, DomainEvent.ts
      infrastructure/   systemClock.ts, inProcessEventBus.ts
  container.ts          raíz de composición (web)
  worker.ts             raíz de composición (BullMQ)
app/                    Next App Router: route handlers, server actions, páginas -> importan de '@/modules/*'
components/, lib/       UI y utilidades de presentación
prisma/schema.prisma
tests/  (o co-localizados *.test.ts junto al archivo; ver más abajo)
```

```json
// tsconfig.json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*", "./*"], "@modules/*": ["src/modules/*"] },
  "strict": true, "exactOptionalPropertyTypes": true, "noUncheckedIndexedAccess": true } }
```

Backend Node puro (Fastify/Hono): igual, con `src/http/` como carpeta de adaptadores
driving en lugar de `app/`. Monorepo (Turborepo/pnpm): cada contexto puede ser un
`packages/<context>` con `exports` restringidos en `package.json`; los adaptadores viven
en `apps/web`, `apps/worker`.

`index.ts` como fachada del módulo permite que dependency-cruiser prohíba importar
`@modules/invoicing/domain/*` desde fuera del módulo.

## Python (FastAPI)

```
src/
  invoicing/
    __init__.py
    domain/           invoice.py, money.py, ids.py, events.py, repository.py (Protocol), errors.py
    application/      issue_invoice.py, register_payment.py, ports.py (Clock, Mailer, EventPublisher), queries/list_pending.py
    infrastructure/   persistence/{models.py,invoice_repository.py,pending_reader.py,unit_of_work.py}, mail/, gateways/
    composition.py    build_invoicing()
  sales/
  shared/
    domain/           aggregate.py, events.py, result.py
    infrastructure/   clock.py
  api/                FastAPI: main.py, deps.py, routers/invoices.py, schemas/invoices.py, errors.py
  worker/             arq/Celery: tasks -> casos de uso
  cli/                typer
tests/
  unit/invoicing/{domain,application}/
  integration/invoicing/
  api/
  fakes/              in_memory_invoice_repository.py, fixed_clock.py
alembic/              migraciones (o por módulo si se prefiere)
pyproject.toml
```

```toml
# pyproject.toml
[tool.setuptools.packages.find]  # o [tool.hatch...]
where = ["src"]
[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
[tool.mypy]
strict = true
```

`api/` fuera de los contextos deja claro que FastAPI es un adaptador; alternativa
`invoicing/infrastructure/http/router.py` si prefieres routers por módulo, registrados
en `api/main.py`.

## Naming

| Elemento | PHP | TS | Python |
|---|---|---|---|
| Agregado / entidad | `Invoice` | `Invoice` (clase) | `Invoice` |
| VO | `Money`, `InvoiceId` | `Money`, `InvoiceId` | `Money`, `InvoiceId` |
| Evento | `InvoiceIssued` | `InvoiceIssued` (type + factory) | `InvoiceIssued` (frozen dataclass) |
| Repositorio (puerto) | `InvoiceRepository` | `InvoiceRepository` | `InvoiceRepository` (Protocol) |
| Implementación | `EloquentInvoiceRepository` | `prismaInvoiceRepository` (factoría) | `SqlInvoiceRepository` |
| Command | `IssueInvoiceCommand` | `IssueInvoiceCommand` (type) | `IssueInvoiceCommand` |
| Handler | `IssueInvoiceHandler` | `issueInvoice` (factoría) | `IssueInvoice` (callable) |
| Lector | `PendingInvoicesReader` | `PendingInvoicesReader` | `PendingInvoicesReader` |
| Read model | `InvoiceRow`, `InvoiceDetail` | `InvoiceRow` | `InvoiceRow` |
| Excepción | `InvoiceCannotBeIssued` | `InvoiceError` (union) | `InvoiceCannotBeIssued` |

Prefijo tecnológico solo en implementaciones (`Eloquent*`, `prisma*`, `Sql*`, `Stripe*`).
Nunca `Interface`/`Impl`/`Abstract` como sufijo; el puerto tiene el nombre limpio.

## Dónde van los tests

| Stack | Ubicación | Motivo |
|---|---|---|
| Laravel | `tests/{Unit,Integration,Feature}/<Context>/...` espejo de `src/` | convención PHPUnit/Pest; `Unit` sin bootstrap |
| TS | co-localizados `Invoice.test.ts` para dominio/aplicación; `tests/integration` para BD; `tests/e2e` para Playwright | cercanía y borrado conjunto |
| Python | `tests/unit`, `tests/integration`, `tests/api` espejo de `src/` | convención pytest; fakes en `tests/fakes` |

Fakes y builders son código compartido de test: `tests/Fakes`, `tests/Builders`
(PHP), `src/modules/<ctx>/testing/` exportado desde `index.ts` (TS), `tests/fakes`
(Python). Ver `../testing/overview.md`.

## Errores frecuentes

- Primer nivel por capa (`src/Domain/Invoicing`, `src/Application/Invoicing`): dispersa el
  contexto y facilita cruces entre contextos.
- `Shared/` que crece hasta ser un segundo framework.
- Modelos Eloquent en `app/Models` usados por módulos de `src/`.
- `utils/`, `helpers/`, `common/` sin dueño.
- Un módulo por tabla (`Invoices`, `InvoiceLines`) en lugar de por contexto.
- `index.ts` que re-exporta todo, incluido el dominio interno.
- Migraciones o seeds con lógica de negocio.
- Tests unitarios que viven en `Feature/` y arrancan el framework.

## Checklist

- [ ] `src/<Contexto>/{Domain,Application,Infrastructure}` (o equivalente en minúsculas).
- [ ] Framework y adaptadores fuera de Domain/Application.
- [ ] Application agrupada por caso de uso; Infrastructure por tecnología.
- [ ] `Shared` mínimo y con dueño.
- [ ] Paths configurados (`composer.json`, `tsconfig paths`, `pyproject pythonpath`).
- [ ] Fachada pública por módulo (`index.ts` / provider / `__init__`).
- [ ] Tests espejo de la estructura, con fakes y builders compartidos.
- [ ] Regla de dependencias verificable por regex de carpeta.
