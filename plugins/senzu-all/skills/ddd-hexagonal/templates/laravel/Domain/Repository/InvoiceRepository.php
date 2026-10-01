<?php

declare(strict_types=1);

namespace Invoicing\Domain\Repository;

use Invoicing\Domain\Model\Invoice;
use Invoicing\Domain\ValueObject\InvoiceId;

/**
 * Puerto driven: persistencia del agregado Invoice.
 * Vive en el dominio; la implementación (Eloquent) en Infrastructure.
 *
 * Reglas:
 *  - Habla en términos de dominio: devuelve/recibe Invoice, nunca modelos ni arrays.
 *  - Solo lo necesario para los casos de uso de escritura. Los listados van a read models.
 *  - Una interfaz por agregado.
 */
interface InvoiceRepository
{
    /** Genera un id nuevo (UUID v7 en infraestructura). El dominio no sabe cómo. */
    public function nextId(): InvoiceId;

    public function ofId(InvoiceId $id): ?Invoice;

    /** Upsert de la raíz y sus líneas. Idempotente. */
    public function save(Invoice $invoice): void;

    /**
     * Ejemplo de consulta de dominio legítima (la usa un caso de uso, no una pantalla).
     *
     * @return array<int, Invoice>
     */
    public function overdueAt(\DateTimeImmutable $date): array;
}
