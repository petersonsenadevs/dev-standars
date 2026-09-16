# React 19 / Next.js 16: buenas prácticas

## Índice

- [Server Components vs Client Components](#server-components-vs-client-components)
- [Composición de componentes](#composición-de-componentes)
- [Hooks correctos](#hooks-correctos)
- [Estado: derivado, local y global](#estado-derivado-local-y-global)
- [memo, useMemo y useCallback con criterio](#memo-usememo-y-usecallback-con-criterio)
- [Obtención de datos y caching en Next](#obtención-de-datos-y-caching-en-next)
- [Server Actions y validación](#server-actions-y-validación)
- [Rutas, layouts y boundaries](#rutas-layouts-y-boundaries)
- [Formularios](#formularios)
- [Accesibilidad en JSX](#accesibilidad-en-jsx)
- [Rendimiento: bundle, imágenes, fuentes](#rendimiento-bundle-imágenes-fuentes)
- [Testing](#testing)
- [Estructura de carpetas](#estructura-de-carpetas)

## Server Components vs Client Components

- Por defecto todo es Server Component (RSC). Añade `"use client"` solo en la hoja del árbol que necesita estado, efectos, eventos o APIs del navegador.
- `"use client"` marca una frontera: todo lo que ese archivo importa pasa al bundle del cliente. Mantén los client components pequeños y pásales datos ya resueltos por props.
- Un Server Component puede renderizar un Client Component y pasarle `children` (RSC) como slot. Así evitas convertir árboles enteros en cliente.
- Nunca importes módulos con secretos, acceso a BD o `fs` desde un archivo cliente. Marca módulos solo-servidor con `import "server-only"`.
- Datos serializables a través de la frontera: sin funciones (excepto Server Actions), sin clases, sin `Date` sin convertir (usa ISO string).
- Fetch de datos en Server Components con `async/await` directo; no uses `useEffect` para cargar datos iniciales.

```tsx
// app/orders/page.tsx (server)
export default async function OrdersPage() {
  const orders = await getOrders(); // acceso directo a datos, sin API intermedia
  return <OrdersTable orders={orders} actions={<ExportButton />} />;
}
// OrdersTable es "use client" solo si necesita ordenación interactiva
```

## Composición de componentes

- Componentes pequeños con una responsabilidad; extrae cuando un JSX supera ~80 líneas o mezcla varias preocupaciones.
- Prefiere composición (`children`, slots por props) a props booleanas de configuración (`variant="danger"` mejor que `isDanger isLarge isOutlined`).
- Compound components para UI con partes coordinadas (`<Tabs><Tabs.List/><Tabs.Panel/></Tabs>`) con contexto interno.
- Props tipadas con `interface Props`; usa `ComponentPropsWithoutRef<"button">` para envolver elementos nativos y reenviar `...rest`. En React 19, `ref` es una prop normal: no necesitas `forwardRef`.
- Sin lógica de negocio en componentes: llévala a hooks, servicios o al servidor.
- Render props y HOCs solo si un hook no resuelve el problema.

## Hooks correctos

- Reglas: solo en el nivel superior, solo en componentes o custom hooks. ESLint `react-hooks/rules-of-hooks` y `exhaustive-deps` como error, nunca desactivadas.
- Array de dependencias honesto. Si te "sobra" una dependencia, la solución no es quitarla: extrae la lógica, usa `useRef` para valores que no deben re-disparar, o reestructura.
- `useEffect` es para sincronizar con sistemas externos (suscripciones, DOM, timers), no para derivar estado ni para reaccionar a cambios de props. Lee "You Might Not Need an Effect".
- Cleanup siempre que el efecto cree algo (listener, timer, `AbortController`).
- Custom hooks: nombre `useX`, devuelven un objeto o tupla estable, encapsulan efectos y estado de una preocupación. Sin hooks "dios" que devuelven 15 cosas.
- `useSyncExternalStore` para stores externos; `useTransition` / `useDeferredValue` para actualizaciones no urgentes; `useOptimistic` para UI optimista con Server Actions; `use()` para consumir promesas/contexto en render.

```tsx
// Malo: estado derivado en efecto
useEffect(() => { setTotal(items.reduce(sum, 0)); }, [items]);

// Bueno: derivar en render
const total = items.reduce(sum, 0);
```

## Estado: derivado, local y global

- Si se puede calcular a partir de props o de otro estado, no es estado: calcúlalo en render.
- Estado lo más cerca posible de quien lo usa; elévalo solo cuando dos hermanos lo necesitan.
- URL como estado para filtros, paginación, tabs (`useSearchParams`, `nuqs`): compartible, navegable, sobrevive a recargas.
- Estado de servidor (datos remotos) no va en `useState` ni en Redux: usa RSC + caché de Next, o TanStack Query en cliente.
- Estado global de UI (tema, modales) con Context pequeño o Zustand; evita un contexto gigante que re-renderiza toda la app.
- `useReducer` cuando varias piezas de estado cambian juntas o las transiciones tienen reglas.

## memo, useMemo y useCallback con criterio

- Mide antes (React DevTools Profiler). La mayoría de re-renders son baratos.
- Con React Compiler activado (React 19 + Next 16 lo soportan), la memoización manual es en gran parte innecesaria; no la añadas "por si acaso".
- Sin compilador: `memo` para componentes hoja costosos con props estables; `useMemo` para cálculos caros (ordenar/filtrar miles de ítems); `useCallback` solo cuando la función es dependencia de un efecto o prop de un componente memoizado.
- Rompe re-renders por estructura antes que por memo: mueve estado hacia abajo, pasa `children` desde arriba.

## Obtención de datos y caching en Next

- En Next 15+/16 `fetch` **no** se cachea por defecto. Opta explícitamente: `fetch(url, { next: { revalidate: 3600, tags: ["orders"] } })` o `"use cache"` con `cacheLife` / `cacheTag`.
- Invalida por tag tras mutaciones (`revalidateTag("orders")`) desde Server Actions o route handlers; `revalidatePath` para rutas concretas.
- Deduplica llamadas dentro de una request con `React.cache()` en funciones de acceso a datos (no `fetch`).
- Para datos por usuario, lee `cookies()` / `headers()` (asíncronos) en el servidor y no cachees respuestas personalizadas globalmente.
- Streaming con `<Suspense>` alrededor de partes lentas; `loading.tsx` para el segmento completo.
- Nunca hagas fetch a tu propio API route desde un Server Component: llama a la función de datos directamente.

## Server Actions y validación

- `"use server"` en archivos dedicados (`actions.ts`). Son endpoints públicos: valida entrada con zod y **autoriza** en cada acción, aunque la UI ya lo haga.
- Devuelve estados serializables (`{ ok, errors }`) y úsalos con `useActionState`; no lances excepciones para errores esperados.
- Tras mutar: `revalidateTag`/`revalidatePath` y, si procede, `redirect()` (fuera de `try/catch`, porque redirect lanza internamente).
- Nunca pases IDs de recurso sin verificar propiedad; nunca aceptes campos como `role` o `userId` desde el cliente.

```ts
"use server";
export async function updateProfile(_: State, formData: FormData): Promise<State> {
  const session = await requireSession();
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  await profiles.update(session.userId, parsed.data);
  revalidateTag(`profile:${session.userId}`);
  return { ok: true };
}
```

## Rutas, layouts y boundaries

- App Router: `layout.tsx` para UI persistente (no se re-renderiza al navegar entre hijos), `page.tsx` para contenido, `template.tsx` solo si necesitas remount.
- Route groups `(marketing)`, `(app)` para layouts distintos sin afectar la URL. Rutas paralelas/interceptadas para modales con URL.
- `error.tsx` por segmento (Client Component, recibe `error` y `reset`); `global-error.tsx` para el layout raíz; `not-found.tsx` + `notFound()`.
- `loading.tsx` = Suspense boundary automático. Añade Suspense granular dentro de la página para no bloquear todo por un widget lento.
- Middleware (`proxy.ts` en Next 16) solo para redirecciones, auth ligera y cabeceras; sin acceso a BD ni lógica pesada.
- `generateMetadata` para SEO por página; `generateStaticParams` para rutas estáticas conocidas.
- Route Handlers (`route.ts`) solo para webhooks, APIs externas o clientes no-React; no como capa interna.

## Formularios

- Formularios sencillos: `<form action={serverAction}>` + `useActionState` + `useFormStatus`. Funcionan sin JS.
- Formularios complejos (validación en vivo, arrays dinámicos): React Hook Form + zod resolver, enviando a la Server Action.
- Un mismo schema zod para cliente y servidor (`shared/schemas`). Errores de servidor mapeados a campos.
- Estados disabled/pending, mensajes de error asociados con `aria-describedby`, foco al primer error.

## Accesibilidad en JSX

- HTML semántico primero: `<button>` para acciones, `<a>`/`<Link>` para navegación, `<nav>`, `<main>`, `<h1>`-`<h6>` en orden. Un `div` con `onClick` no es un botón.
- Todo control interactivo accesible por teclado y con nombre accesible (`aria-label` solo si no hay texto visible).
- Imágenes: `alt` descriptivo o `alt=""` si es decorativa.
- Formularios: `<label htmlFor>` siempre; errores con `role="alert"` o `aria-live="polite"`.
- Modales/menús: usa primitivas accesibles (Radix, React Aria, Headless UI) en lugar de implementar foco y trampas a mano.
- Contraste mínimo 4.5:1; no transmitas información solo con color.
- `eslint-plugin-jsx-a11y` activo; pruebas con `axe` (`@axe-core/playwright`, `vitest-axe`).

## Rendimiento: bundle, imágenes, fuentes

- Analiza con `@next/bundle-analyzer`; presupuesto por ruta (< 200 KB JS inicial gz como referencia).
- `next/dynamic` con `ssr: false` solo para componentes que dependen de `window`; para el resto, `dynamic()` normal o Suspense.
- Importa lo necesario: `import { debounce } from "es-toolkit"`, no librerías enteras; evita `moment`, usa `date-fns`/`Temporal` polyfill.
- `next/image` siempre: tamaños (`sizes`), `priority` solo en LCP, formatos AVIF/WebP automáticos, `fill` con contenedor dimensionado.
- `next/font` para fuentes (self-hosted, sin layout shift, `display: swap`). Máximo 2 familias, subsets acotados.
- Core Web Vitals: LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Mide con Lighthouse CI y `useReportWebVitals` en producción.
- Evita renderizar listas enormes: paginación, virtualización (`@tanstack/virtual`).
- Third-party scripts con `next/script` `strategy="lazyOnload"` o `afterInteractive`.

## Testing

- Unit/componente: Vitest + Testing Library. Consulta por rol/etiqueta (`getByRole("button", { name: /save/i })`), nunca por clase o test-id salvo último recurso. `userEvent` en lugar de `fireEvent`.
- Testea comportamiento observable, no implementación (sin espiar `useState`). Un test por comportamiento.
- Hooks: `renderHook` solo para hooks reutilizables; el resto se prueba a través del componente.
- Server Components async: test de integración ligera renderizando el resultado, o E2E. Server Actions: test unitario de la función con mocks de la capa de datos.
- Red: MSW para mockear HTTP en tests de componente; nunca mockees `fetch` a mano.
- E2E: Playwright para 5-10 flujos críticos (login, checkout, CRUD principal). Usa `getByRole`, fixtures de autenticación con `storageState`, trazas en fallo.
- Comandos: `vitest run --coverage`, `playwright test --project=chromium` en CI; `playwright test --ui` en local.

## Estructura de carpetas

```
src/
  app/                 # rutas (solo page/layout/route + wiring)
  features/<feature>/  # componentes, hooks, actions, schemas de la feature
  components/ui/       # primitivas compartidas (button, dialog)
  lib/                 # clientes (db, http), utilidades puras
  server/              # acceso a datos, servicios solo-servidor ("server-only")
  shared/schemas/      # zod compartido cliente/servidor
```

- Colocación por feature, no por tipo de archivo. `app/` importa de `features/`, nunca al revés.
- Archivos: `kebab-case.tsx`; componentes exportados en `PascalCase`; un componente principal por archivo.
