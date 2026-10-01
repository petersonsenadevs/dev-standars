/**
 * Eventos de dominio del módulo. Hechos pasados, inmutables, con datos mínimos.
 * `name` versionado: es el published language si otro contexto los consume.
 */
import type { Money } from './Money';

export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
  /** Payload plano y serializable (outbox, colas, logs). */
  toPayload(): Record<string, unknown>;
}

export class InvoiceIssued implements DomainEvent {
  static readonly NAME = 'invoicing.invoice_issued.v1' as const;
  readonly name = InvoiceIssued.NAME;
  readonly occurredAt: Date;

  constructor(
    readonly data: Readonly<{
      invoiceId: string;
      customerId: string;
      number: string;
      total: Money;
      issuedAt: Date;
    }>,
  ) {
    this.occurredAt = data.issuedAt;
  }

  toPayload() {
    return {
      invoice_id: this.data.invoiceId,
      customer_id: this.data.customerId,
      number: this.data.number,
      total_cents: this.data.total.amountCents,
      currency: this.data.total.currency,
      issued_at: this.data.issuedAt.toISOString(),
    };
  }
}

/** Unión de eventos del módulo, útil para tipar handlers: `on<InvoicingEvent>` */
export type InvoicingEvent = InvoiceIssued;
