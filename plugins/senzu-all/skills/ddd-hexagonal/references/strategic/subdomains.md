# Subdominios: core, supporting y generic

## Índice

- [Subdominio vs bounded context](#subdominio-vs-bounded-context)
- [Los tres tipos](#los-tres-tipos)
- [Cómo clasificar](#cómo-clasificar)
- [Dónde invertir](#dónde-invertir)
- [Comprar vs construir](#comprar-vs-construir)
- [Cómo afecta a la arquitectura](#cómo-afecta-a-la-arquitectura)
- [Ejemplo: plataforma de reservas](#ejemplo-plataforma-de-reservas)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Complementa [bounded-contexts](bounded-contexts.md): los contextos dicen *dónde* están
las fronteras; los subdominios dicen *cuánto* vale lo que hay dentro.

## Subdominio vs bounded context

- **Subdominio**: área del problema de negocio. Existe aunque no haya software. "Fijar
  precios", "gestionar reservas", "emitir facturas".
- **Bounded context**: área de la solución; un modelo con frontera. Idealmente uno por
  subdominio, pero no siempre (un contexto legacy puede cubrir dos subdominios; un
  subdominio grande puede necesitar dos contextos).

Clasificar subdominios sirve para decidir inversión, no para dibujar carpetas. La
pregunta es "si esto funciona mal, ¿perdemos clientes o solo tiempo?".

## Los tres tipos

| Tipo | Definición | Ventaja competitiva | Cambia | Ejemplos típicos |
|---|---|---|---|---|
| **Core** | lo que hace que el negocio gane frente a alternativas | sí, es la razón de existir | mucho, dirigido por producto | motor de pricing dinámico, algoritmo de matching, flujo de reserva diferencial |
| **Supporting** | necesario para operar el core, específico del negocio, sin diferenciar | no, pero nadie lo vende hecho a medida | moderado | gestión de devoluciones, onboarding de proveedores, reporting interno |
| **Generic** | resuelto por la industria; igual para todos | no | poco, dirigido por estándares | autenticación, facturación fiscal, email transaccional, pagos, PDF |

El mismo subdominio cambia de tipo según la empresa: facturación es generic para una
tienda y core para un SaaS de facturación. Pagos es generic para casi todos y core para
una fintech.

## Cómo clasificar

Tres preguntas por subdominio; la tabla decide:

| Pregunta | Core | Supporting | Generic |
|---|---|---|---|
| ¿Un competidor podría copiarlo comprando un producto? | no | no del todo | sí |
| ¿Lo mencionan ventas/marketing como diferencial? | sí | no | no |
| ¿Cuánto costaría hacerlo "suficientemente bien" con algo existente? | imposible o inaceptable | caro de adaptar | barato |

Método rápido (30 min con dirección o producto): listar capacidades del negocio (salen
del [event storming](event-storming.md) big picture), puntuar 1-5 en "diferenciación" y
"complejidad". Diferenciación alta = core. Baja diferenciación + alta complejidad =
supporting (o generic si existe producto). Baja en ambas = generic.

Revisar la clasificación una vez al año: lo que hoy es core (p. ej. un chatbot) se
vuelve generic cuando el mercado lo ofrece como servicio.

## Dónde invertir

| Recurso | Core | Supporting | Generic |
|---|---|---|---|
| Mejores desarrolladores | aquí | rotación | quien esté libre |
| Tiempo de modelado (event storming, glosario) | completo, iterativo | exprés | ninguno o mínimo |
| Cobertura de tests de dominio | alta, con reglas de negocio como tests | funcional | integración del adaptador |
| Refactor y deuda | pagar pronto | pagar cuando duele | no pagar, sustituir |
| Documentación de decisiones | ADRs | ficha de contexto | README de integración |
| Tolerancia a "hecho rápido" | ninguna | media | alta |

Regla práctica: el 60-70 % del esfuerzo de diseño debe caer en core. Si el sprint está
lleno de tareas de generic (login, PDFs, emails), la clasificación no está guiando la
planificación.

## Comprar vs construir

| Subdominio | Decisión por defecto | Excepciones |
|---|---|---|
| Generic | comprar / librería / SaaS, integrado por ACL | coste prohibitivo, requisito legal de soberanía de datos, el SaaS no cubre un caso obligatorio |
| Supporting | construir simple, o adaptar un producto configurable (CRM, ERP, workflow) | si el producto exige cambiar el proceso de negocio, construir |
| Core | construir, siempre | nunca externalizar la lógica; sí externalizar infraestructura (hosting, colas) |

Criterios para el "comprar" en generic:

- **Coste total**: licencia + integración + migración de salida. Si la salida es
  imposible, sube el riesgo aunque baje el precio.
- **ACL obligatorio**: el modelo del proveedor no entra en tu dominio
  ([context-mapping](context-mapping.md)). Cambiar de proveedor debe ser cambiar un adaptador.
- **Frontera de datos**: qué datos salen a un tercero y con qué base legal.

```php
// Generic (email) comprado y aislado: el dominio solo conoce el puerto
interface NotificationSender { public function send(Notification $n): void; }
final class PostmarkNotificationSender implements NotificationSender { /* SDK aquí */ }
final class LogNotificationSender implements NotificationSender { /* local/dev */ }
```

## Cómo afecta a la arquitectura

DDD táctico completo (agregados, VO, eventos, especificaciones) tiene un coste. Se paga
donde hay reglas que cambian y compiten: core. Fuera de core, se relaja
deliberadamente.

| Aspecto | Core | Supporting | Generic |
|---|---|---|---|
| Modelo de dominio | agregados ricos, VO, eventos, invariantes explícitas | entidades con comportamiento básico; VO donde haya reglas | sin dominio propio; DTOs y adaptador |
| Casos de uso | commands/queries separados, handlers | servicios de aplicación sencillos, puede ser transaction script | controlador -> adaptador |
| Persistencia | repositorio por agregado, mapeo explícito | repositorio o Active Record disciplinado | lo que dé el SDK |
| Tests | unit de dominio + casos de uso + contrato de puertos | casos de uso + integración | integración del adaptador, contract test del proveedor |
| Estructura | `Domain/Application/Infrastructure` completa | mismas carpetas, menos archivos | `Infrastructure/<Provider>/` + puerto |
| Reglas de dependencia | estrictas, linter en error | estrictas | solo "no se importa desde dominio" |

```
src/
  Pricing/        core: Domain/ (PriceList, Rule, Quote, PricingPolicy, 30+ tests), Application/, Infrastructure/
  Returns/        supporting: Domain/ (Return con 3 métodos), Application/ (4 casos de uso), Infrastructure/
  Notifications/  generic: Contracts/NotificationSender.php, Infrastructure/Postmark/, Infrastructure/Log/
  Identity/       generic: adaptador sobre el proveedor de auth; expone UserId, TenantId en shared kernel
```

Un supporting en Laravel puede usar Eloquent como entidad si el equipo lo acepta y el
linter impide que salga del módulo; en core, no. En TypeScript, un generic puede ser una
función que envuelve el SDK sin clases de dominio.

```ts
// Supporting en TS: entidad sencilla, sin eventos ni VO más allá de lo necesario
export class Return {
  private constructor(readonly id: string, private status: 'requested' | 'approved' | 'rejected') {}
  static request(id: string): Return { return new Return(id, 'requested'); }
  approve(): void { if (this.status !== 'requested') throw new Error('Return already decided'); this.status = 'approved'; }
}
```

## Ejemplo: plataforma de reservas

Marketplace de alojamientos con pricing dinámico como propuesta de valor.

| Subdominio | Tipo | Decisión | Arquitectura |
|---|---|---|---|
| Pricing dinámico | core | construir; equipo senior; event storming trimestral | DDD completo; `PricingPolicy`, `Rule`, especificaciones; 200+ tests de reglas |
| Booking (flujo de reserva) | core | construir | DDD completo; `Booking` agregado con invariantes de solape |
| Reviews | supporting | construir simple | entidad `Review`, 3 casos de uso, sin eventos internos |
| Onboarding de anfitriones | supporting | construir sobre workflow configurable | casos de uso + estado; sin VO complejos |
| Pagos | generic | Stripe vía ACL | puerto `PaymentGateway`, adaptador, contract test |
| Facturación fiscal | generic | SaaS de facturación vía ACL | evento `BookingCompleted` -> adaptador que crea factura |
| Identidad | generic | proveedor de auth | `UserId` en shared kernel; conformist |
| Email / SMS | generic | Postmark/Twilio | puerto `NotificationSender` |

Consecuencia en planificación: dos equipos en core, uno rotando por supporting, y generic
se resuelve con integraciones de una semana cada una. Si aparece "necesitamos un motor de
facturación propio", la pregunta es si facturación ha pasado a ser core o si el SaaS
elegido no cubre un caso (cambiar de SaaS antes que construir).

## Errores frecuentes

- **Tratar todo como core**: DDD completo en login y PDFs; el esfuerzo de modelado se
  diluye y el core queda igual de pobre que el resto.
- **Tratar el core como generic**: comprar un motor de pricing cuando el pricing es el
  diferencial; se pierde el control del negocio.
- **Clasificar por tamaño de código** en vez de por valor: un core puede ser pequeño.
- **Construir generic "porque es fácil"**: auth, PDF y email nunca son fáciles en el
  tiempo; el coste es mantenimiento, no la primera versión.
- **Comprar sin ACL**: el modelo del SaaS acaba en el dominio y la salida es un rewrite.
- **No revisar la clasificación**: lo que era diferencial hace tres años ahora lo tiene
  todo el mercado.
- **Mezclar core y supporting en un contexto** para "reutilizar": el supporting acaba
  frenando el ritmo del core.

## Checklist

- [ ] Lista de subdominios con tipo (core/supporting/generic) acordada con producto.
- [ ] Justificación de cada core en una frase ("gana clientes porque...").
- [ ] Todo generic tiene decisión comprar/construir documentada y ACL si se compra.
- [ ] El esfuerzo de modelado (event storming, glosario, tests de dominio) se concentra
      en core.
- [ ] Cada contexto tiene nivel de rigor explícito en su ficha (DDD completo / simple /
      adaptador).
- [ ] Ningún módulo generic contiene reglas de negocio propias.
- [ ] La clasificación tiene fecha de revisión (anual o al cambiar la estrategia).
