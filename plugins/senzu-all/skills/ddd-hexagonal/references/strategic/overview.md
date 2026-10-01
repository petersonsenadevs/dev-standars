# Diseño estratégico: contextos, lenguaje y mapa

Índice
1. Para qué sirve (y cuándo saltárselo)
2. Bounded context
3. Lenguaje ubicuo: glosario por contexto
4. Context map: tipos de relación
5. Event storming exprés (90 minutos)
6. Cortar un monolito modular por contextos
7. Cuándo un contexto merece módulo o servicio propio
8. Plantilla de ficha de contexto
9. Errores habituales

---

## 1. Para qué sirve (y cuándo saltárselo)

El diseño estratégico responde a "dónde acaba un modelo y empieza otro". Sin esto, el
diseño táctico produce un único modelo gigante donde `Customer` tiene 60 campos porque
ventas, facturación y soporte quieren cosas distintas.

Sáltatelo si: aplicación de un solo equipo, un solo dominio de negocio pequeño (< ~10
agregados), sin integraciones externas relevantes. Ahí basta un módulo y buen diseño táctico.

## 2. Bounded context

Frontera explícita dentro de la cual un modelo y un lenguaje son consistentes. El mismo
término puede significar cosas distintas en dos contextos, y eso es correcto:

| Término | Ventas | Facturación | Logística |
|---|---|---|---|
| Cliente | lead con probabilidad de cierre | entidad fiscal con NIF y dirección de facturación | destinatario con dirección de entrega |
| Producto | ficha con precios y descuentos | línea con tipo impositivo | bulto con peso y dimensiones |
| Pedido | oportunidad convertida | base para emitir factura | lista de envíos |

Señales de que tienes dos contextos y no uno:
- Mismo nombre, distintos atributos e invariantes según quién habla.
- Equipos o roles distintos "poseen" partes distintas del modelo.
- Ritmo de cambio distinto (facturación cambia con la ley; ventas, con marketing).
- Una entidad con campos que casi siempre son null porque "no aplican aquí".

Un contexto se materializa en código como **un módulo** (`src/Invoicing/`,
`src/modules/invoicing/`, `src/invoicing/`) con su propio `Domain/Application/Infrastructure`.

## 3. Lenguaje ubicuo: glosario por contexto

El glosario es un archivo por contexto (`docs/contexts/invoicing.md` o en la ficha, §8).
Cada término: definición de una frase, sinónimos prohibidos, nombre en código.

```
Factura (Invoice): documento fiscal emitido a un cliente por servicios prestados.
  Estados: Draft -> Issued -> Paid | Voided. No se edita tras Issued.
  NO llamar: "ticket", "albarán", "recibo". Código: Invoice, InvoiceStatus.
Emitir (issue): pasar de Draft a Issued, asignando número correlativo y fecha.
  Código: Invoice::issue(), InvoiceIssued.
Anular (void): invalidar una Issued sin borrarla; genera rectificativa si estaba pagada.
```

Reglas: el código usa los términos del glosario tal cual (en inglés). Si en la reunión
alguien dice "cerrar la factura" y en código pone `issue`, o cambias el código o el
glosario. Los tests de dominio se leen como frases del glosario.

## 4. Context map: tipos de relación

El mapa dice cómo se relacionan dos contextos y **quién manda** sobre el modelo compartido.

