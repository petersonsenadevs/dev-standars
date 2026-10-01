# Puertos y adaptadores

## Índice

- [Definición en una frase](#definición-en-una-frase)
- [Puertos driving y driven](#puertos-driving-y-driven)
- [Dónde viven las interfaces](#dónde-viven-las-interfaces)
- [Granularidad de los puertos](#granularidad-de-los-puertos)
- [Ejemplo completo: HTTP -> caso de uso -> repo, email, reloj](#ejemplo-completo-http---caso-de-uso---repo-email-reloj)
- [Cuándo un puerto no merece interfaz](#cuándo-un-puerto-no-merece-interfaz)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../tactical/overview-concepts.md` §11, `driving-vs-driven.md`,
`dependency-injection.md`, `folder-structures.md`.

## Definición en una frase

La aplicación (dominio + casos de uso) es un hexágono que **no conoce** el mundo exterior;
se comunica con él únicamente a través de **puertos** (interfaces que ella define) y cada
tecnología concreta se conecta mediante un **adaptador** que implementa o invoca esos
puertos. Consecuencia práctica: puedes ejecutar un caso de uso desde un test, un
controlador HTTP o un job sin cambiar una línea del caso de uso, y cambiar Eloquent por
otra persistencia sin tocar el dominio.

Hexagonal no dice nada de carpetas `Domain/Application/Infrastructure`; eso lo aporta la
combinación con DDD. Hexagonal dice: dentro/fuera, puertos, adaptadores, dependencias
hacia dentro.

## Puertos driving y driven

| | Puerto driving (primario) | Puerto driven (secundario) |
|---|---|---|
| Quién lo define | la aplicación (sus casos de uso) | la aplicación (lo que necesita del exterior) |
| Quién lo llama | el adaptador (controlador, CLI, job) | el caso de uso o el dominio |
| Quién lo implementa | la aplicación | el adaptador (Eloquent, SMTP, SDK) |
| Forma habitual | clase handler / función; opcionalmente interfaz | interfaz + implementación concreta |
| Ejemplos | `IssueInvoiceHandler`, `ListPendingInvoices` | `InvoiceRepository`, `Mailer`, `Clock`, `PaymentGateway`, `EventBus` |

Los puertos driving rara vez necesitan interfaz explícita: el handler es la API. Los
driven casi siempre la necesitan, porque hay al menos dos implementaciones (real y fake).

## Dónde viven las interfaces

| Puerto | Carpeta | Motivo |
|---|---|---|
| Repositorio de agregado | `Domain/Repository` | forma parte del modelo: habla de agregados y VO |
| Servicios que el dominio necesita (`Clock` si lo usa una política, `IdGenerator`) | `Domain/Port` o `Domain/Service` | el dominio los invoca |
| Puertos de aplicación (`EventBus`, `Mailer`, `Authorizer`, `TransactionRunner`, `PaymentGateway`) | `Application/Port` | los usan solo los casos de uso |
| Lectores de read models | `Application/Query` | son parte del contrato de lectura |
| Implementaciones | `Infrastructure/<Tecnología>` | detalle |

Regla: la interfaz vive en la capa más interna que la usa, con tipos de esa capa. Un
`PaymentGateway` en Application recibe `Money` y `PaymentReference` (dominio), nunca
`StripeChargeRequest`.

Compartidos entre módulos (`Clock`, `EventBus`): `src/Shared/Domain` o
`src/Shared/Application`, con implementación en `src/Shared/Infrastructure`.

## Granularidad de los puertos

- **Un puerto por necesidad, no por tecnología**: `Mailer.send(Notification)` y no
  `SmtpClient`. `InvoiceRepository`, no `Database`.
- **Pequeños y orientados al consumidor** (ISP): si `IssueInvoice` solo necesita
  `ofId`/`save`, no le des un repositorio con 15 métodos de consulta. Divide lector y
  repositorio.
- **Nombrados en lenguaje de negocio**: `InvoiceNumberSequence.next(series)`, no
  `SequenceTable.incrementAndGet`.
- **Sin tipos de framework en la firma**: nada de `Illuminate\Http\UploadedFile`,
  `Request`, `PrismaClient`, `Session`. Si un puerto necesita un stream, usa
  `resource`/`ReadableStream`/`BinaryIO` o un VO propio (`FileContents`).
- Un puerto con un solo método es normal (`Clock.now()`). Un puerto con 20 métodos es un
  módulo disfrazado: divídelo.

## Ejemplo completo: HTTP -> caso de uso -> repo, email, reloj

**Puertos (TypeScript)**

```ts
// domain/InvoiceRepository.ts
export interface InvoiceRepository { ofId(id: InvoiceId): Promise<Invoice | null>; save(i: Invoice): Promise<void>; }
// application/ports/Clock.ts
export interface Clock { now(): Date }
// application/ports/Mailer.ts
export interface Mailer { send(n: { to: Email; template: 'invoice-issued'; data: Record<string, unknown> }): Promise<void> }
```

**Caso de uso (puerto driving)**

```ts
export const issueInvoice = (d: { invoices: InvoiceRepository; clock: Clock; mailer: Mailer }) =>
  async (cmd: { invoiceId: string }): Promise<Result<void, InvoiceError>> => {
    const invoice = await d.invoices.ofId(InvoiceId.of(cmd.invoiceId));
    if (!invoice) return err({ kind: 'NotFound' });
    const r = invoice.issue(d.clock.now());
    if (!r.ok) return r;
    await d.invoices.save(invoice);
    await d.mailer.send({ to: invoice.customerEmail, template: 'invoice-issued', data: { number: invoice.number } });
    return ok(undefined);
  };
```

(En producción el email iría por evento + listener; aquí se llama directo para mostrar el
puerto.)

**Adaptadores driven**

```ts
// infrastructure/time/systemClock.ts
export const systemClock: Clock = { now: () => new Date() };
// infrastructure/mail/resendMailer.ts
export const resendMailer = (client: Resend): Mailer => ({
  send: async (n) => { await client.emails.send({ to: n.to.value, subject: subjectFor(n.template), react: render(n.template, n.data) }); },
});
// infrastructure/persistence/prismaInvoiceRepository.ts  -> ver dtos-and-mapping.md
```

**Adaptador driving (route handler Next)**

```ts
// app/api/invoices/[id]/issue/route.ts
import { container } from '@/modules/invoicing/composition';
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const r = await container.issueInvoice({ invoiceId: params.id });
  return r.ok ? new Response(null, { status: 202 }) : toHttpError(r.error);
}
```

**Test del caso de uso con fakes**

```ts
const invoices = inMemoryInvoiceRepository([anInvoice().withLines(1).build()]);
const mailer = { sent: [] as unknown[], send: async (n) => { mailer.sent.push(n); } };
const uc = issueInvoice({ invoices, clock: fixedClock('2026-01-15'), mailer });
expect((await uc({ invoiceId: 'inv-1' })).ok).toBe(true);
expect(mailer.sent).toHaveLength(1);
```

**Misma forma en PHP**: `interface Mailer` en `Application/Port`, `SymfonyMailerAdapter`
en `Infrastructure/Mail`, binding en el ServiceProvider; controlador en
`Infrastructure/Http` (ver `../stacks/laravel/overview.md` §5-6).

## Cuándo un puerto no merece interfaz

- Servicios de dominio puros (`PricingPolicy`): sin IO, no se sustituyen; interfaz inútil.
- Estructuras de datos y utilidades estándar (`Collection`, `DateTimeImmutable`, `crypto.randomUUID`)
  cuando no afectan al determinismo de los tests. El reloj y el random **sí** lo afectan:
  puerto.
- Un único adaptador, sin IO y sin necesidad de fake: llama a la clase concreta. Añadir la
  interfaz cuando aparezca la segunda implementación cuesta cinco minutos.
- En TS, "interfaz" puede ser un `type` con funciones; en Python, un `Protocol`
  (structural), no hace falta herencia.

## Errores frecuentes

- Puerto con nombre de tecnología (`EloquentInvoiceRepositoryInterface`, `RedisCache`).
- Puerto driven definido en Infrastructure junto a su implementación: la aplicación
  importa hacia fuera y se rompe la regla.
- Interfaz por cada clase "por si acaso": ruido; solo donde hay IO o sustitución.
- Firma del puerto con tipos de framework o del SDK externo.
- Adaptador driving con lógica: el controlador decide qué hacer según el estado de la
  factura en lugar de delegar en el caso de uso.
- Un `Repository` genérico `find/findAll/where` compartido por todos los agregados: es un
  DAO, no un puerto de dominio.
- "Hexagonal" con el dominio importando el contenedor (`app()`, `container.resolve`).

## Checklist

- [ ] Cada dependencia externa del caso de uso entra por un puerto con nombre de negocio.
- [ ] Interfaces en la capa más interna que las usa; implementaciones en Infrastructure.
- [ ] Firmas sin tipos de framework ni SDK.
- [ ] Puertos pequeños; lector y repositorio separados.
- [ ] Existe un fake en memoria por puerto driven con IO.
- [ ] El caso de uso se ejecuta desde un test sin framework en < 10 ms.
- [ ] Reloj y random son puertos.
