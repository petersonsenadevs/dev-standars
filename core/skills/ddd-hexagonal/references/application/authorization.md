# Autorización por capas

## Índice

- [Tres tipos de pregunta](#tres-tipos-de-pregunta)
- [Dónde vive cada decisión](#dónde-vive-cada-decisión)
- [Puerto de autorización en Application](#puerto-de-autorización-en-application)
- [Permisos como invariante del agregado](#permisos-como-invariante-del-agregado)
- [Adaptadores: Gate/Policies, middleware Next, Depends FastAPI](#adaptadores-gatepolicies-middleware-next-depends-fastapi)
- [RBAC y ABAC pragmáticos](#rbac-y-abac-pragmáticos)
- [Filtrado de lecturas](#filtrado-de-lecturas)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `use-cases.md`, `validation-layers.md`, `../stacks/laravel/overview.md` §8.

## Tres tipos de pregunta

| Pregunta | Ejemplo | Tipo | Capa |
|---|---|---|---|
| ¿Está autenticado y tiene el rol/permiso para esta acción? | `invoice.issue` requiere rol `billing` | Autorización de aplicación (coarse) | Application (puerto) + adaptador |
| ¿Puede este actor hacerlo con **este** recurso? | solo el propietario del proyecto puede archivarlo | Autorización de recurso | Application, tras cargar el agregado |
| ¿Es una regla de negocio que depende del estado del agregado y del actor? | un aprobador no puede aprobar su propio gasto | Invariante de dominio | Domain (método del agregado) |

La primera se responde sin cargar nada; la segunda necesita el agregado (o un read
model de propiedad); la tercera es negocio y va donde van las reglas.

## Dónde vive cada decisión

```
HTTP middleware / route guard   -> autenticación, tenant, "está logueado"        (adaptador)
Policy / Gate / can()           -> permiso coarse y de recurso, expresado por el adaptador,
                                   delegando en el puerto o en datos del read model
Handler                         -> authorizer.assert(actor, action, resource)    (aplicación)
Agregado                        -> invoice.approve(by: approver) lanza si approver == author (dominio)
```

La regla clave: **el handler autoriza aunque el controlador ya lo haya hecho**. El
controlador puede hacerlo antes para dar un 403 barato y no cargar nada; pero el job, el
comando CLI o el listener que invoquen el mismo handler no pasan por el controlador. Si
solo el adaptador autoriza, la regla es un agujero.

Excepción: procesos de sistema (cron, sagas) que actúan sin usuario. Usa un actor
`SystemActor` explícito con permisos definidos, no "saltarse" la comprobación.

## Puerto de autorización en Application

```php
// src/Shared/Application/Authorizer.php
interface Authorizer
{
    /** @throws NotAuthorized */
    public function assert(Actor $actor, string $action, ?string $resourceId = null): void;
    public function can(Actor $actor, string $action, ?string $resourceId = null): bool;
}

// Actor: VO de aplicación (id, roles, tenantId). El command lleva el actorId; el handler
// obtiene el Actor por un puerto `ActorProvider` o lo recibe ya construido.
```

```ts
export interface Authorizer {
  can(actor: Actor, action: Action, resource?: { type: string; id: string }): Promise<boolean>;
}
export type Actor = { id: string; roles: readonly string[]; tenantId: string };
```

La implementación (adaptador) puede consultar tablas de roles, Laravel Gate, Casbin, OPA
o una API externa. El handler no lo sabe. En tests, un `AllowAllAuthorizer` y un
`DenyingAuthorizer` de dos líneas.

## Permisos como invariante del agregado

Cuando la regla mezcla estado del agregado y actor, es dominio y no debe depender de
ninguna infraestructura de permisos:

```php
final class ExpenseReport
{
    public function approve(EmployeeId $approver, \DateTimeImmutable $now): void
    {
        if ($this->status !== ExpenseStatus::Submitted) throw ExpenseCannotBeApproved::notSubmitted($this->id);
        if ($approver->equals($this->submittedBy)) throw ExpenseCannotBeApproved::bySubmitter($this->id);
        $this->status = ExpenseStatus::Approved;
        $this->record(new ExpenseApproved($this->id, $approver, $now));
    }
}
```

El handler comprueba antes que `$actor` tiene el permiso `expense.approve` (aplicación) y
el agregado comprueba que no se aprueba a sí mismo (dominio). Son dos preguntas distintas;
la segunda es testeable sin BD ni roles.

Otros ejemplos de dominio: límites de importe por rol de aprobación (política de dominio
que recibe el rol como VO), visibilidad de un documento según su estado, ventana temporal
en la que el autor puede editar.

## Adaptadores: Gate/Policies, middleware Next, Depends FastAPI

**Laravel**: la `Policy` es un adaptador válido para la comprobación coarse y de recurso
desde el controlador. Para que el handler también la use, implementa el puerto:

```php
final class GateAuthorizer implements Authorizer
{
    public function can(Actor $actor, string $action, ?string $resourceId = null): bool
    {
        $user = User::find($actor->id);                     // o un objeto Authorizable ligero
        return Gate::forUser($user)->allows($action, $resourceId);
    }
    public function assert(Actor $actor, string $action, ?string $resourceId = null): void
    {
        if (!$this->can($actor, $action, $resourceId)) throw NotAuthorized::to($action, $resourceId);
    }
}
// Gate::define('invoice.pay', fn (User $u, string $invoiceId) => $u->hasRole('billing') && ...);
```

`NotAuthorized` (excepción de aplicación) se mapea a 403 en el handler de excepciones.

**Next.js**: `middleware.ts` solo autentica y protege rutas (redirige a login). La
autorización de acción va en el server action / route handler, que construye el `Actor`
desde la sesión y pasa al caso de uso; el caso de uso llama al puerto.

```ts
export async function issueInvoiceAction(id: string) {
  const actor = await currentActor();                   // lanza si no hay sesión
  const r = await handlers.issueInvoice({ invoiceId: id, actorId: actor.id });
  if (!r.ok && r.error.kind === 'Forbidden') return { error: 'No tienes permiso' };
  ...
}
```

**FastAPI**: `Depends(current_actor)` en el endpoint resuelve autenticación y construye
el `Actor`; un `Depends(require("invoice.issue"))` puede cortar en 403 barato. El caso de
uso sigue llamando a `authorizer.assert(...)`: `Depends` es adaptador, no política.

## RBAC y ABAC pragmáticos

- **RBAC**: roles -> permisos (`billing: [invoice.issue, invoice.pay]`). Suficiente para
  la mayoría de aplicaciones B2B. Tabla `role_permissions` o un mapa en config si los
  roles son fijos.
- **ABAC** cuando las decisiones dependen de atributos (tenant, departamento, importe,
  propiedad). No necesitas un motor: una función `can(actor, action, resource)` con
  atributos ya es ABAC. Motores (Casbin, OPA, Cerbos) cuando las políticas cambian sin
  despliegue o se comparten entre servicios.
- Multi-tenant: el `tenantId` viaja en el `Actor` y en el command; repositorios y lectores
  filtran **siempre** por él. Un agregado de otro tenant es "no encontrado" (404), no 403,
  para no revelar existencia.
- Nombra permisos como `recurso.acción` en minúsculas; documenta la lista en el módulo.

## Filtrado de lecturas

Autorizar lecturas registro a registro no escala. Los lectores (read models) reciben el
`Actor` y aplican el filtro en la consulta: `WHERE tenant_id = ? AND (owner_id = ? OR
visibility = 'team')`. La regla de visibilidad se documenta junto al lector y se prueba
con un test de integración por rol. Para vistas complejas, una vista SQL o CTE
`visible_invoices(actor_id)` reutilizable.

## Errores frecuentes

- Autorizar solo en el controlador/Policy; jobs y CLI se saltan la regla.
- Regla de dominio ("no aprobar tu propio gasto") escrita en una Policy de Laravel: no se
  prueba sin framework y se duplica en el job.
- Pasar el `User` de Eloquent al handler: acopla Application a Auth y a Eloquent. Pasa
  un `Actor` plano.
- 403 para recursos de otro tenant: revela existencia. Devuelve 404.
- Global scopes de Eloquent para multi-tenant: mágicos, se olvidan en jobs sin contexto.
  Filtra explícitamente con el `tenantId` del command.
- Comprobar permisos dentro del agregado consultando un repositorio de roles: el dominio
  recibe hechos (`approverRole`), no consulta infraestructura.
- Mezclar autenticación (quién eres) con autorización (qué puedes) en una sola función
  gigante de middleware.

## Checklist

- [ ] Puerto `Authorizer` en Application; implementación en Infrastructure.
- [ ] El handler llama a `assert` aunque el adaptador ya haya comprobado.
- [ ] Reglas que dependen del estado del agregado viven en el agregado.
- [ ] `Actor` plano (id, roles, tenant) en lugar del modelo de usuario del framework.
- [ ] `SystemActor` explícito para procesos sin usuario.
- [ ] Lecturas filtradas por tenant/visibilidad en el lector, con test por rol.
- [ ] Otro tenant -> 404; sin permiso -> 403; sin sesión -> 401.
- [ ] Lista de permisos `recurso.acción` documentada en el módulo.
