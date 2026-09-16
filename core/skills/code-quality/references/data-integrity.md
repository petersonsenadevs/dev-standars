# Integridad de datos: dinero, fechas, concurrencia y borrados

## Índice
- [Dinero](#dinero)
- [Fechas y zonas horarias](#fechas-y-zonas-horarias)
- [Transacciones](#transacciones)
- [Concurrencia y race conditions](#concurrencia-y-race-conditions)
- [Unicidad y duplicados](#unicidad-y-duplicados)
- [Borrados (soft delete y derecho al olvido)](#borrados-soft-delete-y-derecho-al-olvido)
- [IDs](#ids)
- [Checklist](#checklist)

## Dinero
- **NUNCA float**. Enteros en la unidad mínima (céntimos) o `DECIMAL(12,2)` en BD; en código, value object
  o librería (PHP `brick/money`, JS enteros en céntimos o `dinero.js`, Python `Decimal`).
- La moneda viaja SIEMPRE con la cantidad (`{amount: 1999, currency: 'EUR'}`); no sumes monedas distintas.
- Redondeo: define la regla una vez (half-up por línea vs sobre el total — en facturación española, por línea
  y el IVA según agencia tributaria) y testéala con casos de céntimos impares.
- Los totales se recalculan del detalle; si los persistes (snapshot de factura), no se recalculan nunca más:
  una factura emitida es inmutable.

## Fechas y zonas horarias
- **BD y servidor en UTC**; conversión a zona del usuario SOLO al mostrar (y la zona se guarda en el perfil o
  se detecta, no se asume Madrid).
- Tipos con zona (`timestamptz` en Postgres); en código, objetos datetime conscientes (Carbon con tz, `Temporal`/
  date-fns-tz, `datetime` aware — nunca naive).
- "Fecha sin hora" (cumpleaños, vencimiento) es un tipo distinto: `DATE`, sin conversión de zona (el clásico
  bug del día anterior viene de convertir fechas puras).
- Rangos: `[inicio, fin)` — inclusivo/exclusivo — y compáralo siempre igual. "Hoy" se calcula en la zona del
  usuario, no del servidor.
- Programación futura (recordatorios): guarda la hora local Y la zona; una hora UTC fija se rompe con el
  cambio horario.

## Transacciones
- Toda escritura multi-tabla va en transacción; o todo o nada (pedido + líneas + stock).
- Transacciones CORTAS: nada de HTTP/emails/colas dentro (encola DESPUÉS de commit — Laravel `afterCommit`,
  o el patrón outbox de ddd si necesitas garantía).
- Lo que sale de la transacción tras rollback no existió: cuidado con efectos ya disparados (logs ok, emails no).

## Concurrencia y race conditions
Síntomas: doble clic = doble pedido, dos admins pisándose, stock en negativo, contadores mal.
- **Check-then-act es el bug**: entre "¿hay stock?" y "resta stock" entra otra request. Soluciones:
  - Escritura atómica condicional: `UPDATE stock = stock - 1 WHERE id = ? AND stock >= 1` y mira filas afectadas.
  - **Lock pesimista** (`SELECT ... FOR UPDATE` / `lockForUpdate`) cuando la sección crítica es corta y caliente.
  - **Lock optimista** (columna `version`; el UPDATE exige la versión leída; si 0 filas → reintenta o avisa
    "otro usuario ha modificado esto") para edición de formularios.
- Doble submit: clave de idempotencia por operación (token del formulario u `Idempotency-Key` en API) +
  restricción única que lo respalde en BD. El disable del botón es UX, no protección.
- Contadores calientes (visitas, likes): incremento atómico o acumulación en Redis con volcado periódico;
  nunca leer-sumar-guardar.

## Unicidad y duplicados
- La regla de negocio "no puede haber dos X" se garantiza con **UNIQUE en BD**, no con un `exists()` previo
  (eso es check-then-act). El código captura la violación y responde bonito.
- Únicos compuestos con soft delete: incluye `deleted_at` en el índice único (o índice parcial `WHERE deleted_at IS NULL`).
- Normaliza antes de comparar/guardar: emails en minúscula, teléfonos E.164, espacios fuera.

## Borrados (soft delete y derecho al olvido)
- Soft delete SOLO si hay requisito real (recuperación, histórico); si no, borra: los `deleted_at` olvidados
  contaminan todas las queries y los únicos.
- Con soft delete: revisa CADA lugar que deba (o no) incluir borrados; los conteos y agregados suelen olvidarlo.
- RGPD: "borrar mi cuenta" = borrado o anonimización REAL de PII (también en backups programados y logs),
  no un `deleted_at`. Documenta qué se conserva por obligación (facturas) y su base legal.
- Cascadas explícitas y decididas (¿borrar usuario borra sus pedidos? normalmente NO: se anonimiza el usuario).

## IDs
- Interno: autoincrement/bigint (barato, ordenado). Expuesto en URLs/API: UUID v7 o ULID + nunca revelar
  conteos de negocio con ids secuenciales (y evita IDOR: `security-owasp.md`).
- No uses el id como número de factura: la numeración legal es una secuencia propia sin huecos.

## Checklist
- [ ] Dinero en céntimos/DECIMAL con moneda; regla de redondeo única y testeada; facturas inmutables.
- [ ] UTC en BD; datetimes aware; fechas puras como DATE; "hoy" en la zona del usuario.
- [ ] Escrituras multi-tabla en transacción corta; encolar tras commit.
- [ ] Puntos de doble ejecución protegidos (atómico, lock o idempotency key) y UNIQUE en BD como última red.
- [ ] Soft delete solo con motivo; RGPD con borrado/anonimización real.
- [ ] IDs expuestos no secuenciales; consultas filtradas por propietario.
