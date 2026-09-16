# Casos de uso de cliente en Vue: SPA e Inertia

## Índice

- [Alcance](#alcance)
- [Cuándo no hacer nada](#cuando-no-hacer-nada)
- [Puertos de API con adaptador HTTP, Inertia y fake](#puertos-de-api-con-adaptador-http-inertia-y-fake)
- [Composables como casos de uso](#composables-como-casos-de-uso)
- [Modelos de vista con toVm](#modelos-de-vista-con-tovm)
- [Validación de forma frente a reglas de negocio](#validacion-de-forma-frente-a-reglas-de-negocio)
- [Pinia como estado de aplicación](#pinia-como-estado-de-aplicacion)
- [Ejemplo completo: wizard de factura](#ejemplo-completo-wizard-de-factura)
- [Tipar props de Inertia desde los DTOs](#tipar-props-de-inertia-desde-los-dtos)
- [Tests](#tests)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

## Alcance

Profundiza los §4-§9 de [`overview.md`](overview.md) con un flujo completo con estado local
(wizard de factura) en dos variantes: SPA con API REST e Inertia. Lado servidor en
[`../laravel/http-and-inertia-adapters.md`](../laravel/http-and-inertia-adapters.md).

## Cuándo no hacer nada

Solo si hay estado de cliente con reglas (carrito, wizard, configurador), la misma
operación se dispara desde varios sitios, o quieres Storybook y tests sin backend. Para
un listado o un formulario que hace un POST:

```ts
// resources/js/Pages/Invoices/Show.vue — Inertia puro, sin módulo
const form = useForm({});
const issue = () => form.post(route('invoices.issue', props.invoice.id), { preserveScroll: true });
```

`useForm` ya da `processing`, `errors` y `recentlySuccessful`; envolverlo sin añadir lógica es ruido.

## Puertos de API con adaptador HTTP, Inertia y fake

Un puerto por contexto y tres adaptadores con la misma interfaz. El puerto habla de
operaciones (`create`, `issue`), no de rutas ni verbos.

```ts
// modules/invoicing/application/ports.ts
export interface InvoiceApi {
  create(input: CreateInvoiceInput): Promise<Result<{ id: string }, ApiError>>;
  issue(id: string): Promise<Result<void, ApiError>>;
}
export const InvoiceApiKey: InjectionKey<InvoiceApi> = Symbol('InvoiceApi');

// infrastructure/InertiaInvoiceApi.ts — router.post envuelto en promesa; el ACL frente al flash y errors
export class InertiaInvoiceApi implements InvoiceApi {
  issue(id: string) { return this.visit(route('invoices.issue', id), {}); }
  create(input: CreateInvoiceInput) {
    return this.visit<{ id: string }>(route('invoices.store'), input, (page) => ({ id: page.props.flash.createdId as string }));
  }
  private visit<T = void>(url: string, data: object, pick?: (page: Page) => T): Promise<Result<T, ApiError>> {
    return new Promise((resolve) => router.post(url, data, {
      preserveState: true,
      onSuccess: (page) => resolve(ok(pick ? pick(page) : (undefined as T))),
      onError: (errors) => resolve(err(toApiError(errors))),   // { invoice: '...' } -> Domain; el resto -> Validation
    }));
  }
}

function toApiError(errors: Record<string, string>): ApiError {
  if ('invoice' in errors) return { kind: 'Domain', code: 'invoice', message: errors.invoice };
  return { kind: 'Validation', fields: Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]])) };
}
```

El servidor devuelve errores de dominio bajo una clave convenida (`invoice`) vía `withErrors`;
`HttpInvoiceApi` (axios) hace lo mismo con 422/409. `FakeInvoiceApi` tiene comportamiento
real en memoria y es el único doble que usan tests y Storybook.

## Composables como casos de uso

Un composable por intención, con estado de la operación, sin `router` ni toasts. Recibe
el puerto por parámetro con `inject` como default para que el test no monte nada.

```ts
// application/useCreateInvoice.ts
export function useCreateInvoice(api: InvoiceApi = inject(InvoiceApiKey)!) {
  const pending = ref(false);
  const error = ref<ApiError | null>(null);
  const fieldErrors = computed(() => (error.value?.kind === 'Validation' ? error.value.fields : {}));

  async function create(draft: InvoiceDraft): Promise<{ id: string } | null> {
    if (!canSubmit(draft)) { error.value = { kind: 'Domain', code: 'incomplete', message: 'Faltan líneas' }; return null; }
    pending.value = true; error.value = null;
    const r = await api.create(toCreateInput(draft));
    pending.value = false;
    if (!r.ok) { error.value = r.error; return null; }
    return r.value;
  }
  return { create, pending: readonly(pending), error: readonly(error), fieldErrors };
}
```

`canSubmit` y `toCreateInput` son funciones puras de `domain/`. El componente decide navegar
o notificar. Lecturas: `useInvoiceList` envuelve TanStack Query o, con Inertia, no existe.

## Modelos de vista con toVm

```ts
// application/invoiceVm.ts
export type InvoiceRowVm = InvoiceRow & { totalFormatted: string; isOverdue: boolean; statusTone: 'neutral' | 'warning' | 'danger' };

export function toVm(row: InvoiceRow, today: Date, locale = 'es-ES'): InvoiceRowVm {
  const isOverdue = row.status === 'issued' && !!row.dueAt && new Date(row.dueAt) < today;
  return {
    ...row,
    totalFormatted: new Intl.NumberFormat(locale, { style: 'currency', currency: row.currency }).format(row.totalCents / 100),
    isOverdue,
    statusTone: isOverdue ? 'danger' : row.status === 'draft' ? 'warning' : 'neutral',
  };
}
// componente: const rows = computed(() => props.invoices.map((r) => toVm(r, today.value)));
```

`today` se pasa, no se lee dentro: el test es determinista. Formateo de moneda y fechas
vive aquí, nunca en el template ni en el DTO.

## Validación de forma frente a reglas de negocio

```ts
// ui/InvoiceLineForm.vue — vee-validate + zod: solo forma
const schema = toTypedSchema(z.object({
  description: z.string().min(1).max(255),
  unitPriceCents: z.number().int().min(0),
  quantity: z.number().int().min(1),
}));
const { handleSubmit, setErrors } = useForm({ validationSchema: schema });

// domain/InvoiceDraft.ts — reglas repetidas para UX, mismas que el backend
export function canSubmit(d: InvoiceDraft): boolean { return d.lines.length > 0 && d.customerId !== null; }
export function lineTotal(l: InvoiceLineInput): number { return l.unitPriceCents * l.quantity; }
```

Con `Validation`, el componente hace `setErrors(fieldErrors)`: el backend puede rechazar
por forma aunque zod ya validara (esquema desfasado). `Domain` se pinta como alerta global.
`lineTotal` es una previsualización; el total con efecto económico llega del servidor.

## Pinia como estado de aplicación

```ts
// modules/invoicing/application/invoiceDraftStore.ts
export const useInvoiceDraftStore = defineStore('invoiceDraft', () => {
  const draft = ref<InvoiceDraft>(emptyDraft());
  const step = ref<1 | 2 | 3>(1);
  const canSubmit = computed(() => canSubmitDraft(draft.value));
  const total = computed(() => draftTotal(draft.value));

  function addLine(line: InvoiceLineInput) { draft.value = withLine(draft.value, line); }   // función pura, inmutable
  function removeLine(id: string) { draft.value = withoutLine(draft.value, id); }
  function next() { if (step.value < 3) step.value += 1; }
  function reset() { draft.value = emptyDraft(); step.value = 1; }
  return { draft, step, canSubmit, total, addLine, removeLine, next, reset };
});
```

Persistir en `sessionStorage` (plugin de Pinia) vale para no perder el wizard al recargar;
nunca uses el store como caché de agregados del backend.

## Ejemplo completo: wizard de factura

```ts
// ui/InvoiceWizard.vue (script setup)
const store = useInvoiceDraftStore();
const { create, pending, error, fieldErrors } = useCreateInvoice();
const notify = useNotifications();                       // store global de UI

async function submit() {
  const result = await create(store.draft);
  if (!result) { if (error.value?.kind === 'Domain') notify.error(error.value.message); return; }
  store.reset();
  router.visit(route('invoices.show', result.id));       // Inertia; en SPA: useRouter().push(...)
}
```

Paso 1 elige cliente (store), paso 2 añade líneas (`InvoiceLineForm` con zod -> `store.addLine`),
paso 3 resumen con `store.total` y botón deshabilitado si `!store.canSubmit`. Composable, store
y funciones puras se testean sin montar el wizard; el componente solo con el fake.

## Tipar props de Inertia desde los DTOs

Los DTOs del read model son el contrato. Genera tipos (`spatie/typescript-transformer`
sobre los DTO de PHP) o mantenlos a mano en `modules/<ctx>/domain/types.ts`; nunca copies
el modelo Eloquent.

```ts
// resources/js/types/inertia.d.ts
import type { InvoiceRow } from '@/modules/invoicing';
declare module '@inertiajs/core' {
  interface PageProps { auth: { user: { id: string; name: string } }; flash: { success?: string; createdId?: string } }
}
// Pages/Invoices/Index.vue
defineProps<{ invoices: InvoiceRow[]; filters: { status?: string } }>();
```

En SPA el mismo `InvoiceRow` tipa `HttpInvoiceApi.list`. Cambiar el DTO rompe la compilación del front: es la señal que buscas.

## Tests

```ts
// application/useCreateInvoice.test.ts
it('maps a validation error to field errors', async () => {
  const api = new FakeInvoiceApi({ rejectWith: { kind: 'Validation', fields: { 'lines.0.quantity': ['min 1'] } } });
  const { create, fieldErrors } = useCreateInvoice(api);
  expect(await create(aDraft().withLine({ quantity: 0 }).build())).toBeNull();
  expect(fieldErrors.value['lines.0.quantity']).toEqual(['min 1']);
});

// application/invoiceDraftStore.test.ts
beforeEach(() => setActivePinia(createPinia()));
it('cannot submit without lines', () => { expect(useInvoiceDraftStore().canSubmit).toBe(false); });

// infrastructure/InertiaInvoiceApi.test.ts — solo el adaptador, con router mockeado
vi.mock('@inertiajs/vue3', () => ({ router: { post: vi.fn((_u, _d, o) => o.onError({ invoice: 'Sin líneas' })) } }));
it('translates errors.invoice into a Domain error', async () => {
  expect(await new InertiaInvoiceApi().issue('inv-1')).toEqual(err({ kind: 'Domain', code: 'invoice', message: 'Sin líneas' }));
});
```

Solo el test del adaptador mockea `router`/axios; el resto usa `FakeInvoiceApi`. Builders
(`aDraft()`) igual que en backend.

## Errores frecuentes

- Composable que llama `router.push` o abre toasts: no reutilizable; su test monta la app.
- `router.post` desde varios componentes para la misma operación: la traducción de errores diverge.
- Store de Pinia con `actions` que calculan totales o deciden si se puede emitir: dominio escondido.
- Copiar el modelo del backend (`Invoice` con métodos) al front: dos fuentes de verdad.
- `toVm` leyendo `new Date()` o `navigator.language` por dentro: tests no deterministas.
- Tratar 409/`errors.invoice` como error de campo, o 422 como error global.
- Props de Inertia tipadas como `any`; mockear axios o `@inertiajs/vue3` fuera del test del adaptador.
- Aplicar toda esta estructura a una página CRUD con un solo formulario.

## Checklist

- [ ] La pantalla justifica módulo: estado local con reglas, reutilización o tests sin backend.
- [ ] Un puerto `InvoiceApi` con adaptadores HTTP e Inertia intercambiables y un fake con comportamiento.
- [ ] El adaptador traduce forma (`Validation`) y dominio (`Domain`) a `Result`; ninguna otra capa ve HTTP.
- [ ] Un composable por intención; recibe el puerto; no navega ni notifica.
- [ ] Reglas repetidas para UX en `domain/` como funciones puras; el servidor sigue siendo la verdad.
- [ ] Formularios con vee-validate + zod solo para forma; `setErrors` con los `fields` del backend.
- [ ] Pinia guarda estado del flujo y delega reglas; `toVm(row, today)` para todo lo derivado.
- [ ] Props de Inertia y respuestas de API tipadas desde los DTOs del read model.
- [ ] Tests: funciones puras, composables con fake, store con `createPinia`, adaptador con router mockeado.
