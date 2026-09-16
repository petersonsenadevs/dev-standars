<?php

declare(strict_types=1);

namespace Invoicing\Application\IssueInvoice;

use Illuminate\Support\Facades\DB;
use Invoicing\Application\Port\Clock;
use Invoicing\Application\Port\EventBus;
use Invoicing\Domain\Exception\InvoiceNotFound;
use Invoicing\Domain\Repository\InvoiceRepository;
use Invoicing\Domain\Repository\InvoiceSequenceRepository;
use Invoicing\Domain\ValueObject\InvoiceId;
use Invoicing\Domain\ValueObject\InvoiceNumber;

/**
 * Caso de uso (servicio de aplicación). Orquesta: cargar -> regla -> guardar -> publicar.
 * No contiene reglas de negocio: las reglas están en Invoice::issue().
 *
 * Dependencias por constructor (el contenedor de Laravel las resuelve por los bindings
 * del ServiceProvider). En tests se construye a mano con fakes.
 *
 * DB::transaction es la única dependencia de framework tolerada en Application
 * (documentada en deptrac.yaml). Alternativa purista: puerto TransactionRunner.
 */
final class IssueInvoiceHandler
{
    public function __construct(
        private readonly InvoiceRepository $invoices,
        private readonly InvoiceSequenceRepository $sequences,
        private readonly EventBus $events,
        private readonly Clock $clock,
    ) {
    }

    /** Devuelve el número asignado; el adaptador decide cómo presentarlo. */
    public function __invoke(IssueInvoiceCommand $command): InvoiceNumber
    {
        $invoiceId = InvoiceId::of($command->invoiceId);
        $now = $this->clock->now();

        $invoice = $this->invoices->ofId($invoiceId)
            ?? throw InvoiceNotFound::withId($invoiceId);

        // Una transacción por caso de uso. Dentro: solo persistencia.
        $number = DB::transaction(function () use ($invoice, $now): InvoiceNumber {
            // La secuencia hace SELECT ... FOR UPDATE en su implementación Eloquent:
            // dos emisiones concurrentes no obtienen el mismo número.
            $number = $this->sequences->next($now);
            $invoice->issue($number, $now);        // aquí viven las invariantes
            $this->invoices->save($invoice);

            return $number;
        });

        // Fuera de la transacción: si un listener falla, la factura ya está emitida
        // (y el listener debe ser reintentable). LaravelEventBus usa DB::afterCommit
        // por si este handler se ejecuta dentro de otra transacción externa.
        $this->events->publish(...$invoice->pullEvents());

        return $number;
    }
}
