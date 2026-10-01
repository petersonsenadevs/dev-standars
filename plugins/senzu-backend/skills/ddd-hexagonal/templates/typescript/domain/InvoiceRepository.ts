/**
 * Puerto driven: persistencia del agregado Invoice.
 * Interfaz en dominio; implementación (Prisma/Drizzle/in-memory) en infrastructure.
 *
 * Solo lo que necesitan los casos de uso de escritura. Los listados van a read models
 * (application/queries), no aquí.
 */
import type { Invoice, InvoiceId } from './Invoice';

export interface InvoiceRepository {
  /** Id nuevo (UUID v7 en infraestructura). El dominio no sabe cómo se genera. */
  nextId(): InvoiceId;
  ofId(id: InvoiceId): Promise<Invoice | null>;
  /** Upsert idempotente de la raíz y sus líneas. */
  save(invoice: Invoice): Promise<void>;
  /** Consulta de dominio legítima (la usa un caso de uso, no una pantalla). */
  overdueAt(date: Date): Promise<Invoice[]>;
}
