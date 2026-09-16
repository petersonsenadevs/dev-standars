# Convenciones de nombres

## Índice
1. Principios
2. Tabla general por concepto
3. Laravel / PHP
4. TypeScript (Next/Node/Vue)
5. Python (FastAPI / LangGraph)
6. Carpetas y módulos
7. Tests
8. Base de datos y eventos de integración
9. Nombres prohibidos

---

## 1. Principios

- **Idioma**: código en inglés; el glosario del contexto tiene la columna en español y su
  equivalente en inglés, y el código usa esa equivalencia sin inventar otra.
- **Lenguaje ubicuo manda**: si el negocio dice "emitir", el método es `issue()`, no
  `confirm()` ni `finalize()`. Si dos contextos usan la misma palabra con sentidos
  distintos, cada módulo usa la suya; no se "unifica".
- **Nombre = intención**: `registerPayment`, no `addPayment`; `InvoiceCannotBeIssued`, no
  `InvoiceException`.
- **Sin sufijos técnicos en dominio**: `Invoice`, no `InvoiceEntity`; `Money`, no
  `MoneyVO`. Los sufijos técnicos van en infraestructura (`InvoiceModel`,
  `EloquentInvoiceRepository`).
- **Un archivo por clase** en PHP y TS de dominio; en Python, un módulo por concepto.

## 2. Tabla general por concepto

| Concepto | Patrón | Ejemplo |
|---|---|---|
| Agregado / entidad | sustantivo singular | `Invoice`, `InvoiceLine`, `Conversation` |
| Value object | sustantivo del concepto | `Money`, `InvoiceNumber`, `Series`, `EscalationReason` |
| Id tipado | `<Agregado>Id` | `InvoiceId`, `CustomerId` |
| Enum de estado | `<Agregado>Status`; valores en PascalCase (PHP/TS) o UPPER (Py) | `InvoiceStatus::Draft`, `InvoiceStatus.DRAFT` |
| Fábrica | verbo de negocio estático | `Invoice::draftFor()`, `Invoice.draft()`, `Invoice::creditNoteFor()` |
| Rehidratación | `reconstitute` | `Invoice::reconstitute(...)` |
| Método de negocio | verbo en imperativo, presente | `issue()`, `cancel()`, `registerPayment()`, `escalate()` |
| Consulta sin efectos | sustantivo o `is/has/can` | `total()`, `outstanding()`, `isIssued()`, `canResolve()` |
| Evento de dominio | `<Agregado><VerboPasado>` | `InvoiceIssued`, `PaymentRegistered`, `ConversationEscalated` |
| Command | `<Verbo><Agregado>Command` | `IssueInvoiceCommand`, `RegisterPaymentCommand` |
| Caso de uso / handler | `<Verbo><Agregado>Handler` (PHP) / `<verbo><Agregado>` función (TS) / `<Verbo><Agregado>` callable (Py) | `IssueInvoiceHandler`, `issueInvoice`, `IssueInvoice` |
| Query | `<Descripción>Query` + `<Descripción>Reader` + `<Fila>Row` | `ListPendingInvoicesQuery`, `PendingInvoicesReader`, `InvoiceRow` |
| DTO de salida | sustantivo + `Summary/Row/Detail/Result` | `InvoiceSummary`, `IssueInvoiceResult` |
| Repositorio (puerto) | `<Agregado>Repository` | `InvoiceRepository` |
| Repositorio (adaptador) | `<Tecnología><Agregado>Repository` | `EloquentInvoiceRepository`, `PrismaInvoiceRepository`, `SqlAlchemyInvoiceRepository` |
| Puerto driven no persistente | sustantivo de capacidad | `Clock`, `EventBus`, `PaymentGateway`, `KnowledgeBase`, `MessageAnalyzer` |
| Adaptador driven | `<Proveedor><Puerto>` | `StripePaymentGateway`, `AnthropicMessageAnalyzer`, `PgVectorKnowledgeBase` |
| Fake para tests | `Fake<Puerto>` / `InMemory<Repositorio>` / `Recording<Bus>` / `Fixed<Clock>` | `FakePaymentGateway`, `InMemoryInvoiceRepository`, `RecordingEventBus`, `FixedClock` |
| Excepción de dominio | `<Agregado>CannotBe<Verbo>` / `<Acción>NotAllowed` / `<Agregado>NotFound` | `InvoiceCannotBeIssued`, `PaymentNotAllowed`, `InvoiceNotFound` |
| Constructor nombrado de excepción | motivo | `InvoiceCannotBeIssued::withoutLines()`, `::alreadyIssued()` |
| Código de error estable | snake_case con contexto | `invoice_without_lines`, `payment_exceeds_outstanding` |
| Servicio de dominio | `<Concepto>Policy` / `<Concepto>Calculator` | `PricingPolicy`, `EscalationPolicy`, `TaxCalculator` |
| Especificación | adjetivo o predicado | `OverdueInvoice`, `EligibleForDiscount` |
| Controlador (una acción) | `<Verbo><Agregado>Controller` invocable | `IssueInvoiceController` |
| Form Request / schema | `<Verbo><Agregado>Request` / `<Verbo><Agregado>Input` | `IssueInvoiceRequest`, `IssueInvoiceInput` |
| Listener | `<Efecto>Listener` / `<Efecto>On<Evento>` | `SendInvoicePdfListener`, `NotifyAccountingOnInvoiceIssued` |
| Job (driving asíncrono) | `<Verbo><Agregado>Job` | `IssueInvoiceJob` |
| Service provider / wiring | `<Contexto>ServiceProvider` / `container.ts` / `deps.py` | `InvoicingServiceProvider` |
| ACL hacia otro contexto | `<ContextoOrigen><Capacidad>` | `CustomersModuleBillingData`, `HttpCrm` |

