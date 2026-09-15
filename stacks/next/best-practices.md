# Mejores prácticas — Next.js + TS

## Arquitectura App Router
- Server Components para datos y render; Client Components solo para interactividad.
- Server Actions para mutaciones; valida entrada con zod. `revalidatePath`/`revalidateTag` tras mutar.
- Route Handlers (`app/api/.../route.ts`) para APIs; tipa request/response.
- Streaming + Suspense para cargas progresivas. `loading.tsx` / `error.tsx` por segmento.

## TypeScript
- `strict: true`. Tipos derivados (`z.infer`, `Awaited<ReturnType<>>`) en vez de duplicar.
- Sin `any`; usa `unknown` + narrowing. DTOs tipados en el borde (fetch/DB).

## Rendimiento
- `next/image`, `next/font`. Code splitting con `dynamic()` para lo pesado.
- Caching consciente: `fetch` con `cache`/`next.revalidate`. Evita render dinámico innecesario.

## Estado / datos
- Server state con React Query/SWR si el repo lo usa; client state mínimo.
- No dupliques la fuente de verdad entre server y client.

## Testing
- Unit con Vitest/Jest + Testing Library. e2e con Playwright.
- Testea Server Actions y Route Handlers como funciones.

## Seguridad
- Validación en el servidor siempre. Auth en middleware/handlers, no solo en UI.
- Secretos solo en el servidor; nunca en `NEXT_PUBLIC_*`.

> Detalle y ejemplos bajo demanda: skill `code-quality` → `references/react-next.md` (+ `testing.md`, `security-owasp.md`, `performance.md`, `api-design.md`).
