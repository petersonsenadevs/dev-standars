# Reglas de arquitectura que se comprueban solas

Una regla de arquitectura escrita en un documento se incumple en tres semanas. Escrita como test o
como configuración de una herramienta, falla en cuanto alguien se la salta. Aquí van las reglas base y
cómo convertirlas en comprobación automática por stack.

Índice: 1 Reglas base · 2 Laravel · 3 TypeScript (Node, Nest, Next) · 4 Python · 5 Java y .NET ·
6 Cómo se integra con dev-standards

## 1. Reglas base (adáptalas a la estructura REAL del proyecto)
- Los controladores (o handlers HTTP) no acceden a la base de datos directamente: delegan en servicios,
  actions o repositorios.
- El dominio o los servicios de negocio no dependen del framework HTTP (ni de la request ni de la respuesta).
- Los modelos no llaman a servicios externos (email, pagos, APIs).
- Sin dependencias circulares entre módulos.
- Un módulo solo usa de otro lo que ese otro expone (su API pública), no sus clases internas.
Si el proyecto tiene su propia estructura sellada con `/adoptar`, las reglas salen de ahí.

## 2. Laravel
**Con Pest** (sin dependencias nuevas si ya usáis Pest), en `tests/Arch/ArchitectureTest.php`:
```php
arch('controllers no usan la BD directamente')
    ->expect('App\Http\Controllers')
    ->not->toUse(['Illuminate\Support\Facades\DB']);

arch('modelos no llaman a servicios externos')
    ->expect('App\Models')
    ->not->toUse(['App\Services\Payments', 'Illuminate\Support\Facades\Mail']);

arch('sin funciones de depuración')->expect(['dd', 'dump', 'ray'])->not->toBeUsed();
```
Corren con `php artisan test`: entran solas en `/verificar`.

**Con Deptrac** (sin Pest o con muchas capas): `deptrac.yaml` con las capas por namespace y qué puede
usar cada una; `vendor/bin/deptrac analyse`.

## 3. TypeScript (Node, NestJS, Next)
**dependency-cruiser**: `npx depcruise --init` y reglas en `.dependency-cruiser.cjs`:
```js
module.exports = {
  forbidden: [
    { name: 'sin-ciclos', severity: 'error', from: {}, to: { circular: true } },
    { name: 'dominio-sin-http', severity: 'error',
      from: { path: '^src/domain' }, to: { path: '^src/(http|controllers)' } },
    { name: 'solo-api-publica', severity: 'error',
      from: { path: '^src/modules/([^/]+)/' }, to: { path: '^src/modules/(?!$1)[^/]+/internal/' } },
  ],
};
```
Se ejecuta con `npx depcruise src --config .dependency-cruiser.cjs`.

## 4. Python
**import-linter**: contratos en `.importlinter` (capas o prohibiciones) y `lint-imports`.
```ini
[importlinter]
root_package = app

[importlinter:contract:capas]
name = Capas
type = layers
layers =
    app.api
    app.services
    app.domain
```

## 5. Java y .NET
**ArchUnit** (Java) y **NetArchTest** (.NET): las reglas se escriben como tests normales y corren con la
suite. Ejemplo ArchUnit: `noClasses().that().resideInAPackage("..domain..").should().dependOnClassesThat().resideInAPackage("..web..")`.

## 6. Cómo se integra con dev-standards
- **`/adoptar`** propone estas reglas adaptadas a la estructura real del proyecto (con el ok del usuario).
- **`/verificar`** (script `verify-build.mjs`) ejecuta Deptrac o dependency-cruiser automáticamente si
  encuentra su configuración (`deptrac.yaml`, `.dependency-cruiser.cjs`); los tests de arquitectura de
  Pest, ArchUnit o NetArchTest ya corren dentro de los tests.
- Si una regla falla, la verificación falla, y el hook `stop-guard` no deja cerrar la tarea sin
  una verificación en verde.
- **`/auditar`** usa la salida de estas herramientas como evidencia de los hallazgos de arquitectura.