## 3. Laravel / PHP

- Namespaces: `<Contexto>\Domain\...`, `<Contexto>\Application\...`,
  `<Contexto>\Infrastructure\...`, `Shared\Domain\...`. Contexto en singular en inglés
  (`Invoicing`, `Support`), no `Invoices`.
- Clases `final`; VO `final readonly class`; enums nativos `enum InvoiceStatus: string`.
- Métodos de negocio en camelCase; constructores nombrados estáticos (`of`, `draftFor`,
  `withoutLines`); `equals()` en VO.
- Propiedades del command `public readonly` en camelCase (`invoiceId`, `actorId`).
- Eloquent: `InvoiceModel`, `InvoiceLineModel` en `Infrastructure/Persistence/Eloquent`,
  tabla `invoices`. Nunca `App\Models\Invoice` para un agregado DDD (colisión de nombre).
- Handlers invocables: `__invoke(IssueInvoiceCommand $command)`.
- Constantes de nombre de evento: `InvoiceIssued::NAME = 'invoicing.invoice_issued.v1'`.

## 4. TypeScript (Next/Node/Vue)

- Archivos: PascalCase para clases y tipos de dominio (`Invoice.ts`, `Money.ts`,
  `InvoiceRepository.ts`); camelCase para funciones/casos de uso (`issueInvoice.ts`);
  `events.ts` para el conjunto de eventos del agregado.
- Ids como branded types con objeto compañero: `type InvoiceId = string & { __brand }` y
  `InvoiceId.of(v)`.
- Estados como uniones de literales en minúscula: `'draft' | 'issued'`.
- Errores esperados como `Result<T, E>` con `E = { kind: 'NoLines'; invoiceId }`;
  `kind` en PascalCase. Excepciones (`throw new Error`) solo para bugs.
- Casos de uso como función que recibe `deps` y devuelve la función: `issueInvoice(deps)`;
  tipo exportado `IssueInvoice = ReturnType<typeof issueInvoice>`; `IssueInvoiceCommand`,
  `IssueInvoiceOutput`, `IssueInvoiceError`.
- Puertos: `interface InvoiceRepository`, `interface Clock`; adaptadores
  `PrismaInvoiceRepository`, `SystemClock`.
- Server Actions / rutas: `app/actions/issueInvoice.ts`; nunca lógica ahí.

## 5. Python (FastAPI / LangGraph)

- Paquetes en snake_case: `invoicing.domain.invoice`, `agents.support.application`.
- Clases en PascalCase, funciones y métodos en snake_case: `Invoice.register_payment()`,
  `escalation_for()`, `can_resolve()`.
- Ids: `NewType("InvoiceId", str)` + función validadora `invoice_id(value)`.
- VO: `@dataclass(frozen=True, slots=True)`; agregados `@dataclass(eq=False)` con
  `_lines`, `_events` privados y `pull_events()`.
- Enums `class InvoiceStatus(str, Enum)` con valores `DRAFT = "draft"`.
- Puertos como `Protocol` en `ports.py`; adaptadores `SqlAlchemyInvoiceRepository`,
  `AnthropicMessageAnalyzer`; fakes `FakeAnalyzer`, `InMemoryInvoiceRepository`.
- Casos de uso: clase callable `IssueInvoice.__call__(cmd)` con `IssueInvoiceCommand`
  e `IssueInvoiceResult` como dataclasses frozen; variante funcional `issue_invoice(cmd, *, deps)`.
