/**
 * .dependency-cruiser.cjs — reglas de dependencia para módulos hexagonales.
 * Instalar: npm i -D dependency-cruiser
 * Ejecutar: npx depcruise src --config .dependency-cruiser.cjs   (añadir a CI y a `lint`)
 * Grafo:    npx depcruise src --config .dependency-cruiser.cjs --output-type dot | dot -T svg > deps.svg
 *
 * Convención: src/modules/<ctx>/{domain,application,infrastructure,index.ts}; src/app es Next.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ---- Dominio: puro ----------------------------------------------------------------
    {
      name: 'domain-no-framework',
      comment: 'domain/ no importa framework, ORM ni validación de transporte',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: '^(src/(app|lib)|node_modules/(next|react|@prisma|prisma|drizzle-orm|zod|axios))' },
    },
    {
      name: 'domain-only-domain',
      comment: 'domain/ solo depende de domain/ (propio o shared)',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: '^src/modules/[^/]+/(application|infrastructure)' },
    },

    // ---- Aplicación: dominio + puertos, nada de infraestructura ----------------------
    {
      name: 'application-no-infrastructure',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application' },
      to: { path: '^(src/modules/[^/]+/infrastructure|src/(app|lib)|node_modules/(next|react|@prisma|prisma|drizzle-orm))' },
    },

    // ---- Entre módulos: solo por index.ts ---------------------------------------------
    {
      name: 'modules-only-via-public-api',
      comment: 'otro módulo solo se importa desde su index.ts (API pública)',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/(?!$1/)(?!shared/)[^/]+/(?!index\\.ts$).+', pathNot: '^src/modules/[^/]+/testing/' },
    },
    {
      name: 'shared-does-not-know-modules',
      severity: 'error',
      from: { path: '^src/modules/shared' },
      to: { path: '^src/modules/(?!shared/)' },
    },

    // ---- App (adaptadores driving Next): no toca internals ----------------------------
    {
      name: 'app-uses-module-index-only',
      severity: 'error',
      from: { path: '^src/app' },
      to: { path: '^src/modules/[^/]+/(domain|application|infrastructure)/' },
    },

    // ---- Higiene general -------------------------------------------------------------------
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'no-test-code-in-prod',
      severity: 'error',
      from: { path: '^src', pathNot: '\\.(test|spec)\\.ts$|/testing/' },
      to: { path: '\\.(test|spec)\\.ts$|/testing/|node_modules/vitest' },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    reporterOptions: { dot: { collapsePattern: 'node_modules/[^/]+' } },
  },
};

// ---- Alternativa integrada en ESLint (eslint-plugin-boundaries) ---------------------------
// settings: { 'boundaries/elements': [
//   { type: 'domain', pattern: 'src/modules/*/domain/**' },
//   { type: 'application', pattern: 'src/modules/*/application/**' },
//   { type: 'infrastructure', pattern: 'src/modules/*/infrastructure/**' },
//   { type: 'app', pattern: 'src/app/**' } ] },
// rules: { 'boundaries/element-types': ['error', { default: 'disallow', rules: [
//   { from: 'domain', allow: ['domain'] },
//   { from: 'application', allow: ['domain', 'application'] },
//   { from: 'infrastructure', allow: ['domain', 'application', 'infrastructure'] },
//   { from: 'app', allow: ['application', 'infrastructure'] } ] }] }
