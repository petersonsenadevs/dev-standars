# CRUD vs DDD lado a lado: emitir una factura

## Índice
1. El requisito
2. Versión A: capas simples en Laravel
3. Versión B: DDD/hexagonal
4. Comparación: líneas, archivos, tests
5. Tres cambios futuros y su coste en cada versión
6. Cuándo gana cada uno
7. Camino intermedio

---

## 1. El requisito

"Emitir una factura en borrador: debe tener al menos una línea, todas en la misma moneda;
se le asigna el siguiente número correlativo de la serie A del año en curso; queda
inmutable; se envía el PDF por email al cliente. Si ya estaba emitida, error 409."

Mismo requisito, dos implementaciones. Ambas correctas hoy.

## 2. Versión A: capas simples en Laravel

```php
// app/Http/Controllers/InvoiceController.php
public function issue(Request $request, Invoice $invoice, IssueInvoiceAction $action): RedirectResponse
{
    $this->authorize('issue', $invoice);
    $action->execute($invoice);
    return redirect()->route('invoices.show', $invoice)->with('success', 'Factura emitida');
}
```

```php
// app/Actions/IssueInvoiceAction.php
final class IssueInvoiceAction
{
    public function execute(Invoice $invoice): void
    {
        if ($invoice->status !== 'draft') {
            throw new ConflictHttpException('Invoice already issued');
        }
        if ($invoice->lines()->count() === 0) {
            throw ValidationException::withMessages(['lines' => 'La factura no tiene líneas']);
        }
        if ($invoice->lines()->distinct('currency')->count('currency') > 1) {
            throw ValidationException::withMessages(['lines' => 'Monedas distintas']);
        }

        DB::transaction(function () use ($invoice) {
            $seq = InvoiceSequence::where('series', 'A')->where('year', now()->year)->lockForUpdate()->firstOrCreate([...]);
            $seq->increment('last');
            $invoice->update([
                'number' => sprintf('%d-A-%06d', now()->year, $seq->last),
                'status' => 'issued',
                'issued_at' => now(),
                'total_cents' => $invoice->lines()->sum(DB::raw('unit_price_cents * quantity')),
            ]);
        });

        Mail::to($invoice->customer->email)->queue(new InvoiceIssuedMail($invoice));
    }
}
```

```php
// app/Models/Invoice.php — Eloquent normal; sin lógica salvo relaciones y casts
// tests/Feature/IssueInvoiceTest.php — RefreshDatabase, factories, POST y asserts en BD
```

Inventario: 3 archivos tocados (controlador, action, modelo), 1 migración, 1 test Feature con
4 casos (ok, sin líneas, ya emitida, monedas distintas). Unas 70 líneas de producción.

## 3. Versión B: DDD/hexagonal

Código completo en `templates/laravel/`. Piezas:

```php
// src/Invoicing/Domain/Model/Invoice.php — la regla vive aquí
public function issue(InvoiceNumber $number, DateTimeImmutable $now): void
{
    if ($this->status !== InvoiceStatus::Draft) throw InvoiceCannotBeIssued::alreadyIssued($this->id);
    if ($this->lines === []) throw InvoiceCannotBeIssued::withoutLines($this->id);
    $this->status = InvoiceStatus::Issued; $this->number = $number; $this->issuedAt = $now;
    $this->record(new InvoiceIssued($this->id->value, $this->customerId->value, $number->value, $this->total(), $now));
}
// addLine() ya rechaza otra moneda: la invariante se cumple siempre, no solo al emitir.
```

```php
// src/Invoicing/Application/IssueInvoice/IssueInvoiceHandler.php — orquesta
$invoice = $this->invoices->ofId($id) ?? throw InvoiceNotFound::withId($id);
$number = DB::transaction(function () use ($invoice, $now) {
    $number = $this->sequences->next(Series::standard(), $now);
    $invoice->issue($number, $now);
    $this->invoices->save($invoice);
    return $number;
});
$this->events->publish(...$invoice->pullEvents());
```

```php
// src/Invoicing/Infrastructure/Listeners/SendInvoicePdfListener.php (ShouldQueue, afterCommit)
public function handle(InvoiceIssued $event): void { /* read model + Mail */ }
// src/Invoicing/Infrastructure/Http/IssueInvoiceController.php — 5 líneas, ver overview.md §6
```

Inventario: agregado, 2 entidades/VO extra (`InvoiceLine`, `Money`, `InvoiceNumber`,
`InvoiceId`), enum, 2 excepciones, evento, 2 interfaces de repositorio, 2 puertos, command,
handler, repositorio Eloquent + mapper, listener, controlador, provider. Unos 15 archivos y
~350 líneas de producción, la mitad de ellas VO y mapeo.

