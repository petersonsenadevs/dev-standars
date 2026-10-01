# Read models y proyecciones

## Índice

- [Por qué las pantallas no leen agregados](#por-qué-las-pantallas-no-leen-agregados)
- [Nivel 1: consultas directas](#nivel-1-consultas-directas)
- [Nivel 2: vistas y tablas denormalizadas](#nivel-2-vistas-y-tablas-denormalizadas)
- [Nivel 3: proyecciones actualizadas por eventos](#nivel-3-proyecciones-actualizadas-por-eventos)
- [Listados, paginación y filtros](#listados-paginación-y-filtros)
- [Caché](#caché)
- [Reconstrucción y pruebas](#reconstrucción-y-pruebas)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `commands-queries-cqrs.md`, `../tactical/overview-concepts.md` §13,
`../integration/eventual-consistency.md`, `../integration/outbox-pattern.md`.

## Por qué las pantallas no leen agregados

Un agregado está diseñado para proteger invariantes al escribir: carga completo, expone
comportamiento, no getters de presentación. Una pantalla de listado necesita 6 columnas de
200 filas con datos de tres tablas, ordenadas y paginadas. Usar el agregado para eso:

- obliga a añadir getters y relaciones "para la vista", deformándolo;
- carga grafos enteros y dispara N+1;
- impide joins y agregaciones SQL triviales.

Solución: las lecturas tienen su propio camino (lector -> DTO) fuera del dominio. El
dominio no sabe que existen read models.

## Nivel 1: consultas directas

Punto de partida para todo módulo. Interfaz en `Application/Query`, implementación en
`Infrastructure/Persistence/Query`, DTO plano por pantalla.

```php
// Application/Query/InvoiceDetail.php  (read model de la pantalla de detalle)
final readonly class InvoiceDetail
{
    /** @param InvoiceDetailLine[] $lines */
    public function __construct(
        public string $id, public ?string $number, public string $status,
        public string $customerName, public int $totalCents, public string $currency,
        public array $lines, public ?string $issuedAt,
    ) {}
}
interface InvoiceDetailReader { public function byId(string $id, string $tenantId): ?InvoiceDetail; }
```

Implementación con `DB::table()`/SQL/Prisma `select`. Sin ORM de escritura: no uses el
modelo Eloquent del repositorio para leer (acopla las dos rutas y arrastra casts/relations).
Puedes usar modelos Eloquent **de solo lectura** separados si prefieres la API fluida.

Regla de oro: una consulta por pantalla, con exactamente las columnas que la pantalla usa.

## Nivel 2: vistas y tablas denormalizadas

Cuando la consulta de nivel 1 se vuelve lenta o ilegible (5 joins, agregaciones,
subconsultas correlacionadas):

- **Vista SQL** (`CREATE VIEW invoice_summaries AS ...`): sin cambio en escrituras,
  siempre consistente, coste en cada lectura. Primera opción.
- **Vista materializada** (PostgreSQL): refresco periódico o tras commit
  (`REFRESH MATERIALIZED VIEW CONCURRENTLY`). Buena para dashboards que toleran minutos.
- **Tabla denormalizada mantenida en la misma transacción**: el repositorio, al guardar el
  agregado, actualiza también `invoice_summaries`. Consistencia inmediata; acopla el
  repositorio a un modelo de lectura. Aceptable si es una sola tabla y el mismo módulo.
- **Columnas calculadas** (`GENERATED ALWAYS AS`) para derivados simples (`total_cents`).

Migraciones de vistas: en el módulo, versionadas como cualquier otra.

## Nivel 3: proyecciones actualizadas por eventos

Un **proyector** escucha eventos de dominio y mantiene una tabla de lectura. Necesario
cuando: el modelo de lectura cruza contextos, la lectura es cara y frecuente, o quieres
reconstruirla desde el historial.

```
InvoiceIssued ----> InvoiceSummaryProjector.onIssued  ----> UPDATE invoice_summaries ...
PaymentRegistered -> InvoiceSummaryProjector.onPayment -> UPDATE ... outstanding_cents
```

```ts
// infrastructure/projections/invoiceSummaryProjector.ts
export const invoiceSummaryProjector = (db: Db): Projector => ({
  handles: ['InvoiceIssued', 'PaymentRegistered', 'InvoiceVoided'],
  async project(event) {
    switch (event.type) {
      case 'InvoiceIssued':
        await db.insertInto('invoice_summaries').values({ id: event.invoiceId, status: 'issued', total_cents: event.totalCents, outstanding_cents: event.totalCents, issued_at: event.occurredAt }).onConflict((oc) => oc.column('id').doUpdateSet({ status: 'issued' })).execute();
        break;
      case 'PaymentRegistered':
        await db.updateTable('invoice_summaries').set((eb) => ({ outstanding_cents: eb('outstanding_cents', '-', event.amountCents) })).where('id', '=', event.invoiceId).execute();
        break;
    }
  },
});
```

Reglas del proyector:
- **Idempotente**: upsert, o tabla `projection_positions(projector, last_event_id)` en la
  misma transacción que la escritura de la proyección.
- **Sin lógica de negocio**: transforma hechos en filas. Si necesita "calcular" algo, ese
  dato debería venir en el evento.
- **Consumidor de outbox/cola**, no listener síncrono en el request (salvo proyecciones
  triviales del mismo módulo).
- **Tolerante a orden**: si `PaymentRegistered` puede llegar antes que `InvoiceIssued`,
  usa upsert con valores por defecto o reordena por `occurredAt` + versión.

Laravel: el proyector es un listener `ShouldQueue` con `afterCommit`; Python: consumidor
del worker de outbox; TS: worker BullMQ o consumidor del outbox.

## Listados, paginación y filtros

Todo fuera del dominio, en el lector:

```ts
export type InvoiceListQuery = {
  tenantId: string; status?: InvoiceStatus; customerId?: string; search?: string;
  sort: 'dueAt' | 'total' | 'number'; dir: 'asc' | 'desc'; cursor?: string; limit: number;
};
export type Page<T> = { items: T[]; nextCursor: string | null; total?: number };
```

- Paginación por **cursor** (keyset) para listados grandes o infinitos; por offset para
  tablas admin con "ir a página N". No mezcles.
- `total` solo si la pantalla lo muestra; `COUNT(*)` es caro en tablas grandes.
- Filtros validados en el adaptador (zod/Form Request) y traducidos a SQL en el lector.
  Whitelist de columnas ordenables.
- Búsqueda de texto: `ILIKE` con índice trigram o full-text del motor; no cargues y
  filtres en memoria.

Laravel: `paginate()`/`cursorPaginate()` sobre `DB::table()` y mapea `items` a DTOs;
la estructura de paginación de Laravel es aceptable como contrato de API.

## Caché

- Cachea **read models**, nunca agregados. Clave: `invoice-detail:{tenant}:{id}:{version}`
  si tienes versión; si no, invalidación por evento (`InvoiceIssued` -> `forget`).
- TTL corto (30-300 s) + invalidación por evento cubre el 90 %. Caché por request
  (memoización) para lectores llamados varias veces en un render.
- No cachees listados filtrados con claves combinatorias sin TTL; se llenan de basura.
- El caché es un adaptador: decorador `CachedInvoiceDetailReader` que envuelve al lector
  real, no `Cache::remember` esparcido por controladores.

## Reconstrucción y pruebas

- Toda proyección debe poder **reconstruirse** desde cero: comando `projections:rebuild
  invoice_summaries` que trunca y reprocesa el historial de eventos (outbox/event store)
  o, si no hay historial, recalcula desde las tablas de escritura. Escríbelo el mismo día
  que la proyección.
- Tests de lectores: integración con BD real y fixtures mínimas; un test por filtro y
  por regla de visibilidad. No mockees el query builder.
- Tests de proyectores: dado evento(s) -> filas esperadas; incluir idempotencia (mismo
  evento dos veces) y orden alterado.

## Errores frecuentes

- Reutilizar el repositorio para listados (`findAllByStatusPaginated`).
- Modelo Eloquent de escritura con `with()` en el controlador para pintar tablas.
- Proyección con lógica de negocio que diverge del agregado.
- Proyector síncrono con IO en el request; o asíncrono sin `afterCommit`.
- Sin comando de rebuild; la proyección se corrompe y nadie sabe regenerarla.
- `COUNT(*)` en cada página de una tabla de millones de filas.
- Caché de entidades y luego `save()` de una copia obsoleta.
- Un read model "universal" con 40 campos para todas las pantallas.

## Checklist

- [ ] Cada pantalla/endpoint de lectura tiene un lector y un DTO propios.
- [ ] Lectores en `Infrastructure/Persistence/Query`; interfaz en `Application/Query`.
- [ ] Paginación (cursor u offset), filtros y ordenación en el lector, con whitelist.
- [ ] Nivel 2/3 solo tras medir; vista SQL antes que proyección por eventos.
- [ ] Proyectores idempotentes, sin negocio, tolerantes a orden, consumidores de outbox.
- [ ] Comando de reconstrucción por proyección.
- [ ] Caché como decorador del lector, con invalidación por evento o TTL corto.
- [ ] Tests de integración por lector; tests de idempotencia por proyector.
