# Árboles de decisión

## Índice
1. Cómo usar estos árboles
2. ¿DDD/hexagonal o capas simples?
3. ¿Entidad o value object?
4. ¿Agregado nuevo o parte de otro?
5. ¿Servicio de dominio o método de agregado?
6. ¿Evento síncrono o asíncrono?
7. ¿Repositorio o consulta directa (read model)?
8. ¿Módulo o bounded context?
9. ¿Monolito modular o servicio aparte?
10. ¿Result o excepción?
11. Resumen en una tabla

---

## 1. Cómo usar estos árboles

Cada árbol es una secuencia de preguntas sí/no. Se responde en orden; la primera salida que
se alcanza es la decisión. Si una pregunta no se puede responder, la respuesta por defecto
es la opción más simple (menos abstracción, menos piezas). Anota la decisión en un ADR
(`templates/docs/adr.md`) si afecta a más de un módulo.

## 2. ¿DDD/hexagonal o capas simples?

```
P1 ¿Hay reglas con estados, límites o cálculos que un test de formulario no cubre?
   no -> SALIDA: capas simples (controlador -> action -> modelo). Fin.
   sí -> P2
P2 ¿Se cumplen al menos 3 de la checklist de SKILL.md §1 (invariantes, varios contextos
   o integraciones, vida > 1 año o equipo > 2, testear sin BD, ya duele)?
   no -> SALIDA: capas simples + VO para los primitivos con reglas (Money, Email). Fin.
   sí -> P3
P3 ¿El módulo tiene más de un agregado o una integración externa que aislar?
   no -> SALIDA: hexagonal ligero: un agregado, un repositorio, casos de uso, sin mapa de contextos.
   sí -> SALIDA: DDD completo: contexto nombrado, glosario, agregados, puertos, eventos, reglas de dependencia.
```

## 3. ¿Entidad o value object?

```
P1 ¿Dos instancias con los mismos atributos son "la misma cosa" para el negocio?
   sí -> P2
   no -> SALIDA: entidad (tiene identidad, ciclo de vida, se referencia por id).
P2 ¿Alguien necesita seguir su historia (cambió de X a Y) o referenciarla desde fuera?
   sí -> SALIDA: entidad.
   no -> P3
P3 ¿Tiene alguna regla de validación u operación (sumar, comparar, formatear)?
   sí -> SALIDA: value object inmutable con validación en constructor.
   no -> SALIDA: primitivo (string/int). No crees un VO sin reglas.
```

Ejemplos: `Money`, `InvoiceNumber`, `Address` -> VO. `InvoiceLine` con id que se edita
por separado -> entidad. `Payment` que nunca se modifica ni se referencia -> VO.

## 4. ¿Agregado nuevo o parte de otro?

```
P1 ¿Debe cambiar en la misma transacción que la raíz candidata para que una invariante
   se cumpla (p. ej. total de la factura = suma de líneas)?
   sí -> SALIDA: dentro del agregado existente (entidad hija o VO).
   no -> P2
P2 ¿Tiene ciclo de vida propio: se crea, cambia o se borra sin tocar la raíz?
   sí -> SALIDA: agregado nuevo; referencia por id; coordinación por eventos.
   no -> P3
P3 ¿Cargarlo junto a la raíz haría el agregado grande (cientos de filas, varios joins)
   o generaría conflictos de concurrencia entre usuarios que editan cosas distintas?
   sí -> SALIDA: agregado nuevo aunque parezca "parte de".
   no -> SALIDA: dentro del agregado existente.
```

Ejemplo: `InvoiceSequence` es agregado propio (P2: cambia con cada factura, bloquea por
serie). `InvoiceLine` está dentro (P1: el total es una invariante).

## 5. ¿Servicio de dominio o método de agregado?

```
P1 ¿La regla necesita datos de un único agregado (y sus VO)?
   sí -> SALIDA: método del agregado con nombre de negocio. Fin.
   no -> P2
P2 ¿Necesita IO (cargar otro agregado, llamar a un puerto)?
   sí -> SALIDA: caso de uso (aplicación) que carga lo necesario y llama a métodos/servicios puros.
   no -> P3
P3 ¿La regla combina dos o más agregados/VO ya cargados, sin efectos?
   sí -> SALIDA: servicio de dominio sin estado (PricingPolicy::priceFor(product, customer)).
   no -> SALIDA: función pura junto al VO afectado.
```

Señal de alarma: un servicio de dominio con un solo parámetro de tipo agregado casi siempre
es un método que se escapó del agregado.

## 6. ¿Evento síncrono o asíncrono?

