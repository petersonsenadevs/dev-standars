# Inyección de dependencias y composición

## Índice

- [Principios: composición en el borde](#principios-composición-en-el-borde)
- [Laravel: contenedor, bindings y contextual binding](#laravel-contenedor-bindings-y-contextual-binding)
- [TypeScript: contenedor manual y factorías](#typescript-contenedor-manual-y-factorías)
- [TypeScript: cuándo tsyringe/inversify](#typescript-cuándo-tsyringeinversify)
- [Python: wiring explícito y Depends solo en el adaptador](#python-wiring-explícito-y-depends-solo-en-el-adaptador)
- [Evitar el service locator](#evitar-el-service-locator)
- [Ciclo de vida y scopes](#ciclo-de-vida-y-scopes)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `ports-and-adapters.md`, `../stacks/laravel/overview.md` §2,
`../stacks/typescript/overview.md`, `../stacks/python/overview.md`.

## Principios: composición en el borde

1. Las clases de Domain y Application reciben sus dependencias por **constructor** (o
   parámetros de factoría). No las buscan, no las crean.
2. Existe un **composition root** por proceso (web, worker, CLI): un lugar donde se decide
   qué implementación concreta corresponde a cada puerto. Es infraestructura.
3. Los tests construyen el grafo a mano con fakes; no necesitan el contenedor.
4. El contenedor (si existe) es un detalle del adaptador. Nada dentro del hexágono lo
   importa.

Con estas reglas, el "framework de DI" es opcional. Laravel lo trae y conviene usarlo;
en TS y Python la composición manual suele ser suficiente y más legible.

## Laravel: contenedor, bindings y contextual binding

Cada módulo tiene su `ServiceProvider` (ver `../stacks/laravel/overview.md` §2). Patrones:

```php
final class InvoicingServiceProvider extends ServiceProvider
{
    // 1. Puerto -> adaptador (autoresolución del resto por constructor)
    public array $bindings = [
        InvoiceRepository::class     => EloquentInvoiceRepository::class,
        PaymentGateway::class        => StripePaymentGateway::class,
        Clock::class                 => SystemClock::class,
    ];

    public function register(): void
    {
        // 2. Singleton para adaptadores con estado/conexión cara
        $this->app->singleton(StripeClient::class, fn () => new StripeClient(config('services.stripe.secret')));

        // 3. Contextual binding: dos implementaciones del mismo puerto
        $this->app->when(ExportInvoicesHandler::class)->needs(DocumentStore::class)->give(S3DocumentStore::class);
        $this->app->when(PreviewInvoiceHandler::class)->needs(DocumentStore::class)->give(LocalDocumentStore::class);

        // 4. Decoradores (transacción, caché) sin bus
        $this->app->extend(InvoiceDetailReader::class, fn ($inner, $app) => new CachedInvoiceDetailReader($inner, $app->make(Cache::class)));

        // 5. Sustitución por entorno
        if ($this->app->environment('testing') && config('invoicing.fake_gateway')) {
            $this->app->bind(PaymentGateway::class, FakePaymentGateway::class);
        }
    }
}
```

Reglas:
- Handlers y controladores no se registran: el contenedor los autoresuelve por type-hint.
- Nada de `app()`, `resolve()`, `App::make()` fuera de providers y de código de arranque.
  Facades solo en `Infrastructure/`; `DB::transaction` en Application es la excepción
  documentada.
- `$bindings` (array) es más rápido y legible que `bind()` uno a uno.
- Para probar un handler en Unit: `new IssueInvoiceHandler(new InMemoryInvoiceRepository(), ...)`.
  Para Feature: `$this->app->instance(PaymentGateway::class, new FakePaymentGateway())`.

## TypeScript: contenedor manual y factorías

Sin decoradores ni reflexión: un archivo de composición por módulo que devuelve un objeto
con los casos de uso ya cableados.

```ts
// src/modules/invoicing/composition.ts
export type InvoicingModule = ReturnType<typeof buildInvoicing>;

export function buildInvoicing(infra: { db: PrismaClient; mail: Resend; clock?: Clock; eventBus?: EventBus }) {
  const clock = infra.clock ?? systemClock;
  const events = infra.eventBus ?? inProcessEventBus();
  const tx = prismaTransactionRunner(infra.db);
  const invoices = prismaInvoiceRepository(infra.db);
  const mailer = resendMailer(infra.mail);

  return {
    issueInvoice: issueInvoice({ invoices, clock, events, tx }),
    registerPayment: registerPayment({ invoices, clock, events, tx, authz: dbAuthorizer(infra.db) }),
    listPendingInvoices: prismaPendingInvoicesReader(infra.db),
  };
}

// src/container.ts — raíz única del proceso
export const container = buildInvoicing({ db: prisma, mail: new Resend(env.RESEND_KEY) });
```

Next.js: `container.ts` se importa desde route handlers y server actions; como los módulos
ES se evalúan una vez por proceso, actúa como singleton. Usa `globalThis` para preservar
la instancia de Prisma en dev con HMR (patrón habitual de Prisma).

Workers (BullMQ): mismo `buildInvoicing`, distinta raíz (`worker.ts`), quizá con otro
`eventBus`.

Tests: `buildInvoicing({ db: testDb, mail: fakeResend, clock: fixedClock })` o, para
unitarios, llamar a la factoría del caso de uso con fakes sin pasar por `buildInvoicing`.

Ventajas: tipado total (si falta una dependencia, no compila), cero magia, grafo visible.
Desventaja: al crecer a 60 casos de uso el archivo es largo; divídelo por módulo y
agrupa dependencias en objetos (`persistence`, `messaging`).

## TypeScript: cuándo tsyringe/inversify

Usa un contenedor cuando: tienes muchos módulos con dependencias cruzadas, necesitas
scopes por request (multi-tenant con conexión por tenant) o el equipo viene de NestJS y
el contenedor es la convención. Si usas NestJS, su DI es el contenedor: providers para
puertos (`{ provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository }`) y módulos
por contexto.

Condiciones para que no rompa el hexágono:
- Los decoradores (`@injectable`, `@inject`) solo en Infrastructure y en el módulo de
  composición. Domain y Application quedan libres de decoradores; si el contenedor exige
  decorar los handlers, envuélvelos con factorías en composición.
- `reflect-metadata` y `emitDecoratorMetadata` obligan a clases; las funciones factoría
  no encajan. Decide un estilo por proyecto.
- Nunca `container.resolve()` fuera de la raíz o de los adaptadores driving.

## Python: wiring explícito y Depends solo en el adaptador

`Depends` de FastAPI es un mecanismo de **adaptador**: resuelve sesión, actor, casos de
uso para un endpoint. No lo uses dentro de Application.

```python
# src/invoicing/composition.py — sin framework
@dataclass(frozen=True)
class InvoicingModule:
    issue_invoice: IssueInvoice
    register_payment: RegisterPayment
    list_pending: PendingInvoicesReader

def build_invoicing(session_factory: sessionmaker, clock: Clock | None = None, gateway: PaymentGateway | None = None) -> InvoicingModule:
    clock = clock or SystemClock()
    uow = SqlAlchemyUnitOfWork(session_factory)
    return InvoicingModule(
        issue_invoice=IssueInvoice(uow=uow, clock=clock),
        register_payment=RegisterPayment(uow=uow, clock=clock, gateway=gateway or StripeGateway(settings.stripe_key)),
        list_pending=SqlPendingInvoicesReader(session_factory),
    )

# src/api/deps.py — adaptador FastAPI
_module = build_invoicing(SessionLocal)
def issue_invoice() -> IssueInvoice: return _module.issue_invoice

@router.post("/invoices/{id}/issue", status_code=202)
def issue(id: str, actor: Actor = Depends(current_actor), uc: IssueInvoice = Depends(issue_invoice)) -> None:
    uc(IssueInvoiceCommand(invoice_id=id, actor_id=actor.id))
```

Sesión por request: el UoW crea su sesión por caso de uso; no inyectes `Session` en
handlers. Para CLI y workers, el mismo `build_invoicing`. Librerías (`dependency-injector`,
`lagom`, `punq`) solo si el grafo se vuelve inmanejable; empieza sin ellas.

## Evitar el service locator

Service locator = pedir dependencias a un registro global desde dentro de la clase
(`app(Mailer::class)`, `container.get(...)`, `import { prisma } from '@/lib/db'` dentro de
un handler). Problemas: dependencias ocultas (no están en la firma), tests que necesitan
el contenedor configurado, acoplamiento al framework en Application.

Señales: `app()`/`resolve()` en un handler; importar singletons de infraestructura desde
Application; `Depends` en clases de aplicación; `static` que devuelve la instancia real.

Remedio mecánico: mover la dependencia al constructor/factoría y dejar que la raíz de
composición la provea. Regla de deptrac/dependency-cruiser que prohíbe importar el
contenedor desde Domain/Application (`dependency-rules-tooling.md`).

## Ciclo de vida y scopes

| Objeto | Vida | Motivo |
|---|---|---|
| Clientes de SDK, pools, `PrismaClient` | singleton por proceso | conexión cara |
| Repositorios, lectores | singleton o transient; sin estado | dependen del pool, no del request |
| Handlers | transient (Laravel) o singleton (TS composición) | sin estado; da igual |
| Sesión ORM / transacción | por caso de uso | la abre el UoW/TransactionRunner |
| `Actor`, `tenantId`, `correlationId` | por request, viajan en el command | no los guardes en el contenedor |

Cuidado con Octane/Swoole, workers de larga vida y Node: los singletons sobreviven entre
peticiones; nada de estado por request en singletons (el clásico `$this->currentUser`).

## Errores frecuentes

- `app(...)`/`resolve(...)` dentro de handlers o entidades.
- Importar `prisma`/`db` global desde un caso de uso en lugar de recibir el repositorio.
- Decoradores de tsyringe/Nest en Domain.
- `Depends` en clases de Application o `Request` pasado al caso de uso.
- Estado por request guardado en un singleton (Octane, workers).
- Contextual binding para "todo": si necesitas 10, revisa los puertos.
- Bindings dispersos en `AppServiceProvider` global en vez de en el provider del módulo.
- Tests de casos de uso que arrancan el framework solo para resolver dependencias.

## Checklist

- [ ] Domain y Application reciben dependencias por constructor/factoría; sin contenedor.
- [ ] Una raíz de composición por proceso (web, worker, CLI), en Infrastructure.
- [ ] Laravel: bindings en el provider del módulo; contextual/extend para variantes y decoradores.
- [ ] TS: `build<Module>()` tipado; contenedor solo si hay razón concreta.
- [ ] Python: `build_<module>()` y `Depends` solo en routers.
- [ ] Ningún import del contenedor/facades dentro del hexágono (regla verificada).
- [ ] Singletons sin estado por request; sesión ORM por caso de uso.
