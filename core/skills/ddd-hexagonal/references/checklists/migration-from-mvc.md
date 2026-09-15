# Migración incremental desde MVC clásico

Índice
1. Punto de partida y principio rector
2. Paso 1: extraer casos de uso (Actions) del controlador
3. Paso 2: interfaces de repositorio sobre Eloquent/Prisma
4. Paso 3: mover reglas a entidades y value objects
5. Paso 4: eventos de dominio en lugar de efectos en el controlador
6. Paso 5: módulos por contexto
7. Paso 6: tests primero en dominio
8. Strangler fig: convivir con el legacy
9. Qué mantener tal cual
10. Señales de sobreingeniería
11. Checklist de una feature migrada

---

## 1. Punto de partida y principio rector

Punto de partida típico:

```php
// Laravel clásico: controlador que lo hace todo
public function issue(Request $request, Invoice $invoice)
{
    $request->validate(['send_email' => 'boolean']);
    if ($invoice->lines()->count() === 0) return back()->withErrors('Sin líneas');
    if ($invoice->status !== 'draft') abort(409);
    DB::transaction(function () use ($invoice) {
        $invoice->number = Sequence::next('INV');
        $invoice->status = 'issued'; $invoice->issued_at = now(); $invoice->save();
        Ledger::create([...]);
    });
    if ($request->send_email) Mail::to($invoice->customer)->send(new InvoiceMail($invoice));
    return redirect()->route('invoices.show', $invoice);
}
```

O el equivalente Next.js: un route handler / server action con Prisma y `if`s de negocio.

Principio rector: **cada paso deja el sistema funcionando y desplegable**, se aplica
**feature a feature** (no "migrar todo el módulo"), y se empieza por la feature con más
reglas y más bugs, no por la más fácil. El objetivo no es "ser hexagonal", es que las
reglas tengan un sitio y un test.

## 2. Paso 1: extraer casos de uso (Actions) del controlador

Mueve el cuerpo del controlador a una clase con un método (`IssueInvoice::__invoke` o
`issueInvoice()`), que recibe datos planos (command) y no conoce `Request` ni `Response`.

```php
// app/Actions/Invoicing/IssueInvoice.php (primer paso: aún con Eloquent dentro)
final class IssueInvoice
{
    public function __invoke(IssueInvoiceCommand $cmd): void
    {
        $invoice = InvoiceModel::findOrFail($cmd->invoiceId);
        if ($invoice->lines()->count() === 0) throw new InvoiceCannotBeIssued($invoice->id);
        if ($invoice->status !== 'draft') throw new InvoiceIsLocked($invoice->id);
        DB::transaction(function () use ($invoice) { /* igual que antes */ });
        if ($cmd->sendEmail) Mail::to(...)->send(...);
    }
}
// Controlador: valida forma, construye command, llama, mapea excepciones a HTTP
public function issue(IssueInvoiceRequest $request, string $id, IssueInvoice $action)
{
    $action(new IssueInvoiceCommand($id, $request->boolean('send_email')));
    return redirect()->route('invoices.show', $id);
}
```

Ganancia inmediata: el caso de uso es invocable desde un test, un job o un comando
Artisan. Excepciones de dominio -> HTTP se mapean en un `Handler` central, no en cada
controlador.

Next.js: el server action queda en `app/actions/*.ts` con 5 líneas (parse con zod,
llamar a `issueInvoice(cmd)`, `revalidatePath`); la lógica va a `modules/invoicing/application`.

## 3. Paso 2: interfaces de repositorio sobre Eloquent/Prisma

Define la interfaz en términos de dominio y una implementación que por ahora devuelve el
propio modelo Eloquent/Prisma (aún no hay entidad propia). Bindea en el ServiceProvider /
container.

```php
interface InvoiceRepository { public function ofId(string $id): ?InvoiceModel; public function save(InvoiceModel $i): void; }
final class EloquentInvoiceRepository implements InvoiceRepository { /* find, save */ }
```

Parece trivial, pero ya permite un fake en memoria en los tests del caso de uso y marca
el punto único de acceso a la persistencia. Lo que NO hay que hacer: un repositorio
genérico `Repository<T>` con `all/find/where/paginate` (ver `anti-patterns.md` §3).

## 4. Paso 3: mover reglas a entidades y value objects

Ahora sustituye el modelo Eloquent por una entidad propia **solo en la escritura**. El
repositorio mapea entidad <-> modelo. Las reglas (`sin líneas no se emite`, `no editable
tras emitir`) pasan a métodos de la entidad y lanzan excepciones de dominio.

```php
// antes (en el action)          // después (en la entidad)
if ($invoice->lines()->count() === 0) throw ...   ->   $invoice->issue($now); // lanza InvoiceCannotBeIssued
```

Orden dentro del paso: primero VO para primitivos con reglas (`Money`, `Email`,
`InvoiceNumber`), luego la raíz del agregado, luego el mapeo en el repositorio. Los
listados y pantallas siguen usando Eloquent directamente (read side); no migres las
lecturas, no aporta.

Trampa habitual: dejar que la entidad extienda `Model` "para no mapear". Ahí no has
migrado nada; ver `anti-patterns.md` §4.

## 5. Paso 4: eventos de dominio en lugar de efectos en el controlador

