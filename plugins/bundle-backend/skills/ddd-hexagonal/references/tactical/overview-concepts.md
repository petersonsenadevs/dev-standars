# Conceptos tácticos: DDD + Hexagonal + CQRS ligero

## Índice

- [Mapa mental en una pantalla](#mapa-mental-en-una-pantalla)
- [Entidad](#entidad)
- [Value Object](#value-object)
- [Agregado y raíz](#agregado-y-raíz)
- [Repositorio](#repositorio)
- [Servicio de dominio vs servicio de aplicación](#servicio-de-dominio-vs-servicio-de-aplicación)
- [Eventos de dominio](#eventos-de-dominio)
- [Fábricas](#fábricas)
- [Especificaciones](#especificaciones)
- [Anti-Corruption Layer](#anti-corruption-layer)
- [Puertos y adaptadores](#puertos-y-adaptadores)
- [DTOs, commands y queries](#dtos-commands-y-queries)
- [CQRS ligero](#cqrs-ligero)
- [Unit of Work](#unit-of-work)
- [Regla de dependencias](#regla-de-dependencias)
- [Checklist](#checklist)

Este documento es el mapa: define cada bloque táctico en pocas líneas y remite al
documento que lo desarrolla. Léelo entero una vez; después entra por el índice.

## Mapa mental en una pantalla

```
           driving adapters                    driven adapters
  HTTP / CLI / Job / Server Action      Eloquent / Prisma / SQLAlchemy / SMTP / LLM
              |                                        ^
              v                                        |
      [ Application ]  --usa puertos (interfaces)-->  [ Infrastructure ]
      casos de uso, commands, queries, DTOs
              |
              v
        [ Domain ]  entidades, VO, agregados, eventos, interfaces de repositorio
```

Regla única: las flechas de dependencia apuntan hacia dentro. `Domain` no importa nada
de framework. `Application` orquesta. `Infrastructure` implementa puertos. Los adaptadores
driving (controladores, actions) traducen el mundo exterior a commands/queries.

## Entidad

Tiene identidad estable (id) y ciclo de vida; dos entidades con el mismo id son la misma
aunque cambie su estado. Encapsula comportamiento: los cambios se hacen por métodos con
nombre de negocio, no por setters.

```php
final class InvoiceLine
{
    public function __construct(public readonly InvoiceLineId $id, private Money $unitPrice, private int $quantity) {
        if ($quantity <= 0) throw new \InvalidArgumentException('quantity must be > 0');
    }
    public function total(): Money { return $this->unitPrice->multiply($this->quantity); }
}
```

Detalle: `entities.md` (identidad, igualdad, constructor privado, persistencia sin contaminar).

## Value Object

Sin identidad, inmutable, igualdad por valor, validación en el constructor. Si el VO
existe, es válido. Sustituye "primitivos con reglas" (email, dinero, porcentaje, rango de fechas).

```ts
export class Email {
  private constructor(readonly value: string) {}
  static of(raw: string): Email {
    const v = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error(`Invalid email: ${raw}`);
    return new Email(v);
  }
  equals(other: Email): boolean { return this.value === other.value; }
}
```

Cuándo NO: si el valor no tiene reglas ni operaciones (un `note: string`), déjalo primitivo.

Detalle: `value-objects.md` (inmutabilidad por stack, VO compuestos, enums, serialización).

## Agregado y raíz

Un agregado es un grupo de entidades/VO que cambian juntos bajo una única raíz. La raíz es
la única puerta de entrada: nadie modifica una `InvoiceLine` sin pasar por `Invoice`.

Reglas prácticas:
- Invariantes garantizados en cada método público de la raíz.
- Límites pequeños: un agregado = una transacción. Si una operación toca dos agregados,
  casi seguro el límite está mal o hace falta un evento.
- Referencia por id a otros agregados (`CustomerId`), nunca el objeto entero.
- Se carga y se guarda completo. Si "es demasiado grande para cargarlo", es demasiado grande.

```php
public function issue(\DateTimeImmutable $now): void {
    if ($this->lines === []) throw InvoiceCannotBeIssued::withoutLines($this->id);
    $this->status = InvoiceStatus::Issued;
    $this->record(new InvoiceIssued($this->id, $this->total(), $now));
}
```

Detalle: `aggregates.md` (diseño paso a paso, consistencia eventual, versión optimista, tamaño).

## Repositorio

Interfaz en el dominio, implementación en infraestructura, una por agregado. Habla en
términos de dominio (`ofId`, `save`, `nextIdentity`), devuelve agregados, no filas.

```ts
export interface InvoiceRepository {
  nextId(): InvoiceId;
  ofId(id: InvoiceId): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
}
```

No es un DAO genérico ni un query builder. Las consultas para pantallas van a read models.

Detalle: `repositories.md` (qué consultas entran, fake en memoria, implementación por stack).

## Servicio de dominio vs servicio de aplicación

| | Servicio de dominio | Servicio de aplicación (caso de uso) |
|---|---|---|
| Vive en | `Domain/Service` | `Application/` |
| Sabe de | reglas puras entre varios agregados/VO | orquestación, transacción, puertos |
| Ejemplo | `PricingPolicy::priceFor(Product, Customer)` | `IssueInvoiceHandler` |
| Estado | sin estado, sin IO | sin estado, coordina IO por puertos |

Regla: si la lógica no encaja en una entidad porque involucra a varias, es servicio de
dominio. Si involucra cargar/guardar/notificar, es caso de uso.

Detalle: `domain-services.md`; casos de uso en `../application/use-cases.md`.

## Eventos de dominio

Hechos pasados, en tiempo verbal pasado (`InvoiceIssued`), inmutables, con los datos
mínimos (ids, importes, fecha). Se registran en el agregado durante la operación y se
publican tras el commit en el caso de uso (o por el UoW). Nunca dentro de la transacción
a un consumidor con IO externo: si el commit falla, ya has enviado el email. Si necesitas
garantía de entrega, patrón outbox.

Detalle: `domain-events.md`; garantía de entrega en `../integration/outbox-pattern.md`.

## Fábricas

Cuando construir un agregado exige reglas o varios pasos, saca la construcción a un
método estático (`Invoice::draftFor(CustomerId)`) o a una clase `InvoiceFactory` si
necesita dependencias. El constructor queda para rehidratar sin re-emitir eventos.

Detalle: `factories.md` (creación vs reconstitución, builders de test).

## Especificaciones

Predicados de negocio reutilizables y combinables (`OverdueInvoice`). Úsalas cuando la
misma regla aparece en varios sitios o se combina. Si la regla es una línea y se usa una
vez, un método `isOverdue()` en la entidad basta.

Detalle: `specifications.md` (composición, traducción a query, cuándo es sobreingeniería).

## Anti-Corruption Layer

Capa que traduce un modelo externo (API de terceros, legacy, otro contexto) al tuyo.
Implementación: un puerto en tu dominio (`PaymentGateway`) + un adaptador que llama al SDK
y mapea a tus VO. El adaptador es el ACL.

Detalle: `../integration/anti-corruption-layer.md`; `../checklists/anti-patterns.md`.

## Puertos y adaptadores

- Puerto driving (primario): la API de entrada = los casos de uso. Los adaptadores driving
  (controlador, comando CLI, job, server action, listener) la invocan.
- Puerto driven (secundario): interfaz que la aplicación necesita del exterior
  (repositorio, reloj, gateway, LLM, bus). Los adaptadores driven la implementan.

Un puerto driven merece interfaz cuando tiene IO o quieres sustituirlo en tests. Un
servicio puro del dominio no necesita interfaz.

Detalle: `../hexagonal/ports-and-adapters.md`, `../hexagonal/driving-vs-driven.md`.

## DTOs, commands y queries

- Command: intención de cambiar estado. Datos planos, imperativo (`IssueInvoiceCommand`).
- Query: intención de leer. Devuelve un read model, nunca un agregado.
- DTO de salida: estructura serializable que cruza la frontera. No devuelvas entidades a
  controladores/vistas.

Proporción: un command por caso de uso; DTO de salida solo si el caso de uso devuelve algo.

Detalle: `../application/commands-queries-cqrs.md`, `../application/dtos-and-mapping.md`.

## CQRS ligero

Sin dos bases de datos ni bus obligatorio. Las escrituras pasan por agregado + repositorio;
las lecturas para pantallas usan consultas directas (SQL, query builder, Prisma select)
que devuelven DTOs planos. Proyecciones materializadas solo con lecturas caras o modelos
de lectura muy distintos al de escritura.

Detalle: `../application/read-models-projections.md`.

## Unit of Work

Un caso de uso = una transacción. La abre el handler (o un decorador del bus), no el
controlador ni el repositorio. Dentro: cargar, mutar, guardar. Fuera: publicar eventos,
responder. Si el caso de uso hace un único `save`, la transacción explícita es opcional.

Detalle: `../application/transactions-unit-of-work.md`.

## Regla de dependencias

| Capa | Puede importar | Nunca importa |
|---|---|---|
| Domain | solo Domain (y stdlib) | framework, ORM, HTTP, otras capas |
| Application | Domain, puertos propios | ORM, HTTP, framework (salvo contratos triviales) |
| Infrastructure | Domain, Application, framework, SDKs | - |
| Adaptador driving (`app/`, `routes`) | Application (commands/queries/DTOs), framework | Domain internals, Infrastructure concreta |

Herramientas: deptrac (PHP), dependency-cruiser (TS), import-linter (Python).

Detalle: `../hexagonal/dependency-rules-tooling.md`; errores en `invariants-and-errors.md`.

## Checklist

- [ ] Cada concepto de negocio con reglas es un VO o una entidad, no un primitivo.
- [ ] Cada agregado tiene raíz única, invariantes en sus métodos y referencia a otros por id.
- [ ] Un repositorio por agregado, interfaz en dominio, sin consultas de pantalla.
- [ ] Los eventos se registran en el agregado y se publican tras el commit.
- [ ] Un caso de uso = una intención = una transacción.
- [ ] Las lecturas de pantalla no rehidratan agregados.
- [ ] Ningún import de framework en `Domain`; verificado por herramienta en CI.
