<?php

declare(strict_types=1);

namespace Invoicing\Domain\Exception;

use Invoicing\Domain\ValueObject\InvoiceId;
use Shared\Domain\DomainException;

/**
 * Excepción de dominio con constructores nombrados: el mensaje explica la regla,
 * el código (`code()`) permite al adaptador HTTP mapear a status/error estable.
 *
 * Shared\Domain\DomainException es una abstracta mínima:
 *   abstract class DomainException extends \DomainException { abstract public function code(): string; }
 */
final class InvoiceCannotBeIssued extends DomainException
{
    private function __construct(string $message, private readonly string $errorCode)
    {
        parent::__construct($message);
    }

    public static function withoutLines(InvoiceId $id): self
    {
        return new self("Invoice {$id->value} has no lines and cannot be issued", 'invoice_without_lines');
    }

    public static function alreadyIssued(InvoiceId $id): self
    {
        return new self("Invoice {$id->value} is already issued", 'invoice_already_issued');
    }

    public static function locked(InvoiceId $id): self
    {
        return new self("Invoice {$id->value} is not a draft and cannot be modified", 'invoice_locked');
    }

    public function code(): string
    {
        return $this->errorCode;
    }
}