```
P1 ¿El consumidor hace IO externo (email, HTTP, cola, otro sistema)?
   sí -> SALIDA: asíncrono (listener en cola, afterCommit). Reintentable e idempotente.
   no -> P2
P2 ¿Si el consumidor falla, la operación original debe fallar también?
   sí -> P3
   no -> SALIDA: asíncrono o síncrono tras commit; elige síncrono solo si es barato.
P3 ¿El consumidor escribe en otro agregado del mismo contexto?
   sí -> SALIDA: revisa el límite del agregado (§4). Si sigue siendo otro agregado, evento
         síncrono dentro de la transacción es aceptable solo con ADR; lo habitual es asíncrono + compensación.
   no -> SALIDA: no es un evento; es parte del mismo método del agregado.
```

Entre contextos: siempre asíncrono, con outbox si se necesita garantía de entrega.

## 7. ¿Repositorio o consulta directa (read model)?

```
P1 ¿El resultado se va a mutar (llamar a métodos de negocio y guardar)?
   sí -> SALIDA: repositorio; devuelve el agregado completo.
   no -> P2
P2 ¿Lo pide una pantalla, un listado, un export o un informe?
   sí -> SALIDA: read model (reader con query builder/SQL) que devuelve DTO plano.
   no -> P3
P3 ¿Lo usa un caso de uso para decidir (p. ej. "facturas vencidas a fecha")?
   sí -> SALIDA: método de repositorio con nombre de dominio (overdueAt) que devuelve agregados.
   no -> SALIDA: read model.
```

Nunca: paginar en el repositorio, devolver arrays de filas desde el repositorio, rehidratar
agregados para pintar una tabla.

## 8. ¿Módulo o bounded context?

```
P1 ¿El mismo término (Cliente, Producto, Pedido) significa cosas distintas o tiene
   atributos distintos para dos grupos de usuarios?
   sí -> SALIDA: dos bounded contexts, cada uno con su modelo y su glosario.
   no -> P2
P2 ¿Hay un equipo o un stakeholder distinto que decide las reglas?
   sí -> SALIDA: bounded context propio (aunque hoy lo programe el mismo equipo).
   no -> P3
P3 ¿Son más de ~10 agregados o hay integraciones externas que solo esa parte usa?
   sí -> SALIDA: separar en contextos por capacidad de negocio.
   no -> SALIDA: un contexto, varios módulos técnicos (carpetas) si ayuda a la navegación.
```

Un módulo es una carpeta; un contexto es una frontera de modelo y lenguaje. Todo contexto
es un módulo; no todo módulo es un contexto.

## 9. ¿Monolito modular o servicio aparte?

```
P1 ¿Existe ya la frontera de contexto con reglas de dependencia verificadas (deptrac,
   dependency-cruiser, import-linter) en verde?
   no -> SALIDA: monolito modular. Primero la frontera lógica; nunca extraer sin ella.
   sí -> P2
P2 ¿Hay una razón operativa concreta: escalado independiente, despliegue por otro equipo,
   requisito de aislamiento (datos, lenguaje, runtime)?
   no -> SALIDA: monolito modular. La modularidad ya está; el servicio solo añade red.
   sí -> P3
P3 ¿La comunicación con el resto cabe en eventos asíncronos y una API pequeña, sin
   transacciones compartidas?
   sí -> SALIDA: servicio aparte, con outbox y contratos versionados.
   no -> SALIDA: monolito modular; el corte propuesto está mal (revisa §8).
```

## 10. ¿Result o excepción?

```
P1 ¿Es un error esperado de negocio (regla violada, estado incorrecto, no encontrado)?
   no -> SALIDA: excepción (bug, infraestructura caída, contrato roto). Se propaga.
   sí -> P2
P2 ¿El resultado cruza una frontera serializada (Server Action -> cliente, JSON de API)?
   sí -> SALIDA: Result tipado (TypeScript). El adaptador lo devuelve tal cual.
   no -> P3
P3 ¿El stack tiene convención fuerte de excepciones tipadas mapeadas en un handler global
   (Laravel, FastAPI)?
   sí -> SALIDA: excepción de dominio con `code()` estable; el adaptador la mapea a HTTP.
   no -> SALIDA: Result. Sé consistente por stack; no mezcles en el mismo módulo.
```

## 11. Resumen en una tabla

| Pregunta | Regla corta |
|---|---|
| DDD o capas simples | 3 de 5 en la checklist; si no, capas simples + VO |
| Entidad o VO | identidad y ciclo de vida -> entidad; igualdad por valor -> VO |
| Agregado nuevo | invariante transaccional -> dentro; ciclo de vida propio -> fuera |
| Servicio de dominio | varios agregados sin IO; con IO es caso de uso |
| Evento | IO externo o entre contextos -> asíncrono tras commit |
| Repositorio o read model | se muta -> repositorio; se muestra -> read model |
| Módulo o contexto | lenguaje distinto -> contexto |
| Servicio aparte | solo con frontera verificada y razón operativa |
| Result o excepción | TS y fronteras serializadas -> Result; PHP/Python -> excepción tipada |
