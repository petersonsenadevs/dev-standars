# Prisma y Drizzle como adaptadores de persistencia

## Índice

- [Alcance](#alcance)
- [Repositorio con Prisma](#repositorio-con-prisma)
- [Repositorio con Drizzle](#repositorio-con-drizzle)
- [Transacciones interactivas y AsyncLocalStorage](#transacciones-interactivas-y-asynclocalstorage)
- [Mapeo sin fuga de tipos generados](#mapeo-sin-fuga-de-tipos-generados)
- [Concurrencia: bloqueo y versión optimista](#concurrencia-bloqueo-y-versión-optimista)
- [Migraciones](#migraciones)
- [Tests con base de datos real](#tests-con-base-de-datos-real)
- [Prisma o Drizzle](#prisma-o-drizzle)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

## Alcance

Profundiza en el §7 de [`../stacks/typescript/overview.md`](../stacks/typescript/overview.md): implementar
`InvoiceRepository` con Prisma o Drizzle sin que esquema, cliente ni tipos generados salgan de
`infrastructure/`. Estrategias generales de mapeo en [`orm-mapping.md`](orm-mapping.md). Plantilla:
`templates/typescript/infrastructure/PrismaInvoiceRepository.ts`.

## Repositorio con Prisma

Cliente inyectado, `client()` que resuelve la transacción activa, mapeo privado al módulo.

```ts
// infrastructure/PrismaInvoiceRepository.ts
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}
  private client(): PrismaClient | Prisma.TransactionClient { return txStorage.getStore() ?? this.prisma; }

  async ofId(id: InvoiceId): Promise<Invoice | null> {
    const row = await this.client().invoice.findUnique({ where: { id }, include: { lines: true } });
    return row ? toDomain(row) : null;
  }

  async save(invoice: Invoice): Promise<void> {
    const data = toRow(invoice);
    const lines = invoice.getLines().map(lineToRow);
    await this.client().invoice.upsert({
      where: { id: data.id },
      create: { ...data, lines: { create: lines } },
      update: { ...data, lines: { deleteMany: {}, create: lines } },
    });
  }
}
```

Puntos que la plantilla no cubre:

- **Reemplazo de líneas vs diff**: `deleteMany + create` rompe si otra tabla referencia
  `invoice_lines.id`. Entonces, diff por id (`deleteMany({ id: { notIn: ids } })` + `upsert` por línea)
  encapsulado en `syncLines(tx, invoiceId, lines)`; el resto del repositorio no cambia.
- **`select` explícito** si la tabla tiene columnas que el agregado no usa (`search_vector`); tipo de
  fila inferido con `Prisma.InvoiceGetPayload<typeof invoiceSelect>`, nunca en firmas públicas.
- **Nombres**: importa el tipo generado con alias (`Invoice as InvoiceRow`) para que la colisión con la
  entidad sea visible.

## Repositorio con Drizzle

Drizzle no genera cliente: el esquema son objetos TS y las consultas SQL tipado. Cambia solo el upsert.

```ts
// infrastructure/schema.ts (solo lo importa infrastructure/)
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey(), customerId: uuid('customer_id').notNull(),
  status: text('status').$type<'draft' | 'issued' | 'void'>().notNull(), number: text('number').unique(),
  issuedAt: timestamp('issued_at', { withTimezone: true }), currency: char('currency', { length: 3 }).notNull(),
  totalCents: integer('total_cents').notNull(), version: integer('version').notNull().default(0),
});
export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').primaryKey(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  description: text('description').notNull(), unitPriceCents: integer('unit_price_cents').notNull(), quantity: integer('quantity').notNull(),
});
export const invoicesRelations = relations(invoices, ({ many }) => ({ lines: many(invoiceLines) }));

// infrastructure/DrizzleInvoiceRepository.ts
export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: Db) {}
  private client(): Db | Tx { return txStorage.getStore() ?? this.db; }

  async ofId(id: InvoiceId): Promise<Invoice | null> {
    const row = await this.client().query.invoices.findFirst({ where: eq(invoices.id, id), with: { lines: true } });
    return row ? toDomain(row) : null;
  }

  async save(invoice: Invoice): Promise<void> {
    const c = this.client();
    const row = toRow(invoice);
    await c.insert(invoices).values(row).onConflictDoUpdate({ target: invoices.id, set: row });
    await c.delete(invoiceLines).where(eq(invoiceLines.invoiceId, row.id));
    const lines = invoice.getLines().map((l) => lineToRow(l, row.id));
    if (lines.length) await c.insert(invoiceLines).values(lines);
  }
}
```

`db.query.*` requiere registrar `relations` en `drizzle(pool, { schema })`. Para read models usa el query
builder (`db.select().from()`), ver [`read-models-and-projections.md`](read-models-and-projections.md).

## Transacciones interactivas y AsyncLocalStorage

El caso de uso no conoce Prisma: llama a `tx.run(fn)` (puerto `TransactionRunner`). El runner abre una
transacción interactiva y guarda el cliente transaccional en `AsyncLocalStorage`; los repositorios lo
recuperan con `client()`. Ventaja: firmas de puerto limpias (`save(invoice)`, no `save(invoice, tx)`).

```ts
// infrastructure/PrismaTransactionRunner.ts
const txStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}
  run<T>(fn: () => Promise<T>): Promise<T> {
    if (txStorage.getStore()) return fn();                               // anidado: reutiliza
    return this.prisma.$transaction((tx) => txStorage.run(tx, fn), { maxWait: 2_000, timeout: 8_000 });
  }
}

// Drizzle: idéntico con db.transaction
run<T>(fn: () => Promise<T>) {
  if (txStorage.getStore()) return fn();
  return this.db.transaction((tx) => txStorage.run(tx, fn));
}
```

Reglas: `timeout` corto y explícito (una transacción que espera IO externo bloquea conexiones; publica
eventos **después** de `run`); en tests de aplicación el runner es `{ run: (fn) => fn() }`; en
serverless `AsyncLocalStorage` funciona por invocación pero el pool no (Prisma Accelerate, Neon o `pg`
con `max: 1`); nunca `$transaction([...])` en batch para casos de uso (no permite leer antes de decidir).

## Mapeo sin fuga de tipos generados

Tipos de `@prisma/client` o `typeof invoices.$inferSelect` solo en las firmas de `toDomain`/`toRow`. Fugas habituales:

| Fuga | Corrección |
|---|---|
| `application/` importa `Prisma.InvoiceWhereInput` para filtros | DTO de filtros propio en `application/queries`; el reader lo traduce |
| El enum de estado del dominio es `import { InvoiceStatus } from '@prisma/client'` | Enum/unión en `domain/`; el adaptador hace `status as InvoiceStatus` tras validar con un `switch` exhaustivo |
| `Invoice.reconstitute(row)` recibe la fila entera | Recibe un objeto construido campo a campo: si cambia el esquema falla el compilador en el adaptador, no en el dominio |

`Decimal` de Prisma para dinero: no. Persiste `total_cents Int` y construye `Money.of(cents, currency)`
en el mapeo. Con esquema heredado `DECIMAL(12,2)`, convierte (`row.total.mul(100).toNumber()`) en
`toDomain` y a la inversa en `toRow`; el dominio nunca ve `Decimal`.

## Concurrencia: bloqueo y versión optimista

Prisma no expone `FOR UPDATE` en el query API; usa SQL crudo dentro de la transacción o versión optimista.

```ts
// Pesimista (secuencias, saldos): SQL dentro de la misma transacción interactiva
const [seq] = await this.client().$queryRaw<{ last: number }[]>`
  SELECT last FROM invoice_sequences WHERE year = ${year} FOR UPDATE`;

// Optimista: columna version; el repositorio compara y falla si otro escribió antes
async save(invoice: Invoice) {
  const { count } = await this.client().invoice.updateMany({
    where: { id: invoice.id, version: invoice.version },
    data: { ...toRow(invoice), version: { increment: 1 } },
  });
  if (count === 0) throw new ConcurrencyConflict(invoice.id);   // la aplicación decide: reintentar o 409
}
```

Drizzle tiene `.for('update')` en `select`. La versión viaja como dato opaco en `reconstitute`; el
dominio no la incrementa ni la interpreta.

## Migraciones

- **Prisma**: `prisma migrate dev --create-only`, revisa y edita el SQL (índices parciales, `CHECK`,
  backfill), después `migrate deploy` en CI. Nunca `db push` fuera de prototipos.
- **Drizzle**: `drizzle-kit generate` produce SQL versionado en `drizzle/`; `drizzle-kit migrate` lo
  aplica. Edita a mano cuando el generador no sabe (renombrar columna = drop+add: corrige a `RENAME`).
- Expand/contract y compatibilidad en [`migrations-and-domain.md`](migrations-and-domain.md).
- Migraciones junto al módulo (`packages/invoicing/prisma/`) o un único `schema.prisma` con `@@map` a
  tablas prefijadas por contexto (`invoicing_invoices`).

## Tests con base de datos real

Sin mockear el cliente: Postgres efímero con Testcontainers. SQLite solo si el SQL es portable (Drizzle +
`better-sqlite3`; con Prisma exige cambiar el provider y pierde features de Postgres).

```ts
// tests/setup-db.ts (vitest project "integration", pool: 'forks')
import { PostgreSqlContainer } from '@testcontainers/postgresql';
let container: StartedPostgreSqlContainer;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'inherit' });   // drizzle-kit migrate para Drizzle
}, 60_000);
afterAll(() => container.stop());

// infrastructure/PrismaInvoiceRepository.test.ts
describe('PrismaInvoiceRepository', () => {
  const prisma = new PrismaClient();
  const repo = new PrismaInvoiceRepository(prisma);
  beforeEach(() => prisma.$transaction([prisma.invoiceLine.deleteMany(), prisma.invoice.deleteMany()]));

  it('round-trips an issued invoice with lines', async () => {
    const invoice = anInvoice().issued().withLines(2).build();
    await repo.save(invoice);
    const loaded = await repo.ofId(invoice.id);
    expect(loaded).toEqual(invoice);                         // igualdad estructural; sin eventos pendientes
    expect(loaded!.pullEvents()).toHaveLength(0);
  });

});
```

Añade un test de versión obsoleta (dos cargas, dos `save`, el segundo lanza `ConcurrencyConflict`).
Aislamiento por test: `deleteMany` por tabla en orden de FK (rápido) o rollback de una transacción
envolvente (más rápido, pero no sirve para probar las transacciones del propio adaptador). Ejecuta la
misma suite de contrato contra `InMemoryInvoiceRepository`, ver
[`../testing/overview.md`](../testing/overview.md) §4.

## Prisma o Drizzle

Prisma: upsert anidado de agregado con hijos en una llamada; `FOR UPDATE`, CTE y ventanas solo con
`$queryRaw`; edge/serverless requiere driver adapter o Accelerate. Drizzle: SQL tipado nativo (mejor
para read models y bloqueos), ligero en edge, pero el upsert de agregado es explícito y las migraciones
piden más edición manual. Para el módulo hexagonal la diferencia es solo del adaptador: puerto, dominio y
tests de aplicación no cambian. No mezcles ambos en el mismo contexto.

## Errores frecuentes

- Pasar `tx` como parámetro de cada método del puerto: el puerto acaba con tipo `Prisma.TransactionClient`.
  Usa `AsyncLocalStorage` en el runner.
- Devolver desde el repositorio filas Prisma "por comodidad" a un read model: son dos puertos distintos.
- `include` recursivo (`lines: { include: { product: true } }`) para hidratar un agregado: el agregado
  no contiene `Product`, guarda `productId` y el nombre copiado si lo necesita.
- `$extends` con lógica de negocio (soft delete, tenant): el repositorio recibe `TenantId` y filtra explícitamente.
- Confiar en que `upsert` es atómico frente a lecturas concurrentes: sin versión optimista, dos
  `save` sucesivos pisan cambios.
- Tests de adaptador con `vi.mock('@prisma/client')`: no prueban el SQL, lo único que deben probar.
- `timestamp` sin `withTimezone: true` en Drizzle: devuelve hora local del servidor. Siempre `TIMESTAMPTZ`.

## Checklist

- [ ] `@prisma/client` o `infrastructure/schema.ts` solo se importan desde `infrastructure/`.
- [ ] `toDomain` construye con `reconstitute` campo a campo; no emite eventos.
- [ ] `TransactionRunner` con `AsyncLocalStorage`, timeout explícito y reutilización en anidados.
- [ ] Eventos publicados fuera de `tx.run`.
- [ ] Dinero en enteros; `Decimal` convertido en el mapeo.
- [ ] Versión optimista o `FOR UPDATE` donde haya escrituras concurrentes.
- [ ] Migraciones versionadas en SQL y revisadas; nada de `db push` en producción.
- [ ] Tests del repositorio contra Postgres real + suite de contrato compartida con el fake.
- [ ] Reglas de dependency-cruiser bloquean `@prisma/client` y `drizzle-orm` fuera de infrastructure.