| Relación | Significado | Cuándo usarla | Coste |
|---|---|---|---|
| **Shared kernel** | dos contextos comparten código/modelo (un paquete `Shared/`) | equipos muy cercanos, tipos realmente universales (`Money`, `UserId`) | cualquier cambio requiere acuerdo; mantenerlo mínimo |
| **Customer–Supplier** | upstream (supplier) provee; downstream (customer) influye en su roadmap | dos equipos de la misma empresa con negociación real | reuniones de contrato; tests de contrato |
| **Conformist** | downstream adopta el modelo del upstream tal cual | el upstream no negocia (SaaS externo) y su modelo es aceptable | tu dominio se contamina con su vocabulario |
| **Anti-Corruption Layer** | downstream traduce el modelo del upstream al suyo | upstream legacy o externo con modelo malo/inestable | código de traducción; vale la pena casi siempre con terceros |
| **Open Host Service** | upstream publica una API estable y documentada para muchos consumidores | un contexto consumido por varios | versionado, compatibilidad |
| **Published Language** | formato común acordado (JSON schema, eventos versionados) | integración por eventos entre contextos | gobernanza del esquema |
| **Separate ways** | no se integran | el coste de integrar supera el beneficio | duplicación consciente |

Notación mínima en texto (vale para un README):

```
[Sales] --(customer/supplier, eventos OrderConfirmed v1)--> [Invoicing]
[Invoicing] --(ACL sobre API REST)--> [Stripe]
[Invoicing] --(conformist)--> [Auth: UserId, TenantId]
[Shared kernel: Money, Currency, Clock] usado por Sales, Invoicing
```

Regla por defecto en proyectos de agencia: **ACL frente a todo lo externo**, **eventos
con published language** entre contextos propios, **shared kernel diminuto** (VO
técnicos). Customer–supplier solo si hay dos equipos de verdad.

## 5. Event storming exprés (90 minutos)

Formato reducido para una feature o un dominio pequeño. Post-its o tablero digital
(FigJam/Miro). Participantes: 1 persona de negocio, 2-4 devs, un facilitador.

| Min | Paso | Salida |
|---|---|---|
| 0-10 | Contexto: qué proceso cubrimos, de dónde a dónde | una frase de alcance |
| 10-35 | **Eventos** (naranja): hechos en pasado, "Factura emitida", "Pago recibido". Todos escriben, sin filtrar. Ordenar en línea temporal | 20-60 eventos ordenados |
| 35-50 | **Comandos** (azul) y **actores** (amarillo): qué acción/quién provoca cada evento. "Emitir factura" <- Administrador | comandos delante de cada evento |
| 50-65 | **Agregados** (amarillo grande): agrupar comando+evento por "la cosa que decide". Si un comando necesita datos de dos cosas, marca un **hotspot** (rojo) | candidatos a agregado |
| 65-80 | **Contextos**: rodear agrupaciones por vocabulario/actor. Donde cambia el significado de una palabra, línea | 2-5 contextos |
| 80-90 | **Políticas** (lila): "cuando X, entonces Y" = suscriptores de eventos, y decisión de qué es síncrono | lista de reacciones; hotspots pendientes |

Salida mínima: foto del tablero + tabla `evento | comando | agregado | contexto |
política`. De ahí sale directamente `Domain/Event`, `Application/Command` y la ficha de
contexto (§8). No intentes modelar campos: eso es diseño táctico y va después.

## 6. Cortar un monolito modular por contextos

Orden recomendado (incremental, cada paso deja el sistema funcionando):

1. **Nombrar** contextos en un documento aunque el código siga mezclado. Etiqueta cada
   tabla/modelo con su contexto propietario.
2. **Mover archivos** a `src/<Context>/` sin cambiar código (solo namespaces y autoload).
   Los imports cruzados quedan a la vista.
3. **Prohibir dependencias cruzadas** con deptrac / dependency-cruiser / import-linter en
   modo warning; medir cuántas hay.
4. **Sustituir** cada import cruzado por:
   - un **id** (referencia por identidad, no por objeto),
   - una **query** al otro contexto (puerto en el consumidor, adaptador que lee su tabla o API),
   - un **evento** si es una reacción ("cuando se confirma el pedido, crea factura borrador").
5. **Datos**: cada contexto es dueño de sus tablas. Otro contexto puede *leer* (read model)
   pero no *escribir*. Foreign keys entre contextos: aceptables al principio, se eliminan
   cuando el contexto se extraiga.
6. Pasar el linter a modo error. Ahora sí, cada contexto puede evolucionar solo.

