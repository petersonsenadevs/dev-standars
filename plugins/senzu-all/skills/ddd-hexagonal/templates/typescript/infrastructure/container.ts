/**
 * Composition root del módulo: el único archivo que conoce a la vez los puertos y
 * sus implementaciones reales. Sin librería de DI.
 *
 * - Se evalúa una vez por proceso (Node/Next server). Fine para singletons sin estado.
 * - Los tests de aplicación NO importan este archivo: construyen sus deps con fakes.
 * - Otros módulos y `app/` importan `invoicing` desde `src/modules/invoicing/index.ts`,
 *   que reexporta este objeto y los tipos públicos.
 */
import { prisma } from '@/lib/prisma';
import { issueInvoice, type Clock, type EventBus, type InvoiceNumberSequence } from '../application/issueInvoice';
import { listPendingInvoices } from '../application/queries/listPendingInvoices';
import { PrismaInvoiceRepository, PrismaTransactionRunner } from './PrismaInvoiceRepository';
import { PrismaPendingInvoicesReader } from './PrismaPendingInvoicesReader';
import { PrismaInvoiceNumberSequence } from './PrismaInvoiceNumberSequence';
import { InvoiceIssued, type DomainEvent } from '../domain/events';
import { sendInvoiceEmail } from './listeners/sendInvoiceEmail';

// ---- Implementaciones de puertos simples, inline -------------------------------------
const clock: Clock = { now: () => new Date() };

/** Bus en proceso. Suficiente para listeners rápidos e idempotentes; si no, outbox. */
class InProcessEventBus implements EventBus {
  private handlers = new Map<string, Array<(e: DomainEvent) => Promise<void>>>();
  on<E extends DomainEvent>(name: E['name'], handler: (e: E) => Promise<void>): this {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as (e: DomainEvent) => Promise<void>);
    this.handlers.set(name, list);
    return this;
  }
  async publish(events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      for (const h of this.handlers.get(e.name) ?? []) {
        try { await h(e); } catch (error) { console.error(`[events] handler failed for ${e.name}`, error); } // no rompe el caso de uso
      }
    }
  }
}

// ---- Wiring --------------------------------------------------------------------------------
const events = new InProcessEventBus()
  .on<InvoiceIssued>(InvoiceIssued.NAME, sendInvoiceEmail); // listener = adaptador de 5 líneas

const invoices = new PrismaInvoiceRepository(prisma);
const sequence: InvoiceNumberSequence = new PrismaInvoiceNumberSequence(prisma);
const tx = new PrismaTransactionRunner(prisma);

export const invoicing = {
  // Puertos driving (casos de uso y queries) ya cableados
  issueInvoice: issueInvoice({ invoices, sequence, clock, events, tx }),
  listPendingInvoices: listPendingInvoices({ reader: new PrismaPendingInvoicesReader(prisma) }),
} as const;

export type InvoicingModule = typeof invoicing;

// ---- Variante con factory (request-scoped, p. ej. multi-tenant por conexión) --------------
// export const createInvoicing = (db: PrismaClient) => ({ issueInvoice: issueInvoice({ invoices: new PrismaInvoiceRepository(db), ... }) });
