# Glosario de lenguaje ubicuo: plantilla

Copiar la sección "Plantilla" a `docs/glossary/<contexto>.md`. Un glosario **por bounded
context**: el mismo término puede tener definiciones distintas en dos contextos y ambas
son correctas dentro de su frontera. El glosario es la fuente de los nombres del código;
si el código usa un nombre que no está aquí, o se añade al glosario o se renombra el código.

Reglas de mantenimiento:
- Cada término tiene una sola definición, en una o dos frases, escrita como la diría el
  negocio (no "tabla que almacena...").
- La columna "Sinónimos prohibidos" evita que aparezcan en código, UI, tickets o
  conversaciones. Si el negocio usa dos palabras, se elige una y la otra se prohíbe.
- "En código" apunta al identificador real (clase, método, evento) en inglés.
- Se revisa en cada PR que introduce un concepto nuevo (`code-review-checklist.md` §3).

---

## Plantilla

```markdown
# Glosario: <Contexto>

- **Contexto**: <nombre> — ficha: `docs/contexts/<contexto>.md`
- **Idioma de negocio**: español — **Idioma de código**: inglés
- **Última revisión**: AAAA-MM-DD

## Términos

| Término (ES) | Término (EN) | Definición | Sinónimos prohibidos | En código | Ejemplo |
|---|---|---|---|---|---|
| <término> | <term> | <definición de negocio> | <palabras que no se usan> | `<Clase/método/evento>` | `<fragmento breve>` |

## Estados y transiciones

| Estado | Significado | Transiciones válidas (método) |
|---|---|---|
| <Estado> | <qué significa para el negocio> | -> <Estado> (`método()`) |

## Reglas nombradas

| Regla | Enunciado | Dónde vive | Excepción/Result |
|---|---|---|---|
| <nombre corto> | <frase de negocio> | `<Agregado::método>` | `<Excepción::motivo>` |

## Términos de otros contextos que aparecen aquí

| Término | Contexto dueño | Cómo lo vemos aquí |
|---|---|---|
| <término> | <contexto> | <id + snapshot / VO propio / evento consumido> |

## Pendientes de definir

- <término usado en tickets o conversaciones sin definición acordada>
```

---

## Ejemplo relleno: Facturación

