# TypeScript (Next.js / Node): módulos hexagonales

## Índice

- [Estructura de carpetas](#estructura-de-carpetas)
- [Dominio sin framework](#dominio-sin-framework)
- [Puertos como interfaces](#puertos-como-interfaces)
- [Result type para errores esperados](#result-type-para-errores-esperados)
- [Casos de uso: funciones con dependencias explícitas](#casos-de-uso-funciones-con-dependencias-explícitas)
- [DI ligera: container.ts](#di-ligera-containerts)
- [Prisma / Drizzle como adaptador driven](#prisma--drizzle-como-adaptador-driven)
- [Adaptadores driving: Server Actions, route handlers, jobs](#adaptadores-driving-server-actions-route-handlers-jobs)
- [Eventos de dominio y outbox](#eventos-de-dominio-y-outbox)
- [Read models](#read-models)
- [Reglas de dependencia](#reglas-de-dependencia)
- [Vitest por capas](#vitest-por-capas)
- [Decisiones pragmáticas](#decisiones-pragmáticas)
- [Checklist](#checklist)

Este documento es el mapa del stack TypeScript: estructura, convenciones y decisiones del
equipo. El detalle de cada tema está en los documentos de esta carpeta y en los
transversales enlazados.

## Estructura de carpetas

```
src/
  modules/
    invoicing/
      domain/           Invoice.ts, Money.ts, InvoiceId.ts, events.ts, InvoiceRepository.ts (puerto), errors.ts
      application/      issueInvoice.ts, ports.ts (Clock, EventBus), queries/listPendingInvoices.ts
      infrastructure/   PrismaInvoiceRepository.ts, PrismaPendingInvoicesReader.ts, InProcessEventBus.ts, container.ts
      index.ts          API pública del módulo: casos de uso, DTOs, tipos de error
    shared/
      domain/           Result.ts, DomainEvent.ts, AggregateRoot.ts, Uuid.ts
  app/                  Next.js App Router: page.tsx, actions/*.ts, api/*/route.ts (adaptadores driving)
  lib/                  prisma.ts (cliente), auth.ts
```

Node sin Next: `src/http/` (Fastify/Hono routes) y `src/cli/` como adaptadores driving.
`index.ts` de cada módulo es lo único que importan otros módulos o `app/`.

Detalle: `../../hexagonal/folder-structures.md`.

## Dominio sin framework

- Sin imports de `next`, `@prisma/client`, `zod`, `react`. Solo TS y `shared/domain`.
- Entidades como clases con constructor privado y factories estáticas (`Invoice.draft()`,
  `Invoice.reconstitute()`), estado privado, métodos de negocio que devuelven `Result`.
- VO como clases pequeñas o branded types cuando solo hay que validar formato:

```ts
export type InvoiceId = string & { readonly __brand: 'InvoiceId' };
export const InvoiceId = {
  of: (v: string): InvoiceId => { if (!/^[0-9a-f-]{36}$/.test(v)) throw new Error('bad id'); return v as InvoiceId; },
};
```

`Money` sí es clase (tiene operaciones).

Detalle: `type-driven-domain.md` (uniones discriminadas, transiciones tipadas,
exhaustividad, configuración del compilador).

## Puertos como interfaces

```ts
// domain/InvoiceRepository.ts (driven, persistencia del agregado)
export interface InvoiceRepository { nextId(): InvoiceId; ofId(id: InvoiceId): Promise<Invoice | null>; save(invoice: Invoice): Promise<void> }
// application/ports.ts (driven, no persistentes)
export interface Clock { now(): Date }
export interface EventBus { publish(events: DomainEvent[]): Promise<void> }
```

Puerto driving = la firma del caso de uso exportada desde `index.ts`. No hace falta
interfaz: `export type IssueInvoice = ReturnType<typeof issueInvoice>`.

Detalle: `../../hexagonal/ports-and-adapters.md`.

## Result type para errores esperados

Excepciones para bugs e infraestructura; `Result` para errores de negocio que el
llamador debe manejar (y que se serializan a la UI).

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export type InvoiceError =
  | { kind: 'NotFound'; invoiceId: string }
  | { kind: 'NoLines'; invoiceId: string }
  | { kind: 'AlreadyIssued'; invoiceId: string };
```

El tipo de retorno documenta los fallos, el compilador obliga a tratarlos y un Server
Action puede devolver el error al cliente tal cual.

Detalle: `type-driven-domain.md`; `../../tactical/invariants-and-errors.md`.

## Casos de uso: funciones con dependencias explícitas

Función que recibe `deps` y devuelve la función ejecutable. Sin decoradores.

```ts
export type IssueInvoiceDeps = { invoices: InvoiceRepository; clock: Clock; events: EventBus; tx: TransactionRunner };

export const issueInvoice = (deps: IssueInvoiceDeps) =>
  async (cmd: { invoiceId: string; actorId: string }): Promise<Result<{ number: string }, InvoiceError>> => {
    const invoice = await deps.invoices.ofId(InvoiceId.of(cmd.invoiceId));
    if (!invoice) return err({ kind: 'NotFound', invoiceId: cmd.invoiceId });

    const issued = invoice.issue(deps.clock.now());
    if (!issued.ok) return issued;

    await deps.tx.run(() => deps.invoices.save(invoice));
    await deps.events.publish(invoice.pullEvents());
    return ok({ number: invoice.number! });
  };
```

`TransactionRunner` es un puerto mínimo `{ run<T>(fn: () => Promise<T>): Promise<T> }`.
Si solo hay un `save`, omite `tx`.

Detalle: `../../application/use-cases.md`, `../../application/transactions-unit-of-work.md`.

## DI ligera: container.ts

Un archivo por módulo que cablea implementaciones reales. Sin librería.

```ts
const invoices = new PrismaInvoiceRepository(prisma);
const clock: Clock = { now: () => new Date() };
const events = new InProcessEventBus();
const tx = new PrismaTransactionRunner(prisma);

export const invoicing = {
  issueInvoice: issueInvoice({ invoices, clock, events, tx }),
  listPendingInvoices: listPendingInvoices({ reader: new PrismaPendingInvoicesReader(prisma) }),
};
```

Tests de aplicación construyen sus propios deps con fakes; nunca importan `container.ts`.
tsyringe/inversify solo con decenas de servicios y ciclos de vida distintos.

Detalle: `../../hexagonal/dependency-injection.md`; `node-services.md` (un proceso, un container).

## Prisma / Drizzle como adaptador driven

```ts
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: PrismaClient) {}
  private client() { return currentTx() ?? this.db; }   // AsyncLocalStorage

  async ofId(id: InvoiceId) {
    const row = await this.client().invoice.findUnique({ where: { id }, include: { lines: true } });
    return row ? toDomain(row) : null;
  }
  async save(invoice: Invoice) { /* upsert de raíz + reemplazo de líneas */ }
}
```

Tipos generados por Prisma no salen del adaptador. `toDomain` llama a
`Invoice.reconstitute(...)` sin emitir eventos. Drizzle: idéntico con `insert ... onConflictDoUpdate`.

Detalle: `../../persistence/prisma-drizzle.md` (transacciones interactivas,
AsyncLocalStorage, versión optimista, migraciones, tests).

## Adaptadores driving: Server Actions, route handlers, jobs

```ts
'use server';
const Input = z.object({ invoiceId: z.string().uuid() });

export async function issueInvoiceAction(raw: unknown) {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: { kind: 'Validation' as const, issues: parsed.error.flatten() } };
  const session = await auth();
  if (!session) return { ok: false as const, error: { kind: 'Unauthorized' as const } };

  const result = await invoicing.issueInvoice({ ...parsed.data, actorId: session.user.id });
  if (result.ok) revalidatePath('/invoices');
  return result;   // Result serializable: la UI hace switch sobre error.kind
}
```

Todo lo que devuelve un Server Action debe ser JSON-serializable: por eso los errores son
uniones, no clases. Route handlers mapean `error.kind` a status. Jobs (BullMQ, cron,
Inngest): el handler del job es el adaptador.

Detalle: `next-adapters.md` (useActionState, Route Handlers, Server Components, auth,
revalidación) y `node-services.md` (Fastify, workers BullMQ, cron, shutdown).

## Eventos de dominio y outbox

`InProcessEventBus` (mapa de handlers por nombre, `publish` secuencial) es suficiente
cuando los listeners son rápidos e idempotentes. Si un listener hace IO externo o
necesitas garantía, outbox: `OutboxEventBus.publish` inserta en tabla `outbox` dentro de
la misma transacción y un worker entrega. En serverless (Vercel) el outbox + cron es la
única opción fiable.

Detalle: `../../integration/outbox-pattern.md`, `../../tactical/domain-events.md`.

## Read models

`application/queries/listPendingInvoices.ts` define el DTO plano `InvoiceRow`, el puerto
`PendingInvoicesReader` y la query como función con `deps`. Implementación con
`prisma.invoice.findMany({ select: ... })` o SQL crudo. Un Server Component llama
directamente a `invoicing.listPendingInvoices(...)`; los datos ya son serializables.

Detalle: `../../application/read-models-projections.md`.

## Reglas de dependencia

dependency-cruiser con cuatro reglas: `domain` no importa framework ni `app/`/`lib/`;
`domain` no importa `application` ni `infrastructure`; `application` no importa
`infrastructure` ni `@prisma`; otros módulos solo a través de `index.ts`.
`npx depcruise src --config .dependency-cruiser.cjs` en CI. Alternativa:
`eslint-plugin-boundaries`. Elige una; las dos es redundante.

Detalle: `../../hexagonal/dependency-rules-tooling.md`; archivo completo en
`templates/typescript/.dependency-cruiser.cjs`.

## Vitest por capas

`vitest.workspace.ts` con dos proyectos: `unit` (include `**/{domain,application}/**`,
environment node) e `integration` (include `**/infrastructure/**`, `setupFiles` que
levanta la BD, `pool: 'forks'`). Fakes en `src/modules/<ctx>/testing/` (exportados para otros módulos) o `tests/fakes/`.

Detalle: `../../testing/overview.md`.

## Decisiones pragmáticas

- Páginas CRUD: Server Component + Prisma directo + Server Action con zod. Sin módulo.
- zod en dominio: no. zod valida forma en el adaptador; el dominio valida reglas.
  Compartir el schema de forma entre cliente y servidor sí.
- Clases vs objetos planos: clases para agregados (encapsulan), objetos planos + funciones
  para VO simples. Coherencia dentro de un módulo.
- `"use server"` en `application/`: nunca; es un artefacto de Next. Solo en `app/`.
- Monorepo: `packages/invoicing` con la misma estructura interna; `apps/web` es adaptador.
- Hono/Fastify: el handler de ruta es el adaptador; `container.ts` se instancia en el arranque.

## Checklist

- [ ] Cada módulo expone su API por `index.ts`; nadie importa sus internos.
- [ ] `domain/` sin imports de next, prisma, zod ni react.
- [ ] Errores de negocio como uniones serializables dentro de `Result`.
- [ ] Casos de uso como funciones con `deps` explícitas; tests con fakes, sin `container.ts`.
- [ ] Tipos generados por el ORM no salen del adaptador; reconstitución sin eventos.
- [ ] Server Actions y route handlers validan forma con zod y devuelven datos serializables.
- [ ] Outbox cuando un listener hace IO externo o el runtime es serverless.
- [ ] dependency-cruiser en CI; workspace `unit` sin base de datos.
