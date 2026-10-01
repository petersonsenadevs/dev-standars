# Mapeo ORM: entidad de dominio frente a modelo de persistencia

## Índice

- [Por qué la entidad no es el modelo ORM](#por-qué-la-entidad-no-es-el-modelo-orm)
- [Tres estrategias de mapeo](#tres-estrategias-de-mapeo)
- [Reconstitución: la factoría fromPersistence](#reconstitución-la-factoría-frompersistence)
- [Value objects embebidos](#value-objects-embebidos)
- [Colecciones hijas del agregado](#colecciones-hijas-del-agregado)
- [Lazy loading fuera del dominio](#lazy-loading-fuera-del-dominio)
- [Identidad, versión y metadatos técnicos](#identidad-versión-y-metadatos-técnicos)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Los overviews por stack ya muestran un repositorio completo (`../stacks/laravel/overview.md` §4,
`../stacks/typescript/overview.md` §7, `../stacks/python/overview.md` §6). Este documento explica
las decisiones de diseño detrás de ese código y cómo elegir entre estrategias. Detalles por ORM:
`eloquent-pitfalls.md`, `prisma-drizzle.md`, `sqlalchemy.md`.

## Por qué la entidad no es el modelo ORM

El modelo ORM describe **filas**: columnas planas, claves foráneas, relaciones navegables en
cualquier dirección, ciclo de vida gestionado por una sesión o un `save()`. La entidad describe
**comportamiento**: invariantes, transiciones, VO compuestos y una frontera de agregado que decide
quién puede tocar qué. Fusionarlos obliga a elegir entre dos males:

| Si el dominio es el modelo ORM | Consecuencia |
|---|---|
| Atributos públicos y mutables (`$invoice->status = 'issued'`) | Las invariantes se saltan desde cualquier sitio |
| Relaciones bidireccionales cargables a demanda | El agregado deja de tener frontera; cualquier consulta atraviesa todo |
| Eventos del ORM (`saved`, `flush`) | Lógica de negocio disparada por el momento de persistir, no por la intención |
| Constructor sin argumentos exigido por el ORM | No hay forma de garantizar un estado inicial válido |
| Tests de dominio necesitan BD o mocks del ORM | Se pierde la razón principal de la arquitectura |

La regla: el dominio expone `Invoice::draftFor(...)`, `issue()`, `addLine()`; el modelo ORM expone
`id`, `status`, `total_cents`. La traducción ocurre en un único sitio: el repositorio (o su mapper).

## Tres estrategias de mapeo

**1. Mapeo manual en el repositorio** (recomendada por defecto). El repositorio conoce el modelo ORM
y la entidad; dos funciones privadas `toDomain` / `toRow`. Es lo que hacen las tres plantillas:
`templates/laravel/Infrastructure/Persistence/Eloquent/EloquentInvoiceRepository.php`,
`templates/typescript/infrastructure/PrismaInvoiceRepository.ts`,
`templates/python/infrastructure/sqlalchemy_invoice_repository.py`. Coste: código repetitivo.
Beneficio: dominio completamente puro, esquema y modelo evolucionan por separado.

**2. Data mapper explícito** (una clase `InvoiceMapper` por agregado). Igual que la anterior pero
extraída, útil cuando el mismo mapeo lo usan varios adaptadores (repositorio, proyector, importador)
o cuando el agregado tiene más de tres tablas.

```php
final class InvoiceMapper
{
    public static function toDomain(InvoiceModel $m): Invoice { /* reconstitute */ }
    public static function fillModel(InvoiceModel $m, Invoice $invoice): void { /* columnas */ }
    /** @return array<int, array<string, mixed>> */
    public static function linesToRows(Invoice $invoice): array { /* filas hijas */ }
}
```

**3. ORM como adaptador transparente** (imperative mapping de SQLAlchemy, Doctrine con XML/attributes
en clases puras). La entidad se persiste sin clase ORM: el ORM instrumenta la clase de dominio en
arranque. Menos código, pero la entidad queda instrumentada (proxies, `__slots__` y `frozen` chocan,
lazy loading implícito). Elegirla solo con SQLAlchemy/Doctrine y agregados de tabla única o casi;
ver `sqlalchemy.md`. Eloquent y Prisma no la soportan: Eloquent es Active Record y Prisma genera
tipos planos.

Criterio de decisión rápido:

| Situación | Estrategia |
|---|---|
| Laravel, Prisma, Drizzle | 1 (o 2 si el mapeo se comparte) |
| SQLAlchemy con VO en varias columnas, dataclasses frozen | 1 |
| SQLAlchemy con entidad simple y equipo que domina el ORM | 3 |
| Agregado con 4+ tablas o mapeo reutilizado por proyecciones | 2 |

## Reconstitución: la factoría fromPersistence

Crear un agregado desde negocio y rehidratarlo desde la BD son operaciones distintas. La primera
valida y emite eventos; la segunda restaura un estado que ya fue válido cuando se guardó, sin
volver a pasar por las transiciones (una factura emitida no se "vuelve a emitir" al cargarla).

```php
// templates/laravel/Domain/Model/Invoice.php
public static function draftFor(InvoiceId $id, CustomerId $customerId, string $currency = 'EUR'): self
{
    return new self($id, $customerId, InvoiceStatus::Draft, null, null, $currency);   // negocio
}

/** Solo la usa el repositorio. No valida transiciones, no emite eventos. */
public static function reconstitute(
    InvoiceId $id, CustomerId $customerId, InvoiceStatus $status, ?InvoiceNumber $number,
    ?DateTimeImmutable $issuedAt, string $currency, array $lines,
): self {
    $invoice = new self($id, $customerId, $status, $number, $issuedAt, $currency);
    $invoice->lines = $lines;
    return $invoice;
}
```

Reglas para `reconstitute` / `fromPersistence`:

- Constructor privado; `reconstitute` es la única puerta técnica y está documentada como tal.
- Recibe VO ya construidos (`InvoiceId`, `Money`), no escalares: la validación de formato ocurre en
  el mapper; si la BD contiene un valor imposible, falla al cargar, no dentro de una regla.
- No emite eventos ni toca `_events`. Si el ORM exige constructor vacío (Doctrine), usa
  `ReflectionClass::newInstanceWithoutConstructor` en el mapper, nunca un constructor público vacío.
- En TypeScript el argumento es un objeto con nombre de campos (`Invoice.reconstitute({...})`),
  lo que evita errores de orden; en Python, keyword-only (`def reconstitute(*, id, ...)`).

Anti-simetría: `toRow` lee la entidad con getters de intención (`status()`, `lines()`, `total()`).
Si necesitas exponer algo solo para persistir (por ejemplo `issuedAt()`), es aceptable; lo que no
es aceptable es un setter para rehidratar.

## Value objects embebidos

Un VO no tiene tabla ni id: se aplana en columnas de la tabla del propietario. `Money` son
`total_cents` + `currency`; `Period` son `starts_at` + `ends_at`; `Address` son cinco columnas
con prefijo. El mapper es el único que conoce esa correspondencia.

```ts
// Prisma: columnas planas -> VO en el mapper
const row = await this.client().invoice.findUnique({ where: { id }, include: { lines: true } });
const total = Money.of(row.totalCents, row.currency);
```

```python
# SQLAlchemy declarativo: composite() evita el mapeo manual para VO simples
from sqlalchemy.orm import composite
class InvoiceModel(Base):
    total_cents: Mapped[int]
    currency: Mapped[str] = mapped_column(String(3))
    total: Mapped[Money] = composite(Money, "total_cents", "currency")   # Money(frozen) debe ser posicional
```

Decisiones:

- **Un VO compartido por varias columnas del mismo agregado** (moneda de la factura y de cada línea):
  persiste la moneda una vez en la raíz y reconstrúyela en cada línea al cargar (así lo hace la
  plantilla Python). Evita inconsistencias que el dominio ya prohíbe.
- **VO con lista interna** (`Tags`, `PhoneNumbers`): columna JSON si nunca se consulta por elemento;
  tabla hija si se filtra o se indexa. JSON no es una excusa para guardar el agregado entero.
- **Enums**: columna `string` con el `value` del enum; nunca el ordinal. `InvoiceStatus::from($row)`
  falla ruidosamente si aparece un valor desconocido, que es lo deseado.
- **Fechas**: la BD guarda UTC con zona; el mapper convierte a `DateTimeImmutable` / `datetime`
  aware. Carbon y `Date` del ORM no cruzan la frontera.

## Colecciones hijas del agregado

Las entidades hijas (`InvoiceLine`) viven en su tabla, con FK a la raíz, pero solo se cargan y
guardan a través de la raíz. Tres formas de persistir la colección:

| Estrategia | Cuándo | Coste |
|---|---|---|
| Reemplazo completo (`delete` + `insert`) | < ~50 hijas, sin FK entrantes a las hijas | Simple, correcto, lo hacen las plantillas |
| Diff por id (insert nuevas, update cambiadas, delete ausentes) | Hijas referenciadas desde fuera o cientos de filas | Más código, un test de cada rama |
| Tracking de cambios en el agregado (`addedLines()`, `removedLines()`) | Colecciones grandes con escrituras frecuentes | Contamina la entidad con preocupaciones de persistencia; último recurso |

```php
// Diff por id en el repositorio (estrategia 2)
$existing = $model->lines()->pluck('id')->all();
$current  = array_map(fn (InvoiceLine $l) => $l->id, $invoice->lines());
$model->lines()->whereIn('id', array_diff($existing, $current))->delete();
foreach ($invoice->lines() as $line) {
    $model->lines()->updateOrCreate(['id' => $line->id], InvoiceMapper::lineToRow($line));
}
```

Si una colección crece sin límite (movimientos de una cuenta, mensajes de un hilo), no es una
colección hija: es otro agregado que referencia a la raíz por id, y la raíz guarda solo lo
agregado (saldo, contador). Ver `../tactical/overview-concepts.md` sobre tamaño de agregados.

Orden: si el orden de las hijas importa al dominio, persiste una columna `position`; no confíes en
el orden de inserción ni en el id.

## Lazy loading fuera del dominio

El lazy loading es una optimización del ORM que rompe la frontera del agregado: una entidad con
una relación perezosa arrastra la sesión o la conexión dentro del dominio, y un test unitario que
toque esa relación acaba abriendo una consulta.

Reglas:

- El repositorio carga el agregado **completo** en una consulta (`with('lines')`,
  `include: { lines: true }`, `selectinload`) y lo entrega desconectado. Después de `ofId` no hay
  más SQL hasta `save`.
- Lo que no cabe en una carga es un read model (`read-models-and-projections.md`) o un agregado
  aparte, nunca una relación perezosa.
- Referencias a otros agregados: el dominio guarda `CustomerId`, no `Customer`. Si un caso de uso
  necesita datos del cliente, los pide a su repositorio o a un read model.
- Con imperative mapping de SQLAlchemy, `lazy="selectin"` o `"joined"` en cada relación del
  agregado y `expire_on_commit=False` en la sesión; de lo contrario, acceder a un atributo tras el
  commit dispara una consulta o un `DetachedInstanceError`.

## Identidad, versión y metadatos técnicos

- **Id generado por la aplicación** (UUID v7, ULID): el agregado nace con id, el repositorio ofrece
  `nextId()`. Autoincrementales obligan a persistir antes de tener identidad, lo que rompe
  `draftFor` y el registro de eventos con id.
- **`version`** para bloqueo optimista: columna técnica que el dominio puede exponer como entero
  opaco (`version()`) sin usarla en reglas. El repositorio la incrementa y comprueba en `save`;
  ver `eloquent-pitfalls.md` y `sqlalchemy.md`.
- **`created_at` / `updated_at`**: metadatos de fila. Si el dominio necesita "cuándo se emitió",
  es una columna propia (`issued_at`) que el agregado decide, no `updated_at`.
- **Soft delete**: es un estado de dominio (`archived`, `voided`) o no existe. `deleted_at` con
  scope global esconde filas al repositorio y a las proyecciones de formas difíciles de razonar.
- **Multi-tenant**: `tenant_id` llega en el command y el repositorio lo añade en cada consulta;
  el agregado lo lleva como VO si forma parte de su identidad lógica.

## Errores frecuentes

- Exponer setters públicos "solo para el repositorio": acaban usándose desde controladores.
- `reconstitute` que llama a métodos de negocio (`issue()`) para "reproducir" el estado: emite
  eventos duplicados y falla cuando cambian las reglas.
- Devolver el modelo ORM desde el repositorio "por comodidad" en un método concreto; a partir de
  ahí el dominio importa el ORM.
- Guardar el agregado como JSON entero en una columna para no mapear: pierde consultabilidad,
  migraciones y bloqueo por fila; solo válido para event sourcing o documentos reales.
- Relación bidireccional `Line -> Invoice` en el modelo ORM que el mapper también copia al
  dominio: ciclo de referencias, serialización rota, agregado sin frontera.
- Mapear en el controlador o en el Resource: dos mapeos distintos del mismo agregado divergen.
- Olvidar la moneda o la zona horaria al reconstruir VO: el test de ida y vuelta lo detecta
  (`../testing/adapter-tests.md`).

## Checklist

- [ ] La entidad no extiende ni importa nada del ORM; el modelo ORM vive en `Infrastructure`.
- [ ] Existe `reconstitute`/`fromPersistence` con constructor privado, sin eventos ni validación de transición.
- [ ] Cada VO se aplana en columnas y solo el mapper conoce esa correspondencia.
- [ ] Las hijas se cargan con la raíz en una consulta y se guardan con una estrategia explícita y testeada.
- [ ] Ningún atributo del dominio es una relación perezosa; referencias a otros agregados son ids.
- [ ] Id generado por la aplicación; `version` presente si hay concurrencia real.
- [ ] Test de ida y vuelta `save -> ofId -> equals` para cada agregado contra BD real.
- [ ] Un solo sitio de mapeo por agregado (repositorio o mapper), reutilizado por proyecciones.
