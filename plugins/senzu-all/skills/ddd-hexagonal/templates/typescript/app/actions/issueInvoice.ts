'use server';

/**
 * Adaptador driving: Server Action de Next.js (App Router).
 * Responsabilidades: validar forma (zod), resolver actor (auth), construir command,
 * invocar caso de uso, devolver Result serializable, revalidar caché.
 *
 * Sin `if` de negocio, sin Prisma, sin transacciones. Todo lo que devuelve es JSON-serializable
 * (por eso los errores son uniones discriminadas, no clases).
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { invoicing } from '@/modules/invoicing';
import type { IssueInvoiceError, IssueInvoiceOutput } from '@/modules/invoicing';

const Input = z.object({
  invoiceId: z.string().uuid(),
});

export type IssueInvoiceActionResult =
  | { ok: true; value: IssueInvoiceOutput }
  | { ok: false; error: IssueInvoiceError | { kind: 'Validation'; issues: Record<string, string[]> } | { kind: 'Unauthorized' } };

export async function issueInvoiceAction(raw: unknown): Promise<IssueInvoiceActionResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { kind: 'Validation', issues: parsed.error.flatten().fieldErrors as Record<string, string[]> } };
  }

  const session = await auth();
  if (!session?.user) return { ok: false, error: { kind: 'Unauthorized' } };
  // Autorización de acceso (puede/no puede) aquí o en un middleware; la regla de negocio, en el dominio.

  const result = await invoicing.issueInvoice({ invoiceId: parsed.data.invoiceId, actorId: session.user.id });

  if (result.ok) {
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  }
  return result;
}

// ---- Uso desde un Client Component ----------------------------------------------------------
//
// 'use client';
// const [pending, start] = useTransition();
// const onIssue = () => start(async () => {
//   const r = await issueInvoiceAction({ invoiceId });
//   if (r.ok) toast.success(`Factura ${r.value.number} emitida`);
//   else switch (r.error.kind) {
//     case 'NoLines': toast.error('Añade al menos una línea'); break;
//     case 'AlreadyIssued': toast.error('Ya estaba emitida'); break;
//     case 'Validation': setErrors(r.error.issues); break;
//     default: toast.error('No se pudo emitir');
//   }
// });
//
// ---- Equivalente como route handler (app/api/invoices/[id]/issue/route.ts) --------------------
//
// export async function POST(_: Request, { params }: { params: { id: string } }) {
//   const result = await invoicing.issueInvoice({ invoiceId: params.id, actorId: await actorId() });
//   if (result.ok) return Response.json(result.value);
//   const status = { NotFound: 404, NoLines: 409, AlreadyIssued: 409, Locked: 409 }[result.error.kind] ?? 400;
//   return Response.json({ error: result.error }, { status });
// }
