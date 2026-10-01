<?php

declare(strict_types=1);

// Tres VO de identidad en un archivo solo por brevedad de la plantilla.
// En el proyecto real: un archivo por clase (PSR-4).

namespace Invoicing\Domain\ValueObject;

/** Id tipado: evita pasar un CustomerId donde se espera un InvoiceId. */
final readonly class InvoiceId
{
    private function __construct(public string $value)
    {
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value) !== 1) {
            throw new \InvalidArgumentException("Invalid InvoiceId: {$value}");
        }
    }

    public static function of(string $value): self
    {
        return new self($value);
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }
}

final readonly class CustomerId
{
    private function __construct(public string $value)
    {
        if ($value === '') {
            throw new \InvalidArgumentException('CustomerId cannot be empty');
        }
    }

    public static function of(string $value): self
    {
        return new self($value);
    }
}

/** Número fiscal correlativo, p. ej. "2026-A-000123". Lo genera InvoiceSequence (otro agregado). */
final readonly class InvoiceNumber
{
    public function __construct(public string $value)
    {
        if (preg_match('/^\d{4}-[A-Z]-\d{6}$/', $value) !== 1) {
            throw new \InvalidArgumentException("Invalid invoice number: {$value}");
        }
    }
}
