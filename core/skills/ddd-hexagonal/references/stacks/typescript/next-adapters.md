# Next.js (App Router) como adaptador driving

## Índice

- [Qué es y qué no es `app/`](#qué-es-y-qué-no-es-app)
- [Server Actions: el adaptador de escritura](#server-actions-el-adaptador-de-escritura)
- [Errores hacia la UI: `useActionState` y uniones serializables](#errores-hacia-la-ui-useactionstate-y-uniones-serializables)
- [Route Handlers: mapeo de `Result` a HTTP](#route-handlers-mapeo-de-result-a-http)
- [Server Components como driving de lectura](#server-components-como-driving-de-lectura)
- [DTOs serializables: la frontera RSC/cliente](#dtos-serializables-la-frontera-rsccliente)
- [Auth y tenant en el borde](#auth-y-tenant-en-el-borde)
- [Revalidación y caché](#revalidación-y-caché)
- [Middleware, streaming y Suspense](#middleware-streaming-y-suspense)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

La estructura general, `container.ts` y el `Result` están en `overview.md` §5-§8. Este
documento profundiza en la capa `app/`: todo lo que aquí vive es adaptador driving y debe
poder borrarse sin tocar `modules/`. Persistencia: `../../persistence/prisma-drizzle.md`.

## Qué es y qué no es `app/`

| Vive en `app/` | No vive en `app/` |
|---|---|
| `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` | reglas de negocio, cálculos con efecto económico |
| `actions/*.ts` (`'use server'`), `api/**/route.ts` | acceso directo a Prisma para escrituras |
| schemas zod de forma, mapeo `Result` -> UI/HTTP | tipos de dominio reexportados a cliente |
| `auth()`, `cookies()`, `headers()`, `revalidatePath` | `import { prisma }` en componentes de negocio |

Regla operativa: un archivo de `app/` importa de `@/modules/<ctx>` (su `index.ts`) y de
`@/lib`; nunca de `modules/<ctx>/{domain,application,infrastructure}` directamente. La
regla `modules-via-index` de dependency-cruiser (`../../testing/architecture-tests.md`) lo
verifica.

## Server Actions: el adaptador de escritura

Plantilla base: `templates/typescript/app/actions/issueInvoice.ts`. Anatomía completa con
formulario (`FormData`) y estado previo, que es lo que `useActionState` requiere:

```ts
// app/invoices/actions.ts
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { invoicing, type InvoiceError } from '@/modules/invoicing';
import { requireSession } from '@/lib/auth';

const AddLineInput = z.object({
  invoiceId: z.string().uuid(),
  description: z.string().min(1).max(255),
  unitPriceCents: z.coerce.number().int().min(0),
  quantity: z.coerce.number().int().min(1),
});

export type ActionState =
  | { status: 'idle' }
  | { status: 'ok'; lineId: string }
  | { status: 'invalid'; fields: Record<string, string[] | undefined> }
  | { status: 'domain'; error: InvoiceError }
  | { status: 'unauthorized' };

export async function addLineAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = AddLineInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: 'invalid', fields: parsed.error.flatten().fieldErrors };

  const session = await requireSession();
  if (!session) return { status: 'unauthorized' };

  const result = await invoicing.addLine({ ...parsed.data, actorId: session.user.id });
  if (!result.ok) return { status: 'domain', error: result.error };

  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  return { status: 'ok', lineId: result.value.lineId };
}

export async function issueInvoiceAction(invoiceId: string): Promise<never | ActionState> {
  const session = await requireSession();
  if (!session) return { status: 'unauthorized' };
  const result = await invoicing.issueInvoice({ invoiceId, actorId: session.user.id });
  if (!result.ok) return { status: 'domain', error: result.error };
  revalidatePath('/invoices');
  redirect(`/invoices/${invoiceId}`);   // lanza NEXT_REDIRECT: nunca dentro de try/catch
}
```

Cinco pasos y nada más: parsear forma, autenticar, invocar caso de uso, revalidar,
devolver/redirigir. Si una action tiene un `if` sobre `invoice.status`, la regla se ha
escapado del dominio.

## Errores hacia la UI: `useActionState` y uniones serializables

El cliente hace `switch` sobre `status` y sobre `error.kind`. Los mensajes de dominio se
traducen en el cliente (i18n) a partir del `kind`, no del `message` del servidor.

```tsx
// app/invoices/[id]/AddLineForm.tsx
'use client';
import { useActionState } from 'react';
import { addLineAction, type ActionState } from '../actions';

const domainMessage: Record<InvoiceError['kind'], string> = {
  NotFound: 'La factura no existe',
  NoLines: 'Añade al menos una línea',
  AlreadyIssued: 'La factura ya está emitida; no admite cambios',
};

export function AddLineForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState(addLineAction, { status: 'idle' } satisfies ActionState);
  return (
    <form action={action}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input name="description" aria-invalid={state.status === 'invalid' && !!state.fields.description} />
      {state.status === 'invalid' && state.fields.description?.map((m) => <p key={m}>{m}</p>)}
      {state.status === 'domain' && <p role="alert">{domainMessage[state.error.kind]}</p>}
      <button disabled={pending}>Añadir línea</button>
    </form>
  );
}
```

`Record<InvoiceError['kind'], string>` obliga a cubrir todos los errores: añadir un `kind`
al dominio rompe la compilación del cliente. Es exhaustividad gratis, ver
`type-driven-domain.md`.

## Route Handlers: mapeo de `Result` a HTTP

Misma estructura que la action; cambia solo la salida. Centraliza el mapeo `kind -> status`
en un helper por módulo para que los handlers sean de diez líneas.

```ts
// app/api/_shared/http.ts
import { NextResponse } from 'next/server';
const statusByKind: Record<string, number> = { NotFound: 404, AlreadyIssued: 409, NoLines: 422, Validation: 422, Unauthorized: 401 };
export const fromResult = <T>(r: Result<T, { kind: string }>, okStatus = 200) =>
  r.ok ? NextResponse.json(r.value, { status: okStatus })
       : NextResponse.json({ error: r.error }, { status: statusByKind[r.error.kind] ?? 500 });

// app/api/invoices/[id]/issue/route.ts
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;                       // Next 15+: params es Promise
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: { kind: 'Unauthorized' } }, { status: 401 });
  return fromResult(await invoicing.issueInvoice({ invoiceId: id, actorId: session.user.id }));
}
```

Webhooks (Stripe, etc.) son route handlers que verifican firma, traducen el payload a un
command y llaman al caso de uso; la idempotencia (por `event.id`) va en el caso de uso o
en una tabla `processed_webhooks` del adaptador, nunca en ambos.

## Server Components como driving de lectura

Un Server Component es un adaptador de lectura: llama a la query del módulo y renderiza.
No hidrata agregados; usa el read model (`overview.md` §10).

```tsx
// app/invoices/page.tsx
import { invoicing } from '@/modules/invoicing';
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const session = await requireSession();
  if (!session) redirect('/login');
  const rows = await invoicing.listPendingInvoices({ customerId: customer ?? session.user.customerId });
  return <InvoiceTable rows={rows} />;   // rows: InvoiceRow[] ya serializable
}
```

Si la página necesita datos de dos módulos, los llama a ambos y compone en el componente;
no crees un "servicio de página" en `modules/`. Con `React.cache()` deduplicas la misma
query dentro de un render sin tocar el módulo.

## DTOs serializables: la frontera RSC/cliente

Lo que cruza de servidor a cliente (props de componentes `'use client'`, retorno de
actions) pasa por el serializador de React: solo JSON plano, `Date` y unos pocos tipos
más. Por tanto:

- `Money`, `InvoiceId` de clase, `Invoice`: nunca como prop. El módulo expone `InvoiceRow`
  con `totalCents: number` y `currency: string`; el formato se hace en cliente.
- Branded types (`InvoiceId = string & Brand`) sí cruzan: en runtime son `string`.
- Fechas: `string` ISO en el DTO evita sorpresas de zona horaria entre server y cliente.
- Errores: uniones de objetos planos (`{ kind, ... }`), nunca instancias de `Error`.

```ts
// modules/invoicing/index.ts — lo único que ve app/
export type { InvoiceRow, InvoiceError, IssueInvoiceCommand } from './application';
export { invoicing } from './infrastructure/container';
```

Añade `import 'server-only'` en `infrastructure/container.ts`: si un componente cliente
lo importa por error, falla el build en vez de enviar Prisma al bundle.

## Auth y tenant en el borde

La sesión se lee en el adaptador (`auth()`, cookies) y se convierte en datos del command
(`actorId`, `tenantId`). El caso de uso decide autorización de negocio ("solo el emisor
puede anular") con esos ids; la autenticación ("hay sesión") es del borde. Nunca pases el
objeto `session` al módulo: es un tipo del framework de auth.

```ts
// lib/auth.ts
export async function requireSession() { return (await auth()) ?? null; }   // wrapper único; cambiar de proveedor toca un archivo
```

## Revalidación y caché

- `revalidatePath`/`revalidateTag` van en la action, tras el caso de uso. Es conocimiento
  de UI (qué pantallas muestran esa factura), no de dominio.
- Si prefieres desacoplarlo, un listener del `InProcessEventBus` registrado en
  `app/` (no en `modules/`) reacciona a `InvoiceIssued` llamando a `revalidateTag('invoices')`.
- `unstable_cache`/`'use cache'` solo alrededor de lecturas del read model, con tags
  por agregado (`invoice:${id}`). Nunca cachees el `ofId` del repositorio.
- Streaming con `Suspense` no cambia nada del módulo: cada bloque suspendido es una
  llamada más a una query.

## Middleware, streaming y Suspense

`middleware.ts` (edge): redirecciones de auth, cabeceras, A/B. Sin BD ni casos de uso; el
runtime edge no carga Prisma ni `node:async_hooks`. Reglas de negocio ahí son señal de
que pertenecen a una action o page. `error.tsx` captura solo excepciones inesperadas; los
errores esperados ya viajaron como `Result` y nunca llegan ahí.

## Errores frecuentes

- **Lógica en la action**: comprobar `status === 'draft'` antes de llamar al caso de uso
  "para ahorrar una query". Duplica la regla y la desincroniza.
- **Devolver clases** (`Money`, `Error`) desde una action: `Warning: Only plain objects can
  be passed to Client Components`. Serializa a DTO.
- **`redirect()` dentro de `try/catch`**: captura `NEXT_REDIRECT` y la redirección no ocurre.
  Llama a `redirect` fuera del bloque o rethrow con `isRedirectError`.
- **Importar `container.ts` desde un componente cliente**: Prisma en el bundle. `server-only`.
- **Un schema zod que reexporta tipos de dominio** (`z.infer` como tipo del command):
  el command lo define `application/`; zod solo produce un objeto que se le pasa.
- **`revalidatePath` dentro del caso de uso**: acopla `application/` a Next.
- **Page que hace `prisma.invoice.findMany` inline** en un módulo con reglas: usa el reader.
  Excepción legítima: CRUD sin módulo (`overview.md` §13).
- **Mocks de `next/headers` en tests de aplicación**: si hace falta, el test está en la capa
  equivocada. Tests de actions en `../../testing/adapter-tests.md`.

## Checklist

- [ ] Cada action/handler: parse zod -> auth -> caso de uso -> revalidar -> `Result`/redirect.
- [ ] Ningún `if` de negocio en `app/`; ningún import de `modules/*/{domain,application,infrastructure}`.
- [ ] Todo lo devuelto al cliente es JSON plano; errores como uniones `{ kind }`.
- [ ] `Record<Error['kind'], ...>` en la UI para mensajes: exhaustividad comprobada por TS.
- [ ] `server-only` en `container.ts`; `middleware.ts` sin BD ni casos de uso.
- [ ] `redirect()` fuera de `try/catch`; `error.tsx` solo para lo inesperado.
- [ ] Lecturas vía read model; escrituras vía caso de uso; CRUD trivial fuera del módulo.
- [ ] dependency-cruiser en CI con `modules-via-index` y `domain-no-framework`.