Todo lo que era "y después envía email / crea asiento / avisa a Slack" pasa a ser una
reacción a `InvoiceIssued`. La entidad registra el evento; el caso de uso lo publica tras
el commit; los listeners (adaptadores) hacen el efecto, idealmente en cola.

```php
// Handler
DB::transaction(fn () => $this->invoices->save($invoice));
DB::afterCommit(fn () => $this->events->publish(...$invoice->pullEvents()));
// EventServiceProvider: InvoiceIssued::class => [SendInvoiceEmail::class, PostLedgerEntry::class]
```

Regla: el listener llama a otro caso de uso o a un puerto; no contiene lógica de negocio.
El flag `send_email` del formulario deja de ser parte del command y se convierte en
preferencia del cliente o en una política.

## 6. Paso 5: módulos por contexto

Cuando dos o tres features de un mismo vocabulario ya están migradas, agrúpalas:
`src/Invoicing/{Domain,Application,Infrastructure}` (o `app/Modules/Invoicing`). Añade
PSR-4 en `composer.json`, un ServiceProvider por módulo, y **deptrac / dependency-cruiser
en modo warning** para ver los imports cruzados. Ver `strategic-design.md` §6 para el
procedimiento y `laravel.md` / `typescript.md` para la estructura.

No muevas lo que no has migrado: un módulo con la mitad de controladores legacy dentro
confunde más que ayuda. El legacy se queda en `app/` hasta que le toque.

## 7. Paso 6: tests primero en dominio

En el momento en que existe la entidad, escribe sus tests **antes** de seguir migrando
(`testing-strategy.md` §2). Motivo práctico: el test de dominio es el que fija el
comportamiento que estás copiando del controlador; sin él, la migración es una
reescritura a ciegas. Los tests HTTP existentes se mantienen como red de seguridad y se
adelgazan al final.

Orden por feature: (1) tests de dominio, (2) test de caso de uso con fake, (3) test de
integración del repositorio, (4) recortar tests HTTP a cableado.

## 8. Strangler fig: convivir con el legacy

- **Fachada de rutas**: la ruta vieja y la nueva apuntan al mismo path; un feature flag o
  la propia migración del controlador decide quién responde. No hay "v2" pública.
- **Mismas tablas**: el repositorio nuevo escribe en las tablas existentes. No dupliques
  esquema hasta que un contexto se extraiga.
- **Lecturas sin tocar**: listados, informes, exports siguen con Eloquent/Prisma. Solo
  cambia la escritura.
- **Eventos hacia el legacy**: si código viejo necesita reaccionar, se suscribe al evento
  de dominio. Si el código viejo necesita provocar la acción, llama al caso de uso.
- **ACL con el legacy**: si el módulo nuevo necesita datos del legacy con modelo feo,
  puerto + adaptador que lee la tabla/servicio viejo y devuelve tus VO.
- **Métrica de progreso**: número de controladores con lógica de negocio / total, o
  líneas en `app/Http` que no sean validación y mapeo.

## 9. Qué mantener tal cual

- **CRUD simple sin reglas** (tablas maestras, configuraciones, etiquetas): controlador
  resource + Form Request + Eloquent. Envolverlo en agregado + repositorio + caso de uso
  es puro coste.
- **Listados, filtros, exports, dashboards**: query directa a BD, DTO o Resource, sin
  pasar por dominio.
- **Autenticación, autorización, sesiones**: framework. Solo la regla de negocio
  ("un contable no puede anular facturas pagadas") va al dominio o a una policy que llame
  al dominio.
- **Integraciones triviales** (un webhook que guarda un registro): adaptador + inserción.
- **Jobs de mantenimiento, comandos de consola de operaciones**: scripts.

Criterio: si no hay invariante que romper ni transición de estado, no hay agregado.

## 10. Señales de sobreingeniería

- Command + Handler + DTO + Interface + Impl para una operación de 10 líneas sin reglas.
- Interfaz de repositorio con una única implementación que nadie sustituye ni en tests.
- Un agregado por tabla, con `getters/setters` para cada columna (modelo anémico con capas).
- Bus de comandos, middlewares y colas para llamadas que podrían ser un método.
- Carpetas `Domain/Application/Infrastructure` con un archivo cada una.
- Value objects para todo, incluidos `Name`, `Description`, `Notes`.
- Mapper entidad <-> modelo con 200 líneas porque el agregado es una copia de 5 tablas.
- Eventos para llamadas síncronas dentro del mismo caso de uso.
- "Primero diseñamos toda la arquitectura, luego migramos": nunca se termina.

Si detectas dos o más en un módulo, elimina la capa que menos trabaje. Merge de clases es
barato; mantener capas vacías, no.

## 11. Checklist de una feature migrada

- [ ] El controlador/handler solo valida forma, construye command, llama, mapea respuesta.
- [ ] Existe un caso de uso invocable sin HTTP, con un test con fakes.
- [ ] Las reglas viven en entidad/VO y tienen tests puros.
- [ ] Acceso a persistencia de escritura solo vía interfaz de repositorio.
- [ ] Transacción abierta en el caso de uso (o su decorador), no en el controlador.
- [ ] Efectos secundarios reaccionan a eventos publicados tras commit.
- [ ] Nada en `Domain/` importa framework (lo verifica el linter de dependencias).
- [ ] Las lecturas de pantalla no pasan por el agregado.
