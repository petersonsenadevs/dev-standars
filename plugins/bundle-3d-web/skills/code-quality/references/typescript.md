# TypeScript 5.x: buenas prácticas

## Índice

- [tsconfig recomendado](#tsconfig-recomendado)
- [Modo strict y reglas base](#modo-strict-y-reglas-base)
- [type vs interface](#type-vs-interface)
- [Discriminated unions y exhaustividad](#discriminated-unions-y-exhaustividad)
- [unknown, never y narrowing](#unknown-never-y-narrowing)
- [Validación en los bordes con zod](#validación-en-los-bordes-con-zod)
- [Utilidades de tipos](#utilidades-de-tipos)
- [Errores tipados: Result](#errores-tipados-result)
- [Inmutabilidad](#inmutabilidad)
- [Async correcto](#async-correcto)
- [Módulos, barrels y ciclos](#módulos-barrels-y-ciclos)
- [ESLint y Prettier](#eslint-y-prettier)
- [Antipatrones frecuentes](#antipatrones-frecuentes)

## tsconfig recomendado

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",              // o "NodeNext" en librerías/Node puro
    "moduleResolution": "Bundler",   // "NodeNext" en Node puro
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,    // fuerza `import type`
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- `noUncheckedIndexedAccess` es la opción que más bugs evita (`arr[0]` pasa a ser `T | undefined`). Actívala desde el día uno; en proyectos legados, por carpetas con `tsconfig` anidados.
- El framework (Next, Vite, Astro) genera su base; extiéndela, no la sustituyas.

## Modo strict y reglas base

- `strict: true` no es negociable. Sin `// @ts-ignore`; si es inevitable, `// @ts-expect-error` con comentario del motivo (falla si deja de ser necesario).
- Prohibido `any` explícito e implícito. Sustituye por `unknown` + narrowing, genéricos o tipos concretos.
- Sin aserciones `as T` para "convencer" al compilador. Excepciones aceptables: `as const`, `satisfies`, y `as` tras una validación en runtime en la misma función.
- Sin non-null assertion (`!`) salvo en tests o justo tras una comprobación que el compilador no puede ver (documenta por qué).
- Retornos explícitos en funciones exportadas: sirven de contrato y aceleran el checker.
- `satisfies` para validar forma sin perder literalidad:

```ts
const routes = {
  home: "/",
  user: "/users/:id",
} satisfies Record<string, `/${string}`>;
// routes.home sigue siendo "/" (literal), no string
```

## type vs interface

- `interface` para formas de objeto públicas y extensibles (props de componentes, contratos de API, cosas que otros pueden `extends`). Mejores mensajes de error y rendimiento del checker.
- `type` para uniones, tuplas, tipos mapeados/condicionales, alias de primitivos y funciones.
- No mezcles ambos para lo mismo dentro de un módulo. Nunca uses declaration merging accidental (`interface` global duplicada).
- Modela la nomenclatura sin prefijos húngaros (`User`, no `IUser`).

## Discriminated unions y exhaustividad

- Modela estados con un campo discriminante literal, no con booleanos combinables (`isLoading && hasError` es un estado imposible).

```ts
type Fetch<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: AppError };

function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

function render(s: Fetch<User>) {
  switch (s.status) {
    case "idle": return null;
    case "loading": return "...";
    case "success": return s.data.name;
    case "error": return s.error.message;
    default: return assertNever(s); // compila solo si cubres todo
  }
}
```

- `assertNever` en el `default` de cada `switch` sobre uniones: al añadir un caso, el compilador señala cada sitio que falta.
- Enums: prefiere uniones de literales (`type Role = "admin" | "editor"`) o `as const` sobre `enum` (evita el runtime extra y los `enum` numéricos inseguros).

## unknown, never y narrowing

- Todo lo que entra desde fuera (JSON, `catch`, `localStorage`, `postMessage`, respuestas HTTP) es `unknown` hasta que lo validas.
- `catch (e)` es `unknown`: no accedas a `e.message` sin comprobar `e instanceof Error`.
- Type guards (`function isUser(x: unknown): x is User`) solo si están respaldados por una comprobación real (mejor: zod `safeParse`). Un guard que miente es peor que un `any`.
- Usa `in`, `typeof`, `instanceof`, discriminantes y `Array.isArray` para narrowing; el compilador los entiende sin aserciones.
- Tipa el retorno de funciones que nunca terminan (`throw`, bucle infinito) como `never`.

## Validación en los bordes con zod

- Un schema por frontera: request bodies, respuestas de APIs externas, variables de entorno, params de URL, formularios. Dentro del sistema, confía en los tipos.
- Deriva el tipo del schema, no al revés: `type User = z.infer<typeof UserSchema>`. Una única fuente de verdad.
- Usa `safeParse` en runtime y trata el error como un caso esperado (400/422), no como excepción.
- `z.object({...}).strict()` en entradas de API cuando campos extra son sospechosos; `.passthrough()` nunca por defecto.
- Env: valida en el arranque con un schema y exporta un objeto tipado; falla rápido si falta una variable.

```ts
const Env = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]),
});
export const env = Env.parse(process.env); // lanza al arrancar, no en la request 500
```

## Utilidades de tipos

- Built-ins que debes dominar: `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Readonly`, `ReturnType`, `Parameters`, `Awaited`, `NonNullable`, `Extract`, `Exclude`.
- Branded types para IDs y unidades: evita pasar un `OrderId` donde va un `UserId`.

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type UserId = Brand<string, "UserId">;
const asUserId = (s: string): UserId => s as UserId; // único punto de "as"
```

- Template literal types para rutas, claves de eventos y CSS (`type EventName = \`on${Capitalize<string>}\``).
- Genéricos con restricciones (`<T extends { id: string }>`) y valores por defecto; evita genéricos que solo aparecen una vez (no aportan nada).
- `Omit` sobre uniones las colapsa: usa un `DistributiveOmit` si necesitas preservar la unión.
- No crees tipos condicionales "ingeniosos" en código de aplicación; si no cabe en 5 líneas, seguramente falta un tipo intermedio con nombre.

## Errores tipados: Result

- Excepciones para fallos inesperados (bug, infraestructura). `Result` para fallos esperados del dominio que el llamador debe manejar (validación, "no encontrado", "sin saldo").

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

type ChargeError =
  | { code: "INSUFFICIENT_FUNDS"; missing: number }
  | { code: "CARD_DECLINED"; reason: string };

async function charge(a: Money): Promise<Result<Receipt, ChargeError>> { /* ... */ }

const r = await charge(amount);
if (!r.ok) {
  switch (r.error.code) { /* exhaustivo */ }
}
```

- No mezcles: una función devuelve `Result` **o** lanza, no ambas para el mismo tipo de fallo.
- Errores como uniones discriminadas con `code`, no `class extends Error` genéricas sin datos. Si necesitas stack trace, extiende `Error` y añade `code` y `cause`.
- Librerías: `neverthrow` o `effect` si el equipo las adopta; no reinventes monadas complejas.

## Inmutabilidad

- `readonly` en propiedades y `ReadonlyArray<T>` / `readonly T[]` en parámetros que no mutas. Anuncia intención y evita bugs de aliasing.
- `as const` en configuraciones y tablas de lookup.
- Actualiza con spread, `toSorted()`, `toSpliced()`, `with()` (ES2023) o `structuredClone`; nunca `sort()` / `splice()` sobre datos compartidos.
- Estado (React/Vue/Pinia): trata todo como inmutable; muta solo dentro de las APIs que lo permiten (Immer, `reactive`).

## Async correcto

- Toda promesa se `await`ea, se devuelve o se maneja explícitamente. ESLint `@typescript-eslint/no-floating-promises` y `no-misused-promises` activadas.
- Paralelismo consciente: `Promise.all` para independientes que deben tener éxito todas; `Promise.allSettled` cuando quieres resultados parciales. No `await` dentro de `forEach` (no espera): usa `for...of` o `Promise.all(items.map(...))`.
- Cancelación con `AbortController`: pásalo a `fetch`, timers y trabajos largos; abórtalo en cleanup de efectos y en navegación.

```ts
async function search(q: string, signal: AbortSignal): Promise<Result[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  return SearchResults.parse(await res.json());
}
```

- Timeouts con `AbortSignal.timeout(ms)` o `AbortSignal.any([...])`.
- `fetch` no lanza por 4xx/5xx: comprueba `res.ok`.
- No uses `async` en funciones que no `await`ean nada; no envuelvas promesas en `new Promise` (antipatrón del constructor).
- Reintentos solo para errores transitorios y con backoff; nunca reintentes operaciones no idempotentes.

## Módulos, barrels y ciclos

- ESM siempre; `import type` para tipos (`verbatimModuleSyntax` lo fuerza).
- Barrels (`index.ts`) solo en la frontera pública de un módulo/paquete, nunca dentro para importar entre hermanos: crean ciclos, rompen tree-shaking y disparan tiempos de arranque.
- Regla de dependencias por capas: `ui → application → domain`; el dominio no importa de infraestructura. Comprueba con `eslint-plugin-boundaries` o `dependency-cruiser`.
- Detecta ciclos en CI: `madge --circular src` o `dependency-cruiser`.
- Un módulo exporta lo mínimo. Prefiere exports con nombre a `default` (refactors y autoimport más fiables).
- Side effects de módulo (ejecutar código al importar) prohibidos salvo registro explícito en un `bootstrap`.

## ESLint y Prettier

- ESLint flat config (`eslint.config.js`) con `typescript-eslint` en modo `strictTypeChecked` + `stylisticTypeChecked`. Requiere `parserOptions.projectService: true`.
- Reglas clave: `no-explicit-any`, `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`, `consistent-type-imports`, `no-unnecessary-condition`, `prefer-nullish-coalescing`, `prefer-optional-chain`.
- Prettier (o Biome como alternativa integrada) gobierna el formato; ESLint no discute estilo. `eslint-config-prettier` para desactivar conflictos.
- Ejecuta `tsc --noEmit` en CI aparte del bundler: Vite/Next/esbuild **no** comprueban tipos.
- `lint-staged` + hook de pre-commit para formato y lint solo de archivos cambiados.

## Antipatrones frecuentes

- Objetos "bolsa" con todos los campos opcionales: modela estados con uniones.
- `Record<string, any>` como tipo de retorno de servicios.
- `JSON.parse(x) as T` sin validar.
- Funciones con parámetros booleanos posicionales (`save(user, true, false)`): usa objeto de opciones.
- `let` cuando `const` basta; variables reasignadas dentro de closures asíncronos.
- Optional chaining como tirita (`a?.b?.c?.d`) sobre datos que deberían estar garantizados: arregla el tipo, no el acceso.
- Exportar tipos que exponen detalles de implementación (ORM entities) fuera de la capa de datos.
