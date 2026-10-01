/**
 * Test de caso de uso (Vitest) con fakes en memoria. Sin Prisma, sin Next, sin mocks.
 * Los fakes tienen comportamiento real (guardan y devuelven): el test describe resultado,
 * no llamadas. En el proyecto, los fakes viven en src/modules/invoicing/testing/.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { Invoice, InvoiceId, CustomerId, invoiceLine } from '../domain/Invoice';
import { Money } from '../domain/Money';
import { InvoiceIssued, type DomainEvent } from '../domain/events';
import type { InvoiceRepository } from '../domain/InvoiceRepository';
import { issueInvoice, type Clock, type EventBus, type TransactionRunner, type InvoiceNumberSequence } from './issueInvoice';

// ---- Fakes -----------------------------------------------------------------------
class InMemoryInvoiceRepository implements InvoiceRepository {
  private rows = new Map<string, Invoice>();
  private seq = 0;
  nextId() { return InvoiceId.of(`0190a1b2-0000-7000-8000-${String(++this.seq).padStart(12, '0')}`); }
  async ofId(id: InvoiceId) { return this.rows.get(id) ?? null; }
  async save(inv: Invoice) { this.rows.set(inv.id, inv); }
  async overdueAt(date: Date) { return [...this.rows.values()].filter((i) => i.status === 'issued' && (i.issuedAt ?? date) < date); }
}

class RecordingEventBus implements EventBus {
  published: DomainEvent[] = [];
  async publish(events: DomainEvent[]) { this.published.push(...events); }
  ofType<T extends DomainEvent>(ctor: new (...a: never[]) => T): T[] { return this.published.filter((e): e is T => e instanceof ctor); }
}

const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });
const noTx: TransactionRunner = { run: (fn) => fn() };
const sequence = (n = 1): InvoiceNumberSequence => ({ next: async (at) => `${at.getUTCFullYear()}-A-${String(n++).padStart(6, '0')}` });

// ---- Builder mínimo ----------------------------------------------------------------
const INVOICE_ID = InvoiceId.of('0190a1b2-0000-7000-8000-000000000001');
function aDraftInvoice(opts: { lines?: number } = {}): Invoice {
  const inv = Invoice.draft(INVOICE_ID, CustomerId.of('cust-1'));
  for (let i = 0; i < (opts.lines ?? 1); i++) {
    inv.addLine(invoiceLine({ id: `l${i}`, description: `Line ${i}`, unitPrice: Money.eur(1000), quantity: 2 }));
  }
  return inv;
}

// ---- Tests ---------------------------------------------------------------------------
describe('issueInvoice', () => {
  let invoices: InMemoryInvoiceRepository;
  let events: RecordingEventBus;
  let run: ReturnType<typeof issueInvoice>;

  beforeEach(() => {
    invoices = new InMemoryInvoiceRepository();
    events = new RecordingEventBus();
    run = issueInvoice({ invoices, events, clock: fixedClock('2026-01-10T10:00:00Z'), tx: noTx, sequence: sequence() });
  });

  it('issues a draft invoice, assigns a number and publishes InvoiceIssued', async () => {
    await invoices.save(aDraftInvoice({ lines: 2 }));

    const result = await run({ invoiceId: INVOICE_ID, actorId: 'u1' });

    expect(result).toEqual({ ok: true, value: { invoiceId: INVOICE_ID, number: '2026-A-000001' } });
    const stored = await invoices.ofId(INVOICE_ID);
    expect(stored?.status).toBe('issued');
    expect(stored?.issuedAt?.toISOString()).toBe('2026-01-10T10:00:00.000Z');

    const [issued] = events.ofType(InvoiceIssued);
    expect(issued.data.total.equals(Money.eur(4000))).toBe(true);
    expect(issued.data.number).toBe('2026-A-000001');
  });

  it('returns NotFound for an unknown invoice', async () => {
    const result = await run({ invoiceId: INVOICE_ID, actorId: 'u1' });
    expect(result).toEqual({ ok: false, error: { kind: 'NotFound', invoiceId: INVOICE_ID } });
    expect(events.published).toHaveLength(0);
  });

  it('returns NoLines and does not publish when the draft is empty', async () => {
    await invoices.save(aDraftInvoice({ lines: 0 }));

    const result = await run({ invoiceId: INVOICE_ID, actorId: 'u1' });

    expect(result).toEqual({ ok: false, error: { kind: 'NoLines', invoiceId: INVOICE_ID } });
    expect((await invoices.ofId(INVOICE_ID))?.status).toBe('draft');
    expect(events.published).toHaveLength(0);
  });

  it('returns AlreadyIssued on a second issue', async () => {
    await invoices.save(aDraftInvoice());
    await run({ invoiceId: INVOICE_ID, actorId: 'u1' });

    const second = await run({ invoiceId: INVOICE_ID, actorId: 'u1' });

    expect(second).toEqual({ ok: false, error: { kind: 'AlreadyIssued', invoiceId: INVOICE_ID } });
    expect(events.ofType(InvoiceIssued)).toHaveLength(1);
  });

  it('runs persistence inside the transaction runner', async () => {
    let inside = 0;
    const tx: TransactionRunner = { run: async (fn) => { inside++; return fn(); } };
    run = issueInvoice({ invoices, events, clock: fixedClock('2026-01-10T10:00:00Z'), tx, sequence: sequence() });
    await invoices.save(aDraftInvoice());

    await run({ invoiceId: INVOICE_ID, actorId: 'u1' });

    expect(inside).toBe(1);
  });
});
