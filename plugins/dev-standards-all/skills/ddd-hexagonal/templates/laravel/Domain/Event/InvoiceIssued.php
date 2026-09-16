<?php

declare(strict_types=1);

namespace Invoicing\Domain\Event;

use DateTimeImmutable;
use Invoicing\Domain\ValueObject\Money;
use Shared\Domain\DomainEvent;

/**
 * Hecho pasado, inmutable, con los datos mínimos que un consumidor necesita
 * sin tener que cargar el agregado. Nombre versionado para integración entre contextos.
 *
 * No extiende nada de Illuminate: Event::dispatch acepta cualquier objeto.
 * Si un listener necesita ir a cola, el listener implementa ShouldQueue; el evento
 * debe ser serializable (solo escalares y VO readonly).
 */
final readonly class InvoiceIssued implements DomainEvent
{
    public const NAME = 'invoicing.invoice_issued.v1';

    public function __construct(
        public string $invoiceId,
        public string $customerId,
        public string $number,
        public Money $total,
        public DateTimeImmutable $issuedAt,
    ) {
    }

    public function eventName(): string
    {
        return self::NAME;
    }

    public function occurredOn(): DateTimeImmutable
    {
        return $this->issuedAt;
    }

    /** Payload plano para outbox/integración. */
    public function toPayload(): array
    {
        return [
            'invoice_id' => $this->invoiceId,
            'customer_id' => $this->customerId,
            'number' => $this->number,
            'total_cents' => $this->total->amountCents,
            'currency' => $this->total->currency,
            'issued_at' => $this->issuedAt->format(DATE_ATOM),
        ];
    }
}
