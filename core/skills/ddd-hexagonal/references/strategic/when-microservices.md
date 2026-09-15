# Cuándo (no) pasar a microservicios

## Índice

- [La pregunta correcta](#la-pregunta-correcta)
- [Criterios reales para extraer un servicio](#criterios-reales-para-extraer-un-servicio)
- [Motivos que no justifican la extracción](#motivos-que-no-justifican-la-extracción)
- [Costes que aparecen el primer día](#costes-que-aparecen-el-primer-día)
- [Checklist de "todavía no"](#checklist-de-todavía-no)
- [Camino desde el monolito modular](#camino-desde-el-monolito-modular)
- [Ejemplo: extraer el motor de IA](#ejemplo-extraer-el-motor-de-ia)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Continúa [modular-monolith](modular-monolith.md). Un microservicio es un
[bounded context](bounded-contexts.md) con frontera de despliegue; nunca es un objetivo
por sí mismo.

## La pregunta correcta

No es "¿monolito o microservicios?" sino "¿qué módulo concreto necesita un proceso
propio, y qué problema medible resuelve?". La unidad de decisión es el módulo, uno a
uno. Un sistema sano suele ser un monolito modular con uno o dos servicios extraídos por
motivos concretos.

Regla: la extracción se justifica con un número (latencia, coste, tiempo de despliegue,
personas bloqueadas), no con un adjetivo ("escalable", "moderno", "desacoplado").

## Criterios reales para extraer un servicio

Basta con uno fuerte o dos moderados. Cada criterio con la evidencia que lo respalda:

| Criterio | Evidencia mínima | Ejemplo |
|---|---|---|
| **Equipo propio con ciclo de release distinto** | dos equipos se bloquean mutuamente en despliegues o merges cada semana | equipo de pricing quiere desplegar 5 veces al día; el resto, 1 vez por semana con ventana |
| **Escalado independiente y desigual** | un módulo consume > 50 % de CPU/memoria del proceso en picos y el resto está ocioso, o necesita hardware distinto (GPU) | generación de embeddings, renderizado de PDF masivo |
| **Tecnología distinta necesaria** | la mejor herramienta para el módulo no vive en el runtime principal | orquestación de agentes en Python (LangGraph) junto a Laravel |
| **Aislamiento de fallos** | un fallo del módulo (memoria, bucle, dependencia externa caída) tumba funciones críticas ajenas | integración con un proveedor inestable que agota workers |
| **Requisitos de seguridad o cumplimiento** | datos que deben vivir en red, región o auditoría separada | datos de pago (PCI), datos de salud |
| **SLA distinto** | un módulo necesita 99.95 % y el resto 99.5 %, con on-call distinto | autenticación, motor de checkout |
| **Reutilización por varias aplicaciones** | dos aplicaciones desplegadas por separado necesitan el mismo módulo en tiempo real (no vale una librería) | servicio de identidad usado por web y por app interna |

Si el criterio es "tecnología distinta", la alternativa a evaluar primero es un proceso
worker del mismo repositorio (cola + runtime distinto), no un servicio con API pública.

## Motivos que no justifican la extracción

- "Es DDD / es hexagonal, así que cada contexto es un servicio". No: cada contexto es un
  módulo; el servicio es una decisión de despliegue.
- "Así los equipos no se pisan". Con módulos y linter de dependencias tampoco se pisan;
  si se pisan, el problema es la frontera, no el proceso.
- "Para escalar". Un monolito se escala horizontalmente entero; solo compensa separar
  cuando el desequilibrio de recursos es grande y medido.
- "Para poder reescribir en otro lenguaje". Se puede hacer módulo a módulo dentro del
  mismo despliegue (worker) o cuando de verdad se extraiga.
- "El monolito es lento de desplegar". Casi siempre es un pipeline lento (tests, build,
  imagen), que se arregla sin partir el sistema.
- "El código es un lío". Partir un lío en red da un lío distribuido. Primero
  [modularizar](modular-monolith.md).
- "Lo hace todo el mundo". Los que lo hacen tienen decenas de equipos y plataforma propia.

## Costes que aparecen el primer día

| Área | Lo que hay que construir o pagar |
|---|---|
| Red | latencia por llamada, timeouts, retries, circuit breakers, versionado de API |
| Datos | sin joins ni transacciones cruzadas; consistencia eventual real; duplicación de datos de referencia; outbox |
| Fallos | fallos parciales: el pedido se confirmó pero el stock no se reservó; sagas o compensaciones |
| Observabilidad | trazas distribuidas, correlación de logs, métricas por servicio, dashboards |
| Despliegue | pipeline por servicio, compatibilidad entre versiones desplegadas a la vez, migraciones coordinadas |
| Entorno local | levantar N servicios o simularlos; tests de integración más lentos |
| Seguridad | autenticación servicio a servicio, secretos por servicio, superficie de red |
| Operación | on-call por servicio, coste de infraestructura duplicada (BD, cache, cola por servicio) |
| Organización | contratos entre equipos, gestión de cambios incompatibles, más reuniones de coordinación |

Estimación honesta para un equipo pequeño: el primer servicio extraído cuesta 4-8
semanas de plataforma (CI, observabilidad, red, auth) antes de aportar valor. Los
siguientes, 1-2 semanas cada uno si la plataforma ya existe.

## Checklist de "todavía no"

Si respondes "sí" a tres o más, quédate en el monolito modular:

- [ ] Un solo equipo de desarrollo (o dos que se coordinan en la misma daily).
- [ ] Menos de ~8 desarrolladores tocando el backend.
- [ ] Ningún módulo tiene un consumo de recursos medido que justifique escalar aparte.
- [ ] El despliegue completo tarda < 15 minutos y ocurre al menos a diario.
- [ ] No hay trazas distribuidas ni correlación de logs en producción.
- [ ] Las fronteras entre módulos no están verificadas por linter en CI.
- [ ] Hay lecturas cruzadas de tablas entre módulos sin inventariar.
- [ ] Los listeners de eventos no son idempotentes o no hay outbox.
- [ ] Nadie del equipo ha operado un sistema distribuido en producción.
- [ ] El motivo de extraer no cabe en una frase con un número.

## Camino desde el monolito modular

Cada paso deja el sistema desplegable y se puede revertir.

1. **Elegir un módulo** con criterio fuerte y frontera limpia
   ([modular-monolith](modular-monolith.md) §"Preparar la extracción futura"). Nunca
   empezar por el core.
2. **Aislar la API pública**: todo consumidor usa `Contracts/` con DTOs serializables.
   Añadir un test que falle si algún DTO de `Contracts/` no es serializable a JSON.
3. **Eventos por broker**: los eventos que cruzan la frontera del módulo pasan a un
   broker (Redis Streams, SQS, RabbitMQ) con outbox en el productor e idempotencia en el
   consumidor. Mismo contrato, mismo código de dominio.
4. **Cortar lecturas cruzadas**: cada read model que leía las tablas del módulo pasa a
   consumir su API o a mantener una proyección propia alimentada por eventos.
5. **Adaptador remoto**: en el consumidor, `InventoryApi` gana una implementación HTTP/gRPC
   junto a la in-process. Se conmuta por configuración.
6. **Proceso propio**: el módulo arranca como aplicación separada del mismo repositorio
   (monorepo) con su propio pipeline. Aún comparte BD.
7. **Datos propios**: esquema o BD independiente; migración de datos con doble escritura
   o corte breve; eliminar foreign keys cruzadas.
8. **Observabilidad**: trazas con `traceId` propagado por HTTP y por mensajes de cola
   antes de dar el paso 6 por terminado.

```php
// Paso 5: el consumidor no cambia; solo la implementación inyectada
// Sales/Infrastructure/Providers/SalesServiceProvider.php
$this->app->bind(InventoryApi::class, fn ($app) => config('modules.inventory.remote')
    ? new HttpInventoryApi($app->make(HttpClient::class), config('modules.inventory.base_url'))
    : $app->make(InProcessInventoryApi::class));
```

```ts
// Paso 3: mismo contrato, distinto transporte
const bus: EventBus = process.env.EVENT_TRANSPORT === 'broker'
  ? new OutboxBrokerEventBus(prisma, sqsClient)
  : new InProcessEventBus();
```

## Ejemplo: extraer el motor de IA

Aplicación Laravel con un módulo `Assistant` que orquesta agentes LLM. Motivo medido: el
equipo quiere LangGraph (Python) y las llamadas a LLM de 20-60 s agotan los workers PHP en
picos (criterios: tecnología distinta + aislamiento de fallos).

Decisión por fases:

| Fase | Qué se hace | Qué se evita |
|---|---|---|
| 1 | `Assistant` queda como módulo Laravel con puerto `AgentRunner`; adaptador in-process que llama a la API del LLM | reescribir la UI o la persistencia de conversaciones |
| 2 | Worker Python en el mismo repo consume `RunAgentRequested` de una cola y publica `AgentRunCompleted`; adaptador `QueueAgentRunner` en Laravel | exponer una API HTTP pública del worker; BD propia |
| 3 | Solo si el worker necesita estado propio complejo (memoria vectorial, herramientas): esquema propio y API de consulta `AssistantApi` | mover conversaciones fuera de Laravel mientras la UI las lea desde ahí |

Resultado: un servicio de facto (el worker) con un contrato de dos mensajes, sin API
síncrona, sin BD separada hasta que haga falta. La mayoría de las "necesidades de
microservicio" se resuelven en la fase 2.

## Errores frecuentes

- **Extraer el core primero**: es el módulo con más dependencias y más cambio; el
  peor candidato para aprender.
- **Servicio por entidad** (`users-service`, `orders-service`): acoplamiento de chat entre
  servicios; cada pantalla llama a cinco.
- **BD compartida entre servicios "temporalmente"**: acoplamiento oculto que impide
  desplegar por separado; el temporal se vuelve permanente.
- **Llamadas síncronas en cadena**: la disponibilidad se multiplica (0.99 x 0.99 x 0.99);
  preferir eventos donde sea reacción.
- **Sin outbox ni idempotencia**: mensajes perdidos o duplicados en el primer incidente.
- **Sin trazas distribuidas** antes de extraer: el primer bug tarda días en localizarse.
- **API pública diseñada a partir de tablas**: expone el modelo interno; usar los DTOs de
  `Contracts/` que ya existían en el monolito.
- **Extraer sin criterio numérico**: no se puede saber si funcionó.

## Checklist

- [ ] El motivo de extracción cabe en una frase con un número medible.
- [ ] El módulo cumple los requisitos de extracción de [modular-monolith](modular-monolith.md).
- [ ] La checklist de "todavía no" tiene menos de tres "sí".
- [ ] Existe plataforma mínima: CI por servicio, trazas, correlación de logs, secretos.
- [ ] Eventos con outbox en productor e idempotencia en consumidor.
- [ ] Adaptador remoto conmutable por configuración; se puede volver a in-process.
- [ ] Plan de datos: esquema propio, migración, eliminación de FKs cruzadas.
- [ ] Se ha evaluado antes la alternativa "worker en el mismo repositorio".
- [ ] Hay una métrica de éxito definida y se revisa a los 30 días de la extracción.
