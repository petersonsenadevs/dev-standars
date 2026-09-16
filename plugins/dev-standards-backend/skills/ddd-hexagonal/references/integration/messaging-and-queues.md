# Mensajería y colas

## Índice

- [La cola es un adaptador](#la-cola-es-un-adaptador)
- [Tipos de mensaje: command, evento, query](#tipos-de-mensaje-command-evento-query)
- [Contrato de mensaje](#contrato-de-mensaje)
- [Laravel: jobs, eventos y listeners en cola](#laravel-jobs-eventos-y-listeners-en-cola)
- [TypeScript: BullMQ](#typescript-bullmq)
- [Python: arq y Celery](#python-arq-y-celery)
- [Reintentos, DLQ y backoff](#reintentos-dlq-y-backoff)
- [Observabilidad](#observabilidad)
- [Cuándo Kafka/RabbitMQ no hacen falta](#cuándo-kafkarabbitmq-no-hacen-falta)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `outbox-pattern.md`, `idempotency.md`, `event-versioning.md`,
`../hexagonal/driving-vs-driven.md`.

## La cola es un adaptador

Publicar es driven (`EventBus`, `CommandDispatcher` como puertos); consumir es driving (un
worker que deserializa y llama a un caso de uso). El dominio y la aplicación no saben si
hay Redis, SQS o una tabla. Consecuencias:

- El caso de uso que se ejecuta en un worker es el **mismo** que se ejecuta desde HTTP.
- La clase Job/Task/Processor tiene 5-10 líneas: construir command, invocar handler.
- La serialización del mensaje es un contrato explícito, no la clase serializada.

## Tipos de mensaje: command, evento, query

| Tipo | Semántica | Destinatarios | Nombre | Ejemplo |
|---|---|---|---|---|
| Command | "haz esto"; puede fallar; el emisor espera que ocurra | uno | imperativo | `GenerateInvoicePdf` |
| Evento | "esto ocurrió"; hecho inmutable | cero o muchos | pasado | `InvoiceIssued` |
| Query asíncrona | rara; normalmente request/response síncrono | uno | | evitar |

Commands asíncronos por cola = trabajo diferido del mismo contexto (PDF, email, importación).
Eventos = integración entre contextos y proyecciones. No publiques commands a otros
contextos salvo en orquestación de sagas (`sagas-process-managers.md`).

## Contrato de mensaje

```json
{
  "id": "018f3a2e-7c1b-7d3e-9c4a-1f2e3d4c5b6a",
  "type": "invoicing.invoice_issued",
  "version": 1,
  "occurred_at": "2026-08-25T10:15:00Z",
  "aggregate": { "type": "Invoice", "id": "inv_123" },
  "correlation_id": "req_abc", "causation_id": "018f3a2e-...",
  "actor_id": "usr_9",
  "payload": { "invoice_id": "inv_123", "customer_id": "cus_7", "total_cents": 12000, "currency": "EUR", "issued_at": "2026-08-25T10:15:00Z" }
}
```

Reglas:
- `type` con namespace del contexto y snake_case; estable para siempre.
- `version` entera; cambios incompatibles = nueva versión (`event-versioning.md`).
- `payload` con ids y datos del hecho; sin objetos anidados grandes ni datos que el
  consumidor pueda pedir.
- Esquema documentado (JSON Schema, zod, pydantic, clase PHP `IntegrationEvent`) en un
  paquete/carpeta de contratos compartidos por publicador y consumidores.
- El evento de dominio (clase interna) y el evento de integración (contrato) son cosas
  distintas; un traductor los relaciona en el publicador.

## Laravel: jobs, eventos y listeners en cola

```php
// Command asíncrono: Job = adaptador driving
final class GenerateInvoicePdfJob implements ShouldQueue
{
    use Queueable;
    public int $tries = 5; public array $backoff = [10, 60, 300];
    public function __construct(public readonly string $invoiceId) {}
    public function handle(GenerateInvoicePdfHandler $handle): void { $handle(new GenerateInvoicePdfCommand($this->invoiceId)); }
    public function uniqueId(): string { return $this->invoiceId; }        // con ShouldBeUnique
    public function failed(\Throwable $e): void { /* alerta; nada de negocio */ }
}
// Despacho desde el caso de uso: por puerto CommandDispatcher -> adaptador hace GenerateInvoicePdfJob::dispatch($id)->afterCommit();
```

Eventos de integración: el consumidor de outbox (o `LaravelEventBus` con `afterCommit`)
despacha un `IntegrationEvent` (array serializable) y los listeners `ShouldQueue` con
`$afterCommit = true` lo reciben. Configura `queue.connections.*.after_commit = true`
globalmente. Colas separadas por prioridad (`default`, `mail`, `projections`); Horizon
para supervisión; `retry_after` mayor que el timeout del job más largo.

## TypeScript: BullMQ

```ts
// infrastructure/queue/queues.ts
export const invoicingQueue = new Queue('invoicing', { connection, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 1000, removeOnFail: 5000 } });

// application port
export interface CommandDispatcher { dispatch(name: 'GenerateInvoicePdf', payload: { invoiceId: string }): Promise<void> }
// adaptador driven
export const bullDispatcher = (q: Queue): CommandDispatcher => ({
  dispatch: (name, payload) => q.add(name, payload, { jobId: `${name}:${payload.invoiceId}` }).then(() => undefined),
});

// worker.ts: adaptador driving
const module = buildInvoicing({ db: prisma, mail });
new Worker('invoicing', async (job) => {
  switch (job.name) {
    case 'GenerateInvoicePdf': { const r = await module.generateInvoicePdf(job.data); if (!r.ok) throw new UnrecoverableError(r.error.kind); return; }
    default: throw new UnrecoverableError(`unknown job ${job.name}`);
  }
}, { connection, concurrency: 5 });
```

`jobId` determinista = deduplicación en el broker. `UnrecoverableError` evita reintentar
errores de dominio. Para eventos, un `Worker` por consumidor con `QueueEvents` o un
fan-out desde el relay de outbox (una cola por consumidor).

## Python: arq y Celery

```python
# arq: worker.py — adaptador driving
async def generate_invoice_pdf(ctx, invoice_id: str) -> None:
    ctx["module"].generate_invoice_pdf(GenerateInvoicePdfCommand(invoice_id=invoice_id))

class WorkerSettings:
    functions = [generate_invoice_pdf]
    max_tries = 5
    async def on_startup(ctx): ctx["module"] = build_invoicing(SessionLocal)

# adaptador driven del puerto CommandDispatcher
class ArqDispatcher:
    def __init__(self, redis: ArqRedis): self._r = redis
    async def dispatch(self, name: str, **payload) -> None:
        await self._r.enqueue_job(name, _job_id=f"{name}:{payload['invoice_id']}", **payload)
```

Celery: `@shared_task(bind=True, autoretry_for=(TransientError,), retry_backoff=True, max_retries=5, acks_late=True)`;
`task_id` determinista para dedupe; `acks_late` + idempotencia para no perder trabajos.
`arq` es más simple para asyncio; Celery cuando ya existe o se necesitan sus features.

## Reintentos, DLQ y backoff

- Reintenta solo errores transitorios; errores de dominio -> fallo definitivo sin reintento
  (`UnrecoverableError`, `$this->fail()`, `Reject`).
- Backoff exponencial con jitter; máximo 5 intentos; primer reintento en segundos, último
  en minutos.
- **DLQ**: `failed_jobs` (Laravel), `failed` set (BullMQ), cola `dead` (Celery). Revisar
  diariamente; comando de reproceso; alerta al superar umbral.
- `timeout` por job menor que `retry_after`/`visibility timeout`; jobs largos se trocean.
- Concurrencia por cola según el recurso limitante (BD, API externa con rate limit).
- Idempotencia obligatoria (`idempotency.md`): cualquier reintento reejecuta.

## Observabilidad

- Log estructurado por mensaje: `message_id`, `type`, `correlation_id`, `attempt`,
  `duration_ms`, resultado.
- Métricas: profundidad de cola, edad del mensaje más antiguo, tasa de fallo, duración
  p95 por tipo. Alertas sobre edad y DLQ.
- Propaga `correlation_id` desde el request HTTP al mensaje y de ahí a los siguientes
  (`causation_id` = id del mensaje anterior). OpenTelemetry con propagación de contexto en
  headers del mensaje si hay tracing.
- Paneles: Horizon, Bull Board, Flower. Suficientes para un monolito.

## Cuándo Kafka/RabbitMQ no hacen falta

Redis (BullMQ, Laravel, arq), SQS o incluso la tabla outbox como cola bastan cuando:

- un solo equipo, un monolito o pocos servicios;
- < decenas de miles de mensajes por minuto;
- no necesitas replay de meses de historial ni múltiples grupos de consumidores
  independientes sobre el mismo stream;
- no hay requisitos de orden estricto por partición a gran escala.

Kafka aporta log persistente, particiones y replay; RabbitMQ aporta routing complejo. Su
coste: operación, esquemas, consumidores con offsets, complejidad de tests. Adóptalos
cuando el problema los pida, no como "arquitectura de eventos". La outbox + Redis cubren
el 90 % de los sistemas de este tamaño; la migración posterior es un cambio de adaptador
si los contratos están bien definidos.

## Errores frecuentes

- Job con lógica de negocio (bucles sobre facturas, `if` de estado).
- Serializar modelos Eloquent (`SerializesModels`) con estado que cambia antes de
  ejecutarse: pasa ids.
- Despachar jobs dentro de una transacción sin `afterCommit`: el worker no encuentra la fila.
- Reintentar errores de dominio hasta la DLQ.
- Un solo worker/cola para todo: el email lento bloquea las proyecciones.
- Consumidores no idempotentes.
- Contrato = `serialize($event)` / `JSON.stringify(instance)`; cambiar una clase rompe
  consumidores.
- Sin alertas sobre edad de cola: el problema se descubre por usuarios.

## Checklist

- [ ] Publicación por puerto (`EventBus`, `CommandDispatcher`); consumo por adaptador que llama a casos de uso.
- [ ] Contrato de mensaje con `id`, `type`, `version`, `correlation_id`, payload mínimo.
- [ ] Jobs/tasks de 5-10 líneas; ids en el payload, no modelos.
- [ ] `afterCommit`/outbox para todo despacho dentro de transacción.
- [ ] Reintentos con backoff para transitorios; fallo directo para dominio; DLQ revisada.
- [ ] Colas separadas por prioridad/recurso; concurrencia ajustada.
- [ ] Dedupe por `jobId`/`task_id` determinista + idempotencia en el handler.
- [ ] Métricas y alertas de profundidad, edad y fallos.
