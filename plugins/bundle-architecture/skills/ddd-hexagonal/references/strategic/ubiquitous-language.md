# Lenguaje ubicuo: del glosario al código

## Índice

- [Qué es y por qué un glosario por contexto](#qué-es-y-por-qué-un-glosario-por-contexto)
- [Cómo construir el glosario](#cómo-construir-el-glosario)
- [Reglas de nombrado en código](#reglas-de-nombrado-en-código)
- [Cómo se refleja en cada artefacto](#cómo-se-refleja-en-cada-artefacto)
- [Señales de deriva](#señales-de-deriva)
- [Plantilla de glosario](#plantilla-de-glosario)
- [Ejemplo completo: contexto Booking](#ejemplo-completo-contexto-booking)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Amplía [overview](overview.md) §3. El glosario es la evidencia de que un
[bounded context](bounded-contexts.md) existe: un contexto sin glosario es una carpeta.

## Qué es y por qué un glosario por contexto

El lenguaje ubicuo es el vocabulario que negocio y desarrollo usan **sin traducir** en
reuniones, tickets, tests, código y logs. "Ubicuo" significa que el mismo término aparece
en todos esos sitios con el mismo significado.

Es por contexto porque el significado cambia de frontera en frontera: "cancelar" en
Booking libera la plaza; en Billing genera un abono. Un glosario global obliga a
definiciones vagas ("cancelar: dejar sin efecto") que no sirven para escribir código.

Beneficio concreto: cuando el glosario es bueno, el nombre del caso de uso, del método
del agregado y del evento se deducen sin discusión (`cancel` -> `CancelBooking` ->
`Booking::cancel()` -> `BookingCancelled`).

## Cómo construir el glosario

1. **Fuente**: eventos y comandos del [event storming](event-storming.md), tickets
   recientes, conversaciones con la persona de negocio. No inventar términos "más
   técnicos".
2. **Una frase por término**: si necesitas dos, o son dos términos o falta decidir.
3. **Sinónimos prohibidos**: el paso más valioso. "No llamar X" evita que el código y las
   reuniones se bifurquen.
4. **Nombre en código**: el término en inglés que se usará tal cual en clases, métodos,
   eventos y tablas.
5. **Estados y transiciones**: para términos con ciclo de vida, la máquina de estados en
   una línea.
6. **Reglas ligadas**: invariantes que el término implica ("una reserva confirmada tiene
   pago autorizado").

Cadencia: se revisa cuando un PR introduce un término nuevo o cuando alguien en una
reunión dice "¿a qué te refieres con...?". Vive en el repo, junto al módulo.

## Reglas de nombrado en código

| Artefacto | Regla | Ejemplo |
|---|---|---|
| Agregado / entidad | sustantivo del glosario, singular | `Booking`, `Invoice`, `Sku` |
| Value object | sustantivo o cualidad, sin sufijo `VO` | `Money`, `DateRange`, `GuestCount` |
| Método de agregado | verbo del glosario en imperativo, con intención | `confirm()`, `cancel(reason)`, `reschedule(range)` |
| Caso de uso / command | verbo + sustantivo | `ConfirmBooking`, `IssueInvoice` |
| Query | verbo de lectura + qué | `ListUpcomingBookings`, `GetInvoiceSummary` |
| Evento de dominio | sustantivo + participio pasado | `BookingConfirmed`, `InvoiceIssued` |
| Excepción de dominio | regla violada, legible | `BookingCannotBeCancelled`, `InsufficientStock` |
| Estado (enum) | valor del glosario | `BookingStatus::Confirmed` |
| Repositorio | agregado + `Repository`; métodos de intención | `BookingRepository::ofId`, `::overlapping(range)` |
| Política / handler | `When<Evento>Then<Acción>` o verbo | `ReserveStockOnOrderConfirmed` |
| Tabla / columna | mismo término, snake_case | `bookings.confirmed_at` |

Prohibido en dominio: `Manager`, `Helper`, `Processor`, `Data`, `Info`, `Util`, verbos
genéricos (`update`, `set`, `handle`, `process`) cuando existe un verbo del negocio.

```php
// Mal: vocabulario técnico, intención oculta
$booking->setStatus(BookingStatus::Cancelled);
$booking->setCancelledAt($now);
$bookingManager->process($booking);

// Bien: una frase del glosario
$booking->cancel(CancellationReason::GuestRequest, $now); // emite BookingCancelled
```

```ts
// Mal: el nombre describe la implementación
class BookingDataUpdater { updateFields(id: string, fields: Partial<BookingRow>) {} }

// Bien: el nombre describe la intención de negocio
class RescheduleBooking { execute(cmd: { bookingId: string; newRange: DateRange }) {} }
```

## Cómo se refleja en cada artefacto

- **Tests de dominio**: el nombre del test es una frase del glosario.
  `test_confirmed_booking_cannot_be_rescheduled_within_24h` se lee sin abrir el código.
- **Commits y PRs**: título con el verbo de negocio ("Permitir reprogramar reservas
  confirmadas"), no con el artefacto ("Añadir método en Booking").
- **Logs y métricas**: `booking.confirmed`, `invoice.issued`; nunca `record_updated`.
- **API pública**: rutas y payloads con los mismos términos; `POST /bookings/{id}/confirm`
  y no `PATCH /bookings/{id} { status: 2 }`.
- **UI**: el texto visible puede estar en español y adaptado al usuario, pero el
  identificador de la acción (`data-action="confirm-booking"`) usa el glosario.
- **Tickets**: la descripción usa los términos; si un ticket necesita definir un término
  nuevo, se actualiza el glosario en el mismo PR.

## Señales de deriva

| Señal | Qué indica | Acción |
|---|---|---|
| Un término con dos definiciones "según el caso" | dos contextos mezclados | separar contextos o renombrar uno de los dos |
| Traducción mental al leer código ("`close` es emitir") | el código no siguió al glosario | renombrar el código (deprecación corta si es público) |
| Sinónimos coexistiendo (`client`, `customer`, `account`) | nadie decidió | elegir uno, prohibir el resto en el glosario, renombrar |
| Métodos `update*`/`set*` en agregados | intención perdida | sustituir por verbos del negocio |
| Negocio pide "el estado X" y el código no lo tiene | modelo obsoleto | añadir al glosario y al enum, o corregir la expectativa |
| Tests que necesitan comentarios para entenderse | los nombres no cuentan la historia | renombrar tests y métodos |
| Términos en inglés e idioma local mezclados en clases | falta la columna "código" del glosario | fijar el nombre en código y usarlo siempre |

Automatizable: un test de arquitectura que falle si en `Domain/` aparecen `Manager`,
`Helper`, `setStatus` o palabras de la lista de sinónimos prohibidos.

```php
// tests/Architecture/VocabularyTest.php (Pest arch)
arch('domain uses business verbs')
    ->expect('App\Booking\Domain')
    ->not->toHaveMethod('setStatus')
    ->and('App\Booking\Domain')
    ->classes()->not->toHaveSuffix('Manager')->not->toHaveSuffix('Helper');
```

## Plantilla de glosario

```markdown
# Glosario: <Contexto>

| Término (ES) | Código (EN) | Definición (una frase) | No llamar | Estados / reglas |
|---|---|---|---|---|
| Reserva | `Booking` | compromiso de un huésped sobre un alojamiento en un rango de fechas | pedido, booking request | `Pending -> Confirmed -> (Cancelled \| Completed)` |
| Confirmar | `Booking::confirm`, `BookingConfirmed` | pasar a Confirmed tras autorizar el pago | aprobar, validar | requiere `PaymentAuthorized`; solo desde Pending |

## Términos deliberadamente fuera de este contexto
- "Factura": pertenece a Billing. Aquí solo existe `bookingId` referenciado por Billing.

## Pendientes de definir
- "Reserva parcial": negocio lo usa, no está claro si es un estado o un tipo (decidir antes del sprint 14).
```

## Ejemplo completo: contexto Booking

| Término | Código | Definición | No llamar | Estados / reglas |
|---|---|---|---|---|
| Reserva | `Booking` | compromiso de un huésped sobre un alojamiento en un rango de fechas | pedido, solicitud | `Pending -> Confirmed -> Cancelled \| Completed` |
| Alojamiento | `Listing` (id) | unidad reservable; el detalle vive en Catalog | propiedad, piso | referencia por `ListingId` |
| Huésped | `Guest` (id) | persona que reserva | cliente, usuario | referencia por `GuestId` |
| Estancia | `StayPeriod` (VO) | rango de noches, check-in inclusivo, check-out exclusivo | fechas | mínimo 1 noche; no solapa con otra Confirmed del mismo Listing |
| Confirmar | `confirm()` / `BookingConfirmed` | pasar a Confirmed tras autorizar el pago | aprobar | solo desde Pending |
| Cancelar | `cancel(reason)` / `BookingCancelled` | dejar sin efecto una Pending o Confirmed | anular, borrar | Confirmed cancelable hasta 24 h antes del check-in |
| Reprogramar | `reschedule(period)` / `BookingRescheduled` | cambiar la estancia manteniendo la reserva | modificar, editar | mismas reglas de solape; no en Completed |
| Solape | `OverlappingStay` (excepción) | dos reservas Confirmed sobre el mismo Listing con noches en común | conflicto | invariante del contexto, verificado vía `BookingRepository::overlapping` |

Derivación directa al código:

```ts
// booking/domain/Booking.ts
export class Booking {
  confirm(paymentAuthorizedAt: Date): void { /* Pending -> Confirmed, registra BookingConfirmed */ }
  cancel(reason: CancellationReason, now: Date): void { /* regla 24 h, registra BookingCancelled */ }
  reschedule(period: StayPeriod): void { /* no en Completed, registra BookingRescheduled */ }
}
// booking/application/ConfirmBooking.ts, CancelBooking.ts, RescheduleBooking.ts
// booking/domain/events/BookingConfirmed.ts, BookingCancelled.ts, BookingRescheduled.ts
```

## Errores frecuentes

- **Glosario global** con definiciones vagas para que encajen en todos los contextos.
- **Glosario en un wiki externo** que no se actualiza con el código; debe vivir en el repo.
- **Términos inventados por desarrollo** ("`BookingProcessor`") que negocio no reconoce.
- **Traducir a medias**: `ReservaRepository`, `confirmarBooking`. Fijar idioma de código
  (inglés) y de glosario (español + columna de código).
- **Sinónimos tolerados** "porque todos entienden": cada sinónimo es una futura
  discusión de diseño.
- **Setters y `update`** que borran el verbo del negocio y con él la regla asociada.
- **Definir sin prohibir**: la columna "No llamar" es la que evita la deriva.

## Checklist

- [ ] Cada contexto tiene `glossary.md` (o sección en su ficha) en el repositorio.
- [ ] Cada término: definición de una frase, nombre en código, sinónimos prohibidos.
- [ ] Términos con ciclo de vida tienen estados y transiciones en el glosario.
- [ ] Clases, métodos, eventos, tablas y rutas usan los nombres de la columna "Código".
- [ ] No hay `Manager/Helper/Processor/Util` ni `set*/update*` en `Domain/`.
- [ ] Los tests de dominio se leen como frases del glosario.
- [ ] Un PR que introduce un término nuevo actualiza el glosario en el mismo PR.
- [ ] Existe un test de arquitectura o linter para sufijos y verbos prohibidos.
