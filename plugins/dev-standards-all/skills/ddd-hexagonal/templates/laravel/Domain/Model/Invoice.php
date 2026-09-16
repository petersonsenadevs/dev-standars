<?php

declare(strict_types=1);

namespace Invoicing\Domain\Model;

use DateTimeImmutable;
use Invoicing\Domain\Event\InvoiceIssued;
use Invoicing\Domain\Exception\InvoiceCannotBeIssued;
use Invoicing\Domain\ValueObject\CustomerId;
use Invoicing\Domain\ValueObject\InvoiceId;
use Invoicing\Domain\ValueObject\InvoiceNumber;
use Invoicing\Domain\ValueObject\Money;
use Shared\Domain\AggregateRoot;

/**
 * Raíz del agregado Invoice. Única puerta de entrada a sus líneas.
 *
 * Invariantes:
 *  - Solo se pueden añadir/quitar líneas en estado Draft.
 *  - No se emite sin líneas.
 *  - Una vez emitida es inmutable (salvo void/paid, gestionados por sus propios métodos).
 *
 * Sin dependencias de framework: ni Eloquent, ni Carbon, ni facades.
 */
final class Invoice extends AggregateRoot
{
    /** @var array<int, InvoiceLine> */
    private array $lines = [];

    private function __construct(
        public readonly InvoiceId $id,
        public readonly CustomerId $customerId,
        private InvoiceStatus $status,
        private ?InvoiceNumber $number,
        private ?DateTimeImmutable $issuedAt,
        private readonly string $currency,
    ) {
    }

    // ---- Fábricas -----------------------------------------------------------

    /** Crea un borrador nuevo. Es el único camino "de negocio" para crear una factura. */
    public static function draftFor(InvoiceId $id, CustomerId $customerId, string $currency = 'EUR'): self
    {
        return new self($id, $customerId, InvoiceStatus::Draft, null, null, $currency);
    }

    /**
     * Rehidrata desde persistencia sin validar transiciones ni emitir eventos.
     * Solo la usa el repositorio.
     *
     * @param array<int, InvoiceLine> $lines
     */
    public static function reconstitute(
        InvoiceId $id,
        CustomerId $customerId,
        InvoiceStatus $status,
        ?InvoiceNumber $number,
        ?DateTimeImmutable $issuedAt,
        string $currency,
        array $lines,
    ): self {
        $invoice = new self($id, $customerId, $status, $number, $issuedAt, $currency);
        $invoice->lines = array_values($lines);

        return $invoice;
    }

    // ---- Comportamiento -----------------------------------------------------

    public function addLine(InvoiceLine $line): void
    {
        $this->assertDraft();
        if ($line->unitPrice->currency !== $this->currency) {
            throw new \InvalidArgumentException("Line currency must be {$this->currency}");
        }
        $this->lines[] = $line;
    }

    public function removeLine(string $lineId): void
    {
        $this->assertDraft();
        $this->lines = array_values(array_filter($this->lines, fn (InvoiceLine $l) => $l->id !== $lineId));
    }

    /**
     * Transición Draft -> Issued. El número lo decide fuera (secuencia = otro agregado);
     * la fecha viene inyectada para que el dominio no dependa de un reloj real.
     */
    public function issue(InvoiceNumber $number, DateTimeImmutable $now): void
    {
        if ($this->status !== InvoiceStatus::Draft) {
            throw InvoiceCannotBeIssued::alreadyIssued($this->id);
        }
        if ($this->lines === []) {
            throw InvoiceCannotBeIssued::withoutLines($this->id);
        }

        $this->status = InvoiceStatus::Issued;
        $this->number = $number;
        $this->issuedAt = $now;

        // Se registra; el caso de uso lo publica tras el commit.
        $this->record(new InvoiceIssued(
            invoiceId: $this->id->value,
            customerId: $this->customerId->value,
            number: $number->value,
            total: $this->total(),
            issuedAt: $now,
        ));
    }

    // ---- Consultas (sin efectos) --------------------------------------------

    public function total(): Money
    {
        return array_reduce(
            $this->lines,
            fn (Money $carry, InvoiceLine $line) => $carry->add($line->total()),
            Money::zero($this->currency),
        );
    }

    public function status(): InvoiceStatus
    {
        return $this->status;
    }

    public function number(): ?InvoiceNumber
    {
        return $this->number;
    }

    public function issuedAt(): ?DateTimeImmutable
    {
        return $this->issuedAt;
    }

    public function currency(): string
    {
        return $this->currency;
    }

    /** @return array<int, InvoiceLine> copia defensiva: nadie muta las líneas desde fuera */
    public function lines(): array
    {
        return $this->lines;
    }

    public function isIssued(): bool
    {
        return $this->status === InvoiceStatus::Issued;
    }

    // ---- Helpers privados ---------------------------------------------------

    private function assertDraft(): void
    {
        if ($this->status !== InvoiceStatus::Draft) {
            throw InvoiceCannotBeIssued::locked($this->id);
        }
    }
}
