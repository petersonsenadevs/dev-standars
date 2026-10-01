# Tests de arquitectura: reglas de dependencia automatizadas

## Índice

- [Por qué tests y no solo revisión](#por-qué-tests-y-no-solo-revisión)
- [Qué reglas escribir](#qué-reglas-escribir)
- [PHP: Pest arch y deptrac](#php-pest-arch-y-deptrac)
- [TypeScript: dependency-cruiser y ArchUnitTS](#typescript-dependency-cruiser-y-archunitts)
- [Python: import-linter](#python-import-linter)
- [Reglas entre contextos](#reglas-entre-contextos)
- [Reglas de convención, no solo de dependencia](#reglas-de-convención-no-solo-de-dependencia)
- [Integración en CI](#integración-en-ci)
- [Excepciones controladas](#excepciones-controladas)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Los overviews de cada stack ([laravel](../stacks/laravel/overview.md) §10,
[typescript](../stacks/typescript/overview.md) §11, [python](../stacks/python/overview.md)
§10) muestran la configuración base. Aquí: qué reglas merecen existir, cómo expresarlas en
cada herramienta y cómo hacer que fallen el build.

## Por qué tests y no solo revisión

Una dependencia `Domain -> Illuminate` entra en un PR de 40 archivos y nadie la ve. Seis
meses después el dominio no se instancia sin contenedor y los tests unitarios tardan 20 s.
Las reglas de arquitectura son invariantes del sistema, igual que "no se emite sin líneas";
se protegen con código que falla, no con un documento.

Dos familias complementarias:

| Herramienta | Nivel | Ventaja |
|---|---|---|
| Test de arquitectura (Pest `arch()`, ArchUnitTS) | corre con la suite de tests | mismo flujo, mensajes de error en el runner, asertos de convención (`final`, sufijos) |
| Linter de dependencias (deptrac, dependency-cruiser, import-linter) | paso separado de CI | grafo completo, detecta ciclos, reporta uncovered, más rápido en repos grandes |

Usa las dos: el test para reglas de convención y feedback local; el linter como fuente de
verdad de capas. No dupliques la misma regla en ambos.

## Qué reglas escribir

Ordenadas por valor. Las tres primeras son obligatorias; el resto según tamaño.

1. **Domain no importa framework ni ORM** (`Illuminate\*`, `@prisma/client`, `next`, `sqlalchemy`, `fastapi`, `pydantic` fuera de VO).
2. **Domain no importa Application ni Infrastructure**; Application no importa Infrastructure.
3. **Un contexto no importa el interior de otro** (solo `Shared` o el `index`/API pública).
4. Infrastructure de un contexto no importa Infrastructure de otro (el cruce va por eventos o puertos).
5. `app/` (Laravel), `app/` (Next), `main.py` solo importan Application/Infrastructure, nunca Domain directamente salvo tipos de error.
6. Application no importa HTTP (`Request`, `Response`, `NextRequest`, `APIRouter`).
7. Sin ciclos entre módulos.
8. Convención: entidades `final`, VO `readonly`, handlers con sufijo `Handler`/`UseCase`, puertos como interfaces/Protocols.

## PHP: Pest arch y deptrac

Pest arch vive en `tests/Architecture/` y corre con la suite `Unit`.

```php
// tests/Architecture/LayersTest.php
arch('domain is framework-free')
    ->expect('Invoicing\Domain')
    ->not->toUse(['Illuminate', 'Laravel', 'Carbon', 'Inertia', 'Invoicing\Application', 'Invoicing\Infrastructure']);

arch('application does not touch infrastructure or http')
    ->expect('Invoicing\Application')
    ->not->toUse(['Invoicing\Infrastructure', 'Illuminate\Http', 'Illuminate\Database\Eloquent', 'Inertia']);

arch('domain models are final and have no eloquent')
    ->expect('Invoicing\Domain\Model')->toBeFinal()
    ->and('Invoicing\Domain\Model')->not->toExtend('Illuminate\Database\Eloquent\Model');

arch('value objects are immutable')
    ->expect('Invoicing\Domain\ValueObject')->toBeReadonly()->toBeFinal();

arch('repository ports are interfaces implemented only in infrastructure')
    ->expect('Invoicing\Domain\Repository')->toBeInterfaces()
    ->and('Invoicing\Infrastructure\Persistence')->toImplement('Invoicing\Domain\Repository\InvoiceRepository')->ignoring('Invoicing\Infrastructure\Persistence\Eloquent\InvoiceModel');

arch('handlers are invokable and final')
    ->expect('Invoicing\Application')->classes()->toHaveSuffix('Handler')->toBeFinal()->toBeInvokable()
    ->ignoring(['Invoicing\Application\Port', 'Invoicing\Application\Query']);

arch('no debug leftovers')->expect(['dd', 'dump', 'ray', 'var_dump'])->not->toBeUsed();

arch('eloquent models stay inside persistence')
    ->expect('Illuminate\Database\Eloquent\Model')->toOnlyBeUsedIn('Invoicing\Infrastructure\Persistence');
```

Pest arch analiza `use` y referencias por nombre completo; no ve facades llamadas por alias
sin `use` (raro con PSR-4) ni `app()->make('...')` con strings. Para eso está deptrac, cuyo
`ruleset` completo está en `templates/laravel/deptrac.yaml`. Añade:

```yaml
# deptrac.yaml (fragmento): capa por contexto + uncovered como error
  layers:
    - { name: Invoicing, collectors: [{ type: directory, value: 'src/Invoicing/.*' }] }
    - { name: Sales,     collectors: [{ type: directory, value: 'src/Sales/.*' }] }
    - { name: Shared,    collectors: [{ type: directory, value: 'src/Shared/.*' }] }
  ruleset:
    Invoicing: [Shared]
    Sales: [Shared]
    Shared: []
  skip_violations:
    Invoicing\Application\IssueInvoice\IssueInvoiceHandler:
      - Illuminate\Support\Facades\DB          # decisión documentada en laravel/overview §5
```

`vendor/bin/deptrac analyse --fail-on-uncovered --report-uncovered` obliga a clasificar
cada clase nueva en alguna capa: nada queda fuera del radar.

## TypeScript: dependency-cruiser y ArchUnitTS

`templates/typescript/.dependency-cruiser.cjs` cubre las cuatro reglas de capas. Reglas
adicionales que merecen la pena:

```js
// .dependency-cruiser.cjs (fragmento)
{ name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
{ name: 'application-no-http', severity: 'error',
  from: { path: '^src/modules/[^/]+/application' },
  to: { path: 'node_modules/(next|fastify|hono|express)' } },
{ name: 'no-use-server-outside-app', severity: 'error',
  from: { path: '^src/modules' }, to: { path: '^src/modules', dependencyTypesNot: ['local'] },
  comment: 'Server actions son artefactos de Next; viven en app/' },
{ name: 'infra-of-other-module', severity: 'error',
  from: { path: '^src/modules/([^/]+)/infrastructure' },
  to: { path: '^src/modules/(?!$1)[^/]+/infrastructure' } },
{ name: 'testing-helpers-only-in-tests', severity: 'error',
  from: { path: '^src/modules/[^/]+/(domain|application|infrastructure)/(?!.*\\.test\\.ts$)' },
  to: { path: '^src/modules/[^/]+/testing' } },
```

`options.tsPreCompilationDeps: true` para que los imports de tipos también cuenten (un
`import type { Prisma }` en dominio sigue siendo acoplamiento). `--output-type err-long` en
CI; `--output-type dot | dot -T svg` para revisar el grafo en un PR grande.

ArchUnitTS aporta asertos dentro de Vitest, útil para convenciones de nombre y clases:

```ts
// tests/architecture/layers.test.ts
import { projectFiles } from 'archunit';
it('domain depends on nothing outside domain/shared', async () => {
  await expect(projectFiles('tsconfig.json').inFolder('src/modules/*/domain/**')
    .shouldNot().dependOnFiles().matching(/(application|infrastructure|app|lib|node_modules)/)).toPassAsync();
});
```

Si ya tienes dependency-cruiser, ArchUnitTS solo añade valor para reglas de convención.
`eslint-plugin-boundaries` es la tercera opción; elige una para capas.

## Python: import-linter

`templates/python/.importlinter` tiene los contratos `layers` y `forbidden`. Completa con:

```ini
[importlinter:contract:contexts-independent]
name = Bounded contexts do not import each other
type = independence
modules = invoicing sales agents

[importlinter:contract:testing-helpers]
name = testing package is only imported from tests
type = forbidden
source_modules = invoicing.domain invoicing.application invoicing.infrastructure
forbidden_modules = invoicing.testing
```

Mismo patrón `forbidden` para "Application no importa `fastapi`/`starlette`" y "`shared`
no importa ningún contexto".

`lint-imports --debug` muestra la cadena de imports que rompe el contrato. import-linter
solo ve imports estáticos: complementa con un test que importa `invoicing.domain` en un
subproceso limpio y aserta que `sqlalchemy`/`fastapi`/`langgraph` no aparecen en
`sys.modules` (caza también `__init__.py` que arrastran el ORM).

## Reglas entre contextos

La comunicación legítima entre contextos es: eventos de dominio (integración), puertos
implementados por el otro contexto en infraestructura, o la API pública (`index.ts`,
`Invoicing\Api\`, `invoicing.public`). La regla debe permitir exactamente eso y prohibir
el resto:

| Origen | Puede importar | No puede |
|---|---|---|
| `Sales\Application` | `Invoicing\Api\*` (contratos, DTOs, eventos publicados) | `Invoicing\Domain\Model`, `Invoicing\Infrastructure` |
| `Sales\Infrastructure` | `Invoicing\Api\*` para implementar un puerto de Sales llamando a Invoicing | modelos Eloquent/Prisma de Invoicing |
| `Shared` | nada de contextos | cualquier contexto |

Expresa `Api` como carpeta o módulo explícito; si no existe, la regla "solo `index`" de
dependency-cruiser y la capa `Shared` de deptrac cumplen el mismo papel.

## Reglas de convención, no solo de dependencia

Baratas de escribir y evitan deriva:

- Entidades `final` sin `extends Model`; VO `readonly`; enums para estados.
- Nada de `DateTime`/`Carbon::now()`/`new Date()`/`datetime.now()` en Domain y Application: `Clock` inyectado. En Pest: `->not->toUse(['Carbon\Carbon', 'Illuminate\Support\Facades\Date'])`; en ESLint `no-restricted-syntax` sobre `NewExpression[callee.name='Date'][arguments.length=0]` limitado a `src/modules/*/(domain|application)`; en Python, `ruff` con `flake8-tidy-imports` `banned-api` para `datetime.datetime.now` en esos paquetes.
- Excepciones de dominio extienden `DomainException` (`toExtend`).
- Eventos de dominio son inmutables y tienen `name` estable (`toBeReadonly`, test unitario que valida el formato `context.event.vN`).

## Integración en CI

```yaml
# .github/workflows/architecture.yml (un job por stack presente en el repo)
name: architecture
on: [pull_request]
jobs:
  php:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '8.3' }
      - run: composer install --no-progress --prefer-dist
      - run: vendor/bin/deptrac analyse --fail-on-uncovered --report-uncovered --formatter=github-actions
      - run: vendor/bin/pest tests/Architecture --ci
  # ts: pnpm depcruise src --config .dependency-cruiser.cjs --output-type err-long
  # py: lint-imports && pytest tests/architecture -q
```

Job separado y rápido (< 1 min): falla antes que la suite de integración y el mensaje
señala la regla. En local, `pre-commit`/`husky` ejecuta solo el linter de dependencias
sobre los archivos cambiados (`depcruise --focus`, `deptrac` completo cuesta segundos).

## Excepciones controladas

Toda regla acaba con una excepción legítima (`DB::transaction` en Application, `Collection`
de Laravel, `AsyncLocalStorage` en infraestructura). Regístrala en el archivo de reglas
(`skip_violations`, `ignore_imports`, `->ignoring()`), con comentario y enlace a la
decisión, nunca con `// eslint-disable` disperso ni bajando `severity` a `warn`. Revisa la
lista de excepciones en cada trimestre; si crece, la regla o la arquitectura están mal.

## Errores frecuentes

- Reglas en `warn`: nadie las lee; el build tiene que fallar.
- Capas definidas por regex que no cubren `Shared`, `tests/` o `app/`: uncovered silencioso. Usa `--fail-on-uncovered`.
- Solo reglas de dependencia y ninguna de convención: el dominio sigue "puro" pero lleno de `new DateTime()`.
- Duplicar la misma regla en Pest arch y deptrac: mantenimiento doble, mensajes distintos.
- Regla entre contextos ausente: los módulos son carpetas, no límites. `import type` excluido en TS: acoplamiento invisible.
- Excepciones añadidas en el PR que rompe la regla "para arreglarlo luego".

## Checklist

- [ ] Domain: sin framework, ORM, HTTP, reloj real ni Application/Infrastructure.
- [ ] Application: sin Infrastructure ni HTTP; excepciones documentadas en el archivo de reglas.
- [ ] Contextos independientes salvo `Shared` y API pública; sin ciclos.
- [ ] Paquete `testing/`/`Builders` no importado desde producción.
- [ ] Reglas de convención: `final`, `readonly`, sufijos, excepciones que extienden `DomainException`.
- [ ] Linter con `fail-on-uncovered`/equivalente y `severity: error`.
- [ ] Job de CI propio, < 1 min, ejecutado en cada PR.
- [ ] Lista de excepciones con motivo y fecha; revisada periódicamente.
- [ ] Cada módulo nuevo añade su capa/contrato el mismo día que se crea.
