# Vue 3 SPA / Inertia: dónde acaba el dominio en el cliente

Índice
1. Principio: el servidor manda
2. Cuándo NO hacer nada de esto
3. Estructura `src/modules/<context>/{domain,application,infrastructure,ui}`
4. Puertos para la API: interfaz + adaptador + fake
5. Casos de uso de cliente como composables
6. Modelos de vista vs entidades
7. Validación de formulario vs reglas de negocio
8. Pinia como estado de aplicación, no de dominio
9. Inertia: qué cambia
10. Tests con Vitest
11. Reglas de dependencia en el front

---

## 1. Principio: el servidor manda

El dominio (invariantes, transiciones, cálculos con efecto legal o económico) vive en el
backend. El front tiene tres responsabilidades legítimas:

1. **Orquestar** llamadas a la API con estado de carga/error (casos de uso de cliente).
2. **Reflejar** reglas para UX inmediata (deshabilitar "Emitir" si no hay líneas), sin
   ser fuente de verdad.
3. **Lógica puramente de cliente**: carrito antes de enviar, wizard multi-paso, cálculos
   provisionales, filtros locales, modo offline.

Si una regla existe en el front y no en el backend, es un bug. Si existe en ambos, el
front la trata como "pista" y el backend como ley.

## 2. Cuándo NO hacer nada de esto

Pantalla CRUD, listado con filtros, formulario que hace un POST y muestra errores:
**componente + `useFetch`/axios + estado local**. Sin módulos, sin puertos, sin Pinia.
Un `api/invoices.ts` con funciones tipadas es toda la abstracción necesaria.

Aplica la estructura de este documento cuando (cualquiera): hay flujo multi-pantalla con
estado propio, lógica de cliente con tests que merecen la pena (configurador, carrito,
editor), la misma operación se dispara desde varios componentes, o quieres testear la UI
sin backend de forma sistemática.

## 3. Estructura

```
src/
  modules/
    invoicing/
      domain/           InvoiceDraft.ts (modelo de cliente con reglas locales), Money.ts (o importado del shared),
                        types.ts (tipos del contrato API, generados o a mano)
      application/      ports.ts (InvoiceApi), useCreateInvoice.ts, useInvoiceList.ts (composables = casos de uso)
      infrastructure/   HttpInvoiceApi.ts (axios/fetch), FakeInvoiceApi.ts (tests y Storybook), container.ts
      ui/               InvoiceForm.vue, InvoiceList.vue, InvoiceLineRow.vue, InvoicesPage.vue
      index.ts          exporta composables, tipos y el provider
    shared/             Result.ts, Money.ts, http.ts (cliente base con auth y errores)
  app/                  router, layouts, plugins, main.ts (inyecta container con provide)
  stores/               Pinia global: auth, ui (toasts), preferencias
```

`domain/` en el front suele ser pequeño: tipos del contrato y uno o dos modelos de
cliente. Si queda vacío, elimínalo y deja `application` + `infrastructure` + `ui`.

## 4. Puertos para la API: interfaz + adaptador + fake

```ts
// application/ports.ts
export interface InvoiceApi {
  list(filters: InvoiceFilters): Promise<InvoiceRow[]>;
  create(input: CreateInvoiceInput): Promise<Result<{ id: string }, ApiError>>;
  issue(id: string): Promise<Result<void, ApiError>>;
}
export type ApiError = { kind: 'Validation'; fields: Record<string, string[]> } | { kind: 'Domain'; code: string; message: string } | { kind: 'Network' };

// infrastructure/HttpInvoiceApi.ts — traduce HTTP a Result; es el ACL frente al backend
export class HttpInvoiceApi implements InvoiceApi {
  constructor(private http: HttpClient) {}
  async issue(id: string) {
    try { await this.http.post(`/api/invoices/${id}/issue`); return ok(undefined); }
    catch (e) { return err(toApiError(e)); }   // 422 -> Validation, 409 -> Domain, otros -> Network
  }
}

// infrastructure/FakeInvoiceApi.ts — comportamiento real en memoria, para tests y desarrollo sin backend
export class FakeInvoiceApi implements InvoiceApi {
  rows: InvoiceRow[] = [];
  async issue(id: string) {
    const r = this.rows.find((x) => x.id === id);
    if (!r) return err({ kind: 'Domain', code: 'not_found', message: 'No existe' });
    r.status = 'issued'; return ok(undefined);
  }
}
```

Inyección: `provide(InvoiceApiKey, new HttpInvoiceApi(http))` en `main.ts` o en el
`index.ts` del módulo; los composables hacen `inject(InvoiceApiKey)`. En tests,
`provide` con el fake.

## 5. Casos de uso de cliente como composables

Un composable por intención. Encapsula estado de la operación (loading, error, result)
y llama al puerto. No conoce componentes ni router.

```ts
// application/useIssueInvoice.ts
export function useIssueInvoice(api: InvoiceApi = inject(InvoiceApiKey)!) {
  const pending = ref(false);
  const error = ref<ApiError | null>(null);

  async function issue(id: string): Promise<boolean> {
    pending.value = true; error.value = null;
    const r = await api.issue(id);
    pending.value = false;
    if (!r.ok) { error.value = r.error; return false; }
    return true;
  }
  return { issue, pending, error: readonly(error) };
}
```

