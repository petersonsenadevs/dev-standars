<?php

declare(strict_types=1);

namespace Invoicing\Infrastructure\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Foundation\Http\FormRequest;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Invoicing\Application\IssueInvoice\IssueInvoiceCommand;
use Invoicing\Application\IssueInvoice\IssueInvoiceHandler;
use Invoicing\Application\Query\PendingInvoicesReader;

/**
 * Adaptador driving HTTP. Responsabilidades y nada más:
 *   1. Validar forma (Form Request) y autorizar acceso (policy).
 *   2. Construir el command con datos planos (actor incluido).
 *   3. Invocar el caso de uso.
 *   4. Mapear el resultado a respuesta.
 *
 * Las excepciones de dominio NO se capturan aquí: el handler global de excepciones
 * mapea Shared\Domain\DomainException -> 409 {error: code(), message}.
 *
 * Ruta (Infrastructure/Http/routes.php):
 *   Route::post('/api/invoices/{id}/issue', IssueInvoiceController::class)->middleware('auth:sanctum');
 */
final class IssueInvoiceController
{
    public function __invoke(IssueInvoiceRequest $request, string $id, IssueInvoiceHandler $handler): JsonResponse
    {
        $number = $handler(new IssueInvoiceCommand(
            invoiceId: $id,
            actorId: (string) $request->user()->id,
        ));

        return response()->json(['number' => $number->value], 200);
    }
}

/** Form Request: forma y autorización. Las reglas de negocio no van aquí. */
final class IssueInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('issue-invoices');
    }

    public function rules(): array
    {
        // El id viene por ruta; se valida que exista para dar 404 temprano y consistente.
        return ['id' => ['required', 'uuid', 'exists:invoices,id']];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['id' => $this->route('id')]);
    }
}

// ---- Variante Inertia ----------------------------------------------------------
//
// Mismo caso de uso, distinto adaptador. GET usa el read model; POST llama al handler
// y redirige. Los props son DTOs planos (InvoiceRow), nunca entidades ni modelos.
//
final class InvoicesInertiaController
{
    public function index(PendingInvoicesReader $reader): InertiaResponse
    {
        return Inertia::render('Invoices/Index', [
            'invoices' => $reader->forCustomer((string) auth()->user()->customer_id),
        ]);
    }

    public function issue(IssueInvoiceRequest $request, string $id, IssueInvoiceHandler $handler): RedirectResponse
    {
        $number = $handler(new IssueInvoiceCommand($id, (string) $request->user()->id));

        // Un DomainException aquí lo convierte el handler global en back()->withErrors(['invoice' => ...])
        return redirect()->route('invoices.show', $id)->with('success', "Factura {$number->value} emitida");
    }
}
