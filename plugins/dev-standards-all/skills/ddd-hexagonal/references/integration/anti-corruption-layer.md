# Anti-Corruption Layer (ACL)

## Índice

- [Qué protege y de qué](#qué-protege-y-de-qué)
- [Anatomía: puerto, adaptador, traductor, fachada](#anatomía-puerto-adaptador-traductor-fachada)
- [Diseñar el puerto desde el dominio](#diseñar-el-puerto-desde-el-dominio)
- [Traducción de modelos y errores](#traducción-de-modelos-y-errores)
- [Ejemplo: pasarela de pago](#ejemplo-pasarela-de-pago)
- [Webhooks entrantes a través del ACL](#webhooks-entrantes-a-través-del-acl)
- [Legacy y otros contextos](#legacy-y-otros-contextos)
- [Tests de contrato](#tests-de-contrato)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../tactical/overview-concepts.md` §10, `../hexagonal/ports-and-adapters.md`,
`idempotency.md`, `event-versioning.md`.

## Qué protege y de qué

Un sistema externo (SDK de pagos, API de un ERP, base de datos legacy, otro bounded
context) tiene su propio modelo, vocabulario, errores y ritmo de cambio. Sin ACL, ese
modelo se filtra: `StripeCharge` en el agregado, `status_cd` del legacy en la UI, campos
"por si acaso" copiados de la respuesta JSON. El ACL es la capa que traduce **en ambas
direcciones** para que dentro solo exista tu lenguaje.

Es un adaptador driven (cuando llamas) y/o driving (cuando te llaman por webhook), más el
código de traducción. En hexagonal, "el adaptador es el ACL"; el nombre subraya que la
traducción es deliberada y completa, no un passthrough.

## Anatomía: puerto, adaptador, traductor, fachada

```
Application --> PaymentGateway (puerto, tipos de dominio)
                    ^
            StripePaymentGateway (adaptador)
                |-- StripeTranslator (dominio <-> tipos del SDK; puro, testeable)
                |-- StripeClient (SDK, HTTP, reintentos, auth)
                |-- StripeErrorMapper (excepciones del SDK -> errores del puerto)
```

- **Puerto**: interfaz en Application (o Domain si una política la usa), con VO propios.
- **Adaptador**: implementa el puerto; orquesta cliente + traductor + errores.
- **Traductor**: funciones puras `toStripeIntent(PaymentIntent)`, `fromStripeIntent(obj)`.
  Aislado para probarlo sin red.
- **Fachada** (opcional): cuando el proveedor tiene varias APIs (pagos, reembolsos,
  clientes) y quieres una superficie única antes de mapear a varios puertos.

Todo en `Infrastructure/<Vendor>/`. El SDK se instancia en composición.

## Diseñar el puerto desde el dominio

Escribe el puerto **antes** de mirar la API del proveedor: qué necesita el caso de uso.

```php
interface PaymentGateway
{
    /** @throws PaymentGatewayUnavailable */
    public function charge(PaymentIntent $intent): PaymentResult;     // succeeded | declined(reason) | requiresAction(url)
    /** @throws PaymentGatewayUnavailable */
    public function refund(PaymentReference $ref, Money $amount, RefundReason $reason): RefundResult;
}
```

Señales de puerto mal diseñado: parámetros `array $options`, nombres del proveedor
(`createPaymentIntent`), retorno del SDK (`\Stripe\PaymentIntent`), métodos que existen
porque el proveedor los tiene y no porque el caso de uso los use.

Cuando dos proveedores distintos implementan el mismo puerto (Stripe y Redsys), el puerto
describe la intersección útil; lo específico se resuelve con configuración del adaptador,
no con `if ($provider === 'stripe')` en Application.

## Traducción de modelos y errores

| Del proveedor | A tu dominio |
|---|---|
| importes en float / string / centavos según API | `Money` (centavos int + moneda) |
| estados propios (`requires_capture`, `processing`) | tu enum (`Pending`, `Succeeded`, `Declined`) con mapeo explícito y caso por defecto |
| ids del proveedor | VO `PaymentReference` (guardado en el agregado como referencia externa) |
| excepciones del SDK (`CardException`, `RateLimitException`) | `PaymentResult::declined()` (esperado) o `PaymentGatewayUnavailable` (transitorio) |
| fechas en epoch/ISO/zona propia | `DateTimeImmutable` UTC |

Regla de errores: **esperado** (tarjeta rechazada) -> valor de retorno del puerto;
**transitorio** (red, 5xx, rate limit) -> excepción de infraestructura tipada que el caso
de uso puede reintentar o convertir en estado `Pending`; **bug** (400 por request mal
formada) -> excepción no capturada + alerta. No conviertas todo en `Exception` genérica.

## Ejemplo: pasarela de pago

```ts
// application/ports/PaymentGateway.ts
export interface PaymentGateway {
  charge(intent: PaymentIntent): Promise<PaymentResult>;
}
export type PaymentResult =
  | { kind: 'succeeded'; reference: PaymentReference; capturedAt: Date }
  | { kind: 'declined'; reason: DeclineReason }
  | { kind: 'requiresAction'; reference: PaymentReference; redirectUrl: string };

// infrastructure/stripe/stripeTranslator.ts — puro
export const toStripeParams = (i: PaymentIntent): Stripe.PaymentIntentCreateParams => ({
  amount: i.amount.cents, currency: i.amount.currency.toLowerCase(),
  payment_method: i.methodToken, confirm: true, metadata: { invoiceId: i.invoiceId.value },
});
export const fromStripeIntent = (pi: Stripe.PaymentIntent): PaymentResult => {
  switch (pi.status) {
    case 'succeeded': return { kind: 'succeeded', reference: PaymentReference.of(pi.id), capturedAt: new Date(pi.created * 1000) };
    case 'requires_action': return { kind: 'requiresAction', reference: PaymentReference.of(pi.id), redirectUrl: pi.next_action?.redirect_to_url?.url ?? '' };
    default: return { kind: 'declined', reason: mapDecline(pi.last_payment_error?.decline_code) };
  }
};

// infrastructure/stripe/stripePaymentGateway.ts
export const stripePaymentGateway = (stripe: Stripe): PaymentGateway => ({
  async charge(intent) {
    try {
      const pi = await stripe.paymentIntents.create(toStripeParams(intent), { idempotencyKey: `charge:${intent.paymentId.value}` });
      return fromStripeIntent(pi);
    } catch (e) {
      if (e instanceof Stripe.errors.StripeCardError) return { kind: 'declined', reason: mapDecline(e.decline_code) };
      if (isTransient(e)) throw new PaymentGatewayUnavailable('stripe', e);
      throw e;
    }
  },
});
```

El caso de uso `PayInvoice` recibe `PaymentResult` y decide: `succeeded` ->
`invoice.markPaid`; `declined` -> `PaymentDeclined` evento; `requiresAction` -> estado
`Pending` + URL al cliente. No sabe que existe Stripe.

## Webhooks entrantes a través del ACL

```
POST /webhooks/stripe  -> verificar firma -> deduplicar por event.id -> traducir a command
   'payment_intent.succeeded' -> ConfirmPaymentCommand(paymentReference, capturedAt)
   'charge.refunded'          -> RecordRefundCommand(...)
   otros                      -> 200 y log (ignorar explícitamente)
```

El controlador del webhook está en `Infrastructure/Stripe/Http`; usa el mismo traductor
en dirección inversa. Responde 200 rápido y procesa en cola si el command es lento.
Nunca cambies el estado del agregado directamente desde el controlador del webhook.

## Legacy y otros contextos

- **BD legacy compartida**: repositorio-ACL que lee tablas antiguas y construye tus
  agregados o read models; escribe solo si es inevitable y con reglas de traducción
  explícitas. Nunca modelos Eloquent del legacy fuera del adaptador.
- **Otro bounded context (mismo monolito)**: consume su fachada pública (eventos de
  integración, casos de uso publicados), traduce sus DTOs a tus VO en un adaptador
  `Infrastructure/Acl/SalesAcl.php`. Aunque sea "nuestro" código, su modelo no es el tuyo.
- **ERP/CRM**: fachada + traductores por entidad; tests de contrato contra sandbox;
  mapeo de códigos en tablas de configuración, no hardcodeados si cambian.

## Tests de contrato

- **Traductor**: unitarios con fixtures reales del proveedor (JSON grabado); cubrir cada
  estado y cada decline code mapeado + el caso desconocido.
- **Adaptador contra sandbox**: suite lenta, en CI nocturno o bajo etiqueta; verifica que
  el SDK y la API siguen respondiendo como el fixture. Si cambia, falla aquí y no en
  producción.
- **Grabaciones** (VCR/`nock`/`respx`): reproducibles, sin red; regraba periódicamente.
- **Contrato del fake**: el `FakePaymentGateway` que usan los tests de casos de uso debe
  pasar los mismos tests de comportamiento del puerto que el adaptador real (misma suite
  parametrizada por implementación). Así el fake no miente.

## Errores frecuentes

- Tipos del SDK en Application o Domain (`\Stripe\PaymentIntent` como parámetro).
- Puerto que espeja la API del proveedor método a método.
- Guardar la respuesta JSON completa "por si acaso" en el agregado.
- Errores del SDK sin traducir: el caso de uso captura `\Exception` y no sabe si reintentar.
- Webhook que hace `UPDATE invoices SET status = 'paid'` directamente.
- Fake del gateway que devuelve siempre éxito; los tests nunca ven `declined`.
- Traducción repartida por controladores y jobs en vez de centralizada.
- Sin clave de idempotencia hacia el proveedor (`idempotency.md`).

## Checklist

- [ ] Puerto escrito desde el caso de uso, con VO propios; sin tipos del proveedor.
- [ ] Traductor puro y testeado con fixtures reales, incluido el caso desconocido.
- [ ] Errores clasificados: esperado (valor), transitorio (excepción tipada), bug (propaga).
- [ ] Clave de idempotencia derivada del dominio en cada llamada con efecto.
- [ ] Webhooks: firma, dedupe, traducción a command; sin acceso directo a agregados.
- [ ] Legacy y otros contextos consumidos solo a través de su adaptador ACL.
- [ ] Tests de contrato contra sandbox/grabaciones; fake validado con la misma suite.
