<?php

declare(strict_types=1);

namespace Invoicing\Infrastructure\Persistence\Eloquent;

use DateTimeImmutable;
use Illuminate\Support\Str;
use Invoicing\Domain\Model\Invoice;
use Invoicing\Domain\Model\InvoiceLine;
use Invoicing\Domain\Model\InvoiceStatus;
use Invoicing\Domain\Repository\InvoiceRepository;
use Invoicing\Domain\ValueObject\CustomerId;
use Invoicing\Domain\ValueObject\InvoiceId;
use Invoicing\Domain\ValueObject\InvoiceNumber;
use Invoicing\Domain\ValueObject\Money;

/**
 * Adaptador driven: implementa el puerto con Eloquent.
 * Los modelos Eloquent (InvoiceModel, InvoiceLineModel) solo se conocen aquí.
 *
 * Estrategia de save: upsert de la raíz + reemplazo completo de líneas.
 * Correcta y simple para agregados pequeños; si las líneas fueran miles,
 * se haría diff por id.
 */
final class EloquentInvoiceRepository implements InvoiceRepository
{
    public function nextId(): InvoiceId
    {
        return InvoiceId::of((string) Str::uuid7());
    }

    public function ofId(InvoiceId $id): ?Invoice
    {
        $row = InvoiceModel::query()->with('lines')->find($id->value);

        return $row === null ? null : $this->toDomain($row);
    }

    public function save(Invoice $invoice): void
    {
        /** @var InvoiceModel $model */
        $model = InvoiceModel::query()->findOrNew($invoice->id->value);
        $model->id = $invoice->id->value;
        $model->customer_id = $invoice->customerId->value;
        $model->status = $invoice->status()->value;
        $model->number = $invoice->number()?->value;
        $model->issued_at = $invoice->issuedAt();
        $model->currency = $invoice->currency();
        $model->total_cents = $invoice->total()->amountCents;   // desnormalizado para listados
        $model->save();

        $model->lines()->delete();
        $model->lines()->createMany(array_map(
            fn (InvoiceLine $line) => [
                'id' => $line->id,
                'description' => $line->description,
                'unit_price_cents' => $line->unitPrice->amountCents,
                'quantity' => $line->quantity,
            ],
            $invoice->lines(),
        ));
    }

    /** @return array<int, Invoice> */
    public function overdueAt(DateTimeImmutable $date): array
    {
        return InvoiceModel::query()
            ->with('lines')
            ->where('status', InvoiceStatus::Issued->value)
            ->where('due_at', '<', $date)
            ->get()
            ->map(fn (InvoiceModel $m) => $this->toDomain($m))
            ->all();
    }

    // ---- Mapeo modelo -> dominio (rehidratación sin eventos) -----------------

    private function toDomain(InvoiceModel $m): Invoice
    {
        $lines = $m->lines->map(fn (InvoiceLineModel $l) => new InvoiceLine(
            id: $l->id,
            description: $l->description,
            unitPrice: new Money($l->unit_price_cents, $m->currency),
            quantity: $l->quantity,
        ))->all();

        return Invoice::reconstitute(
            id: InvoiceId::of($m->id),
            customerId: CustomerId::of($m->customer_id),
            status: InvoiceStatus::from($m->status),
            number: $m->number === null ? null : new InvoiceNumber($m->number),
            issuedAt: $m->issued_at?->toDateTimeImmutable(),   // Carbon -> DateTimeImmutable en la frontera
            currency: $m->currency,
            lines: $lines,
        );
    }
}

// ---- Modelos Eloquent: anémicos a propósito, solo esquema ------------------
//
// final class InvoiceModel extends Model {
//     protected $table = 'invoices';
//     public $incrementing = false; protected $keyType = 'string';
//     protected $guarded = [];
//     protected $casts = ['issued_at' => 'immutable_datetime', 'due_at' => 'immutable_datetime'];
//     public function lines(): HasMany { return $this->hasMany(InvoiceLineModel::class, 'invoice_id'); }
// }
// final class InvoiceLineModel extends Model {
//     protected $table = 'invoice_lines'; public $timestamps = false;
//     public $incrementing = false; protected $keyType = 'string'; protected $guarded = [];
// }
