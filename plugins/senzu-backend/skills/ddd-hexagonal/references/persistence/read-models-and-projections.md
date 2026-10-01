# Read models y proyecciones

## Índice

- [Alcance](#alcance)
- [Tres niveles de read model](#tres-niveles-de-read-model)
- [Cuándo dejar de consultar las tablas de escritura](#cuándo-dejar-de-consultar-las-tablas-de-escritura)
- [Tablas de lectura y vistas materializadas](#tablas-de-lectura-y-vistas-materializadas)
- [Proyectores por eventos](#proyectores-por-eventos)
- [Ejemplo Laravel](#ejemplo-laravel)
- [Ejemplo TypeScript](#ejemplo-typescript)
- [Ejemplo Python](#ejemplo-python)
- [Consistencia e idempotencia](#consistencia-e-idempotencia)
- [Reconstrucción](#reconstrucción)
- [Tests](#tests)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

## Alcance

Los overviews de cada stack muestran el nivel básico: un `Reader` que consulta las tablas de escritura
con el query builder ([`../stacks/laravel/overview.md`](../stacks/laravel/overview.md) §9,
[`../stacks/typescript/overview.md`](../stacks/typescript/overview.md) §10,
[`../stacks/python/overview.md`](../stacks/python/overview.md) §1). Este documento cubre el paso
siguiente: tablas de lectura propias alimentadas por eventos, su consistencia y su reconstrucción.

## Tres niveles de read model

| Nivel | Fuente | Frescura | Coste | Cuándo |
|---|---|---|---|---|
| 1. Query directa | tablas del agregado, `JOIN` | inmediata | cero | por defecto |
| 2. Columna desnormalizada | misma fila (`total_cents`) escrita por el repositorio | inmediata | mínimo | ordenar/filtrar por un cálculo del agregado |
| 3. Tabla de lectura / vista materializada | proyector por eventos o refresco periódico | eventual | tabla + proyector + rebuild | agregación cross-agregado, cross-contexto o coste de consulta alto |

El nivel 2 ya aparece en las plantillas (`total_cents` en `EloquentInvoiceRepository`,
`PrismaInvoiceRepository`, `sqlalchemy_invoice_repository.py`): el repositorio escribe un valor calculado
por el agregado y el reader lo lee. Es la solución más barata para el 80 % de listados.

## Cuándo dejar de consultar las tablas de escritura

Pasa al nivel 3 si se cumple alguna:

- La consulta une datos de **varios contextos** (facturas + nombre de cliente de CRM + estado de envío).
  Un `JOIN` entre contextos acopla esquemas que deben evolucionar por separado.
- La pantalla necesita **historial o agregación** que el agregado no guarda (facturación por mes, saldo
  acumulado, ranking).
- La consulta es **cara** y se ejecuta mucho más que la escritura (dashboard con `GROUP BY` sobre
  millones de filas).
- Hay **búsqueda** que la BD relacional hace mal (Elasticsearch, Meilisearch): el índice es una
  proyección.

Si ninguna se cumple, un reader con SQL y un índice adecuado gana: menos piezas, consistencia inmediata.

## Tablas de lectura y vistas materializadas

Dos formas de materializar:

- **Vista materializada** (`CREATE MATERIALIZED VIEW ... ; REFRESH MATERIALIZED VIEW CONCURRENTLY`):
  cero código de proyección, refresco periódico (cron cada N minutos) o disparado tras commits. Vale
  cuando la latencia de minutos es aceptable y la fuente está en la misma BD. Necesita índice único
  para `CONCURRENTLY`.
- **Tabla de lectura** escrita por un proyector: frescura de segundos, permite fuentes de varios
  contextos y BD distinta. Esquema plano, sin FK a tablas de escritura, una fila por elemento de la
  pantalla, columnas con el nombre que usa la UI.

```sql
CREATE TABLE customer_invoice_summary (
  customer_id     uuid PRIMARY KEY,
  customer_name   text NOT NULL,
  open_count      int  NOT NULL DEFAULT 0,
  open_total_cents bigint NOT NULL DEFAULT 0,
  last_issued_at  timestamptz,
  projected_at    timestamptz NOT NULL,
  last_event_id   uuid                          -- para idempotencia y diagnóstico
);
```

La tabla de lectura pertenece al contexto que la consulta, no al que emite los eventos: `Reporting` puede
proyectar eventos de `Invoicing` y `CRM` en su propia tabla.

## Proyectores por eventos

Un proyector es un adaptador driven: escucha eventos de dominio (o de integración) y escribe en la tabla
de lectura. No contiene reglas de negocio; solo traduce evento -> `UPSERT`. Se suscribe al mismo bus
que los listeners, pero se ejecuta **después del commit** del agregado y, salvo casos muy simples, en
cola.

Propiedades obligatorias:

1. **Idempotente**: procesar dos veces el mismo evento deja la tabla igual (`last_event_id`, o
   `UPSERT` con valores absolutos en vez de incrementos).
2. **Tolerante al orden**: si `InvoiceVoided` llega antes que `InvoiceIssued`, no corrompe la fila
   (comparar `occurred_at`, o releer el estado actual del agregado en vez de aplicar deltas).
3. **Reconstruible**: existe un comando que vacía la tabla y reproduce la fuente.

Dos estilos de proyector:

- **Delta**: aplica el evento (`open_total += total`). Rápido, frágil ante duplicados y desorden.
- **Reread**: el evento solo dice "cambió la factura X"; el proyector relee el estado actual (query a
  las tablas de escritura o al contexto emisor) y reescribe la fila. Más lento, siempre correcto,
  idempotente por construcción. Preferido salvo que el volumen lo impida.

## Ejemplo Laravel

```php
// src/Reporting/Infrastructure/Projection/CustomerInvoiceSummaryProjector.php
final class CustomerInvoiceSummaryProjector implements ShouldQueue
{
    public bool $afterCommit = true;
    public string $queue = 'projections';

    public function handle(InvoiceIssued|InvoiceVoided|InvoicePaid $event): void
    {
        // estilo reread: recalcula la fila desde las tablas de escritura
        $row = DB::table('invoices')
            ->selectRaw("customer_id, count(*) as open_count, coalesce(sum(total_cents), 0) as open_total_cents, max(issued_at) as last_issued_at")
            ->where('customer_id', $event->customerId)->where('status', 'issued')
            ->groupBy('customer_id')->first();

        DB::table('customer_invoice_summary')->upsert([[
            'customer_id' => $event->customerId,
            'customer_name' => DB::table('customers')->where('id', $event->customerId)->value('name'),
            'open_count' => $row?->open_count ?? 0,
            'open_total_cents' => $row?->open_total_cents ?? 0,
            'last_issued_at' => $row?->last_issued_at,
            'projected_at' => now(), 'last_event_id' => $event->eventId,
        ]], uniqueBy: ['customer_id']);
    }
}
// Registro: Event::listen([InvoiceIssued::class, InvoiceVoided::class, InvoicePaid::class], CustomerInvoiceSummaryProjector::class);
// Reader:   DbCustomerInvoiceSummaryReader::forCustomer() hace un SELECT plano sobre customer_invoice_summary.
```

`afterCommit = true` evita que el worker lea la factura antes de que exista. El proyector es un listener
delgado, mismas reglas que en [`eloquent-pitfalls.md`](eloquent-pitfalls.md) para eventos y colas.

## Ejemplo TypeScript

```ts
// modules/reporting/infrastructure/CustomerInvoiceSummaryProjector.ts
export class CustomerInvoiceSummaryProjector {
  constructor(private readonly db: Db) {}

  subscribe(bus: InProcessEventBus) {
    for (const name of ['InvoiceIssued', 'InvoiceVoided', 'InvoicePaid'] as const) bus.on(name, (e) => this.project(e.customerId, e.eventId));
  }

  async project(customerId: string, eventId: string): Promise<void> {
    const [agg] = await this.db.select({
        openCount: count(), openTotal: sql<number>`coalesce(sum(${invoices.totalCents}), 0)`, lastIssuedAt: max(invoices.issuedAt),
      }).from(invoices).where(and(eq(invoices.customerId, customerId), eq(invoices.status, 'issued')));
    await this.db.insert(customerInvoiceSummary)
      .values({ customerId, openCount: agg.openCount, openTotalCents: agg.openTotal, lastIssuedAt: agg.lastIssuedAt, projectedAt: new Date(), lastEventId: eventId })
      .onConflictDoUpdate({ target: customerInvoiceSummary.customerId, set: { openCount: agg.openCount, openTotalCents: agg.openTotal, lastIssuedAt: agg.lastIssuedAt, projectedAt: new Date(), lastEventId: eventId } });
  }
}
```

En serverless el bus en proceso no basta: el proyector consume la tabla `outbox` desde un cron o una
cola (Inngest, BullMQ) y llama a `project()`; ver [`prisma-drizzle.md`](prisma-drizzle.md) y el §9 del
overview TS.

## Ejemplo Python

```python
# reporting/infrastructure/projectors.py
class CustomerInvoiceSummaryProjector:
    def __init__(self, session_factory: sessionmaker[Session]) -> None: self._sf = session_factory

    def __call__(self, event: InvoiceIssued | InvoiceVoided | InvoicePaid) -> None:
        with self._sf() as s, s.begin():
            agg = s.execute(
                select(func.count(), func.coalesce(func.sum(InvoiceModel.total_cents), 0), func.max(InvoiceModel.issued_at))
                .where(InvoiceModel.customer_id == event.customer_id, InvoiceModel.status == "issued")
            ).one()
            stmt = pg_insert(customer_invoice_summary).values(
                customer_id=event.customer_id, open_count=agg[0], open_total_cents=agg[1],
                last_issued_at=agg[2], projected_at=datetime.now(UTC), last_event_id=event.event_id)
            s.execute(stmt.on_conflict_do_update(index_elements=["customer_id"], set_=dict(stmt.excluded)))

# wiring: bus.subscribe(InvoiceIssued, projector); en producción, el worker de outbox invoca el mismo callable
```

El proyector abre su **propia** sesión: nunca reutiliza la del caso de uso que emitió el evento
([`sqlalchemy.md`](sqlalchemy.md)).

## Consistencia e idempotencia

- **Eventual por diseño**: la UI puede leer la tabla antes de proyectar. Tras un command, o bien
  redirige a una pantalla que consulta las tablas de escritura (nivel 1), o muestra el resultado del
  command directamente, o espera con `projected_at >= command_at` (polling corto). No bloquees el
  command esperando al proyector.
- **Idempotencia**: `last_event_id` sirve para diagnóstico; la garantía real la da el estilo reread o un
  `UPSERT` con valores absolutos. Si usas deltas, guarda los ids procesados en una tabla
  `projection_processed_events (projection, event_id)` con `INSERT ... ON CONFLICT DO NOTHING` en la misma
  transacción que la escritura.
- **Orden**: colas con una partición por `customer_id` (o un worker por proyección) evitan carreras entre
  eventos del mismo cliente. Con varios workers, `SELECT ... FOR UPDATE` de la fila de resumen serializa.
- **Fallos**: reintentos con backoff; tras N fallos, dead letter y alerta. Un proyector que falla no debe
  revertir el command que emitió el evento (ya está confirmado).

## Reconstrucción

Todo read model de nivel 3 necesita un comando de rebuild desde el día uno: `artisan reporting:rebuild
customer-summary`, `pnpm reporting rebuild`, `python -m reporting.rebuild`. Pasos:

1. Crear la tabla nueva (`customer_invoice_summary_v2`) o truncar en mantenimiento.
2. Recorrer la fuente por lotes (`SELECT DISTINCT customer_id ... ORDER BY id LIMIT 1000 OFFSET`) y
   llamar al mismo `project()` que usa el proyector en vivo. Nada de lógica duplicada.
3. Mientras dura, los eventos nuevos siguen proyectando sobre la tabla nueva (estilo reread lo tolera).
4. Cambiar el reader a la tabla nueva (feature flag o `RENAME`), borrar la antigua.

Con event sourcing la fuente es el event store; con estado persistido (este documento) la fuente son las
tablas de escritura, así que la reconstrucción es siempre posible y los eventos pasados no hacen falta.

## Tests

- **Proyector**: test de integración contra BD real; dado un estado de las tablas de escritura y un
  evento, la fila de lectura queda con valores esperados; aplicar el evento dos veces deja la misma fila.
- **Reader**: test de integración con filas insertadas directamente en la tabla de lectura.
- **Rebuild**: un test que inserta tres facturas, ejecuta el rebuild y compara con el resultado del
  proyector en vivo.
- No hay tests unitarios de proyector porque no hay lógica: si aparece un `if` de negocio en el
  proyector, pertenece al agregado o a una función pura del contexto lector.

## Errores frecuentes

- Poner reglas en el proyector (`if total > 10000 then vip = true`): es lógica de dominio del contexto
  lector; extrae una función pura y testéala.
- Proyectar dentro de la transacción del command: acopla latencia y fallos del read model al caso de uso.
- Deltas sin idempotencia: un reintento de cola duplica el importe.
- Tabla de lectura con FK a las tablas de escritura: el rebuild y el expand/contract se vuelven imposibles.
- Read model que devuelve entidades o modelos ORM: los readers devuelven DTOs planos.
- Olvidar el rebuild y descubrirlo cuando hay que corregir un bug histórico.
- Vista materializada con `REFRESH` sin `CONCURRENTLY` en producción: bloquea lectores durante el refresco.
- Un proyector por contexto emisor en vez de por pantalla: la tabla acaba sirviendo a nadie.

## Checklist

- [ ] Nivel elegido justificado; el nivel 3 solo con cross-contexto, agregación o coste demostrado.
- [ ] Tabla de lectura plana, sin FK a escritura, con `projected_at` y `last_event_id`.
- [ ] Proyector tras commit, en cola, idempotente (reread o tabla de eventos procesados).
- [ ] Sesión/transacción propia del proyector; nunca la del command.
- [ ] Comando de rebuild que reutiliza `project()` y funciona con el sistema en marcha.
- [ ] UI diseñada para consistencia eventual (redirección a nivel 1 o polling explícito).
- [ ] Tests de integración: proyección, idempotencia, rebuild.
- [ ] Reader devuelve DTOs; sin lógica de negocio en proyector ni reader.
