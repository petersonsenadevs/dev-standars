# Clean, Onion, Hexagonal, Vertical Slices y Screaming: comparación

## Índice

- [Las cinco en una tabla](#las-cinco-en-una-tabla)
- [Qué comparten y en qué difieren realmente](#qué-comparten-y-en-qué-difieren-realmente)
- [Hexagonal](#hexagonal)
- [Clean y Onion](#clean-y-onion)
- [Vertical Slices](#vertical-slices)
- [Screaming Architecture](#screaming-architecture)
- [Combinar hexagonal con vertical slices](#combinar-hexagonal-con-vertical-slices)
- [Cuándo cada una](#cuándo-cada-una)
- [Decisión para el equipo](#decisión-para-el-equipo)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `folder-structures.md`, `ports-and-adapters.md`, `../strategic/overview.md`.

## Las cinco en una tabla

| | Autor / año | Idea central | Unidad de organización | Qué prescribe sobre carpetas |
|---|---|---|---|---|
| Hexagonal (Ports & Adapters) | Cockburn, 2005 | la aplicación no conoce el exterior; puertos + adaptadores | dentro/fuera | nada |
| Onion | Palermo, 2008 | anillos concéntricos: dominio en el centro, infra fuera; dependencias hacia dentro | capas | anillos (Domain Model, Domain Services, Application Services, Infra/UI) |
| Clean | Martin, 2012 | igual que Onion con nombres propios: Entities, Use Cases, Interface Adapters, Frameworks | capas | cuatro círculos; regla de dependencia |
| Vertical Slices | Bogard, 2018 | organizar por feature (request -> handler -> respuesta), minimizar abstracciones compartidas | feature | una carpeta por feature con todo dentro |
| Screaming | Martin, 2011 | la estructura de alto nivel grita el dominio, no el framework | contexto/caso de uso | primer nivel = negocio |

## Qué comparten y en qué difieren realmente

Comparten: **la regla de dependencia** (el dominio no depende de infraestructura) y la
**inversión** mediante interfaces. Hexagonal, Onion y Clean son, en la práctica, la misma
arquitectura con distinto vocabulario y distinto número de capas dibujadas. Las diferencias
que sí importan:

- Hexagonal no distingue capas internas; Onion/Clean sí (dominio vs casos de uso).
  DDD táctico aporta esa distinción a hexagonal, y por eso este estándar usa
  `Domain/Application/Infrastructure`.
- Clean introduce "Interface Adapters" (presenters, controllers, gateways) como capa
  propia; en hexagonal son simplemente adaptadores driving/driven.
- Vertical Slices es ortogonal: habla de **cómo agrupar**, no de **hacia dónde
  dependen**. Puede ignorar la regla de dependencia (cada slice toca la BD directamente)
  o respetarla.
- Screaming es una regla de nombrado del primer nivel, compatible con todas.

## Hexagonal

Fortalezas: simple de explicar (dos preguntas: ¿quién llama? ¿qué implementa?), testable
por construcción, independiente de carpetas, encaja con cualquier framework.
Debilidades: no dice cómo estructurar el interior; sin DDD, el "interior" acaba siendo
un `Service` gigante. Por eso se combina con DDD táctico.

## Clean y Onion

Fortalezas: vocabulario ampliamente conocido; separación explícita entidades/casos de
uso. Debilidades típicas en la práctica: **exceso de capas y de DTOs** (request model,
response model, presenter, view model, gateway interface... por cada endpoint), aplicación
dogmática de "una interfaz por clase", y estructura por capa en el primer nivel
(`Entities/`, `UseCases/`, `Adapters/`) que dispersa cada feature en cinco carpetas.

Lo que tomamos de Clean: la regla de dependencia y el nombre "caso de uso". Lo que no:
presenters obligatorios, interfaces para todo, primer nivel por capa.

## Vertical Slices

```
Features/
  IssueInvoice/     IssueInvoiceRequest.cs, IssueInvoiceHandler.cs, IssueInvoiceEndpoint.cs, IssueInvoiceValidator.cs
  ListInvoices/     ListInvoicesQuery.cs, ListInvoicesHandler.cs (SQL directo), ...
```

Fortalezas: alta cohesión por feature; añadir/borrar una feature es local; cada slice
elige su nivel de complejidad (un listado puede ser SQL directo; una operación con reglas
puede usar un agregado). Debilidades: sin disciplina, cada slice reimplementa reglas que
deberían estar en un agregado compartido; duplicación de acceso a datos; las reglas de
dependencia entre slices son difíciles de verificar; el "dominio" deja de existir como
concepto y las invariantes se reparten.

Vertical Slices funciona muy bien en CRUD complejo y APIs de muchas features pequeñas;
funciona mal cuando hay invariantes ricas que varias features comparten.

## Screaming Architecture

Regla única: el primer nivel de `src/` lista contextos/capacidades de negocio
(`Invoicing`, `Shipping`, `Identity`), no `Controllers`, `Models`, `Services`. Ya está
incorporada en `folder-structures.md`. Su valor es orientación: un desarrollador nuevo
encuentra "facturación" sin conocer el framework.

## Combinar hexagonal con vertical slices

Es la combinación adoptada y funciona así:

```
src/Invoicing/
  Domain/                        <- compartido por todas las slices del contexto
  Application/
    IssueInvoice/                <- slice: command + handler (+ DTO de salida)
    RegisterPayment/             <- slice
    Query/ListPendingInvoices/   <- slice de lectura: query + reader interface + row DTO
  Infrastructure/
    Http/IssueInvoiceController.php, Http/IssueInvoiceRequest.php   <- parte "adaptador" de la slice
    Persistence/...              <- compartido
```

- **Slice** = un caso de uso: su command, handler, DTO, request/controlador, y sus tests.
  Se lee y se borra como unidad aunque físicamente esté en dos carpetas (Application e
  Infrastructure/Http).
- **Dominio compartido** por contexto: los agregados y sus invariantes no se duplican
  por slice. Aquí está la corrección a Vertical Slices puro.
- **Lecturas como slices ligeras**: query + lector SQL, sin agregado. Aquí está la
  corrección a Clean dogmático.
- Variante aceptable si el equipo prefiere co-localizar: `Application/IssueInvoice/`
  contiene también `IssueInvoiceController.php` y `IssueInvoiceRequest.php`; deptrac
  entonces usa regex por sufijo (`Controller`, `Request`) para asignarlos a la capa
  Infrastructure. Más cohesión, reglas algo más frágiles.

## Cuándo cada una

| Situación | Elección |
|---|---|
| CRUD con pocas reglas, equipo pequeño, vida corta | MVC del framework o Vertical Slices sin dominio; no hexagonal |
| Reglas de negocio reales, varios adaptadores (web + jobs + API), vida larga | Hexagonal + DDD táctico + slices en Application (este estándar) |
| Muchas features pequeñas independientes, pocas invariantes compartidas | Vertical Slices con disciplina de acceso a datos |
| Equipo con cultura Clean/Onion establecida | Clean con las simplificaciones de arriba; el resultado es equivalente |
| Microservicio de un solo agregado | Hexagonal mínimo: domain + 2-3 casos de uso + adaptadores; sin subcarpetas si cabe en 10 archivos |

## Decisión para el equipo

Adoptado: **hexagonal + DDD táctico, organizado por contexto (screaming), con Application
agrupada por caso de uso (vertical slice) y CQRS ligero para lecturas.**

Justificación en una línea cada una:
- Hexagonal: testabilidad y sustitución de adaptadores sin ceremonia.
- DDD táctico: las invariantes viven en agregados, no repartidas por handlers.
- Screaming: navegación por negocio.
- Slices en Application: cohesión por intención; borrar una feature es borrar una carpeta.
- CQRS ligero: las lecturas no deforman el dominio.

No adoptado: presenters/view models obligatorios, interfaces para servicios puros, primer
nivel por capa, dos bases de datos, event sourcing por defecto.

## Errores frecuentes

- Debatir "Clean vs Hexagonal" como si fueran distintas: son la misma regla con distintos
  dibujos. La decisión real es dónde va cada cosa y cuánta ceremonia.
- Clean dogmático: 7 archivos por endpoint trivial.
- Vertical Slices puro con SQL en cada slice y reglas duplicadas.
- Capas por primer nivel (`src/Domain`, `src/Application`) que mezclan contextos.
- Aplicar la arquitectura completa a un CRUD de configuración.
- Cambiar de estilo por módulo sin documentarlo: un módulo Clean, otro slices, otro MVC.

## Checklist

- [ ] El equipo sabe que Clean/Onion/Hexagonal comparten la regla de dependencia.
- [ ] Primer nivel por contexto; segundo por capa; Application por caso de uso.
- [ ] Dominio compartido por contexto; nunca duplicado por slice.
- [ ] Lecturas como slices ligeras sin agregado.
- [ ] Sin presenters/view models salvo necesidad concreta.
- [ ] CRUD sin reglas queda en el framework, fuera de los módulos.
- [ ] La decisión y sus excepciones están escritas en el ADR del proyecto.
