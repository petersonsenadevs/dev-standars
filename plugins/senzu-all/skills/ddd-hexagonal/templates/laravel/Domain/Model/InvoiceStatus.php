<?php

declare(strict_types=1);

namespace Invoicing\Domain\Model;

/**
 * Estados de la factura. Las transiciones válidas las decide el agregado, no el enum.
 * Backed enum para persistir como string sin mapeo adicional.
 */
enum InvoiceStatus: string
{
    case Draft = 'draft';
    case Issued = 'issued';
    case Paid = 'paid';
    case Voided = 'voided';
}
