<?php

declare(strict_types=1);

/**
 * Test de dominio puro (Pest). No extiende el TestCase de Laravel: sin contenedor,
 * sin BD, sin bootstrap. Debe correr en milisegundos.
 *
 * Los tests se leen como el glosario del contexto. El builder `anInvoice()` vive en
 * tests/Builders/InvoiceBuilder.php y se registra como helper en tests/Pest.php.
 */

use Invoicing\Domain\Event\InvoiceIssued;
use Invoicing\Domain\Exception\InvoiceCannotBeIssued;
use Invoicing\Domain\Model\InvoiceLine;
use Invoicing\Domain\Model\InvoiceStatus;
use Invoicing\Domain\ValueObject\InvoiceNumber;
use Invoicing\Domain\ValueObject\Money;

$issuedAt = new DateTimeImmutable('2026-01-10 10:00:00', new DateTimeZone('UTC'));
$number = new InvoiceNumber('2026-A-000001');

describe('Invoice draft', function () {
    it('starts as draft with zero total', function () {
        $invoice = anInvoice()->build();

        expect($invoice->status())->toBe(InvoiceStatus::Draft)
            ->and($invoice->total()->equals(Money::eur(0)))->toBeTrue();
    });

    it('sums line totals', function () {
        $invoice = anInvoice()
            ->withLine(Money::eur(1000), quantity: 2)   // 20.00
            ->withLine(Money::eur(550))                 //  5.50
            ->build();

        expect($invoice->total()->equals(Money::eur(2550)))->toBeTrue();
    });

    it('rejects a line in another currency', function () {
        $invoice = anInvoice()->build(); // EUR

        expect(fn () => $invoice->addLine(new InvoiceLine('l1', 'Consulting', new Money(100, 'USD'), 1)))
            ->toThrow(InvalidArgumentException::class);
    });
});

describe('Issuing an invoice', function () use ($issuedAt, $number) {
    it('cannot be issued without lines', function () use ($issuedAt, $number) {
        $invoice = anInvoice()->build();

        expect(fn () => $invoice->issue($number, $issuedAt))
            ->toThrow(InvoiceCannotBeIssued::class, 'has no lines');
    });

    it('becomes issued with number and date', function () use ($issuedAt, $number) {
        $invoice = anInvoice()->withLine(Money::eur(1000))->build();

        $invoice->issue($number, $issuedAt);

        expect($invoice->isIssued())->toBeTrue()
            ->and($invoice->number())->toEqual($number)
            ->and($invoice->issuedAt())->toEqual($issuedAt);
    });

    it('records InvoiceIssued with the total', function () use ($issuedAt, $number) {
        $invoice = anInvoice()->withLine(Money::eur(1000))->withLine(Money::eur(500))->build();

        $invoice->issue($number, $issuedAt);
        $events = $invoice->pullEvents();

        expect($events)->toHaveCount(1)
            ->and($events[0])->toBeInstanceOf(InvoiceIssued::class)
            ->and($events[0]->total->equals(Money::eur(1500)))->toBeTrue()
            ->and($events[0]->number)->toBe('2026-A-000001');
    });

    it('pulls events only once', function () use ($issuedAt, $number) {
        $invoice = anInvoice()->withLine(Money::eur(1))->build();
        $invoice->issue($number, $issuedAt);

        $invoice->pullEvents();

        expect($invoice->pullEvents())->toBe([]);
    });

    it('cannot be issued twice', function () use ($issuedAt, $number) {
        $invoice = anInvoice()->withLine(Money::eur(1))->issued()->build();

        expect(fn () => $invoice->issue($number, $issuedAt))
            ->toThrow(InvoiceCannotBeIssued::class, 'already issued');
    });

    it('locks lines after being issued', function () {
        $invoice = anInvoice()->withLine(Money::eur(1))->issued()->build();

        expect(fn () => $invoice->addLine(new InvoiceLine('l9', 'Late line', Money::eur(1), 1)))
            ->toThrow(InvoiceCannotBeIssued::class, 'cannot be modified');
    });
});

// ---- tests/Builders/InvoiceBuilder.php (referencia) ------------------------------
//
// final class InvoiceBuilder {
//     private array $lines = []; private bool $issued = false;
//     public static function anInvoice(): self { return new self(); }
//     public function withLine(Money $price, int $quantity = 1): self { $c = clone $this; $c->lines[] = [$price, $quantity]; return $c; }
//     public function issued(): self { $c = clone $this; $c->issued = true; return $c; }
//     public function build(): Invoice {
//         $invoice = Invoice::draftFor(InvoiceId::of('0190a1b2-0000-7000-8000-000000000001'), CustomerId::of('cust-1'));
//         foreach ($this->lines as $i => [$price, $qty]) { $invoice->addLine(new InvoiceLine("line-{$i}", "Line {$i}", $price, $qty)); }
//         if ($this->issued) { $invoice->issue(new InvoiceNumber('2026-A-000000'), new DateTimeImmutable('2026-01-01')); $invoice->pullEvents(); }
//         return $invoice;
//     }
// }
// // tests/Pest.php:  function anInvoice(): InvoiceBuilder { return InvoiceBuilder::anInvoice(); }
