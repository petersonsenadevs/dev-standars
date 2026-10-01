# Transacciones y Unit of Work

## Índice

- [Una transacción por caso de uso](#una-transacción-por-caso-de-uso)
- [Dónde abrirla](#dónde-abrirla)
- [UoW explícito vs implícito por ORM](#uow-explícito-vs-implícito-por-orm)
- [Eventos tras commit](#eventos-tras-commit)
- [Rollback, reintentos y bloqueos](#rollback-reintentos-y-bloqueos)
- [Idempotencia dentro de la transacción](#idempotencia-dentro-de-la-transacción)
- [Ejemplos por stack](#ejemplos-por-stack)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../tactical/overview-concepts.md` §7 y §14, `use-cases.md`,
`../integration/outbox-pattern.md`, `../integration/idempotency.md`.

## Una transacción por caso de uso

Un caso de uso modifica **un agregado** y lo guarda en **una transacción**. Esa es la
unidad de consistencia. Si un caso de uso necesita tocar dos agregados atómicamente, tres
opciones por orden de preferencia:

1. Revisar el límite del agregado (quizá son uno).
2. Aceptar consistencia eventual: modificar el primero, emitir evento, el segundo reacciona
   (`../integration/eventual-consistency.md`).
3. Excepción justificada: dos agregados en una transacción, documentada en el handler.
   Válido en un monolito con una sola BD; imposible cuando se separen.

La transacción cubre: cargar (opcionalmente con lock), mutar, guardar, escribir en outbox.
No cubre: enviar emails, llamar APIs externas, publicar en colas externas, renderizar.

## Dónde abrirla

| Lugar | Cuándo | Contra |
|---|---|---|
| Dentro del handler (`DB::transaction(fn)`) | por defecto, pocos handlers, visible | repetición; en Application se tolera una dependencia de framework |
| Decorador del handler | > 15 handlers, uniformidad | un nivel de indirección; hay que envolver en el wiring |
| Middleware de bus | ya existe bus | igual que decorador |
| Puerto `TransactionRunner` / `UnitOfWork` | purismo o multi-stack | una interfaz más; vale la pena en TS/Python donde no hay facade |

Nunca: en el controlador (no sabe qué escribe el handler), en el repositorio (no sabe si
hay más escrituras), en un middleware HTTP global "por si acaso" (transacciones largas que
envuelven render y llamadas externas).

## UoW explícito vs implícito por ORM

**Implícito** (Eloquent, Prisma sin `$transaction`): cada `save()` es su propio
statement autocommit. Suficiente si el caso de uso hace una única escritura.

**Explícito**: el ORM acumula cambios y hace flush en el commit (SQLAlchemy `Session`,
Doctrine `EntityManager`) o tú envuelves las escrituras en `transaction()`. Necesario
cuando hay más de una escritura, lectura con lock, o outbox.

Puerto mínimo, agnóstico:

```ts
// application/ports/TransactionRunner.ts
export interface TransactionRunner {
  run<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T>;
}
// infrastructure/prisma/prismaTransactionRunner.ts
export const prismaTransactionRunner = (db: PrismaClient): TransactionRunner => ({
  run: (fn) => db.$transaction(async (tx) => fn({ db: tx }), { isolationLevel: 'ReadCommitted' }),
});
```

Los repositorios reciben `ctx` (o usan AsyncLocalStorage para no propagarlo a mano; más
cómodo pero más opaco). En PHP, `DB::transaction` ya usa la conexión ambiental y los
repositorios Eloquent participan sin cambios.

```python
# Python: UoW explícito con SQLAlchemy
class SqlAlchemyUnitOfWork:
    def __init__(self, session_factory): self._sf = session_factory
    def __enter__(self):
        self.session = self._sf(); self.invoices = SqlInvoiceRepository(self.session); return self
    def __exit__(self, exc_type, *_):
        self.session.rollback() if exc_type else None; self.session.close()
    def commit(self): self.session.commit()
```

El UoW agrupa los repositorios que comparten sesión; el handler recibe el UoW y accede a
`uow.invoices`. Es el patrón de *Architecture Patterns with Python*; funciona bien y
concentra la sesión en un sitio.

## Eventos tras commit

Regla: los efectos con IO externo se ejecutan **después** del commit. Si se ejecutan
dentro y la transacción falla, el email ya salió; si el efecto falla, revientas una
transacción de negocio por un SMTP caído.

Tres mecanismos, del más simple al más robusto:

1. **Publicar después de `transaction()`** en el handler (ver
   `../stacks/laravel/overview.md` §5). Riesgo: si el proceso muere entre commit y
   publish, el evento se pierde.
2. **`DB::afterCommit` / hooks del ORM**: igual que 1 pero seguro ante transacciones
   anidadas (tests, jobs). Mismo riesgo de pérdida.
3. **Outbox**: el evento se inserta en la misma transacción y un worker lo publica
   (`../integration/outbox-pattern.md`). Garantía at-least-once. Necesario cuando el
   evento cruza contextos o servicios.

En Laravel, los listeners `ShouldQueue` deben declarar `public bool $afterCommit = true`
(o `Queue::after_commit` global en `config/queue.php`); sin ello, el job puede procesarse
antes de que la transacción del request termine y no encontrar la fila.

## Rollback, reintentos y bloqueos

- **Rollback** es automático al lanzar una excepción dentro del callback de transacción.
  No captures excepciones dentro para "loguear y seguir": deja que salga.
- **Deadlocks y serialization failures** (`40001`, `1213`): reintenta la transacción
  completa con backoff, 2-3 intentos. Laravel: `DB::transaction($fn, attempts: 3)`. Prisma:
  bucle manual sobre `P2034`. SQLAlchemy: `retry` con `OperationalError`.
- **Lock pesimista** (`SELECT ... FOR UPDATE`, `lockForUpdate()`, `with_for_update()`) para
  contadores, secuencias, stock. Cárgalo **dentro** de la transacción.
- **Lock optimista** (columna `version`): para agregados editados por humanos con poca
  contención. `UPDATE ... WHERE id = ? AND version = ?`; si afecta 0 filas, lanza
  `ConcurrencyConflict` y que el adaptador devuelva 409.
- Aislamiento: `READ COMMITTED` por defecto; `SERIALIZABLE` solo en casos concretos con
  reintento garantizado.

## Idempotencia dentro de la transacción

Un reintento (cliente, cola, saga) puede ejecutar el mismo command dos veces. Estrategias:

- El agregado rechaza la operación repetida como no-op o excepción (`issue()` sobre
  factura ya emitida). Es la más robusta: no depende de infraestructura.
- Tabla `idempotency_keys(key, response, created_at)` con `INSERT` dentro de la misma
  transacción; conflicto de clave única -> devolver la respuesta guardada
  (`../integration/idempotency.md`).
- Para consumidores de mensajes: `processed_messages(message_id)` en la misma transacción
  que el efecto.

## Ejemplos por stack

**Laravel con decorador**

```php
final class TransactionalHandler
{
    /** @param callable(object): mixed $inner */
    public function __construct(private $inner) {}
    public function __invoke(object $command): mixed
    {
        return DB::transaction(fn () => ($this->inner)($command), attempts: 3);
    }
}
// Provider: $this->app->when(IssueInvoiceController::class)->needs(IssueInvoiceHandler::class)
//   ->give(fn ($app) => new TransactionalHandler($app->make(IssueInvoiceHandler::class)));
```

Con decorador, la publicación de eventos debe salir del handler: el bus usa
`DB::afterCommit` o el handler escribe en outbox.

**Python con UoW**

```python
class IssueInvoice:
    def __init__(self, uow: UnitOfWork, clock: Clock, events: EventPublisher): ...
    def __call__(self, cmd: IssueInvoiceCommand) -> None:
        with self._uow as uow:
            inv = uow.invoices.of_id(InvoiceId(cmd.invoice_id), for_update=True)
            inv.issue(self._clock.now())
            uow.invoices.save(inv)
            uow.outbox.add(inv.pull_events())    # misma transacción
            uow.commit()
        # el worker de outbox publica; nada más aquí
```

## Errores frecuentes

- Transacción en el controlador o middleware HTTP: envuelve render y llamadas externas.
- Llamar a Stripe/SMTP dentro de `DB::transaction`: efectos irreversibles con commit
  pendiente, y conexiones de BD retenidas mientras espera la red.
- Capturar excepciones dentro de la transacción y continuar: commit de estado parcial.
- Dos agregados en una transacción "porque es más fácil", sin documentar; luego el módulo
  no se puede extraer.
- Cargar el agregado fuera de la transacción y bloquear dentro: la versión leída ya es vieja.
- `RefreshDatabase` en tests envuelve cada test en una transacción: los `afterCommit` no se
  disparan salvo que uses `DatabaseTruncation` o `Event::fake` + assert directo.
- Reintentar una transacción que incluye efectos no idempotentes.

## Checklist

- [ ] Cada handler abre una transacción (o la recibe de un decorador), nunca el controlador.
- [ ] Un agregado por transacción; excepciones documentadas.
- [ ] IO externo fuera de la transacción; eventos tras commit o vía outbox.
- [ ] Listeners en cola con `afterCommit`.
- [ ] Deadlocks reintentados; lock pesimista u optimista elegido por caso.
- [ ] Reintentos seguros: el agregado o una clave de idempotencia rechaza duplicados.
- [ ] Tests de integración cubren rollback ante excepción de dominio.