- Excepciones: `DomainError` base con `code: str`; subclases `InvoiceCannotBeIssued` con
  classmethods `without_lines()`.
- Nodos de grafo: verbos en snake_case (`analyze`, `decide`, `answer`, `escalate`); estado
  `<Agente>State(TypedDict)`.

## 6. Carpetas y módulos

| Stack | Raíz de contexto | Capas |
|---|---|---|
| Laravel | `src/<Contexto>/` | `Domain/{Model,ValueObject,Event,Repository,Exception,Service}`, `Application/{<CasoDeUso>/,Port,Query}`, `Infrastructure/{Persistence,Http,Bus,Listeners,Jobs,Providers,<Proveedor>}` |
| TypeScript | `src/modules/<contexto>/` | `domain/`, `application/`, `infrastructure/`; adaptadores driving en `app/` (Next) o `routes/` |
| Python | `src/<contexto>/` | `domain/`, `application/`, `infrastructure/` |

Casos de uso agrupados por intención (`Application/IssueInvoice/`) mejor que por tipo
(`Command/`, `Handler/`). `Shared/` solo para primitivas sin negocio.

## 7. Tests

| Tipo | Ubicación | Nombre |
|---|---|---|
| Dominio | `tests/Unit/<Contexto>/Domain/` · `domain/*.test.ts` · `tests/unit/domain/` | `InvoiceTest.php`, `Invoice.test.ts`, `test_invoice.py` |
| Aplicación | `tests/Unit/<Contexto>/Application/` · `application/*.test.ts` · `tests/unit/application/` | `IssueInvoiceHandlerTest.php`, `issueInvoice.test.ts`, `test_issue_invoice.py` |
| Integración | `tests/Integration/` · `tests/integration/` | `EloquentInvoiceRepositoryTest.php`, `test_sqlalchemy_invoice_repository.py` |
| Contrato | `tests/Contract/` · `tests/contract/` | `StripePaymentGatewayTest.php`, `test_anthropic_analyzer_contract.py` |
| HTTP fino | `tests/Feature/` · `tests/e2e/` | `IssueInvoiceEndpointTest.php` |
| Builders | `tests/Builders/` · `tests/builders/` | `InvoiceBuilder` con helper `anInvoice()` / `an_invoice()` |
| Fakes | `tests/Support/` · `tests/fakes/` | `FakeClock`, `RecordingEventBus`, `InMemoryInvoiceRepository` |

Nombres de test en lenguaje de negocio: `it('cannot be issued without lines')`,
`test_billing_intent_escalates_without_replying`. Un `describe` por comportamiento
(`Issuing an invoice`), no por método.

## 8. Base de datos y eventos de integración

- Tablas en plural snake_case (`invoices`, `invoice_lines`, `invoice_sequences`).
- Dinero en dos columnas: `total_cents` + `currency`. Fechas `issued_at` (UTC).
- Estados como string del enum (`'issued'`), no enteros.
- Eventos de integración: `<contexto>.<agregado>_<verbo_pasado>.v<n>`
  (`invoicing.invoice_issued.v1`); payload en snake_case, plano, con `occurred_at`.
- Colas y topics: `<contexto>.<propósito>` (`invoicing.pdf`, `support.escalations`).

## 9. Nombres prohibidos

| Prohibido | Por qué | Alternativa |
|---|---|---|
| `InvoiceService`, `InvoiceManager` | esconde dónde vive la regla | método del agregado o `IssueInvoiceHandler` |
| `InvoiceHelper`, `InvoiceUtils` | cajón de sastre | VO, servicio de dominio con nombre, o función junto a su concepto |
| `data`, `info`, `payload` como nombre de parámetro de dominio | sin intención | `command`, `line`, `amount` |
| `setStatus()`, `setIssuedAt()` | rompe invariantes | `issue()`, `cancel()` |
| `update()`, `process()`, `handle()` en agregados | no dice qué | verbo del glosario |
| `InvoiceEntity`, `MoneyVO`, `InvoiceAggregate` | sufijo técnico en dominio | `Invoice`, `Money` |
| `BaseRepository<T>`, `GenericRepository` | repositorio genérico | uno por agregado |
| `InvoiceCreatedEvent` (sufijo Event) | redundante | `InvoiceDrafted` (y en carpeta `Event/`) |
| `InvoiceException` | genérica | `InvoiceCannotBeIssued`, `PaymentNotAllowed` |
| `findByStatusAndCustomerAndDate()` en repositorio | consulta de pantalla | reader con nombre (`PendingInvoicesReader`) |
