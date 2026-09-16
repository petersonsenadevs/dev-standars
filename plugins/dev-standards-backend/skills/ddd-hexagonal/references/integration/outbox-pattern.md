# Patrón Outbox

## Índice

- [El problema: dual write](#el-problema-dual-write)
- [La solución en tres pasos](#la-solución-en-tres-pasos)
- [Tabla outbox](#tabla-outbox)
- [Escritura en la misma transacción](#escritura-en-la-misma-transacción)
- [Publicación por worker](#publicación-por-worker)
- [Idempotencia en el consumidor](#idempotencia-en-el-consumidor)
- [Ejemplo Laravel](#ejemplo-laravel)
- [Ejemplo TypeScript](#ejemplo-typescript)
- [Operación: limpieza, orden, monitorización](#operación-limpieza-orden-monitorización)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../application/transactions-unit-of-work.md`, `idempotency.md`,
`messaging-and-queues.md`, `event-versioning.md`.

## El problema: dual write

```
BEGIN; UPDATE invoices ...; COMMIT;     -- (1) ok
queue.publish(InvoiceIssued)            -- (2) el proceso muere, la red falla, Redis no responde
```

Si (2) falla, la factura está emitida pero nadie se entera. Si inviertes el orden y (1)
falla, se notifica algo que no ocurrió. No hay orden correcto: son dos sistemas sin
transacción común. `DB::afterCommit` y `Event::dispatch` tras el commit tienen la misma
ventana. Para efectos dentro del mismo proceso y mismo módulo es tolerable; para integrar
contextos, servicios o terceros, no.

## La solución en tres pasos

1. El caso de uso escribe el evento en una tabla `outbox` **en la misma transacción** que
   el cambio de estado. Una sola BD, una sola transacción: atómico.
2. Un **worker** (relay) lee la outbox, publica cada mensaje en la cola/bus y lo marca
   como publicado.
3. Los consumidores son **idempotentes**, porque el worker puede publicar dos veces si
   muere entre publicar y marcar.

Garantía resultante: at-least-once, con orden por agregado si el worker respeta el orden
de inserción.

## Tabla outbox

```sql
CREATE TABLE outbox_messages (
  id            UUID PRIMARY KEY,                 -- id del mensaje (uuid v7: ordenable)
  aggregate_type VARCHAR(100) NOT NULL,           -- 'Invoice'
  aggregate_id  VARCHAR(64) NOT NULL,
  event_type    VARCHAR(150) NOT NULL,            -- 'invoicing.invoice_issued'
  event_version SMALLINT NOT NULL DEFAULT 1,
  payload       JSONB NOT NULL,
  headers       JSONB NOT NULL DEFAULT '{}',      -- correlation_id, causation_id, actor
  occurred_at   TIMESTAMPTZ NOT NULL,
  published_at  TIMESTAMPTZ NULL,
  attempts      SMALLINT NOT NULL DEFAULT 0,
  last_error    TEXT NULL
);
CREATE INDEX outbox_pending_idx ON outbox_messages (occurred_at) WHERE published_at IS NULL;
```

Una tabla global (`Shared`) o una por módulo; global es más simple para el worker.
`payload` es el **contrato público** del evento (`event-versioning.md`), no la
serialización de la clase PHP/TS.

## Escritura en la misma transacción

El repositorio o el UoW, al guardar el agregado, vuelca `pullEvents()` en la outbox.
Opciones:

- **En el repositorio** (`save()` guarda agregado + outbox): transparente para el handler;
  acopla el repositorio a la outbox. Aceptable y habitual.
- **En el UoW / decorador transaccional**: recoge eventos de los agregados tocados y los
  inserta antes del commit. Más limpio; requiere que el UoW conozca los agregados.
- **Explícito en el handler** (`$this->outbox->add(...)` dentro de `DB::transaction`):
  visible, algo repetitivo.

Lo que no vale: insertar en la outbox fuera de la transacción del agregado.

## Publicación por worker

Bucle del relay:

```
loop:
  BEGIN
  rows = SELECT ... FROM outbox_messages WHERE published_at IS NULL
         ORDER BY occurred_at LIMIT 100 FOR UPDATE SKIP LOCKED
  for row in rows: bus.publish(row)  -> si ok: UPDATE published_at = now()
                                       si falla: attempts++, last_error, seguir
  COMMIT
  sleep(200ms) si no hubo filas
```

- `FOR UPDATE SKIP LOCKED` permite varios workers sin duplicar (PostgreSQL, MySQL 8).
- Orden por agregado: si necesitas orden estricto, un worker por partición
  (`hash(aggregate_id) % N`) o publica a una cola con clave de partición.
- Alternativa sin polling: CDC (Debezium) leyendo el WAL. Solo con volumen alto.
- Backoff por mensaje tras N intentos: márcalo como `dead` y alerta; no bloquees la cola
  por un mensaje envenenado.

## Idempotencia en el consumidor

El consumidor guarda el `message_id` procesado en una tabla `processed_messages
(consumer, message_id, processed_at)` **en la misma transacción** que su efecto. Si el
insert falla por clave duplicada, descarta el mensaje. Detalles en `idempotency.md`.

## Ejemplo Laravel

```php
// Shared/Infrastructure/Outbox/OutboxRepository.php (adaptador del puerto EventBus "transaccional")
final class OutboxEventBus implements EventBus
{
    public function publish(DomainEvent ...$events): void
    {
        DB::table('outbox_messages')->insert(array_map(fn (DomainEvent $e) => [
            'id' => Str::uuid7(), 'aggregate_type' => $e->aggregateType(), 'aggregate_id' => $e->aggregateId(),
            'event_type' => $e::NAME, 'event_version' => $e::VERSION,
            'payload' => json_encode($e->toPayload()), 'headers' => json_encode(Correlation::headers()),
            'occurred_at' => $e->occurredAt(),
        ], $events));
    }
}
// Handler: DB::transaction(function () { $this->invoices->save($invoice); $this->events->publish(...$invoice->pullEvents()); });
```

```php
// Shared/Infrastructure/Outbox/RelayOutboxCommand.php  (php artisan outbox:relay, supervisado)
public function handle(): int
{
    while (true) {
        $n = DB::transaction(function () {
            $rows = DB::table('outbox_messages')->whereNull('published_at')->orderBy('occurred_at')->limit(100)->lockForUpdate()->get();
            foreach ($rows as $row) {
                try {
                    Queue::connection('events')->pushRaw($row->payload, queue: $row->event_type);  // o Event::dispatch de un IntegrationEvent
                    DB::table('outbox_messages')->where('id', $row->id)->update(['published_at' => now()]);
                } catch (\Throwable $e) {
                    DB::table('outbox_messages')->where('id', $row->id)->increment('attempts', 1, ['last_error' => $e->getMessage()]);
                }
            }
            return $rows->count();
        });
        if ($n === 0) usleep(200_000);
    }
}
```

`lockForUpdate()` en Laravel no añade `SKIP LOCKED`; para varios workers usa
`->lock('for update skip locked')`. Supervisa el comando con Horizon/Supervisor como un
worker más. Alternativa: `php artisan schedule` cada minuto con `withoutOverlapping()` si
la latencia de un minuto es aceptable.

## Ejemplo TypeScript

```ts
// infrastructure/outbox/outboxEventBus.ts — se usa dentro de TransactionRunner
export const outboxEventBus = (ctx: TxContext): EventBus => ({
  publish: async (events) => {
    if (events.length === 0) return;
    await ctx.db.outboxMessage.createMany({ data: events.map((e) => ({
      id: uuidv7(), aggregateType: e.aggregateType, aggregateId: e.aggregateId,
      eventType: e.type, eventVersion: e.version, payload: e.payload, headers: currentHeaders(), occurredAt: e.occurredAt,
    })) });
  },
});

// worker/outboxRelay.ts
export async function relayOnce(db: PrismaClient, queue: Queue): Promise<number> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<OutboxRow[]>`
      SELECT * FROM outbox_messages WHERE published_at IS NULL ORDER BY occurred_at LIMIT 100 FOR UPDATE SKIP LOCKED`;
    for (const row of rows) {
      try {
        await queue.add(row.event_type, row.payload, { jobId: row.id });   // jobId = dedupe en BullMQ
        await tx.outboxMessage.update({ where: { id: row.id }, data: { publishedAt: new Date() } });
      } catch (e) {
        await tx.outboxMessage.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, lastError: String(e) } });
      }
    }
    return rows.length;
  });
}
```

`jobId` en BullMQ deduplica en el broker si el relay reintenta. Python: mismo bucle con
`with_for_update(skip_locked=True)` en SQLAlchemy y `arq`/Celery como destino.

## Operación: limpieza, orden, monitorización

- **Limpieza**: borra o archiva `published_at < now() - 7 days` con un job nocturno.
  Conservar un tiempo permite reconstruir proyecciones y depurar.
- **Métricas**: filas pendientes (gauge), edad del mensaje pendiente más antiguo (alerta
  si > 1 min), mensajes en `attempts >= N`.
- **Orden**: garantizado por `occurred_at`/uuid v7 dentro de un worker; entre workers y
  colas, solo por partición. Diseña consumidores tolerantes a desorden.
- **Tamaño del payload**: pequeño (ids, importes, fechas). Si el consumidor necesita más,
  que consulte.
- **Reprocesar**: `UPDATE ... SET published_at = NULL WHERE id IN (...)` es la herramienta
  de replay; documéntala.

## Errores frecuentes

- Insertar en outbox fuera de la transacción del agregado: vuelves al dual write.
- Serializar la clase del evento (`serialize($event)`) como payload: acopla consumidores
  al código; usa un payload versionado.
- Worker sin `SKIP LOCKED` con varias réplicas: duplicados o bloqueos.
- Consumidores no idempotentes "porque la outbox garantiza una vez": garantiza al menos una.
- Mensaje envenenado que bloquea el relay indefinidamente sin `attempts` ni dead-letter.
- No limpiar la tabla: crece hasta que el índice parcial deja de ayudar.
- Usar outbox para todo evento interno del mismo módulo: para listeners in-process
  síncronos y sin garantía, `afterCommit` basta.

## Checklist

- [ ] Tabla `outbox_messages` con índice parcial sobre pendientes.
- [ ] Evento insertado en la misma transacción que el agregado.
- [ ] Payload = contrato versionado, no la clase serializada.
- [ ] Relay con `FOR UPDATE SKIP LOCKED`, `attempts`, `last_error`, dead-letter.
- [ ] Consumidores idempotentes por `message_id`.
- [ ] Métricas: pendientes, edad máxima, fallidos; alertas.
- [ ] Limpieza periódica y procedimiento de replay documentado.
