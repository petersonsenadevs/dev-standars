# Migraciones guiadas por el dominio

## Índice

- [El esquema sigue al modelo, no al revés](#el-esquema-sigue-al-modelo-no-al-revés)
- [Expand y contract](#expand-y-contract)
- [Compatibilidad entre versiones de código y de esquema](#compatibilidad-entre-versiones-de-código-y-de-esquema)
- [Datos legacy y valores imposibles](#datos-legacy-y-valores-imposibles)
- [No romper agregados](#no-romper-agregados)
- [Migraciones por módulo y por stack](#migraciones-por-módulo-y-por-stack)
- [Backfills y migraciones de datos](#backfills-y-migraciones-de-datos)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Requisitos previos: mapeo entidad/tabla en `orm-mapping.md`; tablas de lectura reconstruibles en
`read-models-and-projections.md`. Este documento cubre cómo cambiar el esquema cuando el dominio
cambia, sin parar el servicio ni corromper agregados.

## El esquema sigue al modelo, no al revés

Un cambio de dominio (nuevo VO, nueva transición, un campo que pasa de opcional a obligatorio)
produce un cambio de esquema; nunca al contrario. El orden de trabajo:

1. Cambia el agregado y sus tests de dominio (`../testing/domain-tests.md`). Todavía sin BD.
2. Ajusta `reconstitute` y el mapper: aquí aparece qué columnas faltan o sobran.
3. Escribe la migración **aditiva** y actualiza el repositorio para leer ambas formas si hace falta.
4. Backfill de datos existentes con una migración de datos idempotente.
5. Migración de **contracción** cuando ya nada lee la forma antigua.

El test de ida y vuelta del repositorio (`save -> ofId -> equals`) es el que detecta que el mapper
y el esquema se han desalineado; corre en CI contra la BD real (`../testing/adapter-tests.md`).

Nombres de columnas en lenguaje ubicuo: `issued_at`, no `date2`; `status` con los valores del
enum del dominio, no códigos numéricos. La tabla es un artefacto de infraestructura, pero la lee
gente (soporte, analítica) y la migración es documentación viva.

## Expand y contract

Cualquier cambio no aditivo (renombrar, cambiar tipo, hacer obligatorio, partir una tabla) se
hace en tres despliegues para que en todo momento convivan una versión de código y dos de esquema
o viceversa.

| Fase | Esquema | Código | Ejemplo: `Money` pasa de `total` decimal a `total_cents` + `currency` |
|---|---|---|---|
| Expand | Añade lo nuevo, nullable o con default | Escribe en ambos, lee lo nuevo con fallback a lo viejo | `add total_cents int null, currency char(3) null` |
| Backfill | Rellena lo nuevo desde lo viejo | Job por lotes, idempotente | `update ... set total_cents = round(total*100), currency = 'EUR' where total_cents is null` |
| Contract | Elimina lo viejo, añade `not null` y constraints | Escribe y lee solo lo nuevo | `drop column total; alter total_cents set not null` |

```php
// Laravel, fase expand. Un archivo por fase; la de contract se despliega un release después.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->bigInteger('total_cents')->nullable()->after('total');
            $table->char('currency', 3)->nullable()->after('total_cents');
        });
    }
    public function down(): void
    {
        Schema::table('invoices', fn (Blueprint $t) => $t->dropColumn(['total_cents', 'currency']));
    }
};
```

```python
# Alembic, fase contract: solo cuando el backfill ha terminado y ninguna versión lee `total`.
def upgrade() -> None:
    op.alter_column("invoices", "total_cents", nullable=False)
    op.alter_column("invoices", "currency", nullable=False)
    op.drop_column("invoices", "total")
```

Con Prisma, `prisma migrate dev --create-only` genera el SQL para editarlo a mano (Prisma marca
`NOT NULL` sin default como cambio destructivo); con Drizzle, `drizzle-kit generate` y edita el
`.sql` resultante. Ver `prisma-drizzle.md`.

Renombrar columna: no uses `renameColumn` en tablas grandes con tráfico; es expand (nueva
columna) + backfill + contract (drop). En Postgres el rename es instantáneo pero rompe la versión
anterior del código durante el despliegue.

## Compatibilidad entre versiones de código y de esquema

Durante un despliegue con varias réplicas conviven N y N+1. Reglas:

- **El código N+1 debe funcionar con el esquema N y N+1** (arranca antes de migrar o migra
  después de arrancar, según la plataforma). Por eso expand es nullable.
- **El código N debe funcionar con el esquema N+1**: columnas nuevas con default o nullable, sin
  `not null` sin default, sin borrar columnas que N escribe.
- Enum: añadir un valor nuevo al dominio antes de que la BD lo permita (`check constraint`,
  enum de Postgres) falla en producción con el primer agregado que lo use. Orden: migración que
  amplía el `check` -> despliegue del código. Retirar un valor: código deja de producirlo ->
  backfill de filas con ese valor -> constraint que lo prohíbe.
- Índices en tablas grandes: `CREATE INDEX CONCURRENTLY` (Postgres) fuera de transacción;
  en Laravel `Schema::table` no lo soporta, usa `DB::statement` con `$withinTransaction = false`
  en la migración. En Alembic, `op.create_index(..., postgresql_concurrently=True)` con
  `autocommit_block()`.

El repositorio tolera ambas formas durante expand:

```ts
// Drizzle, lectura con fallback durante la fase expand
function toDomain(row: InvoiceRow): Invoice {
  const total = row.totalCents !== null
    ? Money.of(row.totalCents, row.currency ?? 'EUR')
    : Money.fromDecimal(row.total, 'EUR');            // forma antigua; eliminar en contract
  return Invoice.reconstitute({ ...fields(row), total });
}
```

Marca el fallback con un comentario y una tarea; el contract lo borra. Un fallback que sobrevive
tres releases es deuda invisible.

## Datos legacy y valores imposibles

El dominio nuevo tiene invariantes que los datos antiguos no cumplen: facturas emitidas sin
líneas, importes negativos, estados que ya no existen. `reconstitute` no valida transiciones, pero
los VO sí validan formato, así que cargar esas filas lanza excepciones.

Estrategias, de preferida a último recurso:

1. **Corregir los datos** con un backfill antes del despliegue, verificado con una consulta de
   conteo que debe dar cero (`select count(*) from invoices where status = 'issued' and not
   exists (select 1 from invoice_lines l where l.invoice_id = invoices.id)`).
2. **Estado explícito de cuarentena** en el dominio (`InvoiceStatus::Legacy`) que solo permite
   lectura y una transición de saneamiento. Es honesto: el agregado sabe que existe historia.
3. **Relajar el VO con un constructor de rehidratación** (`Money::unchecked`) usado solo por el
   mapper. Peligroso: el VO deja de garantizar; documenta y planifica su retirada.
4. **Excluir en el repositorio** (`where('status', '!=', 'legacy')`) y tratar esas filas con un
   proceso aparte. Solo si no forman parte del negocio actual.

Nunca hagas `try/catch` en `reconstitute` para "saltar" líneas inválidas: el agregado cargado
sería una versión parcial que luego se guarda y destruye datos.

```python
# Backfill idempotente en Alembic: por lotes, sin cargar el ORM de dominio
def upgrade() -> None:
    conn = op.get_bind()
    while True:
        rows = conn.execute(text(
            "select id from invoices where total_cents is null limit 1000")).scalars().all()
        if not rows:
            break
        conn.execute(text(
            "update invoices set total_cents = round(total * 100), currency = 'EUR' "
            "where id = any(:ids)"), {"ids": rows})
```

Las migraciones de datos no importan el dominio ni el repositorio: el código de dominio cambiará
y la migración debe seguir ejecutándose igual dentro de un año.

## No romper agregados

La frontera del agregado impone restricciones al esquema:

- **Todas las tablas del agregado se migran juntas** y en la misma migración cuando el cambio
  afecta a la consistencia (partir `invoice_lines` en dos tablas, mover `currency` de líneas a
  raíz). Una migración a medias deja al repositorio sin poder reconstruir.
- **FK con `on delete cascade` de hijas a raíz**, nunca al revés ni entre agregados. Una FK entre
  agregados (`invoices.customer_id -> customers.id`) es opcional: garantiza integridad
  referencial, pero impide borrar o archivar clientes sin tocar facturas. Decide por agregado y
  documenta; en contextos separados (otras BD, otros módulos), no hay FK: se guarda el id.
- **Extraer un agregado** de otro (los pagos dejan de ser hijas de la factura): expand crea
  `payments` con `invoice_id`, backfill copia, el nuevo repositorio `PaymentRepository` lee de
  la nueva tabla, el `InvoiceRepository` deja de cargar pagos, contract borra la relación. El
  agregado `Invoice` conserva lo agregado que necesita (`paid_cents`) como columna propia,
  actualizada por evento (`PaymentRegistered`).
- **Fusionar agregados**: raro y caro; normalmente es señal de que la frontera original era
  correcta y falta un servicio de dominio o un read model.
- **Bloqueo optimista**: añadir `version int not null default 0` es seguro en expand; el
  repositorio empieza a comprobarla en el mismo release.

## Migraciones por módulo y por stack

| Stack | Ubicación | Registro |
|---|---|---|
| Laravel | `src/<Ctx>/Infrastructure/Persistence/Migrations/` | `$this->loadMigrationsFrom(...)` en el ServiceProvider del módulo |
| Prisma | `prisma/schema.prisma` único (Prisma no soporta varios esquemas por proyecto sin multi-file) | `prisma/schema/` con un archivo por módulo (`prismaSchemaFolder`) |
| Drizzle | `src/modules/<ctx>/infrastructure/schema.ts` | `drizzle.config.ts` con `schema: ['./src/modules/*/infrastructure/schema.ts']` |
| SQLAlchemy | `src/<ctx>/infrastructure/orm.py` | Alembic con `target_metadata = [invoicing.Base.metadata, sales.Base.metadata]` |

Todas las migraciones de todos los módulos se ordenan en una única historia (timestamp o
revisión de Alembic): dos módulos no deben tocar la misma tabla. Si lo hacen, la tabla pertenece
a uno y el otro la lee vía read model o evento.

Laravel: `php artisan migrate --pretend` en CI para revisar el SQL; `schema:dump` para acortar la
historia sin perder migraciones por módulo. Alembic: `alembic check` en CI detecta modelos que
divergen del esquema migrado. Prisma: `prisma migrate diff --exit-code` con el mismo fin.

## Backfills y migraciones de datos

- Separadas de las migraciones de esquema (otro archivo, otro comando o job), porque tardan y
  fallan por razones distintas. En Laravel, un comando Artisan del módulo con `--chunk`; en
  Python, un script en `infrastructure/scripts/` o la propia revisión Alembic si es pequeña.
- Idempotentes: `where nueva is null`, o tabla de progreso. Se pueden relanzar.
- Por lotes con pausa; sin `select *` de la tabla entera; sin cargar agregados por el
  repositorio (miles de `reconstitute` + `save` es lento y dispara eventos si te descuidas).
- Si el backfill **debe** pasar por el dominio (recalcular totales con reglas actuales), es un
  caso de uso (`RecalculateInvoiceTotals`) ejecutado por comando, con eventos silenciados de forma
  explícita y test propio.
- Verificación al final: consulta de conteo esperada y un muestreo de filas cargadas por el
  repositorio real.

## Errores frecuentes

- Migración que cambia tipo y hace `not null` en un solo paso sobre tabla con tráfico.
- Backfill que importa `Invoice` y el repositorio: seis meses después el dominio cambió y la
  migración ya no compila o hace otra cosa.
- Borrar una columna que la versión anterior del código todavía escribe: errores 500 durante el
  despliegue.
- Enum del dominio ampliado sin ampliar el `check` de la BD.
- Migración de esquema y de datos en el mismo archivo con transacción implícita: bloquea la
  tabla durante minutos.
- Read model migrado "a mano" en vez de reconstruido desde la fuente
  (`read-models-and-projections.md`).
- `down()` que no invierte lo que `up()` hizo, o que borra datos sin copia: en producción no se
  hace rollback de esquema, se avanza con otra migración.
- Migraciones de dos módulos que alteran la misma tabla.

## Checklist

- [ ] El cambio empezó por el agregado y sus tests; la migración es consecuencia.
- [ ] Cambios no aditivos en tres fases (expand, backfill, contract) en releases separados.
- [ ] Versión N del código funciona con esquema N+1 y viceversa.
- [ ] Backfill idempotente, por lotes, sin importar dominio ni repositorio.
- [ ] Datos legacy corregidos o modelados como estado explícito; sin `try/catch` en `reconstitute`.
- [ ] Todas las tablas del agregado migran juntas; FK cascade solo de hijas a raíz.
- [ ] Migraciones registradas por módulo; ninguna tabla compartida entre módulos.
- [ ] `migrate --pretend` / `alembic check` / `prisma migrate diff` en CI; test de ida y vuelta en verde.
