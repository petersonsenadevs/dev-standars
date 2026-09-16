# shadcn-vue + Reka UI en Vue 3 / Laravel + Inertia

Índice: 1 instalación · 2 `components.json` · 3 tema y tokens · 4 dark mode · 5 formularios (vee-validate + zod,
Inertia `useForm`) · 6 tablas con TanStack Table · 7 componentes clave · 8 pitfalls.

## 1. Instalación

Requisitos: Vue 3.4+, Vite, TypeScript, Tailwind 4 (`@tailwindcss/vite`).

```bash
npm i -D tailwindcss @tailwindcss/vite
npx shadcn-vue@latest init
npx shadcn-vue@latest add button card dialog form input label select table sonner
npm i lucide-vue-next
```

`init` pregunta framework (Vite / Laravel / Nuxt), ruta del CSS, alias y color base; genera `components.json`,
`lib/utils.ts` (`cn()`) y añade las variables base a `resources/css/app.css` (Laravel) o `src/assets/index.css`.
Cada componente se copia a `components/ui/<nombre>/` como código propio (SFC + `index.ts` con el `cva`).

## 2. `components.json`

```json
{ "$schema": "https://shadcn-vue.com/schema.json", "style": "new-york", "typescript": true, "framework": "laravel",
  "tailwind": { "config": "", "css": "resources/css/app.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "composables": "@/composables", "utils": "@/lib/utils", "ui": "@/components/ui" },
  "iconLibrary": "lucide" }
```

`tailwind.config` vacío en Tailwind 4 (CSS-first). El alias `@` debe existir en `vite.config.ts` y `tsconfig.json`
(`resources/js` en Laravel, `src` en SPA). Vue SPA: `"framework": "vite"`, `"css": "src/assets/index.css"`.

## 3. Tema y tokens (Tailwind 4)

shadcn-vue genera `:root` / `.dark` con variables semánticas y un `@theme inline` que las expone como utilidades
(`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`). Sus valores se sustituyen por los del
`design-system/<slug>/MASTER.md`; los primitivos de marca van en `@theme` (`ui-ux-pro-max/references/es/tokens-tailwind.md`).

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));
@theme {
  --color-brand-500: oklch(0.62 0.19 260); --color-brand-600: oklch(0.55 0.2 260);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif; --radius: 0.625rem;
}
:root {
  --background: oklch(1 0 0); --foreground: oklch(0.145 0 0);
  --primary: var(--color-brand-600); --primary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.97 0 0); --muted-foreground: oklch(0.556 0 0);
  --border: oklch(0.922 0 0); --ring: var(--color-brand-500); --destructive: oklch(0.577 0.245 27.3);
}
.dark {
  --background: oklch(0.145 0 0); --foreground: oklch(0.985 0 0); --primary: var(--color-brand-500);
  --muted: oklch(0.269 0 0); --muted-foreground: oklch(0.708 0 0); --border: oklch(1 0 0 / 10%);
}
@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground); --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground); --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border); --color-ring: var(--ring); --color-destructive: var(--destructive); --radius-lg: var(--radius);
}
```

Variantes propias: edita el `cva` de `components/ui/button/index.ts` (`variant: { brand: "bg-brand-600 …" }`);
no crees `BrandButton.vue` que duplique clases.

## 4. Dark mode

- Clase `dark` en `<html>`; preferencia en `localStorage('theme')` = `light|dark|system`; `html { color-scheme: light dark }`.
- Laravel: script inline en `resources/views/app.blade.php` antes de `@inertia` que lee `localStorage` y
  `prefers-color-scheme` y aplica la clase (sin flash). SPA: el mismo script en `index.html`.
- Toggle: `useColorMode()` de VueUse (`attribute: 'class'`, `storageKey: 'theme'`) en un `DropdownMenu` Sol/Luna/Sistema.

## 5. Formularios

### vee-validate + zod (validación en cliente)

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = toTypedSchema(z.object({ email: z.string().email("Email no válido"), password: z.string().min(8, "Mínimo 8 caracteres") }));
const { handleSubmit, isSubmitting } = useForm({ validationSchema: schema });
const onSubmit = handleSubmit((values) => { /* API o router.post */ });
</script>
<template>
  <form class="space-y-6" novalidate @submit="onSubmit">
    <FormField v-slot="{ componentField }" name="email">
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl><Input type="email" autocomplete="email" v-bind="componentField" /></FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button type="submit" class="w-full" :disabled="isSubmitting">{{ isSubmitting ? "Entrando…" : "Entrar" }}</Button>
  </form>
</template>
```

