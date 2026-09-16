# Dominio dirigido por tipos en TypeScript

## Índice

- [Principio: estados ilegales irrepresentables](#principio-estados-ilegales-irrepresentables)
- [Branded types para identificadores y VO de formato](#branded-types-para-identificadores-y-vo-de-formato)
- [Uniones discriminadas para el estado del agregado](#uniones-discriminadas-para-el-estado-del-agregado)
- [Transiciones tipadas: `Draft -> Issued`](#transiciones-tipadas-draft---issued)
- [`Result` con errores como uniones](#result-con-errores-como-uniones)
- [Exhaustividad: `assertNever` y `satisfies`](#exhaustividad-assertnever-y-satisfies)
- [Eventos de dominio tipados](#eventos-de-dominio-tipados)
- [zod solo en el borde](#zod-solo-en-el-borde)
- [Configuración del compilador](#configuración-del-compilador)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

`overview.md` §2-§4 presenta branded `InvoiceId`, `Result` y la unión `InvoiceError`; aquí
el compilador pasa a ser la primera línea de tests del dominio. Código de partida en
`templates/typescript/domain/Invoice.ts`, `shared/domain/Result.ts` y `domain/events.ts`.

## Principio: estados ilegales irrepresentables

Cada `if (this.status !== 'draft') throw` es una invariante que el tipo podría expresar.
Cuando la forma de los datos solo admite combinaciones válidas, desaparecen comprobaciones
en runtime, sus tests y los bugs por olvidarlas. La técnica: sustituir campos opcionales
correlacionados (`number?: string; issuedAt?: Date`) por una unión donde cada variante
tiene exactamente lo que existe en ese estado. Coste: más tipos y transiciones que
devuelven un objeto nuevo en vez de mutar.

## Branded types para identificadores y VO de formato

```ts
// shared/domain/Brand.ts
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

// domain/ids.ts
export type InvoiceId = Brand<string, 'InvoiceId'>;
export type CustomerId = Brand<string, 'CustomerId'>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const InvoiceId = {
  of(v: string): InvoiceId { if (!UUID.test(v)) throw new TypeError(`invalid InvoiceId: ${v}`); return v as InvoiceId; },
  unsafe: (v: string) => v as InvoiceId,   // solo en mapeo desde BD ya validada
};

// domain/Email.ts — VO de formato: brand + smart constructor que devuelve Result
export type Email = Brand<string, 'Email'>;
export const Email = {
  parse(v: string): Result<Email, { kind: 'InvalidEmail'; value: string }> {
    const n = v.trim().toLowerCase();
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(n) ? ok(n as Email) : err({ kind: 'InvalidEmail', value: v });
  },
};
```

Regla de elección: brand cuando el VO es un primitivo con formato (ids, email, ISO date,
slug); clase cuando tiene operaciones (`Money.add`) o varios campos. `CustomerId` en una
firma que pide `InvoiceId` es error de compilación; con `string` pasaría.

## Uniones discriminadas para el estado del agregado

```ts
// domain/InvoiceState.ts
type Base = { readonly id: InvoiceId; readonly customerId: CustomerId; readonly currency: Currency; readonly lines: readonly InvoiceLine[] };

export type DraftInvoice  = Base & { readonly status: 'draft' };
export type IssuedInvoice = Base & { readonly status: 'issued'; readonly number: InvoiceNumber; readonly issuedAt: Date; readonly dueAt: Date };
export type VoidedInvoice = Omit<IssuedInvoice, 'status'> & { readonly status: 'voided'; readonly voidedAt: Date; readonly reason: string };
export type PaidInvoice   = Omit<IssuedInvoice, 'status'> & { readonly status: 'paid'; readonly paidAt: Date };

export type Invoice = DraftInvoice | IssuedInvoice | VoidedInvoice | PaidInvoice;
export type InvoiceStatus = Invoice['status'];   // 'draft' | 'issued' | 'voided' | 'paid', derivado, no duplicado
```

`number` y `issuedAt` no son opcionales: existen en `issued` y no en `draft`; una función
que recibe `IssuedInvoice` accede a `invoice.number` sin `!`. Con `readonly` en todo,
mutar es error de compilación y las transiciones devuelven un nuevo valor.

## Transiciones tipadas: `Draft -> Issued`

```ts
// domain/invoice.ts
export const draftInvoice = (id: InvoiceId, customerId: CustomerId, currency: Currency): DraftInvoice =>
  ({ status: 'draft', id, customerId, currency, lines: [] });

export const addLine = (inv: DraftInvoice, line: InvoiceLine): Result<DraftInvoice, InvoiceError> =>
  line.unitPrice.currency !== inv.currency
    ? err({ kind: 'CurrencyMismatch', invoiceId: inv.id })
    : ok({ ...inv, lines: [...inv.lines, line] });

export const issue = (inv: DraftInvoice, number: InvoiceNumber, now: Date): Result<[IssuedInvoice, InvoiceIssued], InvoiceError> => {
  if (inv.lines.length === 0) return err({ kind: 'NoLines', invoiceId: inv.id });
  const issued: IssuedInvoice = { ...inv, status: 'issued', number, issuedAt: now, dueAt: addDays(now, 30) };
  return ok([issued, invoiceIssued(issued)]);
};

export const total = (inv: Invoice): Money =>
  inv.lines.reduce((acc, l) => acc.add(l.unitPrice.times(l.quantity)), Money.zero(inv.currency));
```

`issue(issuedInvoice)` no compila: "no se emite dos veces" la aplica el tipo; el caso de
uso hace el `narrowing` y convierte el estado inesperado en `AlreadyIssued`:

```ts
const inv = await deps.invoices.ofId(id);
if (!inv) return err({ kind: 'NotFound', invoiceId: cmd.invoiceId });
if (inv.status !== 'draft') return err({ kind: 'AlreadyIssued', invoiceId: cmd.invoiceId });
const r = issue(inv, await deps.numbers.next(now), now);   // inv: DraftInvoice aquí
```

Con clases: unión en un campo privado `state` y guardas `isDraft(): this is ...`. La
plantilla `templates/typescript/domain/Invoice.ts` usa clase con `status` plano; migrar
a unión es un refactor local del módulo.

## `Result` con errores como uniones

```ts
// shared/domain/Result.ts — ampliación de la plantilla
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> => (r.ok ? ok(f(r.value)) : r);
export const andThen = <T, U, E1, E2>(r: Result<T, E1>, f: (t: T) => Result<U, E2>): Result<U, E1 | E2> => (r.ok ? f(r.value) : r);

// domain/errors.ts — cada variante lleva lo que la UI necesita; sin `message`
export type InvoiceError =
  | { kind: 'NotFound'; invoiceId: string }
  | { kind: 'NoLines'; invoiceId: string }
  | { kind: 'AlreadyIssued'; invoiceId: string }
  | { kind: 'CurrencyMismatch'; invoiceId: string };
export type InvoiceErrorKind = InvoiceError['kind'];
```

`E1 | E2` en `andThen` acumula los errores de una cadena: la firma documenta qué puede
fallar. Excepciones quedan para lo irrecuperable; un `throw` en dominio es una invariante
violada por código, no por el usuario.

## Exhaustividad: `assertNever` y `satisfies`

```ts
// shared/domain/assertNever.ts
export const assertNever = (x: never): never => { throw new Error(`unexpected: ${JSON.stringify(x)}`); };

// aplicación: al añadir 'PaidInvoice' este switch deja de compilar hasta que se cubra
export const canBeVoided = (inv: Invoice): boolean => {
  switch (inv.status) {
    case 'draft': return false;
    case 'issued': return true;
    case 'voided': return false;
    case 'paid': return false;
    default: return assertNever(inv);
  }
};

// Record exhaustivo: mapa de errores a HTTP o a mensajes de UI
export const httpStatus = { NotFound: 404, NoLines: 422, AlreadyIssued: 409, CurrencyMismatch: 422 } satisfies Record<InvoiceErrorKind, number>;
```

`satisfies` valida que el objeto cubre todas las claves sin ensanchar el tipo. Igual con
`Record<InvoiceStatus, ...>` en tablas de transición, etiquetas de UI o colores.

## Eventos de dominio tipados

```ts
// domain/events.ts
type Event<N extends string, P> = { readonly name: N; readonly occurredAt: Date; readonly payload: P };
export type InvoiceIssued = Event<'invoicing.invoice_issued.v1', { invoiceId: InvoiceId; number: string; totalCents: number; currency: Currency }>;
export type InvoiceVoided = Event<'invoicing.invoice_voided.v1', { invoiceId: InvoiceId; reason: string }>;
export type InvoiceEvent = InvoiceIssued | InvoiceVoided;

export const invoiceIssued = (inv: IssuedInvoice): InvoiceIssued => ({
  name: 'invoicing.invoice_issued.v1', occurredAt: inv.issuedAt,
  payload: { invoiceId: inv.id, number: inv.number, totalCents: total(inv).amountCents, currency: inv.currency },
});

// bus tipado por nombre: el handler recibe el payload correcto sin casts
export interface EventBus {
  on<N extends InvoiceEvent['name']>(name: N, h: (e: Extract<InvoiceEvent, { name: N }>) => Promise<void>): void;
  publish(events: readonly InvoiceEvent[]): Promise<void>;
}
```

El sufijo `.v1` es parte del tipo: cambiar el payload obliga a un `v2` y el compilador
señala los consumidores del antiguo. Payloads con primitivos y brands (no `Money`):
serializables al outbox tal cual.

## zod solo en el borde

zod describe la **forma** de lo que entra (HTTP, jobs, env) y produce un objeto para el
caso de uso; no define tipos del dominio ni valida reglas.

```ts
// app/actions o http: el schema es del adaptador
const IssueInput = z.object({ invoiceId: z.string().uuid(), actorId: z.string().min(1) });
type IssueInput = z.infer<typeof IssueInput>;             // tipo local del adaptador

// application/issueInvoice.ts define su propio command; el adaptador comprueba compatibilidad
export type IssueInvoiceCommand = { invoiceId: string; actorId: string };
const cmd: IssueInvoiceCommand = IssueInput.parse(raw);    // error de compilación si divergen
```

Por qué no `z.infer` como tipo del command: `application/` dependería de zod, el schema
sería la fuente de verdad y las reglas acabarían en `.refine()`. Brands: `InvoiceId.of`
en dominio o `.transform(InvoiceId.unsafe)` tras validar formato; nunca
`z.custom<InvoiceId>()` sin validar. El schema sí se comparte con el cliente: es de forma.

## Configuración del compilador

`tsconfig.json` para que los tipos anteriores funcionen de verdad:

```jsonc
{ "compilerOptions": {
  "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true,
  "noFallthroughCasesInSwitch": true, "noImplicitReturns": true, "noPropertyAccessFromIndexSignature": true,
  "verbatimModuleSyntax": true, "isolatedModules": true } }
```

`noUncheckedIndexedAccess`: `lines[0]` es `InvoiceLine | undefined`. `exactOptionalPropertyTypes`
distingue "ausente" de `undefined`, esencial para que las uniones no admitan
`number: undefined`. Tipos-test con `expectTypeOf` de Vitest para lo que no se ve en runtime:

```ts
expectTypeOf(issue).parameter(0).toEqualTypeOf<DraftInvoice>();   // issue no acepta IssuedInvoice
expectTypeOf<InvoiceStatus>().toEqualTypeOf<'draft' | 'issued' | 'voided' | 'paid'>();
```

## Errores frecuentes

- **`status: string` y un `enum` aparte**: dos fuentes de verdad; deriva `InvoiceStatus` de la unión.
- **Campos opcionales correlacionados** (`number?`, `issuedAt?`): `issued` sin `number` es representable. Unión discriminada.
- **Brand por `as` en cualquier sitio**: anula la garantía. Solo `of` (valida) y `unsafe`
  (mapeo desde BD, grep-able).
- **`Result` con `error: string`**: no admite `switch`; unión con `kind`.
- **`switch` sin `default: assertNever`**: un estado nuevo queda sin cubrir en silencio.
- **`z.infer` como tipo de `application/`**: acoplamiento y reglas en `.refine()`.
- **Clases de error con `instanceof` cruzando Server Actions**: no serializan; uniones.
- **`enum` de TS para estados**: no es unión literal ni funciona con `Extract`; literales.
- **`readonly` olvidado**: una transición que muta el objeto anterior rompe la igualdad
  referencial y los tests de "el borrador no cambió".

## Checklist

- [ ] Ids y VO de formato como brands con smart constructor; `unsafe` solo en mapeo desde BD.
- [ ] Estado del agregado como unión discriminada; campos presentes solo donde existen.
- [ ] Transiciones como funciones `Estado -> Result<[Estado', Evento], Error>`, `readonly` en todo.
- [ ] Errores esperados como uniones `{ kind }`; excepciones solo para bugs e infraestructura.
- [ ] `assertNever` en todo `switch` sobre uniones; `satisfies Record<Kind, ...>` en mapas.
- [ ] Eventos con nombre literal versionado y payload serializable; bus tipado con `Extract`.
- [ ] zod solo en adaptadores; `application/` define sus commands sin `z.infer`.
- [ ] `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; `expectTypeOf` para invariantes de tipo; dependency-cruiser prohíbe `zod` en `domain/` y `application/` (`../../testing/architecture-tests.md`).