```markdown
# Glosario: Facturación

- **Contexto**: Facturación (Invoicing) — ficha: `docs/contexts/invoicing.md`
- **Idioma de negocio**: español — **Idioma de código**: inglés
- **Última revisión**: 2026-03-12

## Términos

| Término (ES) | Término (EN) | Definición | Sinónimos prohibidos | En código | Ejemplo |
|---|---|---|---|---|---|
| Factura | Invoice | Documento fiscal con líneas emitido a un cliente por una serie | pedido, recibo, albarán | `Invoice` | `Invoice::draftFor($id, $customerId)` |
| Borrador | Draft | Factura editable, sin número ni fecha de emisión | pendiente, provisional | `InvoiceStatus::Draft` | `$invoice->addLine($line)` |
| Emitir | Issue | Asignar número y fecha a un borrador; desde ese momento es inmutable | confirmar, publicar, finalizar | `Invoice::issue()` / `InvoiceIssued` | `$invoice->issue($number, $now)` |
| Línea | Invoice line | Concepto facturado con descripción, precio unitario y cantidad | ítem, detalle, concepto | `InvoiceLine` | `new InvoiceLine($id, 'Consulting', Money::eur(10000), 2)` |
| Importe | Money | Cantidad en céntimos con moneda; no se mezclan monedas | precio (ambiguo), cantidad | `Money` | `Money::eur(2550)->add(Money::eur(100))` |
| Número de factura | Invoice number | Correlativo `AAAA-S-NNNNNN` único por serie y año | id, referencia, código | `InvoiceNumber` | `new InvoiceNumber('2026-A-000123')` |
| Serie | Series | Prefijo de numeración: A (ordinaria), R (rectificativa) | tipo, categoría | `Series` | `Series::rectifying()` |
| Cobro | Payment | Dinero recibido contra una factura emitida, total o parcial | pago (es el contexto Pagos), ingreso | `Invoice::registerPayment()` / `PaymentRegistered` | `$invoice->registerPayment(Money::eur(500), $now, 'pi_123')` |
| Pendiente | Outstanding | Total menos cobros registrados | saldo, deuda | `Invoice::outstanding()` | `$invoice->outstanding()->isZero()` |
| Cobrada | Paid | Factura con pendiente cero | pagada, liquidada | `InvoiceStatus::Paid` / `InvoicePaid` | |
| Anular | Cancel | Invalidar una factura emitida generando una rectificativa | borrar, eliminar, revertir | `Invoice::cancel()` / `InvoiceCancelled` | `$creditNote = $invoice->cancel($newId, $now)` |
| Rectificativa | Credit note | Factura de serie R con líneas negadas que anula otra | abono, nota de crédito, factura negativa | `Invoice::creditNoteFor()` | |
| Cliente (visto desde aquí) | Customer | Destinatario de la factura; solo id y datos fiscales en el momento de emitir | usuario, cuenta | `CustomerId`, `BillingSnapshot` | `CustomerId::of('cust-1')` |

## Estados y transiciones

| Estado | Significado | Transiciones válidas (método) |
|---|---|---|
| Draft | editable, sin número | -> Issued (`issue`) |
| Issued | emitida, inmutable, sin cobros | -> PartiallyPaid / Paid (`registerPayment`), -> Cancelled (`cancel`) |
| PartiallyPaid | con cobros, pendiente > 0 | -> Paid (`registerPayment`), -> Cancelled (`cancel`) |
| Paid | pendiente = 0 | -> Cancelled (`cancel`) |
| Cancelled | anulada con rectificativa | terminal |

## Reglas nombradas

| Regla | Enunciado | Dónde vive | Excepción |
|---|---|---|---|
| Sin líneas no hay factura | No se emite un borrador sin líneas | `Invoice::issue` | `InvoiceCannotBeIssued::withoutLines` |
| Una moneda | Todas las líneas en la moneda de la factura | `Invoice::addLine` | `InvalidArgumentException` (error de programación) |
| Emitida es inmutable | No se añaden ni quitan líneas fuera de Draft | `Invoice::addLine/removeLine` | `InvoiceCannotBeIssued::locked` |
| Cobro acotado | Un cobro no supera el pendiente | `Invoice::registerPayment` | `PaymentNotAllowed::exceedsOutstanding` |
| Cobro único | Una referencia de cobro no se registra dos veces | `Invoice::registerPayment` | `PaymentNotAllowed::duplicateReference` |
| Borrador no se anula | Un borrador se descarta, no se anula | `Invoice::cancel` | `InvoiceCannotBeCancelled::isDraft` |
| Numeración correlativa | Números únicos y sin huecos por (serie, año) | `InvoiceSequence::next` (lock) | — |

## Términos de otros contextos que aparecen aquí

| Término | Contexto dueño | Cómo lo vemos aquí |
|---|---|---|
| Cliente | Clientes | `CustomerId` + `BillingSnapshot` tomado al emitir |
| Pago / intento de pago | Pagos (Stripe) | `PaymentReceipt` devuelto por el puerto `PaymentGateway` |
| Asiento contable | Contabilidad | no lo vemos; Contabilidad consume `InvoiceIssued`/`InvoicePaid` |

## Pendientes de definir

- "Vencimiento": ¿fecha fija a 30 días o configurable por cliente? Afecta a `overdueAt`.
- "Proforma": ¿es un Draft con PDF o un concepto aparte?
```

Recorrido completo del ejemplo: `references/examples/walkthrough-invoicing.md`.
Ficha del contexto: `templates/docs/context-sheet.md`.
