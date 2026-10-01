# Event storming: big picture y process level en una sesión

## Índice

- [Cuándo y qué formato](#cuándo-y-qué-formato)
- [Materiales y roles](#materiales-y-roles)
- [Colores y significado](#colores-y-significado)
- [Big picture (45-60 min)](#big-picture-45-60-min)
- [Process level (45-60 min)](#process-level-45-60-min)
- [De post-its a artefactos de código](#de-post-its-a-artefactos-de-código)
- [Salida en markdown](#salida-en-markdown)
- [Ejemplo: devoluciones de una tienda](#ejemplo-devoluciones-de-una-tienda)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

[overview](overview.md) §5 describe la versión exprés de 90 minutos para una feature.
Este documento cubre la sesión completa en dos niveles (90-120 min) y, sobre todo, cómo
convertir el tablero en agregados, comandos, políticas y read models.

## Cuándo y qué formato

| Situación | Formato | Duración |
|---|---|---|
| Producto nuevo o dominio desconocido para el equipo | big picture + process level | 2 h (o dos sesiones de 1 h) |
| Feature grande que cruza varios contextos | process level sobre el flujo afectado | 60-90 min |
| Feature dentro de un contexto conocido | exprés ([overview](overview.md) §5) | 45-90 min |
| Refactor de legacy sin documentación | big picture sobre el sistema actual | 90 min |

No sirve para: decidir campos de tablas, elegir tecnología, estimar. Si la conversación
va ahí, el facilitador la aparca en un post-it rojo.

## Materiales y roles

- **Tablero**: pared con papel continuo (mínimo 4 m) o FigJam/Miro con plantilla de
  colores fija. Digital funciona si todos escriben a la vez.
- **Post-its**: naranja, azul, amarillo pequeño, amarillo grande, lila, verde, rosa, rojo.
- **Participantes** (4-8): al menos una persona que viva el proceso (ventas, operaciones,
  soporte); 2-4 desarrolladores; un facilitador que no modela.
- **Facilitador**: mantiene el ritmo, no opina sobre el modelo, convierte discusiones
  largas en post-its rojos, garantiza que negocio escribe tanto como desarrollo.
- **Escriba**: fotografía cada fase y redacta la salida en markdown antes de 24 h.

## Colores y significado

| Color | Elemento | Forma | Ejemplo |
|---|---|---|---|
| Naranja | Evento de dominio | pasado, sujeto de negocio | "Devolución aprobada" |
| Azul | Comando | imperativo | "Aprobar devolución" |
| Amarillo pequeño | Actor | rol o persona | "Agente de soporte" |
| Amarillo grande | Agregado | sustantivo que decide | "Devolución" |
| Lila | Política | "cuando X, entonces Y" | "Cuando devolución aprobada, entonces generar etiqueta" |
| Verde | Read model | datos que el actor necesita para decidir | "Detalle de pedido con líneas devolubles" |
| Rosa | Sistema externo | proveedor, SaaS, legacy | "Transportista", "Pasarela de pago" |
| Rojo | Hotspot | duda, conflicto, decisión pendiente | "¿Se devuelve el envío original?" |

Gramática de lectura, de izquierda a derecha: `[read model] -> actor -> comando ->
agregado -> evento -> política -> comando...`. Si un elemento no encaja en esa frase,
está mal clasificado.

## Big picture (45-60 min)

| Min | Paso | Instrucción |
|---|---|---|
| 0-5 | Alcance | una frase: "desde que el cliente solicita devolver hasta que recibe el reembolso" |
| 5-25 | Tormenta de eventos | todos escriben eventos en naranja, sin hablar, sin filtrar. Objetivo: 40-100 |
| 25-35 | Línea temporal | ordenar de izquierda a derecha; fusionar duplicados; eliminar los que no son hechos |
| 35-45 | Pivotes y sistemas | marcar eventos pivote (cambio de fase) con línea vertical; añadir sistemas externos en rosa |
| 45-55 | Hotspots y actores | cada persona señala lo que no entiende o donde discrepa (rojo); actores en amarillo |
| 55-60 | Contextos candidatos | rodear zonas por vocabulario y actor; anotar nombre provisional |

Reglas del facilitador: nadie corrige el post-it de otro (se añade uno al lado); un
evento que nadie puede explicar se marca rojo, no se borra; si hay debate > 2 min, rojo y
seguir.

## Process level (45-60 min)

Se toma un tramo del big picture (entre dos pivotes) y se completa la gramática.

| Min | Paso | Instrucción |
|---|---|---|
| 0-15 | Comandos y actores | delante de cada evento, el comando (azul) y quién lo lanza (amarillo). Eventos sin comando: vienen de una política o de un sistema externo |
| 15-30 | Políticas | detrás de cada evento, "cuando X, entonces Y" (lila). Decidir si es automática o requiere humano |
| 30-40 | Agregados | agrupar comando + evento por "la cosa que decide si el comando es válido" (amarillo grande). Un agregado, una columna |
| 40-50 | Read models | delante de cada comando, qué datos necesita el actor para decidir (verde) |
| 50-60 | Recorrido | leer la línea completa en voz alta como historia; cada tropiezo es un hotspot |

Pregunta clave para nombrar el agregado: "¿qué tiene que estar cargado en memoria para
decidir si este comando se acepta?". Si son dos cosas, hay dos agregados y una política
entre ellos, o el límite está mal.

## De post-its a artefactos de código

| Post-it | Artefacto | Ubicación |
|---|---|---|
| Evento naranja | clase de evento de dominio, pasado | `Domain/Event/ReturnApproved.php` |
| Comando azul | command + handler (caso de uso) | `Application/ApproveReturn/` |
| Agregado amarillo grande | raíz con un método por comando | `Domain/Return.php` con `approve()`, `reject()` |
| Política lila | listener/subscriber que lanza otro comando | `Application/Policy/GenerateLabelOnReturnApproved.php` |
| Read model verde | query + DTO plano | `Application/Query/GetReturnableLines.php` |
| Sistema externo rosa | puerto + adaptador (ACL) | `Domain/CarrierGateway.php`, `Infrastructure/Carrier/` |
| Actor amarillo | autorización en el adaptador driving | policy/guard del controlador |
| Hotspot rojo | ADR pendiente o ticket | `docs/decisions/` o backlog |
| Contexto rodeado | módulo raíz | `src/Returns/` |

Los eventos que cruzan la línea de un contexto son candidatos a published language
([context-mapping](context-mapping.md)); los que se quedan dentro son eventos de dominio
internos. Las políticas que cruzan contextos son las integraciones del mapa.

```ts
// Política lila -> handler que traduce evento en comando
export class GenerateLabelOnReturnApproved {
  constructor(private readonly generateLabel: GenerateReturnLabel) {}
  async handle(event: ReturnApproved): Promise<void> {
    await this.generateLabel.execute({ returnId: event.returnId });
  }
}
```

## Salida en markdown

Un archivo por sesión en `docs/event-storming/<fecha>-<alcance>.md`:

```markdown
# Event storming: Devoluciones (2026-08-25)

Alcance: desde solicitud de devolución hasta reembolso. Participantes: ...
Foto del tablero: ./2026-08-25-returns.png

## Línea temporal (tabla por tramo)
| # | Read model | Actor | Comando | Agregado | Evento | Política -> comando | Contexto |
|---|---|---|---|---|---|---|---|
| 1 | Pedido con líneas devolubles | Cliente | Solicitar devolución | Return | ReturnRequested | Cuando ReturnRequested -> Evaluar elegibilidad | Returns |
| 2 | Política de devoluciones | (auto) | Evaluar elegibilidad | Return | ReturnApproved / ReturnRejected | Cuando ReturnApproved -> Generar etiqueta | Returns |
| 3 | — | (auto) | Generar etiqueta | Shipment | ReturnLabelGenerated | Cuando ReturnLabelGenerated -> Notificar cliente | Logistics |

## Contextos identificados
- Returns (core): Return, ReturnPolicy. Publica ReturnApproved, ReturnReceived.
- Logistics (supporting): Shipment. Consume ReturnApproved.
- Billing (supporting): Refund. Consume ReturnReceived.

## Sistemas externos
- Transportista (rosa): ACL `CarrierGateway`.

## Hotspots
- [ ] ¿Se reembolsa el envío original? (negocio decide antes del 2026-09-01)
- [ ] ¿Devolución parcial de un pack? (posible agregado `PackReturn` o regla en `Return`)

## Decisiones tomadas en sesión
- La elegibilidad es automática; el agente solo interviene en rechazos apelados.
```

De esta tabla salen directamente la ficha de contexto ([overview](overview.md) §8), el
glosario ([ubiquitous-language](ubiquitous-language.md)) y el esqueleto de directorios.

## Ejemplo: devoluciones de una tienda

Fragmento del tablero tras process level, en la gramática de lectura:

```
[Pedido con líneas devolubles] -> Cliente -> Solicitar devolución -> {Return}
  -> ReturnRequested
    -> cuando ReturnRequested entonces Evaluar elegibilidad -> {Return} -> ReturnApproved | ReturnRejected
      -> cuando ReturnApproved entonces Generar etiqueta -> {Shipment} -> ReturnLabelGenerated -> (Transportista)
      -> cuando ReturnRejected entonces Notificar rechazo -> (Email)
[Etiqueta y estado] -> Almacén -> Registrar recepción -> {Return} -> ReturnReceived
    -> cuando ReturnReceived entonces Emitir reembolso -> {Refund} -> RefundIssued -> (Pasarela)
```

Lo que se decide leyendo esto:

- `Return` es el agregado core: recibe `request`, `approve`, `reject`, `markReceived`.
- `Shipment` y `Refund` son agregados de otros contextos; se integran por eventos.
- `ReturnPolicy` (elegibilidad) es un servicio de dominio con reglas (plazo, estado del
  pedido, categoría), no un agregado: no tiene ciclo de vida.
- El read model "líneas devolubles" cruza Sales y Returns: query en Returns que lee la
  tabla de pedidos (lectura permitida, escritura no).

## Errores frecuentes

- **Eventos que son comandos o pantallas**: "Cliente pulsa devolver" no es un hecho de
  negocio; "Devolución solicitada" sí.
- **Eventos técnicos**: "Registro insertado", "Email enviado" (salvo que enviar el email
  sea negocio, p. ej. notificación legal).
- **Saltar al modelo de datos**: campos, tipos, tablas. Se aparcan en rojo.
- **Un solo participante escribe**: el facilitador debe conseguir que negocio escriba.
- **Agregado = tabla existente**: el agregado se nombra por lo que decide, no por lo que
  hay hoy en la base de datos.
- **Políticas ocultas en el agregado**: "al aprobar, generar etiqueta" dentro de
  `Return::approve()` acopla contextos; es una política lila.
- **Sesión sin salida escrita**: la foto sin la tabla se olvida en una semana.
- **Ignorar los hotspots**: son las decisiones de diseño reales; cada uno necesita dueño y
  fecha.

## Checklist

- [ ] Alcance en una frase y participantes con al menos una persona de negocio.
- [ ] Big picture: 40+ eventos en pasado, ordenados, con pivotes y sistemas externos.
- [ ] Process level: cada evento tiene comando o política que lo provoca.
- [ ] Cada comando tiene un agregado que decide y (si aplica) un read model delante.
- [ ] Políticas expresadas como "cuando X, entonces Y" y clasificadas auto/humano.
- [ ] Contextos rodeados y nombrados; eventos que cruzan fronteras marcados.
- [ ] Hotspots listados con dueño y fecha de decisión.
- [ ] Salida en markdown en el repo antes de 24 h, con foto del tablero.
- [ ] Esqueleto de directorios y ficha de contexto derivados de la tabla.
