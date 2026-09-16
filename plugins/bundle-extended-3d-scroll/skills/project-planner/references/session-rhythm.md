# Ritmo de trabajo por sesión

Una sesión es una conversación con el agente. Empieza leyendo el estado, avanza una tarea (o
varias si hay permiso para encadenar) y termina dejando el plan al día y un resumen que se
entiende sin leer el hilo. Este documento fija ese ritmo.

## Índice

- [Al empezar](#al-empezar)
- [Durante la sesión](#durante-la-sesión)
- [Al cerrar](#al-cerrar)
- [Resumen final](#resumen-final)
- [Peticiones fuera del plan](#peticiones-fuera-del-plan)
- [Sesiones especiales](#sesiones-especiales)
- [Antipatrones](#antipatrones)
- [Checklist](#checklist)

## Al empezar

Orden fijo, 2-3 minutos, antes de tocar código:

1. **Leer el estado inyectado por el hook** (si dev-standards lo inyecta al inicio: stack,
   skills, última entrada de devlog, tarea en curso). Si no hay hook, leer a mano:
   `.dev-standards.json`, última entrada de `devlog/`, `git status` y `git log --oneline -5`.
2. **Leer la cabecera y la tabla `## Fases` de `plan/PLAN.md`**: estado, fase en curso y su
   tarjeta `[doing]`. Después, solo la sección de la fase en curso; no releer todo el plan.
3. **Comprobar coherencia**: `grep -c '\[doing\]' plan/PLAN.md` debe ser 0 o 1. Si hay una
   tarea `doing` de una sesión anterior, decidir: continuarla, dividirla o pasarla a `blocked`.
   `git status` limpio; si hay cambios sin commit, entenderlos antes de seguir.
4. **Elegir la tarea** según `task-protocol.md` paso 8 (dependencias `done`, fase en curso,
   riesgo primero).
5. **Anunciar en una línea**: "Sesión: F2-T1 (M) Generar PDF de factura. Skill:
   code-quality §references/php-laravel 'Arquitectura: controladores, Form Requests, Actions y Services'. Empiezo." Si el usuario dio otra instrucción, ver
   "Peticiones fuera del plan".

Si no existe `plan/PLAN.md` y la petición no es trivial: descubrimiento -> brief -> plan
(`discovery.md`, `brief-and-scope.md`, `plan-format.md`) antes de cualquier tarea.

## Durante la sesión

- Una tarea a la vez, siguiendo los ocho pasos de `task-protocol.md`.
- Leer solo la skill/sección de la tarjeta.
- Verificación real antes de declarar nada hecho; la salida se pega en el devlog.
- Devlog y commit al cerrar la tarea, no "al final de la sesión" (se olvida).
- Si la sesión da para más y el usuario ha dicho "sigue" o "encadena", pasar a la siguiente
  tarea con el mismo protocolo. Sin ese permiso, se propone y se espera.
- Cada 2-3 tareas encadenadas, pausa de estado: una línea con progreso y siguiente paso, por
  si el usuario quiere redirigir.
- Cambios de plan durante la sesión: `replanning-and-risks.md`; nunca en silencio.

Presupuesto orientativo: una sesión = 1 tarea M o 2-3 tareas S. Si la tarea no va a caber,
dividir en la primera hora, no en la última.

## Al cerrar

Antes del último mensaje, en este orden:

1. **Estado del plan**: tarjeta(s) en `[done]`/`[blocked]`; ninguna `[doing]` (o una sola, si
   queda algo a medias y bien delimitado en "Notas"); tabla `## Fases` y fecha "Actualizado".
2. **Devlog**: entrada por tarea creada en `devlog/<YYYY-MM-DD>/NNN-<slug>.md`; si hubo trabajo
   sin tarea (spike, exploración), una entrada de sesión. `devlog/INDEX.md` actualizado.
3. **Commits**: todo el trabajo verificado está commiteado, cada commit con `Tarea: <id>` en el cuerpo. Trabajo no verificado no se
   commitea como `feat`; se guarda como `wip:` en rama o se descarta con nota.
4. **Siguiente tarea propuesta**: id, tamaño, título, skill, y si tiene dependencias
   pendientes.
5. **Preguntas al usuario**: solo las que bloquean o cambian alcance, cada una con default.
6. **Resumen final** (siguiente sección).

Nunca cerrar con una tarea `doing` sin nota que explique exactamente qué queda.

## Resumen final

Regla: quien solo lea el último mensaje debe entender qué se hizo, cómo se comprobó, en qué
estado está el plan y qué se espera de él. Formato fijo, 10-15 líneas:

```markdown
## Resumen de sesión · 2026-08-27
**Hecho**
- F2-T1 Generar PDF de factura · done · `php artisan facturas:pdf 1` genera F-2026-000001.pdf (captura en devlog). Commit `feat(facturacion): generar pdf de factura` (b4c5d6e).
- F2-T2 Enviar por email con job · blocked · faltan credenciales SMTP de staging; verificado con Mailpit local.

**Plan**
- F1 4/4 · F2 1/4 (1 bloqueada) · F3 0/4.
- Siguiente: F2-T3 (M) Panel de cliente `/mi-cuenta/facturas` · ui-ux-pro-max §references/es/components-spec "Table" + code-quality §references/security-owasp "Control de acceso e IDOR". Sin dependencias pendientes.

**Cambios y riesgos**
- F2-T1 tamaño real M (previsto S): DomPDF sin soporte de grid; plantilla con tablas (ADR-004).
- R2 (HubSpot) sin novedad.

**Necesito de ti**
1. Credenciales SMTP de staging (MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD) para desbloquear F2-T2. Mientras tanto sigo con F2-T3.
2. ¿Confirmas el logo en cabecera del PDF? (Default: sí, versión monocromo.)

**Devlog**: devlog/2026-08-27/015-f2-t1-pdf.md · devlog/2026-08-27/016-f2-t2-bloqueo.md
```

Sin narración del proceso ("primero intenté..."), sin disculpas, sin listar archivos leídos.
Los detalles viven en el devlog; el resumen enlaza.

## Peticiones fuera del plan

El usuario pide algo que no está en `plan/PLAN.md` ("cámbiame el color del botón",
"arregla este error que me sale", "añade un export a CSV").

Procedimiento:

1. **Clasificar** en 10 segundos:
   - Trivial (≤ 15 min, sin riesgo): se hace ahora como tarjeta ad hoc.
   - Pequeña (S/M): tarjeta ad hoc; se hace ahora si la tarea en curso está cerrada o se
     puede cerrar en minutos; si no, se propone hacerla justo después.
   - Grande o cambia alcance: no se empieza; se replanifica (`replanning-and-risks.md`).
2. **Crear la tarjeta ad hoc** en la sección `## Tareas ad hoc` de PLAN.md con id `X-T<n>`
   (mismo formato de tarjeta que parsea el hook):

```markdown
## Tareas ad hoc (fuera del plan original)
### X-T1 · Corregir error 500 al exportar pedidos sin cliente  [S] [doing]
- Skill: code-quality §references/errors-logging "Mapeo a HTTP y respuestas de error"
- Archivos: app/Exports/PedidosExport.php
- Hecho cuando: exportar un pedido sin cliente devuelve CSV con campo vacío; test de regresión.
- Verificar: `php artisan test --filter=ExportarPedidos`.
- Depende de: —
- Devlog: —
- Notas: origen, petición del usuario 2026-08-27 durante F2-T1.
```

3. **Ejecutar con el protocolo completo** (verificación, devlog, commit). Ad hoc no significa
   sin calidad.
4. **Volver** a la tarea del plan que estaba en curso o a la siguiente propuesta. Anotar en
   "Cambios al plan" si el ad hoc consumió la sesión.
5. Si se acumulan más de 3-4 tarjetas `X-T` sobre el mismo tema, es una fase que falta:
   proponerla.

Si la petición contradice el plan ("olvida el PDF, quiero cobro online ya"), se confirma el
cambio de alcance explícitamente antes de mover nada.

## Sesiones especiales

**Primera sesión del proyecto**: descubrimiento (≤ 10 min) -> brief -> plan -> validación con
el usuario -> F1-T1 si hay tiempo. El resumen final incluye el plan completo o su enlace.

**Sesión de cierre de fase**: verificar DoD de fase (`definition-of-done.md`), escribir el
resumen de fase como entrada de devlog de tipo docs (`devlog §Resumen de fase`) con el hito
paso a paso y retro corta, actualizar riesgos, proponer inicio de la siguiente fase. No se empieza la fase siguiente en la misma sesión sin confirmación.

**Sesión de solo preguntas**: el usuario quiere entender el estado o decidir. No se toca
código; se responde con datos del plan y el devlog; se actualizan preguntas abiertas y
supuestos con lo decidido; se anota en "Cambios".

**Sesión tras mucho tiempo parado**: repetir el descubrimiento abreviado (git log, tests,
dependencias) antes de retomar; puede haber riesgos nuevos (dependencias, CI rota).

## Antipatrones

- Empezar a codificar sin buscar la tarjeta `[doing]` y descubrir a mitad que ya estaba hecho.
- Leer la skill entera "para tener contexto" en lugar de la sección de la tarjeta.
- Marcar `done` con "los tests los añado en la siguiente tarea".
- Cerrar la sesión con tres tarjetas `[doing]`.
- Resumen final narrativo de 40 líneas sin decir cuál es la siguiente tarea.
- Atender una petición ad hoc grande "ya que estamos" y dejar la tarea del plan a medias.
- Hacer preguntas al usuario que el repo ya responde.
- Desplegar "porque estaba todo verde" sin aprobación explícita.

## Checklist

- [ ] Al empezar: estado inyectado/leído, cabecera y tabla de fases, coherencia (`[doing]` ≤ 1, git limpio), tarea elegida y anunciada.
- [ ] Durante: una tarea a la vez, solo la skill de la tarjeta, verificación real, devlog y commit (`Tarea: <id>`) por tarea.
- [ ] Al cerrar: plan actualizado (tarjetas + tabla de fases + fecha), devlog indexado, commits hechos, siguiente tarea propuesta, preguntas con default.
- [ ] Resumen final con Hecho / Plan / Cambios y riesgos / Necesito de ti / Devlog.
- [ ] Peticiones fuera del plan como `X-T<n>` con protocolo completo y vuelta al plan.
- [ ] Ningún despliegue sin aprobación explícita.
