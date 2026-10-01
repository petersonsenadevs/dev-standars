<?php

declare(strict_types=1);

namespace Invoicing\Domain\ValueObject;

/**
 * Value Object: inmutable, igualdad por valor, validación en constructor.
 * Importes en céntimos (int) para evitar floats. Una moneda por instancia.
 *
 * Si varios contextos usan Money, muévelo a Shared\Domain (shared kernel mínimo).
 */
final readonly class Money
{
    private const CURRENCY_PATTERN = '/^[A-Z]{3}$/';

    public function __construct(
        public int $amountCents,
        public string $currency,
    ) {
        if ($amountCents < 0) {
            throw new \InvalidArgumentException('Money cannot be negative');
        }
        if (preg_match(self::CURRENCY_PATTERN, $currency) !== 1) {
            throw new \InvalidArgumentException("Invalid ISO currency: {$currency}");
        }
    }

    // ---- Constructores nombrados --------------------------------------------

    public static function zero(string $currency): self
    {
        return new self(0, $currency);
    }

    public static function eur(int $amountCents): self
    {
        return new self($amountCents, 'EUR');
    }

    /** Desde decimal de entrada ("12.50") con redondeo half-up a céntimos. */
    public static function fromDecimal(string $amount, string $currency): self
    {
        return new self((int) round(((float) $amount) * 100), $currency);
    }

    // ---- Operaciones: siempre devuelven una instancia nueva -----------------

    public function add(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->amountCents + $other->amountCents, $this->currency);
    }

    public function subtract(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->amountCents - $other->amountCents, $this->currency); // lanza si negativo
    }

    public function multiply(int $factor): self
    {
        return new self($this->amountCents * $factor, $this->currency);
    }

    /** Porcentaje en base 10000 (21 % = 2100) para evitar floats en impuestos. */
    public function percentage(int $basisPoints): self
    {
        return new self(intdiv($this->amountCents * $basisPoints + 5000, 10000), $this->currency);
    }

    // ---- Igualdad y presentación --------------------------------------------

    public function equals(self $other): bool
    {
        return $this->amountCents === $other->amountCents && $this->currency === $other->currency;
    }

    public function isZero(): bool
    {
        return $this->amountCents === 0;
    }

    /** Para DTOs/logs; el formateo con locale es cosa de la UI. */
    public function toDecimalString(): string
    {
        return number_format($this->amountCents / 100, 2, '.', '');
    }

    private function assertSameCurrency(self $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new \InvalidArgumentException("Currency mismatch: {$this->currency} vs {$other->currency}");
        }
    }
}
