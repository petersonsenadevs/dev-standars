/**
 * Agregado Invoice. Raíz única; las líneas solo se tocan a través de ella.
 * Sin imports de next/prisma/zod: solo dominio.
 *
 * Errores de negocio esperados -> Result (serializable hasta la UI).
 * Errores de programación (línea en otra moneda, id mal formado) -> throw.
 */
import { Money } from './Money';
import { InvoiceIssued, type DomainEvent } from './events';
import { err, ok, type Result } from '../../shared/domain/Result';

// ---- Ids como branded types: coste cero en runtime, seguridad en compilación ----
export type InvoiceId = string & { readonly __brand: 'InvoiceId' };
export type CustomerId = string & { readonly __brand: 'CustomerId' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const InvoiceId = {
  of(v: string): InvoiceId {
    if (!UUID.test(v)) throw new Error(`Invalid InvoiceId: ${v}`);
    return v as InvoiceId;
  },
};
export const CustomerId = {
  of(v: string): CustomerId {
    if (!v) throw new Error('CustomerId cannot be empty');
    return v as CustomerId;
  },
};

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'voided';

export type InvoiceError =
  | { kind: 'NoLines'; invoiceId: string }
  | { kind: 'AlreadyIssued'; invoiceId: string }
  | { kind: 'Locked'; invoiceId: string };

/** Entidad hija: inmutable; para cambiar cantidad se reemplaza la línea vía la raíz. */
export type InvoiceLine = Readonly<{
  id: string;
  description: string;
  unitPrice: Money;
  quantity: number;
}>;

export function invoiceLine(input: InvoiceLine): InvoiceLine {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('quantity must be > 0');
  if (!input.description.trim()) throw new Error('description cannot be empty');
  return Object.freeze({ ...input });
}

export class Invoice {
  private lines: InvoiceLine[] = [];
  private events: DomainEvent[] = [];

  private constructor(
    readonly id: InvoiceId,
    readonly customerId: CustomerId,
    readonly currency: string,
    private _status: InvoiceStatus,
    private _number: string | null,
    private _issuedAt: Date | null,
  ) {}

  // ---- Fábricas ---------------------------------------------------------------

  static draft(id: InvoiceId, customerId: CustomerId, currency = 'EUR'): Invoice {
    return new Invoice(id, customerId, currency, 'draft', null, null);
  }

  /** Rehidratación desde persistencia: sin validar transiciones ni emitir eventos. */
  static reconstitute(props: {
    id: InvoiceId; customerId: CustomerId; currency: string; status: InvoiceStatus;
    number: string | null; issuedAt: Date | null; lines: InvoiceLine[];
  }): Invoice {
    const inv = new Invoice(props.id, props.customerId, props.currency, props.status, props.number, props.issuedAt);
    inv.lines = [...props.lines];
    return inv;
  }

  // ---- Comportamiento ---------------------------------------------------------

  addLine(line: InvoiceLine): Result<void, InvoiceError> {
    if (this._status !== 'draft') return err({ kind: 'Locked', invoiceId: this.id });
    if (line.unitPrice.currency !== this.currency) throw new Error(`Line currency must be ${this.currency}`);
    this.lines.push(line);
    return ok(undefined);
  }

  removeLine(lineId: string): Result<void, InvoiceError> {
    if (this._status !== 'draft') return err({ kind: 'Locked', invoiceId: this.id });
    this.lines = this.lines.filter((l) => l.id !== lineId);
    return ok(undefined);
  }

  /**
   * Draft -> Issued. El número lo asigna otro agregado (secuencia); la fecha se
   * inyecta para no depender de Date.now() en el dominio.
   */
  issue(number: string, now: Date): Result<void, InvoiceError> {
    if (this._status !== 'draft') return err({ kind: 'AlreadyIssued', invoiceId: this.id });
    if (this.lines.length === 0) return err({ kind: 'NoLines', invoiceId: this.id });

    this._status = 'issued';
    this._number = number;
    this._issuedAt = now;
    this.events.push(new InvoiceIssued({
      invoiceId: this.id, customerId: this.customerId, number, total: this.total(), issuedAt: now,
    }));
    return ok(undefined);
  }

  // ---- Consultas --------------------------------------------------------------

  total(): Money {
    return this.lines.reduce((acc, l) => acc.add(l.unitPrice.times(l.quantity)), Money.zero(this.currency));
  }
  get status(): InvoiceStatus { return this._status; }
  get number(): string | null { return this._number; }
  get issuedAt(): Date | null { return this._issuedAt; }
  getLines(): readonly InvoiceLine[] { return this.lines; }

  /** Entrega los eventos registrados y vacía la lista. Lo llama el caso de uso tras persistir. */
  pullEvents(): DomainEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
