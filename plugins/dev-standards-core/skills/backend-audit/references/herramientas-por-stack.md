# Herramientas de auditoría por stack

Índice: Transversal · Laravel / PHP · WordPress · Node (Express, NestJS) y Next (servidor) ·
Python (FastAPI, LangGraph) · Go · Java / Spring · C# / .NET

Regla: usa primero lo que el proyecto YA tiene configurado. Lo que falte se propone al usuario
(son dependencias de desarrollo nuevas) y, si no se instala, se anota como límite de la auditoría.
Guarda la salida relevante: es la evidencia.

## Transversal

| Qué | Comando | Detecta |
|---|---|---|
| Hotspots | `node <skills>/backend-audit/scripts/hotspots.mjs --months 6` | Archivos que cambian mucho y son grandes: donde se concentra el riesgo |
| Patrones inseguros (multi-lenguaje) | `semgrep scan --config p/default` | Inyección, deserialización, secretos, crypto débil… con archivo:línea |
| Secretos en el historial | `gitleaks detect` | Claves que se commitearon alguna vez (aunque ya no estén) |

## Laravel / PHP

| Qué | Comando | Detecta |
|---|---|---|
| Tests y cobertura | `php artisan test --coverage` (necesita PCOV o Xdebug) | Qué partes críticas no tienen tests |
| Análisis estático | `vendor/bin/phpstan analyse app --level=5` con Larastan (sube de nivel hasta que aparezca ruido; máximo 10) | Tipos incorrectos, métodos inexistentes, código muerto, nulos sin controlar |
| N+1 y lazy loading | `Model::preventLazyLoading(! app()->isProduction());` en `AppServiceProvider` y recorrer los flujos críticos | **Excepción en cada N+1**: evidencia exacta con modelo y relación |
| Consultas lentas | `DB::listen()` en local, Telescope o Debugbar | Nº de consultas y tiempos por petición |
| Dependencias | `composer audit` · `composer outdated --direct` | Vulnerabilidades conocidas y paquetes muy atrasados |
| Arquitectura | Tests de arquitectura de Pest (`arch()->expect('App\Models')->toOnlyBeUsedIn(...)`) o Deptrac (`vendor/bin/deptrac analyse`) | Capas que se saltan las reglas (ver `reglas-arquitectura.md`) |
| Patrones antiguos | `vendor/bin/rector process --dry-run` | Código que la versión actual de PHP o Laravel permite modernizar |
| Complejidad | `vendor/bin/phpmetrics --report-html=storage/phpmetrics app` | Clases enormes, métodos con complejidad alta, acoplamiento |

## WordPress

| Qué | Comando | Detecta |
|---|---|---|
| Integridad del core | `wp core verify-checksums` · `wp plugin verify-checksums --all` | Archivos del core o de plugins modificados (hackeos, parches a mano) |
| Actualizaciones | `wp core check-update` · `wp plugin list --update=available` | Core y plugins atrasados (la causa nº 1 de hackeos) |
| Seguridad del código propio | `vendor/bin/phpcs --standard=WordPress-Extra --sniffs=WordPress.Security.EscapeOutput,WordPress.Security.NonceVerification,WordPress.DB.PreparedSQL <theme-o-plugin>` | Salida sin escapar, formularios sin nonce, SQL sin `prepare` |
| Rendimiento | Plugin Query Monitor en local | Consultas por página, hooks lentos, consultas duplicadas |

## Node (Express, NestJS) y Next (servidor)

| Qué | Comando | Detecta |
|---|---|---|
| Tipos | `npx tsc --noEmit` | Errores de tipos (y cuántos `any` esconden problemas) |
| Lint | `npx eslint .` (con reglas `complexity` y promesas sin `await`) | Promesas flotantes, complejidad, patrones peligrosos |
| Código muerto | `npx knip` | Archivos, exports y dependencias que no usa nadie |
| Dependencias | `npm audit --omit=dev` · `npm outdated` | Vulnerabilidades y paquetes muy atrasados |
| Dependencias circulares | `npx madge --circular --extensions ts,tsx src` | Ciclos entre módulos |
| Arquitectura | `npx depcruise src --config .dependency-cruiser.cjs` | Capas que se saltan las reglas (ver `reglas-arquitectura.md`) |
| Tests y cobertura | `npx vitest run --coverage` o `npx jest --coverage` | Qué partes críticas no tienen tests |
| N+1 y consultas | Prisma `log: ['query']` o el logging del ORM en local | Consultas repetidas dentro de bucles |
| Next: server actions | Revisión dirigida de cada `'use server'` | Acciones sin comprobar autenticación ni validar la entrada |

## Python (FastAPI, LangGraph)

| Qué | Comando | Detecta |
|---|---|---|
| Lint | `ruff check .` | Errores, imports rotos, patrones peligrosos |
| Tipos | `mypy --strict src` o `pyright` | Errores de tipos |
| Seguridad | `bandit -r src` · `pip-audit` | Patrones inseguros y dependencias vulnerables |
| Complejidad | `radon cc -s -a src` | Funciones con complejidad alta |
| Código muerto | `vulture src` | Funciones y variables sin usar |
| Arquitectura | `lint-imports` (import-linter, contratos en `.importlinter`) | Capas que importan lo que no deben |
| Tests y cobertura | `pytest --cov=src --cov-report=term-missing` | Líneas críticas sin cubrir |
| N+1 | SQLAlchemy con `echo=True` en local | Consultas repetidas en bucles |

## Go
`go vet ./...` · `staticcheck ./...` · `govulncheck ./...` (vulnerabilidades que el código realmente
alcanza) · `go test -race -cover ./...` (carreras de datos y cobertura) · `gocyclo -over 15 .`

## Java / Spring
`mvn verify` con SpotBugs y PMD · OWASP Dependency-Check (`mvn org.owasp:dependency-check-maven:check`) ·
JaCoCo para cobertura · **ArchUnit** para reglas de arquitectura como tests.

## C# / .NET
`dotnet build -warnaserror` con los analizadores activados · `dotnet list package --vulnerable
--include-transitive` · `dotnet test --collect:"XPlat Code Coverage"` · **NetArchTest** para reglas de
arquitectura como tests.
