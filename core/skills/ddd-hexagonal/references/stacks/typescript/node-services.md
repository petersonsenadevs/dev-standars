# Servicios Node (Fastify, NestJS-lite, BullMQ) como adaptadores driving

## Índice

- [Un proceso, un container](#un-proceso-un-container)
- [Fastify: plugins y rutas delgadas](#fastify-plugins-y-rutas-delgadas)
- [Dependencias por request y correlation id](#dependencias-por-request-y-correlation-id)
- [NestJS-lite: módulos como cableado, no como dominio](#nestjs-lite-módulos-como-cableado-no-como-dominio)
- [Workers BullMQ: jobs como adaptadores driving](#workers-bullmq-jobs-como-adaptadores-driving)
- [Colas como adaptadores driven y outbox](#colas-como-adaptadores-driven-y-outbox)
- [Cron, health y graceful shutdown](#cron-health-y-graceful-shutdown)
- [Logging en adaptadores](#logging-en-adaptadores)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

`overview.md` cubre estructura, `Result`, casos de uso como funciones y `container.ts`
(`templates/typescript/infrastructure/container.ts`). Aquí: cómo montar el proceso
Node alrededor de esos módulos cuando no hay Next. Tests de estos adaptadores en
`../../testing/adapter-tests.md`.

## Un proceso, un container

El container se construye una vez en `main.ts` y se pasa a los adaptadores; los
adaptadores no lo importan como singleton global, lo reciben. Así un test de rutas
puede montar la app con un container de fakes.

```ts
// src/infrastructure/container.ts
export type AppContainer = { invoicing: InvoicingModule; billing: BillingModule; close(): Promise<void> };

export function buildContainer(env: Env): AppContainer {
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  const events = new InProcessEventBus();
  const invoicing = buildInvoicing({ prisma, events, clock: systemClock });
  const billing = buildBilling({ prisma, events, clock: systemClock });
  registerCrossModuleListeners({ events, invoicing, billing });   // único sitio que conoce a ambos
  return { invoicing, billing, close: () => prisma.$disconnect() };
}

// src/main.ts
const env = Env.parse(process.env);           // zod: forma del entorno, en el borde
const container = buildContainer(env);
const app = await buildHttpApp(container);
await app.listen({ port: env.PORT, host: '0.0.0.0' });
```

`buildInvoicing(deps)` vive en `modules/invoicing/infrastructure/` y devuelve el objeto
`{ issueInvoice, listPendingInvoices, ... }` del overview; `main.ts` es la única
composition root.

## Fastify: plugins y rutas delgadas

Un plugin por módulo, registrado con prefijo. Cada ruta: schema de forma (JSON Schema o
`fastify-type-provider-zod`), auth, caso de uso, mapeo de `Result`.

```ts
// src/http/invoicing.routes.ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

export const invoicingRoutes: FastifyPluginAsyncZod<{ invoicing: InvoicingModule }> = async (app, { invoicing }) => {
  app.post('/invoices/:id/issue', {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: z.object({ number: z.string() }) } },
    preHandler: app.authenticate,
  }, async (req, reply) => {
    const result = await invoicing.issueInvoice({ invoiceId: req.params.id, actorId: req.user.id });
    return sendResult(reply, result);
  });

  app.get('/invoices', { schema: { querystring: z.object({ customerId: z.string() }) } }, async (req) =>
    invoicing.listPendingInvoices({ customerId: req.query.customerId }));
};

// src/http/sendResult.ts — un solo mapeo kind -> status para toda la app
const status: Record<string, number> = { NotFound: 404, AlreadyIssued: 409, NoLines: 422 };
export function sendResult<T>(reply: FastifyReply, r: Result<T, { kind: string }>, ok = 200) {
  return r.ok ? reply.code(ok).send(r.value) : reply.code(status[r.error.kind] ?? 500).send({ error: r.error });
}

// src/http/app.ts
export async function buildHttpApp(c: AppContainer) {
  const app = fastify({ logger: true, genReqId: () => randomUUID() }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler); app.setSerializerCompiler(serializerCompiler);
  await app.register(authPlugin);
  await app.register(invoicingRoutes, { prefix: '/api', invoicing: c.invoicing });
  app.setErrorHandler((err, req, reply) => { req.log.error({ err }); reply.code(err.statusCode ?? 500).send({ error: { kind: 'Internal' } }); });
  return app;
}
```

`setErrorHandler` solo ve excepciones (bugs, BD caída, validación de Fastify): los errores
de negocio ya salieron como `Result`. Hono: mismo patrón con `app.route('/api', ...)`.

## Dependencias por request y correlation id

La mayoría de módulos no necesita nada por request: el caso de uso recibe `actorId` y
`tenantId` en el command. Lo que sí es por request es transversal (request id, usuario,
locale) y se propaga con `AsyncLocalStorage` desde un hook, sin tocar firmas:

```ts
// src/infrastructure/requestContext.ts
export const requestContext = new AsyncLocalStorage<{ requestId: string; actorId?: string }>();
app.addHook('onRequest', (req, _reply, done) => requestContext.run({ requestId: req.id }, done));

// Adaptador driven que lo consume (nunca el dominio):
class HttpPaymentsGateway implements PaymentsGateway {
  async charge(cmd: ChargeCommand) {
    const ctx = requestContext.getStore();
    return this.http.post('/charges', cmd, { headers: { 'x-request-id': ctx?.requestId ?? randomUUID() } });
  }
}
```

Si un módulo necesita instancias por request (tenant con BD propia), crea el módulo con
`buildInvoicing(deps)` en un hook `onRequest`; sigue sin haber contenedor DI.

## NestJS-lite: módulos como cableado, no como dominio

Si el equipo quiere NestJS, úsalo como lo que es: un contenedor DI + capa HTTP. Los
`@Module` son composition roots; los `@Injectable` son adaptadores o factories.

```ts
// src/invoicing/invoicing.module.ts
@Module({
  providers: [
    { provide: PRISMA, useFactory: () => new PrismaClient() },
    { provide: INVOICE_REPOSITORY, useFactory: (p: PrismaClient) => new PrismaInvoiceRepository(p), inject: [PRISMA] },
    { provide: ISSUE_INVOICE, useFactory: (r: InvoiceRepository, e: EventBus) => issueInvoice({ invoices: r, events: e, clock: systemClock, tx }), inject: [INVOICE_REPOSITORY, EVENT_BUS] },
  ],
  controllers: [InvoicesController],
})
export class InvoicingModule {}

@Controller('invoices')
export class InvoicesController {
  constructor(@Inject(ISSUE_INVOICE) private readonly issue: IssueInvoice) {}
  @Post(':id/issue') @UseGuards(AuthGuard)
  async issueOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const r = await this.issue({ invoiceId: id, actorId: user.id });
    if (!r.ok) throw toHttpException(r.error);   // única conversión Result -> excepción, en el borde
    return r.value;
  }
}
```

Reglas: `application/` y `domain/` no tienen decoradores de Nest (`@Injectable` en un caso
de uso lo acopla al contenedor); los tokens (`ISSUE_INVOICE`) viven en `infrastructure/`;
no uses `@nestjs/cqrs` como bus de dominio si con funciones basta. Un `ExceptionFilter`
global mapea `DomainHttpException` a JSON con `{ error: { kind } }`, igual que `sendResult`.

## Workers BullMQ: jobs como adaptadores driving

Un job es una petición asíncrona: el `Worker` parsea el payload, construye el command y
llama al caso de uso. Sin lógica. El nombre del job y el payload son un contrato
versionado (`invoicing.issue.v1`).

```ts
// src/workers/invoicing.worker.ts
const JobPayload = z.object({ invoiceId: z.string().uuid(), actorId: z.string() });

export function startInvoicingWorker(c: AppContainer, connection: ConnectionOptions) {
  return new Worker('invoicing', async (job) => {
    switch (job.name) {
      case 'issue.v1': {
        const cmd = JobPayload.parse(job.data);
        const r = await c.invoicing.issueInvoice(cmd);
        if (!r.ok && r.error.kind !== 'AlreadyIssued') throw new UnrecoverableError(r.error.kind); // no reintentar errores de negocio
        return;   // AlreadyIssued: reintento tras éxito parcial -> idempotente por diseño
      }
      default: throw new UnrecoverableError(`unknown job ${job.name}`);
    }
  }, { connection, concurrency: 5, lockDuration: 60_000 });
}
```

Reintentos (`attempts`, `backoff`): infraestructura (excepción) -> reintentar; negocio
(`Result` fallido) -> `UnrecoverableError`. La idempotencia real está en el caso de uso
(transición que no se repite) o en un `jobId` determinista al encolar.

## Colas como adaptadores driven y outbox

Encolar desde un caso de uso es IO: va detrás de un puerto (`application/ports.ts`).

```ts
export interface IssueScheduler { scheduleIssue(invoiceId: InvoiceId, at: Date): Promise<void> }

class BullIssueScheduler implements IssueScheduler {
  constructor(private readonly queue: Queue) {}
  scheduleIssue(id: InvoiceId, at: Date) {
    return this.queue.add('issue.v1', { invoiceId: id, actorId: 'system' }, { jobId: `issue:${id}`, delay: at.getTime() - Date.now() }).then(() => {});
  }
}
```

Para reaccionar a eventos de dominio con garantía, el `OutboxEventBus` del overview §9
inserta en `outbox`; un worker `outbox.relay` (BullMQ repeatable o `setInterval`) lee
pendientes, publica en la cola del consumidor y marca `published_at`. Un listener en
memoria que encola sin outbox pierde eventos si el proceso muere entre commit y `add`.

## Cron, health y graceful shutdown

- **Cron**: BullMQ `repeat` o `node-cron`; el callback es un adaptador driving que llama
  a un caso de uso (`markOverdueInvoices({ today: clock.now() })`). Nunca lógica en el cron.
- **Health**: `/health/live` responde siempre; `/health/ready` comprueba BD y Redis con
  timeout corto. No llames a casos de uso desde health.
- **Shutdown**: cierra en orden inverso al arranque: deja de aceptar HTTP, espera jobs en
  vuelo, cierra colas, desconecta BD.

```ts
// src/main.ts
const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();                  // Fastify deja de aceptar y espera respuestas en curso
  await Promise.all(workers.map((w) => w.close()));   // BullMQ espera los jobs activos
  await container.close();
  process.exit(0);
};
for (const s of ['SIGTERM', 'SIGINT'] as const) process.once(s, () => void shutdown(s));
```

## Logging en adaptadores

El dominio no loguea; la aplicación tampoco (las trazas de negocio son eventos de
dominio). Loguean los adaptadores: Fastify por request (`req.log`), el worker por job, los
gateways por llamada externa, con `requestId` desde `requestContext`. Los eventos
publicados se registran una vez en el bus, no en cada listener.

## Errores frecuentes

- **Container global importado desde rutas** (`import { container } from ...`): imposible
  montar la app con fakes. Pásalo por opciones del plugin o por `buildHttpApp(c)`.
- **`@Injectable()` en casos de uso o entidades**: acopla `application/` a Nest. Factories.
- **Reintentar errores de negocio en BullMQ**: `NoLines` no se arregla con backoff.
- **Encolar directamente desde `application/`** con `queue.add`: es un puerto.
- **Listener en memoria que hace IO sin outbox**: pérdida silenciosa de eventos.
- **`process.exit` sin cerrar workers**: jobs se quedan bloqueados hasta `lockDuration`.
- **Logs en el dominio** para "ver qué pasa": usa tests de dominio y eventos.
- **Health que toca casos de uso**: se convierte en carga y en falso rojo.
- **Un plugin de Fastify por endpoint o un `@Module` por caso de uso**: cablea por módulo.

## Checklist

- [ ] Una composition root (`main.ts` + `buildContainer`); ningún adaptador importa un singleton.
- [ ] Rutas: schema de forma, auth, caso de uso, `sendResult`. Sin `if` de negocio.
- [ ] `setErrorHandler`/`ExceptionFilter` solo para excepciones; negocio viaja como `Result`.
- [ ] Workers: payload validado, `UnrecoverableError` para fallos de negocio, `jobId` determinista.
- [ ] Encolar y programar detrás de puertos; eventos con garantía vía outbox + relay.
- [ ] Shutdown ordenado: HTTP -> workers -> colas -> BD.
- [ ] Logging solo en adaptadores, con `requestId` desde `AsyncLocalStorage`.
- [ ] `application/` y `domain/` sin decoradores ni imports de `fastify`, `bullmq`, `@nestjs/*` (dependency-cruiser en CI).
