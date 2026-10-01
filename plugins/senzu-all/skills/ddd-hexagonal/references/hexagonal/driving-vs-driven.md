# Adaptadores driving vs driven

## Índice

- [La pregunta que los distingue](#la-pregunta-que-los-distingue)
- [Catálogo de adaptadores driving](#catálogo-de-adaptadores-driving)
- [Catálogo de adaptadores driven](#catálogo-de-adaptadores-driven)
- [Qué hace y qué no hace un adaptador driving](#qué-hace-y-qué-no-hace-un-adaptador-driving)
- [Qué hace y qué no hace un adaptador driven](#qué-hace-y-qué-no-hace-un-adaptador-driven)
- [Sustituibilidad y fakes](#sustituibilidad-y-fakes)
- [Casos ambiguos](#casos-ambiguos)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `ports-and-adapters.md`, `../application/use-cases.md`,
`../integration/messaging-and-queues.md`, `../testing/overview.md`.

## La pregunta que los distingue

**¿Quién inicia la conversación?** Si el exterior llama a la aplicación, el adaptador es
**driving** (primario, "lado izquierdo"). Si la aplicación llama al exterior, es
**driven** (secundario, "lado derecho"). Un mismo sistema externo puede aparecer en ambos
lados: una cola es driven cuando publicas y driving cuando consumes.

```
 driving                       hexágono                        driven
 HTTP, CLI, cron, cola(in),   [Application + Domain]    BD, mail, API externa, LLM,
 Inertia, server action,       casos de uso + puertos     filesystem, reloj, random,
 webhook, listener, test                                  cola(out), caché
```

## Catálogo de adaptadores driving

| Adaptador | Traduce | Notas por stack |
|---|---|---|
| Controlador HTTP / route handler | request -> command/query; resultado -> response | Laravel `Infrastructure/Http`; Next `app/api/**/route.ts`; FastAPI router |
| Server action (Next) / Inertia (Laravel) | form data -> command; resultado -> redirect/props | el server action es un controlador sin URL; misma disciplina |
| Comando CLI | argv -> command | Artisan, `commander`, `typer` |
| Job / consumidor de cola | mensaje -> command | Laravel Job, BullMQ `Worker`, Celery task; deserializa y llama |
| Cron / scheduler | tick -> command (`CloseDayCommand`) | el scheduler solo despacha; la lógica de "qué hay que cerrar" es del caso de uso |
| Webhook | payload externo -> command | pasa por ACL: valida firma, traduce a tu modelo |
| Listener de evento de dominio | evento -> command de otro caso de uso | reacción dentro del mismo proceso; no metas lógica en el listener |
| Test | fixture -> command | el test es el adaptador driving más importante |
| GraphQL resolver, gRPC handler, MCP tool | igual que HTTP | |

## Catálogo de adaptadores driven

| Adaptador | Implementa puerto | Ejemplo de implementación |
|---|---|---|
| Persistencia | `XRepository`, lectores | Eloquent, Prisma, SQLAlchemy, SQL crudo |
| API externa | `PaymentGateway`, `TaxCalculator`, `GeocodingService` | SDK de Stripe/Redsys + mapeo (ACL) |
| Mail / SMS / push | `Mailer`, `Notifier` | Symfony Mailer, Resend, SES |
| LLM | `TextClassifier`, `Summarizer`, `EmbeddingProvider` | cliente de Anthropic/OpenAI; el puerto habla de negocio, no de prompts |
| Filesystem / storage | `DocumentStore` | Flysystem, S3 SDK, `fs` |
| Reloj | `Clock` | `SystemClock`; `FixedClock` en tests |
| Random / ids | `IdGenerator`, `TokenGenerator` | UUID v7, `crypto.randomUUID`; determinista en tests |
| Cola (publicación) | `EventBus`, `CommandDispatcher` | Laravel Bus/Event, BullMQ `Queue.add`, arq/Celery `delay` |
| Caché | decorador del lector | Redis, `Cache` facade |
| Autorización externa | `Authorizer` | Gate, OPA, Casbin |
| Feature flags | `FeatureToggles` | LaunchDarkly, tabla local |

## Qué hace y qué no hace un adaptador driving

Hace: autenticar y construir el `Actor`; validar forma; construir el command/query; invocar
el caso de uso; mapear el resultado (DTO/Result/excepción) a la respuesta del protocolo;
gestionar cabeceras, códigos de estado, redirects, serialización.

No hace: reglas de negocio; acceso a BD (ni "solo una consulta rápida"); llamar a otros
adaptadores driven; decidir según el estado del agregado; transacciones.

```php
// Job de Laravel como adaptador driving asíncrono: solo traduce
final class IssueInvoiceJob implements ShouldQueue
{
    public function __construct(public readonly string $invoiceId, public readonly string $actorId) {}
    public function handle(IssueInvoiceHandler $handle): void
    {
        $handle(new IssueInvoiceCommand($this->invoiceId, $this->actorId));
    }
}
```

```python
# typer como adaptador driving CLI
@app.command()
def issue(invoice_id: str, actor: str = "system") -> None:
    uc = build_container().issue_invoice
    uc(IssueInvoiceCommand(invoice_id=invoice_id, actor_id=actor))
    typer.echo("issued")
```

## Qué hace y qué no hace un adaptador driven

Hace: traducir tipos de dominio a los del proveedor y viceversa; gestionar conexiones,
reintentos de red, timeouts, autenticación con el proveedor; lanzar excepciones de
infraestructura tipadas (`PaymentGatewayUnavailable`) o mapear a errores del puerto.

No hace: decidir negocio ("si el pago falla, marcar la factura como morosa"); llamar a
casos de uso; conocer HTTP de entrada; loguear payloads con PII.

```php
final class StripePaymentGateway implements PaymentGateway
{
    public function __construct(private readonly StripeClient $stripe) {}
    public function charge(PaymentIntent $intent): PaymentResult
    {
        try {
            $pi = $this->stripe->paymentIntents->create([
                'amount' => $intent->amount->amountCents, 'currency' => strtolower($intent->amount->currency),
                'payment_method' => $intent->methodToken, 'confirm' => true,
                'idempotency_key' => $intent->reference->value,
            ]);
        } catch (ApiConnectionException $e) {
            throw PaymentGatewayUnavailable::because($e);          // el caso de uso decide qué hacer
        }
        return match ($pi->status) {
            'succeeded' => PaymentResult::succeeded(new PaymentReference($pi->id)),
            default     => PaymentResult::declined($pi->last_payment_error?->code ?? 'unknown'),
        };
    }
}
```

## Sustituibilidad y fakes

La razón de ser del lado driven es poder sustituirlo. Por cada puerto con IO mantén:

| Implementación | Uso |
|---|---|
| Real | producción |
| Fake en memoria (`InMemoryInvoiceRepository`, `RecordingMailer`, `FixedClock`) | tests unitarios de casos de uso; escrito a mano, con estado inspeccionable |
| Stub de contrato | tests de contrato del adaptador real contra sandbox o grabaciones |

Un fake es código de primera clase: vive en `tests/Fakes` o `src/<Ctx>/Infrastructure/InMemory`,
tiene tests si su lógica no es trivial (p. ej. filtrado). Prefiere fakes a mocks de
framework (`Mockery`, `jest.mock`) para puertos: los mocks acoplan el test a la secuencia
de llamadas; los fakes al comportamiento.

Del lado driving, la sustituibilidad se demuestra invocando el mismo caso de uso desde
HTTP, CLI y test. Si uno de ellos necesita "un poco más de lógica", esa lógica está mal
situada.

## Casos ambiguos

- **Listener de evento de dominio**: driving (recibe un hecho y dispara un caso de uso).
  El `EventBus` que lo entrega es driven.
- **Webhook de Stripe**: driving (Stripe llama), pero atraviesa el ACL de pagos para
  traducir `charge.succeeded` a `PaymentConfirmedCommand`.
- **Inertia**: driving. El render de props es la "respuesta"; las props son DTOs.
- **Server actions**: driving; el hecho de que vivan junto al componente no cambia su
  papel ni su disciplina.
- **Middleware HTTP**: parte del adaptador driving (auth, tenant); nunca contiene negocio.
- **LLM como generador de decisiones**: driven. El puerto define la pregunta
  (`classifyTicket(text): Category`); el adaptador construye el prompt y parsea. Si la
  respuesta del LLM decide negocio, el caso de uso la valida contra reglas del dominio.
- **Caché**: driven, como decorador del lector o repositorio.

## Errores frecuentes

- Controlador que consulta Eloquent "para comprobar algo" antes de llamar al handler.
- Job con lógica propia (bucles, condiciones de negocio) en lugar de delegar.
- Adaptador driven que llama a un caso de uso (repositorio que emite eventos y dispara
  handlers): ciclo driven -> driving invisible.
- Listener con IO síncrono en el request que hace la petición lenta y frágil.
- Fake que reimplementa media BD (queries SQL parseadas); si el fake es complejo, el
  puerto es demasiado ancho.
- Un puerto `HttpClient` genérico como "adaptador de API externa": el puerto debe hablar
  de negocio (`TaxCalculator`), no de transporte.
- Tratar el scheduler como lugar de lógica ("si es lunes y hay facturas...").

## Checklist

- [ ] Para cada adaptador está claro si es driving o driven y por qué.
- [ ] Los driving traducen protocolo -> command y resultado -> respuesta; nada más.
- [ ] Los driven traducen dominio <-> proveedor y errores de infraestructura tipados.
- [ ] Cada puerto driven con IO tiene fake en memoria mantenido.
- [ ] Un caso de uso se invoca desde al menos dos adaptadores (HTTP + test) sin cambios.
- [ ] Webhooks y APIs externas pasan por un ACL.
- [ ] Reloj, random e ids son adaptadores driven sustituibles.
