# Bounded contexts: detección, tamaño y materialización

## Índice

- [Qué es y qué no es](#qué-es-y-qué-no-es)
- [Cómo detectarlos](#cómo-detectarlos)
- [Tamaño adecuado](#tamaño-adecuado)
- [Contexto vs módulo vs servicio](#contexto-vs-módulo-vs-servicio)
- [Ejemplo: Ventas, Facturación e Inventario](#ejemplo-ventas-facturación-e-inventario)
- [Cómo se ve en código](#cómo-se-ve-en-código)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Este documento profundiza en la sección "Bounded context" de [overview](overview.md).
Para las relaciones entre contextos ver [context-mapping](context-mapping.md); para el
vocabulario, [ubiquitous-language](ubiquitous-language.md).

## Qué es y qué no es

Un bounded context es una **frontera de significado**: dentro de ella, cada término del
lenguaje ubicuo tiene exactamente una definición y un modelo la implementa. Fuera, el
mismo término puede significar otra cosa y no hay conflicto porque hay una traducción
explícita en la frontera.

Consecuencias prácticas:

- El contexto es dueño de su modelo, sus reglas y sus datos. Nadie más escribe en ellos.
- Un contexto expone una **API pública** (casos de uso, eventos, read models) y esconde el
  resto. Lo que no está en la API no existe para los demás.
- La frontera se decide por negocio y por equipo, no por tecnología ni por tabla.

No es: una capa (`Api`, `Persistence`), una entidad (`Users`), una pantalla (`Dashboard`)
ni un microservicio. Puede *materializarse* como módulo o servicio, pero es un concepto
de modelado.

## Cómo detectarlos

Tres heurísticas, en orden de fiabilidad. Si dos coinciden, la frontera es sólida.

### 1. Lenguaje

Pregunta a dos personas de áreas distintas "¿qué es un pedido?" y anota atributos e
invariantes. Divergencias = contextos distintos.

| Señal | Ejemplo |
|---|---|
| Mismo nombre, atributos distintos | `Product` con `price/discount` (Ventas) vs `weight/dimensions` (Logística) |
| Mismo nombre, estados distintos | `Order`: `Quoted/Confirmed` (Ventas) vs `Picked/Shipped` (Almacén) |
| Sinónimos que nadie unifica | "cliente" / "cuenta" / "deudor" según el departamento |
| Reglas que se contradicen | "un pedido sin stock se puede confirmar" (Ventas) vs "no" (Almacén) |

### 2. Equipos y ownership

Quién decide cuando hay conflicto sobre una regla. Si la respuesta es "depende de qué
parte", hay al menos dos contextos. Ley de Conway a favor: un contexto por equipo (o por
rol de negocio que lo patrocina) tiende a durar.

### 3. Ciclos de cambio

Qué cambia junto y por qué. Facturación cambia por normativa fiscal, una o dos veces al
año, con validación legal. Ventas cambia cada sprint por marketing. Meterlos en el mismo
modelo obliga al ritmo lento a soportar el rápido y viceversa.

```
Para cada capacidad del negocio, anota: vocabulario | quién decide | por qué cambia
Agrupa filas con las tres columnas parecidas -> candidatos a contexto
Donde una fila encaja en dos grupos -> hotspot, decidir con context map
```

## Tamaño adecuado

No hay número mágico, pero sí rangos que funcionan en un producto de tamaño medio:

| Indicador | Rango sano | Demasiado pequeño | Demasiado grande |
|---|---|---|---|
| Agregados | 2-8 | 1 (es una entidad con carpeta) | > 12 (varios vocabularios dentro) |
| Casos de uso | 5-40 | < 3 | > 60 |
| Glosario | 8-30 términos | cabe en una frase | términos con "(en el caso de...)" |
| Personas que lo entienden completo | 1 equipo | — | nadie |

Un contexto demasiado grande se nota porque las reuniones de diseño tienen que aclarar
"de qué pedido hablamos". Uno demasiado pequeño se nota porque cada caso de uso necesita
consultar a otro contexto para hacer algo útil (acoplamiento de chat, ver
[context-mapping](context-mapping.md)).

Cuando dudes, empieza **más grande** y divide cuando aparezca la evidencia (segundo
vocabulario, segundo equipo). Fusionar contextos ya separados es mucho más caro que dividir
uno grande.

## Contexto vs módulo vs servicio

| Concepto | Naturaleza | Se decide por |
|---|---|---|
| Bounded context | frontera de modelo y lenguaje | negocio, equipos, ritmo de cambio |
| Módulo | frontera de código (namespace, paquete, reglas de dependencia) | organización del repositorio |
| Servicio | frontera de despliegue y proceso | escalado, SLA, aislamiento, tecnología |

Relaciones habituales:

- Un contexto -> un módulo: el caso por defecto ([modular-monolith](modular-monolith.md)).
- Un contexto -> varios módulos: cuando el contexto tiene subpartes técnicas (p. ej. un
  motor de reglas aparte) pero comparten vocabulario. Aceptable.
- Varios contextos -> un módulo: error; el linter de dependencias no puede protegerlos.
- Un contexto -> un servicio: solo con criterios de [when-microservices](when-microservices.md).
- Un servicio -> varios contextos: normal en un monolito modular desplegado como un proceso.

## Ejemplo: Ventas, Facturación e Inventario

Tienda B2B con catálogo, pedidos, facturas y almacén. Tras aplicar las tres heurísticas:

| | Ventas (Sales) | Facturación (Invoicing) | Inventario (Inventory) |
|---|---|---|---|
| Patrocinador | dirección comercial | administración | operaciones |
| Cambia por | campañas, pricing | ley fiscal, contabilidad | almacenes, proveedores |
| "Cliente" | `Customer { segment, salesRep, creditLimit }` | `BillingAccount { taxId, fiscalAddress, paymentTerms }` | no existe; solo `ShipTo` |
| "Producto" | `Product { listPrice, discounts }` | `TaxableItem { vatRate }` | `Sku { stock, location, reorderPoint }` |
| "Pedido" | `Order` (raíz; `Quoted -> Confirmed -> Cancelled`) | referencia `orderId` en `Invoice` | `Reservation` + `Shipment` |
| Agregados | `Order`, `Quote`, `PriceList` | `Invoice`, `CreditNote`, `InvoiceSequence` | `Sku`, `Reservation`, `Shipment` |
| Publica | `OrderConfirmed`, `OrderCancelled` | `InvoiceIssued`, `InvoicePaid` | `StockReserved`, `StockDepleted` |

Decisiones que salen del análisis:

- **Reserva de stock al confirmar**: Ventas publica `OrderConfirmed`; Inventario reserva y
  responde con `StockReserved` o `StockUnavailable`. Ventas no consulta stock en línea
  para confirmar (consistencia eventual, ver [../tactical/aggregates.md](../tactical/aggregates.md)).
- **Precio final**: lo calcula Ventas. Facturación recibe importes cerrados en el evento y
  no vuelve a tarifar. Evita duplicar reglas de descuento.
- **Identidad de cliente**: `CustomerId` es compartido (shared kernel mínimo); cada
  contexto guarda sus propios atributos bajo ese id.

## Cómo se ve en código

Un contexto = un directorio raíz con las tres capas y una API pública explícita.

```
src/Invoicing/
  Domain/         Invoice.php, InvoiceLine.php, Money (o desde Shared), InvoiceIssued.php
  Application/    IssueInvoice/, RegisterPayment/, Query/ListPendingInvoices.php
  Infrastructure/ Persistence/EloquentInvoiceRepository.php, Http/InvoiceController.php
  Contracts/      InvoicingApi.php (puerto público), Events/InvoiceIssued.php (published language)
```

```php
// src/Invoicing/Contracts/InvoicingApi.php: lo ÚNICO que otro contexto puede importar
namespace App\Invoicing\Contracts;

interface InvoicingApi
{
    public function outstandingBalanceFor(string $billingAccountId): OutstandingBalance;
}
```

```ts
// modules/inventory/index.ts: barrel público; el linter prohíbe importar rutas internas
export type { StockReserved, StockUnavailable } from './contracts/events';
export type { InventoryApi } from './contracts/InventoryApi';
export { registerInventoryModule } from './infrastructure/register';
```

Regla de dependencia entre contextos: `Sales` puede importar `Inventory/Contracts` y
`Inventory/index.ts`, nunca `Inventory/Domain`. Se automatiza con deptrac /
dependency-cruiser / import-linter (ver [modular-monolith](modular-monolith.md)).

Ficha por contexto: usar la plantilla de [overview](overview.md) §8.

## Errores frecuentes

- **Contexto por entidad** (`Users`, `Products`, `Orders`): cada uno acaba necesitando a
  los otros para cualquier caso de uso; es un CRUD con namespaces. Agrupa por capacidad
  ("vender", "facturar"), no por sustantivo.
- **Contexto por capa** (`Api`, `Core`, `Data`): son capas, no fronteras de significado;
  el mismo `Customer` de 60 campos atraviesa las tres.
- **Contexto = pantalla o feature del backlog**: las pantallas cruzan contextos; la feature
  "checkout" toca Ventas, Inventario y Pagos.
- **Modelo canónico único** "para no duplicar `Customer`": la duplicación de atributos
  bajo el mismo id es intencional; lo que se comparte es la identidad, no el modelo.
- **Fronteras dictadas por la base de datos**: una tabla `orders` no obliga a un contexto;
  varios contextos pueden tener vistas o tablas distintas sobre el mismo concepto.
- **Dividir demasiado pronto**: sin evidencia de vocabulario o equipo distinto, dividir
  crea integración sin beneficio.
- **API pública implícita**: si no hay `Contracts/` o barrel, todo es público y la
  frontera existe solo en el diagrama.

## Checklist

- [ ] Cada contexto tiene nombre de capacidad de negocio, no de entidad ni capa.
- [ ] Para cada contexto puedo nombrar patrocinador, motivo de cambio y 8-30 términos.
- [ ] Ningún término del glosario tiene dos definiciones dentro del mismo contexto.
- [ ] Cada contexto vive en un directorio raíz propio con `Domain/Application/Infrastructure`.
- [ ] Existe una API pública explícita (`Contracts/` o barrel) y un linter que impide
      importar el resto desde fuera.
- [ ] Solo el contexto propietario escribe en sus tablas.
- [ ] Los ids compartidos entre contextos están en el shared kernel; los atributos no.
- [ ] Hay una ficha de contexto (plantilla de [overview](overview.md)) y está enlazada
      desde el README del módulo.
- [ ] Las relaciones con otros contextos están en el mapa ([context-mapping](context-mapping.md)).
