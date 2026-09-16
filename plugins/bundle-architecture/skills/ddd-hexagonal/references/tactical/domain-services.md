# Servicios de dominio: lógica que no cabe en un agregado

## Índice

- [Cuándo hace falta un servicio de dominio](#cuándo-hace-falta-un-servicio-de-dominio)
- [Propiedades: stateless, puro, nombrado por el negocio](#propiedades-stateless-puro-nombrado-por-el-negocio)
- [Servicio de dominio vs servicio de aplicación](#servicio-de-dominio-vs-servicio-de-aplicación)
- [Ejemplo: PricingPolicy](#ejemplo-pricingpolicy)
- [Ejemplo: TransferFunds](#ejemplo-transferfunds)
- [Servicios de dominio con puertos](#servicios-de-dominio-con-puertos)
- [Dónde vive y cómo se inyecta](#dónde-vive-y-cómo-se-inyecta)
- [Testing](#testing)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Amplía [overview-concepts](overview-concepts.md) §6. Ver [aggregates](aggregates.md),
[specifications](specifications.md) y [invariants-and-errors](invariants-and-errors.md).

## Cuándo hace falta un servicio de dominio

Por defecto, la lógica va en el agregado o en el VO. Un servicio de dominio aparece solo
cuando se cumple alguna de estas condiciones:

| Condición | Ejemplo |
|---|---|
| La operación involucra **varios agregados** y no pertenece naturalmente a ninguno | transferir fondos entre dos `Account` |
| La regla necesita **datos de varios VO/entidades** de distinto tipo | precio final según `Product`, `Customer`, `Promotion` |
| Es una **política intercambiable** que el negocio cambia sin tocar los agregados | cálculo de comisiones, asignación de repartidor |
| Requiere un **puerto** (tarifas externas, verificación) pero la decisión es de dominio | validar IBAN contra un servicio, tasa de cambio |

Si la operación cabe en un método de la raíz (`order.applyDiscount(pct)`), no crees
servicio. Si el "servicio" solo carga, llama a un método y guarda, es un caso de uso.

## Propiedades: stateless, puro, nombrado por el negocio

- **Sin estado**: recibe todo por argumentos; puede tener dependencias inyectadas (otros
  servicios de dominio, puertos), nunca campos que cambien entre llamadas.
- **Sin IO por defecto**: no carga ni guarda agregados; si necesita datos, el caso de uso
  los carga y se los pasa. Excepción controlada: puertos de solo lectura ([abajo](#servicios-de-dominio-con-puertos)).
- **Nombre del glosario**: verbo o política del negocio (`PricingPolicy`,
  `FundsTransfer`, `ShippingCostCalculator`, `SlotAllocation`). No `OrderService`,
  `OrderManager`, `OrderHelper`: esos nombres significan "no sé dónde va esto".
- **Devuelve valores de dominio** (VO, agregado modificado, `Result`) y lanza
  excepciones de dominio.
- Interfaz solo si hay más de una implementación real o un puerto detrás; una clase
  `final` pura no necesita interfaz para testearse.

## Servicio de dominio vs servicio de aplicación

| | Servicio de dominio | Caso de uso (aplicación) |
|---|---|---|
| Entrada | objetos de dominio ya cargados | command con primitivos/ids |
| Hace | decide, calcula, coordina agregados en memoria | carga, invoca dominio, guarda, publica |
| Transacción | no sabe que existe | la delimita |
| Dependencias | ninguna o puertos de lectura | repositorios, UoW, bus, puertos |
| Test | unitario puro | unitario con repos en memoria |
| Nombre | `PricingPolicy`, `FundsTransfer` | `PlaceOrderHandler`, `TransferFundsHandler` |

Un caso de uso puede invocar varios servicios de dominio; un servicio de dominio nunca
invoca un caso de uso.

## Ejemplo: PricingPolicy

Regla: el precio de una línea depende del producto, del tipo de cliente y de promociones
vigentes. No es de `Product` (no sabe de clientes) ni de `Customer` (no sabe de precios).

```php
namespace App\Sales\Domain\Pricing;

final class PricingPolicy
{
    /** @param list<Promotion> $promotions */
    public function priceFor(Product $product, CustomerTier $tier, array $promotions, \DateTimeImmutable $at): Money
    {
        $base = $product->listPrice();
        $price = $tier->discount()->applyAsReductionTo($base);
        foreach ($promotions as $promo) {
            if ($promo->appliesTo($product, $at)) $price = $promo->reduce($price);
        }
        return $price->max(Money::zero($base->currency));
    }
}
```

Uso desde el caso de uso: carga producto, tier y promociones; llama a `priceFor`; pasa el
`Money` al agregado (`order.addProduct(id, snapshot(price), qty)`). El agregado guarda el
precio decidido, no la política.

```ts
// Variante como función pura en TS: misma idea, sin clase.
export const priceFor = (product: Product, tier: CustomerTier, promos: Promotion[], at: LocalDate): Money =>
  promos
    .filter((p) => p.appliesTo(product, at))
    .reduce((price, p) => p.reduce(price), tier.discount().applyAsReductionTo(product.listPrice()))
    .max(Money.zero(product.listPrice().currency));
```

## Ejemplo: TransferFunds

Dos agregados `Account`; la regla "el débito y el crédito ocurren juntos" no pertenece a
ninguna de las dos cuentas.

```ts
export class FundsTransfer {
  execute(from: Account, to: Account, amount: Money, clock: Clock): TransferReceipt {
    if (from.id.equals(to.id)) throw new SameAccountTransfer(from.id);
    if (!from.currency.equals(to.currency)) throw new CurrencyMismatch(from.currency, to.currency);
    from.debit(amount, clock.now());   // lanza InsufficientFunds; registra AccountDebited
    to.credit(amount, clock.now());    // registra AccountCredited
    return TransferReceipt.of(from.id, to.id, amount, clock.now());
  }
}
```

```ts
// Caso de uso: carga, delega, guarda ambos en una transacción (excepción documentada
// a "un agregado por transacción", ver aggregates.md) y publica tras commit.
export const transferFunds = (deps: Deps) => async (cmd: TransferFundsCommand) => {
  const [from, to] = await Promise.all([deps.accounts.get(cmd.fromId), deps.accounts.get(cmd.toId)]);
  const receipt = deps.transfer.execute(from, to, Money.of(cmd.cents, cmd.currency), deps.clock);
  await deps.uow.run(async () => { await deps.accounts.save(from); await deps.accounts.save(to); });
  await deps.events.publish([...from.pullEvents(), ...to.pullEvents()]);
  return receipt;
};
```

Si las cuentas viven en contextos o bases distintas, el servicio de dominio desaparece:
pasa a ser un proceso con eventos y compensación ([aggregates](aggregates.md)).

## Servicios de dominio con puertos

A veces la decisión es de dominio pero necesita un dato externo: tasa de cambio,
verificación de un identificador, calendario laboral. Define el puerto en `Domain` con
vocabulario de dominio y de **solo lectura**; el servicio lo usa; la implementación va a
`Infrastructure`.

```python
class ExchangeRates(Protocol):                       # puerto en Domain
    def rate(self, from_: Currency, to: Currency, at: date) -> Decimal: ...

class CurrencyConverter:                             # servicio de dominio
    def __init__(self, rates: ExchangeRates) -> None:
        self._rates = rates

    def convert(self, amount: Money, to: Currency, at: date) -> Money:
        if amount.currency == to:
            return amount
        rate = self._rates.rate(amount.currency, to, at)
        return Money(int(round(amount.cents * rate)), to)
```

Límite: si el servicio necesita **guardar** algo o coordinar transacciones, ya no es de
dominio. Y si solo delega en el puerto sin regla propia, elimina el servicio y usa el
puerto desde el caso de uso.

## Dónde vive y cómo se inyecta

- Carpeta: `Domain/Service/` o junto al concepto (`Domain/Pricing/PricingPolicy.php`).
  Prefiere por concepto cuando el módulo crece.
- Sin dependencias del framework; construible con `new` en tests.
- Se inyecta en el caso de uso por constructor (Laravel container, DI de Nest/Next
  manual, `punq`/constructor a mano en Python). Si es puro, registrar como singleton.
- Nunca se inyecta un servicio de dominio dentro de un agregado. Si el agregado lo
  necesita para un método, pásalo como argumento: `order.reprice(pricingPolicy, at)`.
  Este patrón (double dispatch) mantiene el agregado sin dependencias en construcción.

```php
// Agregado que recibe la política como argumento del método, no del constructor
public function reprice(PricingPolicy $policy, CustomerTier $tier, array $promos, \DateTimeImmutable $at): void
{
    $this->assertDraft();
    foreach ($this->lines as $key => $line) {
        $this->lines[$key] = $line->withUnitPrice($policy->priceFor($line->product(), $tier, $promos, $at));
    }
}
```

## Testing

- Servicio puro: test unitario directo con VO construidos a mano o con builders
  ([factories](factories.md) §builders). Sin mocks.
- Servicio con puerto: implementación fake del puerto (`FixedExchangeRates`), no mock
  con expectativas de llamadas.
- Cobertura por tabla de casos: cada regla de la política es una fila
  (tier, promociones, esperado). En PHPUnit `#[DataProvider]`, en Vitest `it.each`,
  en pytest `parametrize`.
- Si el test necesita un repositorio, estás testeando un caso de uso, no un servicio.

## Errores frecuentes

- **`OrderService` que lo hace todo**: mezcla dominio, aplicación e infraestructura.
  Divide en casos de uso + políticas nombradas.
- **Servicio de dominio que carga y guarda**: es un caso de uso disfrazado.
- **Sacar lógica del agregado "para reutilizarla"** cuando pertenece a la raíz: produce
  agregados anémicos ([entities](entities.md)).
- **Inyectar el servicio en el constructor del agregado**: acopla construcción y
  persistencia a dependencias.
- **Interfaces para todo**: `PricingPolicyInterface` con una sola implementación pura.
- **Servicio con estado** (cache interna, contador) que cambia el resultado entre llamadas.
- **Devolver arrays/primitivos** en vez de VO: el resultado pierde sus reglas.
- **Nombre técnico** (`Manager`, `Helper`, `Util`): señal de que el concepto no está en el glosario.

## Checklist

- [ ] La lógica no cabe en un agregado ni en un VO (varios agregados, política intercambiable, puerto).
- [ ] Nombre del glosario; sin `Service/Manager/Helper` genéricos.
- [ ] Stateless; sin cargar ni guardar; sin transacciones ni publicación de eventos.
- [ ] Recibe objetos de dominio ya cargados; devuelve VO/`Result`; lanza excepciones de dominio.
- [ ] Puertos solo de lectura, definidos en `Domain`, con vocabulario de dominio.
- [ ] Se pasa al agregado como argumento de método, nunca al constructor.
- [ ] Test unitario puro con tabla de casos; fakes en lugar de mocks para puertos.
- [ ] Interfaz solo si hay varias implementaciones reales.
