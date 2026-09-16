/**
 * Adaptador driven: InvoiceRepository sobre Prisma.
 * Los tipos generados por Prisma no salen de este archivo.
 *
 * Transacciones: el caso de uso llama a `tx.run(fn)`; PrismaTransactionRunner guarda el
 * cliente transaccional en AsyncLocalStorage y el repositorio lo recupera con `client()`.
 * Así el repositorio no necesita recibir `tx` por parámetro en cada método.
 *
 * schema.prisma de referencia:
 *   model Invoice { id String @id  customerId String  status String  number String?  issuedAt DateTime?
 *                   currency String  totalCents Int  dueAt DateTime?  lines InvoiceLine[] }
 *   model InvoiceLine { id String @id  invoiceId String  description String  unitPriceCents Int  quantity Int
 *                       invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade) }
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient, Prisma, Invoice as InvoiceRow, InvoiceLine as LineRow } from '@prisma/client';
import { Invoice, InvoiceId, CustomerId, invoiceLine, type InvoiceStatus } from '../domain/Invoice';
import { Money } from '../domain/Money';
import type { InvoiceRepository } from '../domain/InvoiceRepository';
import type { TransactionRunner } from '../application/issueInvoice';

type Db = PrismaClient | Prisma.TransactionClient;
const txStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}
  run<T>(fn: () => Promise<T>): Promise<T> {
    // Si ya estamos dentro de una transacción (caso de uso anidado en un job), reutilizarla.
    if (txStorage.getStore()) return fn();
    return this.prisma.$transaction((tx) => txStorage.run(tx, fn));
  }
}

export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(): Db {
    return txStorage.getStore() ?? this.prisma;
  }

  nextId(): InvoiceId {
    return InvoiceId.of(crypto.randomUUID()); // v4; usa `uuidv7` si necesitas orden temporal
  }

  async ofId(id: InvoiceId): Promise<Invoice | null> {
    const row = await this.client().invoice.findUnique({ where: { id }, include: { lines: true } });
    return row ? toDomain(row) : null;
  }

  async save(invoice: Invoice): Promise<void> {
    const data = toRow(invoice);
    const lines = invoice.getLines().map((l) => ({
      id: l.id, description: l.description, unitPriceCents: l.unitPrice.amountCents, quantity: l.quantity,
    }));
    // Upsert raíz + reemplazo completo de líneas: simple y correcto para agregados pequeños.
    await this.client().invoice.upsert({
      where: { id: data.id },
      create: { ...data, lines: { create: lines } },
      update: { ...data, lines: { deleteMany: {}, create: lines } },
    });
  }

  async overdueAt(date: Date): Promise<Invoice[]> {
    const rows = await this.client().invoice.findMany({
      where: { status: 'issued', dueAt: { lt: date } },
      include: { lines: true },
    });
    return rows.map(toDomain);
  }
}

// ---- Mapeo: única frontera entre esquema y dominio ------------------------------------

function toDomain(row: InvoiceRow & { lines: LineRow[] }): Invoice {
  return Invoice.reconstitute({
    id: InvoiceId.of(row.id),
    customerId: CustomerId.of(row.customerId),
    currency: row.currency,
    status: row.status as InvoiceStatus,
    number: row.number,
    issuedAt: row.issuedAt,
    lines: row.lines.map((l) => invoiceLine({
      id: l.id, description: l.description, unitPrice: Money.of(l.unitPriceCents, row.currency), quantity: l.quantity,
    })),
  });
}

function toRow(invoice: Invoice) {
  return {
    id: invoice.id as string,
    customerId: invoice.customerId as string,
    status: invoice.status,
    number: invoice.number,
    issuedAt: invoice.issuedAt,
    currency: invoice.currency,
    totalCents: invoice.total().amountCents, // desnormalizado para listados
  };
}
