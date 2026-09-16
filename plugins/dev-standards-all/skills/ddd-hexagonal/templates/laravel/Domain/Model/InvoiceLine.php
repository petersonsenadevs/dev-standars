<?php

declare(strict_types=1);

namespace Invoicing\Domain\Model;

use Invoicing\Domain\ValueObject\Money;

/**
 * Entidad hija del agregado Invoice. Solo se crea/modifica a través de la raíz.
 * Inmutable en la práctica: cambiar cantidad = quitar y añadir línea desde Invoice.
 */
final readonly class InvoiceLine
{
    public function __construct(
        public string $id,          // UUID generado en infraestructura o por la fábrica
        public string $description,
        public Money $unitPrice,
        public int $quantity,
    ) {
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Quantity must be greater than zero');
        }
        if (trim($description) === '') {
            throw new \InvalidArgumentException('Description cannot be empty');
        }
    }

    public function total(): Money
    {
        return $this->unitPrice->multiply($this->quantity);
    }
}
