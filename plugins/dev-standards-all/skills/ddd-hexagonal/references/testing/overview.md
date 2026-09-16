# Estrategia de testing por capas

## Índice

- [Pirámide por capa](#pirámide-por-capa)
- [Tests de dominio puros](#tests-de-dominio-puros)
- [Tests de casos de uso con fakes en memoria](#tests-de-casos-de-uso-con-fakes-en-memoria)
- [Tests de adaptadores](#tests-de-adaptadores)
- [Tests de API/HTTP finos](#tests-de-apihttp-finos)
- [Tests de arquitectura](#tests-de-arquitectura)
- [Qué NO mockear](#qué-no-mockear)
- [Fixtures y builders](#fixtures-y-builders)
- [Organización por stack](#organización-por-stack)
- [Organización de carpetas y velocidad](#organización-de-carpetas-y-velocidad)
- [Checklist](#checklist)

Este documento fija la estrategia (qué se prueba en cada capa y con qué dobles). Los
ejemplos completos por stack están en los documentos específicos de esta carpeta.

## Pirámide por capa

| Capa | Tipo | Dobles | Velocidad | Proporción orientativa |
|---|---|---|---|---|
| Domain | unitario puro | ninguno | ms | 50 % |
| Application | unitario con fakes en memoria | fakes de puertos driven | ms | 30 % |
| Infrastructure | integración (BD real, contenedor, HTTP grabado) | ninguno o servidor fake | 100 ms - s | 15 % |
| Driving (HTTP, CLI) | end-to-end fino | los de infraestructura de test | s | 5 % |

La proporción no es dogma: un módulo con mucha lógica de mapeo SQL tendrá más tests de
adaptador. Lo que sí es regla: cada regla de negocio se prueba en dominio, no a través
del HTTP.

## Tests de dominio puros

Sin framework, sin contenedor, sin BD, sin reloj real. Se construye el agregado, se llama
a un método, se comprueba estado, evento emitido o excepción. Se leen como el glosario.

Qué cubrir: invariantes (lo que no puede pasar), transiciones de estado, cálculos de VO,
eventos registrados con los datos correctos, igualdad de VO.

```php
it('cannot be issued without lines', function () {
    $invoice = anInvoice()->draft()->build();
    expect(fn () => $invoice->issue(now: new DateTimeImmutable('2026-01-10')))
        ->toThrow(InvoiceCannotBeIssued::class);
});
```

Si un test de dominio necesita `Mockery`, el dominio tiene una dependencia que no
debería tener (reloj, repositorio, HTTP). Pásala como argumento (`issue(now)`) o
elimínala.

Detalle: `domain-tests.md` (matriz de transiciones, eventos, tablas de casos, ejemplo por stack).

## Tests de casos de uso con fakes en memoria

Un fake es una implementación real pero simplificada del puerto (un array como "tabla").
Se escribe una vez por puerto y se reutiliza en todos los tests de aplicación. Prueba
orquestación: carga -> regla -> guarda -> publica.

```ts
it('issues a draft invoice and publishes InvoiceIssued', async () => {
  const invoices = new InMemoryInvoiceRepository();
  const events = new RecordingEventBus();
  invoices.seed(anInvoice().withLine(money(1000)).build());

  const result = await issueInvoice({ invoices, events, clock: fixedClock('2026-01-10') })({ invoiceId: 'inv-1' });

  expect(result.ok).toBe(true);
  expect((await invoices.ofId(InvoiceId.of('inv-1')))!.status).toBe('issued');
  expect(events.published).toContainEqual(expect.objectContaining({ name: 'InvoiceIssued' }));
});
```

Fake vs mock: el fake tiene comportamiento (guardar y recuperar); el mock solo verifica
llamadas. Con fakes el test describe resultado ("la factura queda emitida"), no
implementación ("se llamó a save una vez"). Usa mocks/spies solo para puertos de salida
pura (envío de email) donde lo único observable es la llamada.

Detalle: `use-case-tests.md` (catálogo de fakes, transacción, errores de dominio, spies).

## Tests de adaptadores

Repositorios: contra BD real (SQLite en memoria si el SQL es portable; si no,
Postgres/MySQL en contenedor). Prueban el mapeo ida y vuelta: guardar agregado ->
recuperar -> igual. Y las consultas específicas.

Contract test del puerto: el mismo conjunto de tests se ejecuta contra el fake en
memoria y contra la implementación real. Garantiza que el fake no miente.

Gateways externos (ACL): test contra un servidor fake local (WireMock, MSW, respx) o
grabaciones (VCR). Nunca contra el SaaS real en CI. Un test manual etiquetado
`@external` para verificar de vez en cuando que el contrato sigue vigente.

Detalle: `adapter-tests.md` (SQLite vs contenedor, repositorios por stack, contract tests, jobs).

## Tests de API/HTTP finos

Uno o dos por endpoint: ruta correcta, auth, validación de forma (422), caso feliz con
código de estado y shape de respuesta, un error de dominio mapeado a HTTP. No repetir
las reglas de negocio aquí. Usa la infraestructura real de test (BD de test), no mocks de
casos de uso: el valor de este test es comprobar el cableado (DI, middleware, serialización).

```php
it('returns 409 when the invoice has no lines', function () {
    $invoice = InvoiceModel::factory()->draft()->create();
    $this->actingAs(adminUser())
        ->postJson("/api/invoices/{$invoice->id}/issue")
        ->assertStatus(409)
        ->assertJsonPath('error', 'invoice_cannot_be_issued');
});
```

Detalle: `adapter-tests.md` (HTTP thin tests) y los documentos de adaptadores en `../stacks/`.

## Tests de arquitectura

Las reglas de dependencia (dominio sin framework, aplicación sin infraestructura, módulos
por su `index`) se verifican con tests o linters en CI, no solo en revisión: Pest arch y
deptrac (PHP), dependency-cruiser (TS), import-linter (Python).

Detalle: `architecture-tests.md`; configuración en `../hexagonal/dependency-rules-tooling.md`.

## Qué NO mockear

- El dominio: entidades y VO se instancian de verdad, siempre. Mockear `Invoice` es
  probar el mock.
- Repositorios en tests de aplicación: fake en memoria, no `mock->shouldReceive('save')`.
- El ORM en tests de adaptador: si mockeas Eloquent/Prisma no pruebas nada.
- El framework HTTP: usa el cliente de test del framework.
- El reloj: no lo mockees, inyéctalo (`Clock` con `FixedClock`).
- Casos de uso en tests HTTP: cablea el real con fakes de infraestructura si hace falta
  aislar un servicio externo.

Sí mockear/stubear: SDKs de terceros (Stripe, LLM), envío de email, colas, todo lo que sea
IO externo no determinista, siempre detrás de un puerto.

## Fixtures y builders

Un builder por agregado, con defaults válidos y métodos `with...()` para lo que importa
en cada test. Vive en `tests/Builders` (o `tests/support`) y lo usan las tres capas.

```php
final class InvoiceBuilder
{
    public static function anInvoice(): self { return new self(); }
    public function withLine(Money $price, int $qty = 1): self { $c = clone $this; $c->lines[] = [$price, $qty]; return $c; }
    public function issued(): self { $c = clone $this; $c->issued = true; return $c; }
    public function build(): Invoice { /* construye con defaults válidos y aplica lo configurado */ }
}
function anInvoice(): InvoiceBuilder { return InvoiceBuilder::anInvoice(); }
```

Reglas: inmutable (clona en cada `with`), defaults que producen un objeto válido, un
builder no conoce la BD. Para infraestructura, factories del ORM (`InvoiceModel::factory()`)
separadas del builder de dominio.

Detalle: `test-data-builders.md` (object mother, datos determinísticos, ejemplo por stack).

## Organización por stack

| Stack | Runner | Suites | Ejecución local |
|---|---|---|---|
| PHP | Pest | `Unit` (sin bootstrap de Laravel), `Integration`, `Feature` (`RefreshDatabase`) | `php artisan test --testsuite=Unit` |
| TypeScript | Vitest | workspace `unit` (`domain`, `application`) e `integration` (`infrastructure`, setup de BD) | `vitest --project unit` |
| Python | pytest | markers `unit`, `integration`, `e2e`; `TestClient` con `dependency_overrides` | `pytest -m unit` |

En CI, la suite unitaria corre en cada push; el resto en PR.

Detalle: ejemplos completos en `domain-tests.md`, `use-case-tests.md` y `adapter-tests.md`
(sección "Ejemplo completo por stack" de cada uno) y en el overview de cada stack en `../stacks/`.

## Organización de carpetas y velocidad

```
tests/
  Builders/ | support/     builders de dominio, fakes de puertos, FixedClock
  Unit/Domain/             puro
  Unit/Application/        casos de uso con fakes
  Integration/             adaptadores contra BD/servidores fake
  Feature/ | e2e/          HTTP fino
```

Objetivo: `Unit` completo en < 5 s. Si no, algo de infraestructura se coló en dominio o
aplicación. Los fakes y builders son código de producción de segunda: revísalos en PR,
tipa fuerte, sin lógica condicional compleja.

## Checklist

- [ ] Cada invariante y transición del agregado tiene un test de dominio sin framework.
- [ ] Los casos de uso se prueban con fakes en memoria, no con mocks de repositorio.
- [ ] Cada fake pasa el mismo contract test que la implementación real.
- [ ] Repositorios probados contra BD real; gateways contra servidor fake o grabación.
- [ ] Un test HTTP fino por endpoint; sin reglas de negocio repetidas.
- [ ] Reglas de dependencia verificadas en CI.
- [ ] Un builder inmutable por agregado, separado de las factories del ORM.
- [ ] Suite unitaria completa en menos de 5 segundos.
