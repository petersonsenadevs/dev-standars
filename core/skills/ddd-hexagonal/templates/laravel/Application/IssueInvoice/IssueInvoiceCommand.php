<?php

declare(strict_types=1);

namespace Invoicing\Application\IssueInvoice;

/**
 * Command: intención de cambiar estado, datos planos ya validados en forma.
 * Lo construye el adaptador driving (controlador, job, comando Artisan).
 * Sin lógica, sin VO (los VO se crean en el handler para que el error de
 * dominio sea del dominio, no del transporte).
 */
final readonly class IssueInvoiceCommand
{
    public function __construct(
        public string $invoiceId,
        public string $actorId,   // quién lo hace: lo resuelve el adaptador, nunca auth() en el handler
    ) {
    }
}