`FormControl` conecta `id`, `aria-invalid` y `aria-describedby` con `FormMessage`; no los añadas a mano.

### Inertia `useForm` (validación en servidor, la habitual en Laravel)

`const form = useForm({ email: "" })` + `form.post(route("login"), { preserveScroll: true, onError: focusFirstError })`.
En el markup: `<Label for="email">`, `<Input id="email" v-model="form.email" :aria-invalid="!!form.errors.email"
aria-describedby="email-error" />`, `<p id="email-error" class="text-sm text-destructive">` con `form.errors.email` y
`<Button :disabled="form.processing">`. Elige uno: vee-validate (feedback inmediato, servidor como respaldo) o
`useForm` de Inertia; no dupliques esquemas. Flash de Laravel → `vue-sonner` desde `usePage().props.flash`.

## 6. Tablas con TanStack Table

```bash
npx shadcn-vue@latest add table dropdown-menu checkbox && npm i @tanstack/vue-table
```

`columns.ts` exporta `ColumnDef<User>[]`; cabeceras y celdas con `h()` (`h(Button, { variant: "ghost", onClick: () =>
column.toggleSorting(...) }, () => "Nombre")`, `h(RowActions, { user: row.original })`).

```ts
const table = useVueTable({ get data() { return props.data; }, get columns() { return props.columns; }, getCoreRowModel: getCoreRowModel(), manualPagination: true, manualSorting: true });
```
Template: `Table > TableHeader > TableRow v-for hg in table.getHeaderGroups() > TableHead v-for h in hg.headers` con
`<FlexRender :render="h.column.columnDef.header" :props="h.getContext()" />`; cuerpo igual con `table.getRowModel().rows`
y `row.getVisibleCells()`; fila "Sin resultados" con `:colspan="columns.length"` cuando no hay filas.

Con Laravel, paginación/orden/filtros en servidor (`paginate()` + query string) y `router.get(..., { preserveState: true,
replace: true })` con `manualPagination`/`manualSorting`. Cliente solo para listados < 500 filas.

## 7. Componentes clave (Reka UI)

| Necesidad | Componente shadcn-vue | Nota |
|---|---|---|
| Modal / panel | `Dialog` (`DialogTitle` obligatorio), `Sheet`, `Drawer` (vaul-vue) en móvil | Foco, `Esc` y `aria` los aporta Reka |
| Combobox / autocompletar | `Combobox` (o `Command` + `Popover`) | `v-model` con objeto; `by="id"` |
| Menús, Tabs, Accordion | `DropdownMenu`, `NavigationMenu`, `Tabs`, `Accordion` | Teclado incluido; nunca `v-show` a mano |
| Layout de app, toasts | `Sidebar` + `Breadcrumb`; `Sonner` (`vue-sonner`) | `SidebarProvider` y un `<Toaster />` en el layout persistente |

## 8. Pitfalls

| Síntoma | Causa | Solución |
|---|---|---|
| Clases sin efecto | CSS no importado o Tailwind no ve `resources/js` | Importar `app.css` en `app.ts`; `@source "../js"` |
| `DialogContent requires DialogTitle` | Título omitido | `DialogTitle` (con `class="sr-only"` si no debe verse) |
| Flash de tema claro | Clase `dark` aplicada tras montar | Script inline en `app.blade.php` / `index.html` |
| Tabla no reacciona a props nuevas | `data` pasado por valor a `useVueTable` | Getters `get data() { return props.data }` |
