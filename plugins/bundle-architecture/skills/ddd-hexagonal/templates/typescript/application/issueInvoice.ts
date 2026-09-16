/**
 * Caso de uso IssueInvoice: función que recibe dependencias (puertos) y devuelve la
 * función ejecutable. Sin clases, sin decoradores, sin framework.
 *
 * Orquesta: cargar -> regla (en el agregado) -> guardar en transacción -> publicar eventos.
 * Devuelve Result para que el adaptador (Server Action) lo serialice tal cual.
 */
import { Invoice, InvoiceId, type InvoiceError } from '../domain/Invoice';
import type { InvoiceRepository } from '../domain/InvoiceRepository';
import type { DomainEvent } from '../domain/events';
import { err, ok, type Result } from '../../shared/domain/Result';

// ---- Puertos no persistentes (podrían vivir en application/ports.ts) ----------
export interface Clock { now(): Date }
export interface EventBus { publish(events: DomainEvent[]): Promise<void> }
export interface TransactionRunner { run<T>(fn: () => Promise<T>): Promise<T> }
export interface InvoiceNumberSequence { next(at: Date): Promise<string> } // lock en la impl

// ---- Contrato del caso de uso -----------------------------------------------------
export type IssueInvoiceCommand = { invoiceId: string; actorId: string };
export type IssueInvoiceOutput = { invoiceId: string; number: string };
export type IssueInvoiceError = InvoiceError | { kind: 'NotFound'; invoiceId: string };

export type IssueInvoiceDeps = {
  invoices: InvoiceRepository;
  sequence: InvoiceNumberSequence;
  clock: Clock;
  events: EventBus;
  tx: TransactionRunner;
};

export const issueInvoice = (deps: IssueInvoiceDeps) =>
  async (cmd: IssueInvoiceCommand): Promise<Result<IssueInvoiceOutput, IssueInvoiceError>> => {
    const id = InvoiceId.of(cmd.invoiceId);
    const now = deps.clock.now();

    const invoice = await deps.invoices.ofId(id);
    if (!invoice) return err({ kind: 'NotFound', invoiceId: cmd.invoiceId });

    // Una transacción por caso de uso; dentro solo persistencia.
    const result = await deps.tx.run(async () => {
      const number = await deps.sequence.next(now);
      const issued = invoice.issue(number, now);        // invariantes viven en el agregado
      if (!issued.ok) return issued;
      await deps.invoices.save(invoice);
      return ok({ invoiceId: invoice.id, number });
    });
    if (!result.ok) return result;

    // Fuera de la transacción: los listeners con IO no pueden deshacer la emisión.
    await deps.events.publish(invoice.pullEvents());
    return result;
  };

export type IssueInvoice = ReturnType<typeof issueInvoice>;

// ---- Nota sobre Invoice sin usar ----------------------------------------------------
// El import de `Invoice` (clase) solo se usa como tipo aquí; queda para dejar claro que el
// caso de uso conoce el agregado. Con `verbatimModuleSyntax` conviértelo en `import type`.
export type { Invoice };