El componente decide qué hacer con `true/false` (navegar, toast). Si varios componentes
necesitan compartir el resultado, el composable escribe en un store (§8). TanStack Query
para Vue encaja como implementación de lecturas (`useInvoiceList` envuelve `useQuery`);
las escrituras siguen siendo composables explícitos.

## 6. Modelos de vista vs entidades

- **`InvoiceRow`** (lo que devuelve el backend para la tabla): tipo plano, tal cual.
- **View model** (`InvoiceRowVm`): `InvoiceRow` + campos derivados para la vista
  (`totalFormatted`, `isOverdue`, `statusColor`). Se calcula con una función pura
  `toVm(row, today)`, testeable sin Vue.
- **Modelo de cliente** (`InvoiceDraft`): solo cuando hay lógica local antes de enviar
  (añadir/quitar líneas, total provisional). Clase o `reactive` + funciones puras.

No copies la entidad del backend al front. El front trabaja con los DTOs del contrato;
las reglas que necesita repetir para UX se implementan como funciones puras sobre esos DTOs.

```ts
// domain/InvoiceDraft.ts — lógica local previa al envío
export function canIssue(draft: InvoiceDraft): boolean { return draft.lines.length > 0 && draft.lines.every((l) => l.quantity > 0); }
export function total(draft: InvoiceDraft): Money { return draft.lines.reduce((acc, l) => acc.add(Money.of(l.unitPriceCents).times(l.quantity)), Money.zero('EUR')); }
```

## 7. Validación de formulario vs reglas de negocio

| Capa | Herramienta | Responsabilidad |
|---|---|---|
| Formulario | vee-validate + zod / yup | requerido, formato, longitud; feedback inmediato |
| Cliente (opcional) | funciones puras en `domain/` | reglas repetidas para UX (`canIssue`) |
| Backend | Form Request + dominio | verdad; devuelve 422 (forma) o 409 (regla) |

El adaptador HTTP traduce 422 a `{ kind: 'Validation', fields }` y el formulario los pinta
con `setErrors(fields)`. Un 409 de dominio se muestra como mensaje global, no de campo.
Nunca confíes en que la validación de cliente ha pasado: el composable siempre maneja
`Validation` aunque el formulario "ya validó".

## 8. Pinia como estado de aplicación, no de dominio

Pinia guarda **estado de aplicación**: sesión, preferencias, caché de lecturas
compartidas, estado de UI cross-página (carrito, wizard). No guarda reglas: un store con
`actions` que calculan descuentos o deciden si algo se puede emitir está haciendo de
dominio.

```ts
// stores/invoiceDraft.ts — estado, no reglas
export const useInvoiceDraftStore = defineStore('invoiceDraft', () => {
  const draft = ref<InvoiceDraft>(emptyDraft());
  const canIssue = computed(() => canIssueDraft(draft.value)); // delega en función pura del módulo
  function addLine(line: InvoiceLineInput) { draft.value.lines.push(line); }
  function reset() { draft.value = emptyDraft(); }
  return { draft, canIssue, addLine, reset };
});
```

Regla: si un store se puede testear sin Pinia extrayendo funciones puras, hazlo y deja el
store como cáscara. Stores por módulo viven en `modules/<ctx>/application/` si son
específicos; en `stores/` si son globales.

## 9. Inertia: qué cambia

- No hay `InvoiceApi` para lecturas: las props llegan del controlador (read model).
  Tipa las props con el DTO del backend (`InvoiceRow[]`).
- Escrituras: `router.post(route('invoices.issue', id))` o `useForm`. El "adaptador" es
  Inertia; los errores de dominio llegan por `errors` del flash o `onError`.
- Los casos de uso de cliente siguen teniendo sentido cuando hay lógica local previa
  (carrito, wizard), y se implementan igual (§5) con un puerto cuyo adaptador usa
  `router.post` en vez de axios.
- Pinia queda para estado cross-página; el resto lo dan las props por visita.
- View models: misma técnica (`toVm`), sobre las props.

Estructura recomendada con Inertia: `resources/js/Pages/` (adaptador UI, una página por
ruta) + `resources/js/modules/<ctx>/{application,domain,ui}` para lo reutilizable.

## 10. Tests con Vitest

```ts
// application/useIssueInvoice.test.ts — sin montar componentes
it('exposes the domain error when the API rejects', async () => {
  const api = new FakeInvoiceApi();                       // sin filas -> not_found
  const { issue, error } = useIssueInvoice(api);
  expect(await issue('inv-1')).toBe(false);
  expect(error.value).toMatchObject({ kind: 'Domain', code: 'not_found' });
});

// ui/InvoiceForm.test.ts — @vue/test-utils con el fake inyectado
const wrapper = mount(InvoiceForm, { global: { provide: { [InvoiceApiKey as symbol]: fake } } });
```

Tres niveles: funciones puras de `domain/` (ms), composables con fake (ms), componentes
con fake (decenas de ms). E2E (Playwright) solo para flujos críticos contra backend real
o MSW. No mockees axios: usa el fake del puerto.

## 11. Reglas de dependencia en el front

`dependency-cruiser` con las mismas reglas que `typescript.md` §11 más:
`ui/` puede importar `application/` y `domain/`; `application/` no importa `ui/` ni
`vue-router`; `domain/` no importa `vue` (ni `ref`: funciones puras sobre datos planos).
Entre módulos, solo vía `index.ts`.