## 4. Comparación: líneas, archivos, tests

| Métrica | A: capas simples | B: DDD/hexagonal |
|---|---|---|
| Archivos de producción | 3 (+1 mail) | ~15 |
| Líneas de producción | ~70 | ~350 |
| Tests | 4 Feature (BD, ~1 s cada uno) | 7 unit dominio (ms) + 3 unit handler con fakes (ms) + 2 integración repo + 1 Feature |
| Tiempo de la suite del módulo | ~5 s | ~2 s (solo 3 tocan BD) |
| Dónde leer "qué puede hacer una factura" | en la action y en otras actions | en `Invoice.php` |
| Regla "misma moneda" | se comprueba al emitir | se garantiza al añadir línea |
| Emisión concurrente | `lockForUpdate` en la action | `lockForUpdate` en el repositorio de secuencia |
| Email si falla el commit | `queue` tras la transacción: correcto en A también | evento tras commit |
| Tiempo de la primera entrega | medio día | 1-2 días |

Honestidad: la versión A hoy es más rápida de escribir y de leer para quien conoce
Laravel. La B tiene más piezas y todas tienen que estar bien nombradas para que compense.

## 5. Tres cambios futuros y su coste en cada versión

**Cambio 1: anular con rectificativa (nueva regla: no se anula un borrador; la
rectificativa nace emitida con serie R y líneas negadas).**
- A: nueva `CancelInvoiceAction` que repite las comprobaciones de estado, copia la lógica
  de numeración (ahora con serie R) y crea la rectificativa con `Invoice::create([...])`
  campo a campo. La lógica de "número" existe en dos sitios. Test Feature nuevo con BD.
- B: `Invoice::cancel()` devuelve la rectificativa; `sequences->next(Series::rectifying())`
  ya existe. Handler de 15 líneas. Tests de dominio sin BD.

**Cambio 2: cobros parciales y estado `PartiallyPaid`.**
- A: nueva action con `if` sobre `status`, `sum` de pagos vía query, `update`. Las
  transiciones válidas quedan repartidas en tres actions; nadie garantiza que
  `IssueInvoiceAction` no rompa un `PartiallyPaid`.
- B: `registerPayment()` en el agregado, `outstanding()` calculado en memoria; las
  transiciones están en un archivo y el enum de estados es exhaustivo en los `match`.

**Cambio 3: emitir desde un job nocturno y desde una API externa, además del botón.**
- A: extraer la action ya ayuda; pero `now()` y `Mail::` dentro de la action hacen que el
  job de "emitir con fecha del día anterior" necesite parches (`Carbon::setTestNow`).
- B: `Clock` inyectado; el job y el controlador de API construyen el mismo command.

Coste acumulado tras los tres cambios: A crece con lógica duplicada y tests lentos; B crece
añadiendo métodos al agregado y handlers cortos. El punto de cruce suele llegar con el
segundo cambio de reglas, no con el primero.

## 6. Cuándo gana cada uno

| Gana A (capas simples) | Gana B (DDD/hexagonal) |
|---|---|
| Módulo de mantenimiento (maestros, ajustes, tablas de referencia) | Estados con transiciones y reglas que cambian |
| Un solo desarrollador que conoce Laravel, vida corta | Equipo > 2, vida > 1 año |
| Sin integraciones externas o solo lectura | Pasarelas, ERPs, otros contextos que aislar |
| Reglas = validación de formulario | Reglas = invariantes que se prueban sin BD |
| Prototipo para validar producto | Producto que ya duele (controladores largos, duplicación) |

Regla de `SKILL.md` §1: si no se cumplen 3 de 5 criterios, A. Decirlo explícitamente.

## 7. Camino intermedio

No es binario. Desde A se puede avanzar sin reescribir (ver
`references/checklists/migration-from-mvc.md`):

1. Mover las tres comprobaciones de la action a métodos del modelo Eloquent
   (`$invoice->issue($number)`) con excepciones tipadas. Ya hay un sitio donde leer reglas.
2. Introducir `Money` e `InvoiceNumber` como VO usados por el modelo.
3. Sustituir `now()` y `Mail::` por `Clock` y un evento de Laravel.
4. Cuando el módulo tenga un segundo agregado o una integración, extraer `src/Invoicing/`
   con repositorio e interfaz.

Cada paso deja el sistema funcionando y reduce el coste del siguiente cambio de reglas.
