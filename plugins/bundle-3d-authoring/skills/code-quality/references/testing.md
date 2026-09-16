# Testing: estrategia y práctica

## Índice

- [Pirámide y trofeo: qué mezcla usar](#pirámide-y-trofeo-qué-mezcla-usar)
- [Qué testear y qué no](#qué-testear-y-qué-no)
- [Naming y estructura AAA](#naming-y-estructura-aaa)
- [Fixtures, factories y datos de prueba](#fixtures-factories-y-datos-de-prueba)
- [Mocks, stubs y fakes](#mocks-stubs-y-fakes)
- [Tests de contrato](#tests-de-contrato)
- [Integración con BD real](#integración-con-bd-real)
- [E2E acotados](#e2e-acotados)
- [Cobertura útil](#cobertura-útil)
- [Flaky tests](#flaky-tests)
- [TDD pragmático](#tdd-pragmático)
- [Comandos por stack](#comandos-por-stack)
- [Checklist de revisión de tests](#checklist-de-revisión-de-tests)

## Pirámide y trofeo: qué mezcla usar

- **Backend (Laravel, FastAPI)**: pirámide clásica. Muchos unit tests de dominio/Actions, bastantes tests de integración (endpoint + BD real), pocos E2E.
- **Frontend (React, Vue, Astro)**: trofeo. Pocos unit puros (utils, hooks), muchos tests de componente/integración con Testing Library + MSW, un puñado de E2E con Playwright.
- **Agentes LLM**: unit de nodos puros con modelo fake, integración del grafo con fake, evaluaciones con modelo real fuera del pipeline de PR (nocturno, con dataset y métricas).
- Regla de coste: un test debe ser tan rápido y bajo como sea posible sin perder confianza. Sube de nivel solo cuando el nivel inferior no puede detectar el fallo.
- Objetivo de tiempo: suite unitaria < 1 min, integración < 5 min, E2E < 15 min en CI.

## Qué testear y qué no

Testea:
- Reglas de negocio e invariantes (cálculos, transiciones de estado, permisos).
- Fronteras: validación de entrada, mapeo a códigos HTTP, serialización de respuestas.
- Casos límite: vacío, uno, muchos, máximo, nulo, unicode, zona horaria, concurrencia cuando aplica.
- Bugs corregidos: cada bug reproducido primero con un test que falla.
- Comportamiento observable por el usuario (lo que ve, lo que se envía).

No testees:
- Frameworks, ORMs y librerías de terceros (que Eloquent guarde, que zod valide un email).
- Getters/setters triviales, constructores, configuración estática.
- Detalles de implementación (que se llame a un método interno con ciertos args) si no forman parte del contrato.
- Estilos visuales con snapshots masivos: se aprueban sin mirar. Usa snapshots pequeños y con intención, o visual regression en E2E.

## Naming y estructura AAA

- Nombre = comportamiento esperado + condición: `it('rejects the order when stock is insufficient')`, `test_returns_404_when_order_belongs_to_another_user`. Alguien que lee solo la lista de nombres debe entender el contrato.
- Sin nombres como `test1`, `testCreate`, `works`.
- Estructura Arrange / Act / Assert separada por línea en blanco; un `Act` por test. Varias aserciones están bien si verifican el mismo comportamiento.
- Un test, una razón para fallar. Si tienes que poner `if` dentro de un test, son dos tests.
- Valores explícitos y significativos en el arrange (`price: 1999` no `price: 1`); evita constantes mágicas repartidas: nómbralas.
- Agrupa con `describe`/clases por unidad o escenario; no anides más de 2 niveles.

```ts
it("applies free shipping when subtotal exceeds the threshold", () => {
  const cart = buildCart({ items: [item({ price: 6000 })] });

  const total = calculateTotal(cart, { freeShippingFrom: 5000 });

  expect(total.shipping).toBe(0);
});
```

## Fixtures, factories y datos de prueba

- Factories (Laravel factories, `factory_boy`/funciones en Python, funciones `buildX()` en TS) con valores válidos por defecto y overrides solo de lo relevante para el test.
- Estados con nombre en factories (`->paid()`, `paid_order()`) para expresar intención.
- Fixtures pequeñas y locales; las globales solo para infraestructura (BD, cliente HTTP). Una fixture que cinco tests necesitan con variaciones distintas es una factory.
- Sin ficheros de fixtures JSON gigantes compartidos: acoplan tests entre sí y nadie sabe qué campo importa.
- Datos determinísticos: semilla fija para Faker; sin `now()` sin control (usa relojes inyectables o freezegun/`Date` mockeado/`Carbon::setTestNow`).
- Limpieza automática (transacción por test o BD recreada), nunca "borrar a mano al final".

## Mocks, stubs y fakes

- **Fake**: implementación funcional simplificada (repositorio en memoria, cliente LLM con respuestas fijas). Preferido: tests legibles, sin acoplarse a la firma de llamadas.
- **Stub**: devuelve valores fijos. Útil para dependencias de lectura.
- **Mock**: verifica interacciones. Úsalo solo cuando la interacción ES el comportamiento (se envió un email, se publicó un evento).
- Mockea en la frontera que controlas (tu `Protocol`/interfaz, tu cliente HTTP), no librerías de terceros en profundidad (`patch("requests.Session.get")` es frágil).
- Red: MSW (front), `Http::fake()` (Laravel), `respx` (httpx). Nunca tests que salgan a Internet.
- Tiempo, aleatoriedad, IDs: inyectables o controlados con utilidades del framework.
- LLMs: fake determinista por defecto; registra respuestas reales en fixtures solo si el test verifica parseo de formato real.
- Señal de alarma: más líneas de setup de mocks que de test. Refactoriza el diseño (inyección de dependencias) o sube a test de integración.

## Tests de contrato

- Cuando dos servicios o front/back se comunican, el contrato (OpenAPI, schema zod/Pydantic compartido, eventos) se verifica en ambos lados.
- Backend: test que valida las respuestas reales contra el schema OpenAPI (`schemathesis`, `openapi-validator`) o contra el Resource/serializer esperado.
- Frontend: los mocks de MSW se generan o validan a partir del OpenAPI/schemas del backend, no se escriben a mano de memoria.
- Consumer-driven contracts (Pact) solo si hay varios equipos y despliegues independientes.
- Cambios de contrato son breaking por defecto: test que falla si se elimina/renombra un campo.

## Integración con BD real

- Usa el mismo motor que producción (Postgres/MySQL) en un contenedor: `testcontainers` (Python/TS), servicio en CI (GitHub Actions `services:`), o `docker compose` local. SQLite en memoria solo para unit tests que no dependan de SQL específico.
- Aislamiento: transacción por test con rollback (Laravel `RefreshDatabase`, pytest fixture con `session.begin_nested()`), o truncado por tabla. Paralelismo con una BD por worker (`--parallel` en Pest crea BDs por proceso).
- Migraciones aplicadas al iniciar la suite, no esquema construido a mano.
- Verifica el estado en BD, no solo la respuesta HTTP (`assertDatabaseHas`, query directa).
- Prueba aquí: constraints únicos, cascadas, transacciones, queries complejas, N+1 (`assertQueryCount`/`expectQueries`).

## E2E acotados

- 5-15 flujos críticos de negocio (registro/login, compra, flujo principal del producto). Todo lo demás baja de nivel.
- Playwright: selectores por rol/label (`getByRole`), `storageState` para saltar el login, `test.describe.configure({ mode: "parallel" })`, trazas y vídeo solo en fallo.
- Datos: cada test crea lo que necesita mediante API/seed y no depende de otros tests ni de orden.
- Sin `waitForTimeout`; usa auto-wait de Playwright y aserciones `expect(locator).toBeVisible()`.
- Ejecuta en CI contra un entorno efímero (preview) o la app levantada en el job; en local, contra `dev`.
- Añade `@axe-core/playwright` en 2-3 páginas clave para accesibilidad básica.

## Cobertura útil

- La cobertura mide lo no probado, no la calidad. Objetivo razonable: 80% líneas en código nuevo, 100% en dominio crítico (dinero, permisos).
- Falla la CI solo por bajada de cobertura en el diff (`--cov-fail-under` sobre cambios con `diff-cover`, Codecov patch), no por un número global arbitrario.
- Excluye del cálculo: migraciones, config, código generado, `main`/bootstrap.
- Cobertura de ramas > cobertura de líneas. Mutation testing (`infection` en PHP, `mutmut` en Python, `Stryker` en TS) en módulos críticos, de forma puntual.

## Flaky tests

- Un test flaky se arregla o se borra el mismo día; nunca se reintenta silenciosamente. Reintentos automáticos solo en E2E (`retries: 1`) y con alerta.
- Causas típicas y remedios: tiempo real (inyecta reloj), orden de ejecución (aislamiento de estado, `--random-order`), concurrencia (BD por worker), red (fakes), animaciones (`prefers-reduced-motion` en E2E), `sleep` (espera por condición).
- Cuarentena etiquetada (`@pytest.mark.flaky`, `test.fixme`) con issue asignado y fecha límite.
- Mide: el CI debe reportar tests que pasan en reintento.

## TDD pragmático

- Red-green-refactor cuando el comportamiento está claro y el diseño se beneficia (lógica de dominio, parsers, cálculos, bugs). No obligatorio para UI exploratoria o spikes.
- Escribe primero el test del caso más simple; añade el siguiente solo cuando el anterior está en verde.
- Refactor con la red en verde; el commit incluye test + implementación juntos.
- Para bugs: reproduce con test (rojo), arregla (verde), cierra.
- Spike sin tests → tirar el spike y reimplementar con tests, no "añadir tests después" al spike.

## Comandos por stack

| Stack | Unit / integración | E2E | Notas |
|---|---|---|---|
| Laravel | `php artisan test --parallel` / `vendor/bin/pest --coverage --min=80` | Playwright o Dusk | `--filter=NombreTest`, `--group=slow` |
| TS (React/Vue/Astro) | `vitest run --coverage` / `vitest --ui` | `playwright test` | `vitest related` en pre-commit; `--project=chromium` en PR |
| Python | `uv run pytest -n auto --cov=src --cov-report=term-missing` | `playwright` (Python o TS) | `-x --ff` en local; `-m "not llm"` en PR |
| Contrato | `schemathesis run openapi.json` / tests de Resource | - | En CI del backend |

- Ordena en CI: lint y tipos → unit → integración → E2E. Falla rápido.
- Ejecuta la suite completa localmente antes de abrir la PR.

## Checklist de revisión de tests

- El nombre describe comportamiento y condición.
- Fallaría si se rompiera la funcionalidad (prueba: comenta la línea clave de la implementación).
- No depende de orden, tiempo real, red ni datos externos.
- Arrange mínimo; solo los datos que importan son explícitos.
- Verifica resultado/estado, no llamadas internas (salvo que la llamada sea el efecto).
- Cubre el camino feliz, al menos un error y un límite.
- No hay lógica (condicionales, bucles complejos) dentro del test.
- Se ejecuta en menos de 1 s (unit) o está en el nivel correcto.
