# Reglas de dependencia: herramientas y CI

## Índice

- [Qué reglas verificar](#qué-reglas-verificar)
- [PHP: deptrac](#php-deptrac)
- [PHP: tests de arquitectura con Pest](#php-tests-de-arquitectura-con-pest)
- [TypeScript: dependency-cruiser](#typescript-dependency-cruiser)
- [TypeScript: eslint-plugin-boundaries y ArchUnitTS](#typescript-eslint-plugin-boundaries-y-archunitts)
- [Python: import-linter](#python-import-linter)
- [Ejecución en CI y pre-commit](#ejecución-en-ci-y-pre-commit)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../tactical/overview-concepts.md` §15, `folder-structures.md`,
`../stacks/laravel/overview.md` §10.

## Qué reglas verificar

Las mismas en los tres stacks, expresadas como "capa X solo puede importar Y":

| Regla | Detalle |
|---|---|
| Domain -> nada | solo stdlib y `Shared/Domain` |
| Application -> Domain | + `Shared/Application`; tolerancias explícitas (`DB::transaction`, `Psr\Log`) |
| Infrastructure -> Domain, Application, framework, SDKs | |
| Adaptadores driving (`app/`, `app/` Next, `api/`) -> Application (fachada) | nunca `Domain/Model` ni implementaciones concretas de Infrastructure |
| Contexto A -> Contexto B | prohibido salvo `Shared` y contratos públicos (`index.ts`, eventos de integración) |
| Nadie -> contenedor/service locator desde Domain/Application | `app()`, `container`, `Depends` |

Complementos: sufijos y visibilidad (entidades `final`, VO `readonly`), y "nadie fuera de
`Persistence` usa modelos ORM".

## PHP: deptrac

Configuración base en `../stacks/laravel/overview.md` §10. Versión completa con contextos:

```yaml
# deptrac.yaml
deptrac:
  paths: [./src, ./app]
  exclude_files: ['#.*Test\.php#']
  layers:
    - { name: Domain,          collectors: [{ type: directory, value: 'src/[^/]+/Domain/.*' }] }
    - { name: Application,     collectors: [{ type: directory, value: 'src/[^/]+/Application/.*' }] }
    - { name: Infrastructure,  collectors: [{ type: directory, value: 'src/[^/]+/Infrastructure/.*' }] }
    - { name: App,             collectors: [{ type: directory, value: 'app/.*' }] }
    - { name: Laravel,         collectors: [{ type: classNameRegex, value: '/^(Illuminate|Inertia|Laravel|Carbon)\\\\/' }] }
    - { name: Vendor,          collectors: [{ type: classNameRegex, value: '/^(Stripe|Aws|Symfony|GuzzleHttp)\\\\/' }] }
    - { name: Invoicing,       collectors: [{ type: directory, value: 'src/Invoicing/.*' }] }
    - { name: Sales,           collectors: [{ type: directory, value: 'src/Sales/.*' }] }
    - { name: Shared,          collectors: [{ type: directory, value: 'src/Shared/.*' }] }
  ruleset:
    Domain: []
    Application: [Domain]
    Infrastructure: [Domain, Application, Laravel, Vendor]
    App: [Application, Infrastructure, Laravel]      # App solo debería tocar handlers/DTOs; afinar con classNameRegex si hace falta
    Invoicing: [Shared]
    Sales: [Shared]
    Shared: []
  skip_violations:
    Invoicing\Application\IssueInvoice\IssueInvoiceHandler:
      - Illuminate\Support\Facades\DB
```

Notas: una clase pertenece a varias capas (p. ej. `Domain` e `Invoicing`); deptrac
evalúa todas las reglas. Para tolerar `DB::transaction` en todos los handlers sin listar
uno a uno, crea una capa `LaravelDb` con `classNameRegex: /^Illuminate\\Support\\Facades\\DB$/`
y añádela a `Application`. Ejecutar: `vendor/bin/deptrac analyse --fail-on-uncovered
--report-uncovered`. Baseline para adopción gradual: `--baseline` genera y luego
`deptrac.baseline.yaml`.

## PHP: tests de arquitectura con Pest

Complementan deptrac con reglas de forma:

```php
// tests/Architecture/DomainTest.php
arch('domain is pure')
    ->expect('Invoicing\Domain')
    ->not->toUse(['Illuminate', 'Carbon', 'Inertia', 'App\Models']);

arch('entities are final and value objects readonly')
    ->expect('Invoicing\Domain\Model')->toBeFinal()
    ->and('Invoicing\Domain\ValueObject')->toBeReadonly();

arch('handlers are invokable')
    ->expect('Invoicing\Application')
    ->classes()->toHaveSuffix('Handler')->toHaveMethod('__invoke')
    ->ignoring(['Invoicing\Application\Query', 'Invoicing\Application\Port']);

arch('no eloquent outside persistence')
    ->expect('Illuminate\Database\Eloquent')
    ->toOnlyBeUsedIn(['Invoicing\Infrastructure\Persistence', 'App\Models']);

arch('no debug')->expect(['dd', 'dump', 'ray', 'var_dump'])->not->toBeUsed();
```

Pest arch es rápido y se ejecuta con la suite `Unit`. Elige deptrac para grafo de capas,
Pest arch para convenciones de clase; los dos juntos cubren casi todo.

## TypeScript: dependency-cruiser

```js
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    { name: 'domain-is-pure', severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: '^src/modules/[^/]+/(application|infrastructure)|^node_modules/(?!(zod|uuid)$)' } },
    { name: 'application-not-infra', severity: 'error',
      from: { path: '^src/modules/[^/]+/application' },
      to: { path: '^src/modules/[^/]+/infrastructure|^node_modules/(@prisma|next|bullmq)' } },
    { name: 'no-cross-module-internals', severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/(?!$1|shared)[^/]+/(domain|application|infrastructure)/' } },
    { name: 'app-uses-module-facade-only', severity: 'error',
      from: { path: '^app/' },
      to: { path: '^src/modules/[^/]+/(domain|infrastructure)/' } },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' }, tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' }, exclude: { path: '\\.test\\.ts$' },
  },
};
```

Ejecutar: `npx depcruise src app --config .dependency-cruiser.cjs`. Grafo visual:
`--output-type dot | dot -T svg > deps.svg`. Con `paths` de tsconfig, `tsConfig` es
imprescindible para resolver `@/`.

## TypeScript: eslint-plugin-boundaries y ArchUnitTS

`eslint-plugin-boundaries` da feedback en el editor:

```js
// eslint.config.js (flat)
import boundaries from 'eslint-plugin-boundaries';
export default [{
  plugins: { boundaries },
  settings: { 'boundaries/elements': [
    { type: 'domain', pattern: 'src/modules/*/domain/**', capture: ['module'] },
    { type: 'application', pattern: 'src/modules/*/application/**', capture: ['module'] },
    { type: 'infrastructure', pattern: 'src/modules/*/infrastructure/**', capture: ['module'] },
    { type: 'facade', pattern: 'src/modules/*/index.ts', capture: ['module'] },
    { type: 'app', pattern: 'app/**' },
  ] },
  rules: { 'boundaries/element-types': ['error', { default: 'disallow', rules: [
    { from: 'domain', allow: [['domain', { module: '${from.module}' }]] },
    { from: 'application', allow: [['domain', { module: '${from.module}' }], ['application', { module: '${from.module}' }]] },
    { from: 'infrastructure', allow: ['domain', 'application', 'infrastructure'] },
    { from: 'app', allow: ['facade'] },
  ] }] },
}];
```

ArchUnitTS (`archunit`) permite escribir las reglas como tests de Vitest/Jest
(`projectFiles().inFolder('domain').shouldNot().dependOnFiles().inFolder('infrastructure')`);
útil si el equipo prefiere reglas junto a los tests. Elige uno de los tres como fuente de
verdad en CI (dependency-cruiser suele ser el más completo) y el plugin de ESLint como
ayuda en el editor.

## Python: import-linter

```toml
# pyproject.toml
[tool.importlinter]
root_packages = ["invoicing", "sales", "shared", "api", "worker"]

[[tool.importlinter.contracts]]
name = "Invoicing layers"
type = "layers"
layers = ["invoicing.infrastructure", "invoicing.application", "invoicing.domain"]

[[tool.importlinter.contracts]]
name = "Domain is framework-free"
type = "forbidden"
source_modules = ["invoicing.domain", "invoicing.application", "sales.domain", "sales.application"]
forbidden_modules = ["fastapi", "sqlalchemy", "pydantic", "starlette", "httpx", "celery", "arq"]

[[tool.importlinter.contracts]]
name = "Contexts are independent"
type = "independence"
modules = ["invoicing", "sales"]

[[tool.importlinter.contracts]]
name = "API only uses public modules"
type = "forbidden"
source_modules = ["api", "worker"]
forbidden_modules = ["invoicing.domain", "invoicing.infrastructure.persistence.models"]
```

Ejecutar: `lint-imports`. El contrato `layers` prohíbe que una capa inferior importe una
superior (orden de la lista: más alta primero). `pydantic` en la lista prohibida obliga a
usar dataclasses en Application; si decides permitir pydantic como DTO, quítalo y
documenta.

## Ejecución en CI y pre-commit

| Momento | PHP | TS | Python |
|---|---|---|---|
| pre-commit (rápido) | `pest --testsuite=Unit` (incluye arch) | `eslint` con boundaries | `lint-imports` |
| CI (obligatorio) | `deptrac analyse --fail-on-uncovered` + Pest arch | `depcruise` + `tsc --noEmit` | `lint-imports` + `mypy --strict` |
| Adopción gradual | baseline de deptrac | `severity: 'warn'` por regla y subir a `error` por módulo | `ignore_imports` por contrato |

```yaml
# .github/workflows/arch.yml (fragmento)
- run: vendor/bin/deptrac analyse --fail-on-uncovered --formatter=github-actions
- run: npx depcruise src app --config .dependency-cruiser.cjs --output-type err-long
- run: lint-imports
```

Las violaciones fallan el pipeline; no son warnings. Cada excepción (`skip_violations`,
`ignore_imports`) lleva comentario con el motivo y, si es temporal, un ticket.

## Errores frecuentes

- Configurar la herramienta y no ponerla en CI: se degrada en un mes.
- Reglas solo por carpeta sin cubrir `node_modules`/`vendor`: el dominio importa `@prisma/client`
  y pasa.
- Olvidar `tsConfig` en dependency-cruiser: los imports `@/` no se resuelven y las reglas
  no ven nada.
- `skip_violations` que crece sin control; revisar en cada retro.
- Contextos sin regla de independencia: a los seis meses `Sales` importa `Invoicing\Domain`.
- Tests unitarios excluidos de las reglas que importan Infrastructure para "montar
  rápido": el test de aplicación debe usar fakes, no Eloquent.
- Depender de la revisión de código humana para las reglas de capas.

## Checklist

- [ ] Herramienta de capas configurada: deptrac / dependency-cruiser / import-linter.
- [ ] Reglas: Domain puro, Application sin infra, adaptadores solo fachada, contextos independientes.
- [ ] Framework y SDKs incluidos en las reglas, no solo carpetas propias.
- [ ] Reglas de forma (final, readonly, sufijos) con Pest arch / ArchUnitTS.
- [ ] Feedback en editor (ESLint boundaries) y bloqueo en CI.
- [ ] Excepciones justificadas con comentario y revisadas periódicamente.
- [ ] Baseline o severidad progresiva para proyectos en migración.