Contextos habituales que salen "gratis": `Identity/Auth`, `Billing`, `Notifications`,
`Catalog`, y el contexto core del negocio. `Shared/` solo con VO técnicos y utilidades.

## 7. Cuándo un contexto merece módulo o servicio propio

| Nivel | Cuándo |
|---|---|
| **Carpeta dentro de un módulo** | < 3 agregados, mismo equipo, mismo ritmo de cambio |
| **Módulo propio** (mismo deploy) | vocabulario propio, >= 3 agregados o integración externa, quieres reglas de dependencia |
| **Paquete/librería** | dos aplicaciones distintas lo usan (ej. `Money`, cliente de una API interna) |
| **Servicio desplegable aparte** | equipo propio, escalado o SLA distinto, tecnología distinta (LangGraph en Python junto a Laravel), o aislamiento de fallos. Nunca "porque es DDD" |

Regla: empieza siempre en módulo dentro del monolito. Un módulo con puertos bien
definidos se extrae a servicio en días; un servicio prematuro cuesta meses de red,
observabilidad y consistencia eventual.

## 8. Plantilla de ficha de contexto

Un archivo por contexto (`docs/contexts/<name>.md` o en el README del módulo).

```markdown
# Contexto: Invoicing

**Propósito**: emitir, cobrar y anular facturas conforme a la normativa fiscal.
**Propietario**: equipo Backend (responsable: <nombre>).
**Módulo**: `src/Invoicing` · namespace `App\Invoicing` · tablas `invoices`, `invoice_lines`, `invoice_sequences`.

## Glosario
| Término | Definición | Código |
|---|---|---|
| Factura | ... | `Invoice` |
| Emitir | ... | `Invoice::issue`, `InvoiceIssued` |

## Agregados
- `Invoice` (raíz) -> `InvoiceLine[]`; invariantes: sin líneas no se emite; inmutable tras emitir.
- `InvoiceSequence`: numeración correlativa por serie y año.

## Casos de uso (puertos driving)
- `IssueInvoice`, `VoidInvoice`, `RegisterPayment`, `ListPendingInvoices` (query).

## Puertos driven
- `InvoiceRepository`, `InvoiceSequenceRepository`, `PaymentGateway` (ACL Stripe), `Clock`, `EventBus`.

## Eventos publicados (published language)
- `InvoiceIssued v1 { invoiceId, customerId, total, issuedAt }`
- `InvoicePaid v1 { invoiceId, paidAt, amount }`

## Eventos consumidos
- `Sales.OrderConfirmed v1` -> crea factura borrador (política `DraftInvoiceOnOrderConfirmed`).

## Relaciones (context map)
- Sales -> Invoicing: customer/supplier vía eventos.
- Invoicing -> Stripe: ACL (`StripePaymentGateway`).
- Invoicing -> Identity: conformist (`UserId`, `TenantId` desde shared kernel).

## Decisiones y hotspots
- Descuentos se calculan en Sales; Invoicing recibe precios finales (decidido 2026-03).
- Pendiente: facturas multi-moneda.
```

## 9. Errores habituales

- **Contextos por capa técnica** (`Api`, `Database`) o por entidad (`Users`, `Products`):
  no son contextos, son carpetas. Un contexto agrupa por capacidad de negocio.
- **Un contexto por tabla**: demasiado fino; agregados de una entidad por todas partes.
- **Shared kernel gordo**: si `Shared/` tiene entidades de negocio, no es shared kernel,
  es el monolito de siempre con otro nombre.
- **Sin ACL frente a SaaS**: el modelo de Stripe/HubSpot/Salesforce acaba siendo tu dominio.
- **Mapa sin dirección**: si no sabes quién es upstream, no puedes decidir quién cambia
  cuando algo rompe.
- **Modelar campos en el event storming**: se pierde el tiempo en detalles que el
  diseño táctico resolverá mejor con tests.
