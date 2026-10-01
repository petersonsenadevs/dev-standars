# Monolito modular: estructura, comunicación y reglas

## Índice

- [Qué es y por qué es el punto de partida](#qué-es-y-por-qué-es-el-punto-de-partida)
- [Estructura por módulos](#estructura-por-módulos)
- [API pública de un módulo](#api-pública-de-un-módulo)
- [Comunicación entre módulos](#comunicación-entre-módulos)
- [Reglas de dependencia automatizadas](#reglas-de-dependencia-automatizadas)
- [Base de datos: compartida vs esquemas](#base-de-datos-compartida-vs-esquemas)
- [Preparar la extracción futura](#preparar-la-extracción-futura)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Concreta [overview](overview.md) §6-7. Para decidir si un módulo debe salir a servicio
propio, ver [when-microservices](when-microservices.md).

## Qué es y por qué es el punto de partida

Un despliegue, un repositorio, un proceso; dentro, módulos con fronteras tan estrictas
como las de un servicio: API pública explícita, datos propios, dependencias verificadas
en CI. Se obtiene el 80 % del beneficio de los microservicios (autonomía de modelo,
equipos por área, cambios locales) sin red, sin consistencia distribuida y sin
observabilidad de flota.

Por defecto, cada [bounded context](bounded-contexts.md) es un módulo. Un módulo puede
extraerse a servicio cuando aparezca un motivo real; un servicio prematuro no se vuelve a
fusionar.

## Estructura por módulos

```
src/                                  (Laravel: src/ junto a app/; Node: src/modules/; Python: src/<pkg>/)
  Shared/                             shared kernel: Money, Ids, Clock, Result, contratos de eventos
  Sales/
    Contracts/                        API pública: interfaces, DTOs, eventos publicados
    Domain/
    Application/
    Infrastructure/
      Persistence/
      Http/
      Providers/SalesServiceProvider.php   (Laravel) / register.ts (Node) / wiring.py (Python)
  Invoicing/
    ...
  Inventory/
    ...
app/ (Laravel) o apps/web (Next)      adaptadores driving finos: rutas, controladores, jobs, commands
tests/
  Architecture/                       tests de dependencias y vocabulario
  Sales/ Invoicing/ ...               espejo de src/
```

Reglas de estructura:

- Cada módulo se registra a sí mismo (service provider, función `register`, módulo DI).
  El framework no conoce el interior.
- Migraciones dentro del módulo (`Infrastructure/Persistence/Migrations`) o etiquetadas
  con el módulo en el directorio global. Cada tabla tiene un módulo propietario.
- Rutas por módulo, montadas con prefijo (`/api/sales/...`) desde el provider.
- `Shared/` solo crece por acuerdo explícito; revisar en cada PR que lo toque.

## API pública de un módulo

Todo lo que otro módulo puede usar está en `Contracts/` (PHP/Python) o en el barrel
`index.ts` (TS). Contiene:

1. **Interfaz de consulta síncrona** con DTOs planos (nunca agregados).
2. **Eventos publicados** (published language, versionados).
3. **Ids** y VO que se intercambian, si no están ya en `Shared/`.

```php
// src/Inventory/Contracts/InventoryApi.php
namespace App\Inventory\Contracts;

interface InventoryApi
{
    /** @return array<string, int> sku => available units */
    public function availabilityFor(array $skus): array;
}

// src/Inventory/Contracts/Events/StockReserved.php
final readonly class StockReserved
{
    public const VERSION = 1;
    public function __construct(public string $orderId, public string $sku, public int $quantity, public string $occurredAt) {}
}
```

```ts
// src/modules/inventory/index.ts: única entrada permitida desde fuera
export type { InventoryApi } from './contracts/InventoryApi';
export type { StockReserved } from './contracts/events/StockReserved';
export { registerInventoryModule } from './infrastructure/register';
```

Lo que **no** está en la API pública: entidades, repositorios, casos de uso internos,
modelos Eloquent/Prisma, tablas.

## Comunicación entre módulos

| Necesidad | Mecanismo | Consistencia | Cuándo |
|---|---|---|---|
| Leer datos de otro módulo para decidir | interfaz en `Contracts/` (síncrona, in-process) | fuerte | el dato es necesario para validar un comando |
| Reaccionar a algo que pasó en otro módulo | evento publicado + listener/política | eventual | efectos secundarios, integraciones, proyecciones |
| Listado o pantalla que mezcla datos de varios módulos | read model propio que lee (solo lectura) tablas ajenas o compone APIs | eventual/fuerte según fuente | UI, informes |
| Ejecutar un comando de otro módulo | nunca directamente; publicar evento y que el otro decida | eventual | siempre que sea reacción |

Prohibido: importar `Domain/` o `Infrastructure/` ajenos; escribir en tablas de otro
módulo; llamar a casos de uso ajenos desde un caso de uso propio (crea transacciones que
cruzan agregados de dos módulos).

```php
// Sales/Application/ConfirmOrder/ConfirmOrderHandler.php
final class ConfirmOrderHandler
{
    public function __construct(
        private OrderRepository $orders,
        private InventoryApi $inventory,      // Contracts ajeno, inyectado por DI
        private EventBus $events,
    ) {}

    public function __invoke(ConfirmOrder $cmd): void
    {
        $order = $this->orders->ofId(OrderId::from($cmd->orderId));
        $availability = $this->inventory->availabilityFor($order->skus()); // consulta síncrona
        $order->confirm(Availability::from($availability));                // decide el agregado
        DB::transaction(fn () => $this->orders->save($order));
        $this->events->publishAfterCommit($order->pullEvents());           // OrderConfirmed v1
    }
}
```

La reacción en Inventory es una política `ReserveStockOnOrderConfirmed` que recibe
`OrderConfirmedV1` y ejecuta el caso de uso propio `ReserveStock` (ver
[event-storming](event-storming.md) §"De post-its a artefactos de código").

Bus de eventos in-process al inicio (Laravel `Event`, un `EventEmitter` tipado, un
dispatcher propio en Python). Cuando un listener haga IO externo o sea lento, pasarlo a
cola con el mismo contrato. Ver [../tactical/domain-events.md](../tactical/domain-events.md).

## Reglas de dependencia automatizadas

Sin herramienta, la frontera dura dos sprints. Configuración mínima por stack:

**PHP: deptrac**

```yaml
# deptrac.yaml
deptrac:
  paths: [./src]
  layers:
    - name: SalesContracts    ; collectors: [{ type: directory, value: src/Sales/Contracts/.* }]
    - name: Sales             ; collectors: [{ type: directory, value: src/Sales/(Domain|Application|Infrastructure)/.* }]
    - name: InventoryContracts; collectors: [{ type: directory, value: src/Inventory/Contracts/.* }]
    - name: Inventory         ; collectors: [{ type: directory, value: src/Inventory/(Domain|Application|Infrastructure)/.* }]
    - name: Shared            ; collectors: [{ type: directory, value: src/Shared/.* }]
  ruleset:
    Sales: [SalesContracts, InventoryContracts, Shared]
    Inventory: [InventoryContracts, Shared]
    SalesContracts: [Shared]
    InventoryContracts: [Shared]
```

**TypeScript: dependency-cruiser**

```js
// .dependency-cruiser.cjs
module.exports = { forbidden: [{
  name: 'no-cross-module-internals',
  from: { path: '^src/modules/([^/]+)/' },
  to: { path: '^src/modules/(?!$1/)[^/]+/(domain|application|infrastructure)/' },
  severity: 'error',
}]};
```

**Python: import-linter**: un contrato `type = forbidden` por módulo con
`source_modules = app.sales` y `forbidden_modules = app.inventory.domain,
app.inventory.application, app.inventory.infrastructure`.

Se ejecuta en CI y en pre-commit. Empezar en modo warning para medir violaciones en un
legacy; pasar a error módulo a módulo.

## Base de datos: compartida vs esquemas

| Opción | Pros | Contras | Cuándo |
|---|---|---|---|
| Una BD, un esquema, tablas con prefijo (`sales_orders`) | simple, joins posibles en read models, migraciones únicas | la disciplina es solo por convención | inicio, equipo único |
| Una BD, un esquema por módulo (PostgreSQL `sales.orders`) | ownership visible, permisos por rol, joins aún posibles | migraciones por esquema, algo de configuración | recomendado en cuanto haya 3+ módulos |
| Una BD por módulo | extracción trivial, aislamiento total | sin joins, consistencia solo por eventos, N conexiones | solo como paso previo a extraer |

Reglas que aplican en todas las opciones:

- **Escritura**: solo el módulo propietario. Un test de arquitectura o revisión de
  migraciones lo verifica.
- **Lectura ajena**: permitida únicamente desde read models (`Application/Query` +
  `Infrastructure/ReadModel`), nunca desde repositorios ni dominio. Documentar cada
  lectura cruzada en la ficha del módulo: es una dependencia de esquema.
- **Foreign keys entre módulos**: aceptables al principio; se sustituyen por ids sin FK
  cuando el módulo se acerque a extracción.
- **Transacciones**: una por caso de uso, un agregado. Nunca una transacción que escriba
  en dos módulos; usar evento.

Una lectura cruzada válida es una clase `SqlOrdersToPickReader` en
`Inventory/Infrastructure/ReadModel/` con un `select ... from sales.orders join
inventory.reservations` que devuelve DTOs; su existencia se anota en la ficha del módulo.

## Preparar la extracción futura

Un módulo está listo para extraerse cuando:

1. Su API pública es solo `Contracts/`: interfaces con DTOs serializables + eventos.
2. Ninguna lectura cruzada apunta a sus tablas desde otros módulos (o están inventariadas
   y se pueden sustituir por API/eventos).
3. Sus listeners de eventos ajenos son idempotentes (funcionarán con at-least-once).
4. Sus migraciones y semillas están dentro del módulo.
5. Tiene métricas y logs con el nombre del módulo como etiqueta.

Camino: (a) la interfaz `Contracts/` gana una implementación HTTP en el consumidor sin
cambiar a nadie más; (b) los eventos pasan del bus in-process a un broker con el mismo
contrato; (c) el módulo arranca como proceso propio; (d) se corta la conexión a la BD
compartida. Cada paso es reversible. Ver [when-microservices](when-microservices.md).

## Errores frecuentes

- **Módulos por capa** (`app/Http`, `app/Models`, `app/Services`): monolito clásico sin frontera de negocio.
- **Frontera sin linter**: la primera urgencia importa `Inventory\Domain\Sku` desde Sales y nadie lo ve.
- **Contracts que exponen entidades o modelos ORM**: el consumidor queda acoplado al interior.
- **Casos de uso que llaman a casos de uso de otro módulo**: transacción implícita entre dos módulos; usar evento.
- **Escribir en tablas ajenas** "porque es un update rápido": rompe invariantes que solo el propietario conoce.
- **Shared kernel como cajón de sastre**: `Shared/Services/OrderHelper.php` es acoplamiento global.
- **Listeners no idempotentes**: funcionan in-process y fallan al pasar a cola.
- **Módulo `Core` o `Common` con lógica de negocio**: es un contexto sin nombre.

## Checklist

- [ ] Un directorio raíz por contexto con `Contracts/Domain/Application/Infrastructure`.
- [ ] Cada módulo se registra a sí mismo (provider/register) y monta sus rutas.
- [ ] `Contracts/` (o barrel) contiene solo interfaces, DTOs planos, eventos e ids.
- [ ] Linter de dependencias (deptrac / dependency-cruiser / import-linter) en CI en modo error.
- [ ] Cada tabla tiene un módulo propietario documentado; solo él escribe.
- [ ] Lecturas cruzadas solo en read models, inventariadas en la ficha del módulo.
- [ ] Ninguna transacción escribe en dos módulos; las reacciones van por eventos.
- [ ] Listeners idempotentes y contrato de evento versionado.
- [ ] `Shared/` solo con VO técnicos, ids, `Clock`, `Result` y contratos.
- [ ] Tests de arquitectura en `tests/Architecture/` para dependencias y vocabulario.
