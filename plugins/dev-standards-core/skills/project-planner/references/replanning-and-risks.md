# Replanificación, riesgos y bloqueos

El plan es una hipótesis que se corrige con lo que se aprende. Replanificar no es fracasar:
es mantener `plan/PLAN.md` fiel a la realidad sin perder la historia. Este documento fija
cuándo se replanifica, cómo se registra y cómo se gestionan riesgos y bloqueos.

## Índice

- [Cuándo replanificar](#cuándo-replanificar)
- [Cómo replanificar](#cómo-replanificar)
- [Sección "Cambios"](#sección-cambios)
- [Registro de riesgos](#registro-de-riesgos)
- [Gestión de bloqueos](#gestión-de-bloqueos)
- [Retro corta al cerrar fase](#retro-corta-al-cerrar-fase)
- [Ejemplo completo](#ejemplo-completo)
- [Checklist](#checklist)

## Cuándo replanificar

| Disparador | Señal concreta | Alcance del cambio |
|------------|----------------|--------------------|
| Cambio de alcance | El usuario pide algo nuevo o retira algo del brief | Brief + fases afectadas |
| Descubrimiento técnico | Un spike o una tarea revela que el enfoque no sirve (API sin la capacidad esperada, rendimiento inviable, dependencia incompatible) | Tareas de la fase; a veces una fase nueva |
| Tarea que se dispara | Tamaño real > 2x lo previsto o tercera sesión en la misma tarjeta | Dividir la tarjeta; revisar tareas similares |
| Pregunta abierta resuelta | El usuario responde Q1 y el default era otro | Tareas bloqueadas por Q1 |
| Riesgo materializado | Un riesgo del registro ocurre | Mitigación se convierte en tareas |
| Fase cerrada | Retro corta con hallazgos | Ajustes en la siguiente fase |

No se replanifica por: preferencias de estilo sin impacto, ideas nuevas sin decisión del
usuario (van al backlog), o porque una tarea fue más corta de lo previsto (se anota y ya).

## Cómo replanificar

Procedimiento en 6 pasos, siempre con la tarea en curso cerrada o dividida antes:

1. **Cerrar el estado actual.** Ninguna tarea queda `doing` a medias: se cierra la parte hecha
   (T3a) o se pasa a `blocked` con motivo.
2. **Describir el cambio en una frase** con causa: "Q1 confirmó varios tipos de IVA; la
   numeración por serie y el cálculo de impuestos cambian".
3. **Editar el plan sin borrar.** Tareas `done` intactas. Tareas `todo` se editan, se mueven
   de fase o se marcan `done` con nota "descartada: motivo". Tareas nuevas reciben ids nuevos
   (siguiente número libre de la fase, o fase nueva `F2b`).
4. **Actualizar brief, riesgos y preguntas.** Si el alcance cambió, IN/OUT del brief cambia; si
   el descubrimiento crea riesgo, se registra.
5. **Anotar en "Cambios"** con fecha, causa, qué se movió y enlace al devlog de la sesión.
6. **Informar al usuario** con el delta: qué se añade, qué se quita, qué se retrasa, y pedir
   confirmación si afecta a plazo o alcance.

Regla de proporcionalidad: un cambio pequeño (dividir una tarea) se anota en 1 línea; un
cambio grande (fase nueva) merece un ADR corto (`ddd-hexagonal §templates/docs/adr`) si
implica decisión técnica.

## Sección "Cambios"

Registro cronológico al final de PLAN.md. Formato de una línea por cambio, ampliable con
sub-viñetas si hace falta:

```markdown
## Cambios
- 2026-08-26 · [tamaño] F1-T4 dividida en F1-T4a (migración) y F1-T4b (seeder); tamaño real L. Devlog: entries/2026-08-26-sesion.md
- 2026-08-27 · [alcance] Q1 resuelta: IVA múltiple. F1-T2 reescrita (numeración por serie y tipo); nueva F2-T5 "Tabla de tipos de IVA". OUT: multi-moneda sigue fuera.
- 2026-08-28 · [técnico] DomPDF no soporta CSS grid; F2-T1 pasa a usar tablas en la plantilla. ADR-004.
- 2026-08-29 · [descartada] F2-T4 "README del módulo" fusionada en F2-T3 (cierre de fase).
```

Etiquetas: `[alcance]`, `[técnico]`, `[tamaño]`, `[bloqueo]`, `[descartada]`, `[riesgo]`.
Con `grep '^\- 20' plan/PLAN.md` se obtiene el historial completo.

## Registro de riesgos

Tabla en PLAN.md, sección "Riesgos". Un riesgo es algo que podría pasar y haría daño;
si ya pasó, es un bloqueo o una tarea.

```markdown
## Riesgos
| Id | Riesgo | Impacto | Prob. | Mitigación | Dueño | Estado |
|----|--------|---------|-------|------------|-------|--------|
| R1 | Huecos en numeración bajo concurrencia | Alto (legal) | Media | F1-T2 con bloqueo pesimista + test paralelo | Agente | Mitigado (F1-T2 done) |
| R2 | HubSpot limita 100 req/día en plan gratuito | Medio | Alta | Cola con reintento diario; avisar al usuario | Usuario | Abierto |
| R3 | Sin tests de front: regresiones en formularios | Medio | Alta | Test de componente en cada tarea UI de F2 | Agente | Abierto |
| R4 | Clave de LLM compartida con otro entorno | Alto | Baja | Clave propia por entorno; `.env.example` | Usuario | Cerrado |
```

Reglas:

- Impacto: Alto (legal, datos, dinero, seguridad), Medio (retraso, retrabajo), Bajo (molestia).
- Probabilidad: Alta / Media / Baja, a ojo; no se calcula nada.
- Mitigación: acción concreta y, si es trabajo, id de tarea.
- Dueño: quién puede actuar. Si es el usuario, aparece también en "Preguntas abiertas".
- Estado: Abierto, Mitigado (acción hecha, se vigila), Cerrado (ya no aplica), Materializado (pasó -> ver Cambios).
- Se revisa al cerrar cada fase; máximo 8-10 riesgos vivos, los demás se cierran o se fusionan.

Fuentes habituales de riesgos: señales del descubrimiento (`discovery.md`), integraciones
externas, restricciones legales, partes del stack que nadie del equipo conoce, plazos.

## Gestión de bloqueos

Una tarea pasa a `blocked` cuando no puede avanzar sin algo externo. Formato en la tarjeta:

```markdown
#### F2-T2 · Enviar factura por email con job en cola · S · blocked
- ...
- Notas: BLOQUEADA 2026-08-27. Motivo: no hay credenciales SMTP de staging. Necesito: host, usuario y contraseña en `.env` (variables MAIL_*). Alternativa mientras tanto: Mailpit local (ya verificado). Dueño: usuario.
```

Reglas:

1. Motivo + qué se necesita + quién lo puede resolver + alternativa si existe. Sin esto, no
   es un bloqueo, es una tarea sin terminar.
2. Se anota en "Cambios" con etiqueta `[bloqueo]` y se lista en el cierre de sesión
   (`session-rhythm.md`) bajo "Preguntas al usuario".
3. Se pasa a otra tarea desbloqueada de la misma fase; si no hay, de la siguiente fase sin
   dependencias con la bloqueada.
4. Al resolverse, vuelve a `todo` (no a `doing` directamente) y se anota la fecha.
5. Un bloqueo de más de una semana o que afecta al hito de fase se escala en el resumen
   final con propuesta: cambiar de enfoque, mover la tarea de fase o descartarla.

Tipos de bloqueo típicos y salida rápida:

| Bloqueo | Salida rápida |
|---------|---------------|
| Credenciales/servicio externo | Mock o sandbox local; seguir con la tarea; verificación real al desbloquear |
| Skill no instalada | Pedir instalación; avanzar en tarea que no la necesite |
| Decisión del usuario pendiente | Aplicar el default de la pregunta si es reversible y anotarlo |
| Bug en dependencia | Fijar versión anterior o parche local documentado; abrir tarjeta de seguimiento |
| Datos reales necesarios | Fixture representativa acordada con el usuario |

## Retro corta al cerrar fase

Cinco minutos, tres apartados, en el devlog de fase (`devlog §Resumen de fase`) y enlazada
desde "Cambios". No es una ceremonia: es lo que se cambia en la siguiente fase.

```markdown
### Retro F1 (2026-08-28)
- Mantener: tareas M con test primero; verificación pegada; spike inicial de numeración evitó rediseño.
- Cambiar: estimé S tareas que fueron M (migraciones con backfill); en F2 las migraciones con datos son M por defecto. Las capturas de UI se olvidaron dos veces: añadir a la verificación de cada tarjeta UI.
- Riesgos: R1 mitigado; R3 sigue abierto y F2 tiene 3 tareas UI: añadir test de componente en cada una.
- Ajustes aplicados al plan: F2-T1 pasa de S a M; F2-T3 verificación incluye capturas 360/1280. Ver Cambios 2026-08-28.
```

Los ajustes se aplican en el momento, no "para la próxima vez".

## Ejemplo completo

Situación: a mitad de F2, el usuario confirma que las facturas rectificativas son
imprescindibles para la demo (antes estaban en backlog) y la tarea F2-T3 lleva dos sesiones.

1. Cierre de estado: F2-T3 se divide en F2-T3a "Listado de facturas del cliente" (`done`,
   verificada) y F2-T3b "Descarga de PDF con autorización" (`todo`).
2. Frase: "Rectificativas entran en la demo; F2-T3 dividida por tamaño real".
3. Edición: nueva fase `F2b — Rectificativas` con 3 tareas (dominio, caso de uso, UI en el
   listado admin); F3 (cobro) se retrasa. Backlog actualizado.
4. Brief: IN incluye rectificativas; OUT sin cambios. Riesgo nuevo R5 "reglas de rectificación
   parcial poco claras" con dueño usuario y pregunta Q4.
5. Cambios:
   `- 2026-08-29 · [alcance] Rectificativas entran para la demo: nueva F2b (3 tareas). [tamaño] F2-T3 dividida en T3a (done) y T3b. Riesgo R5 y pregunta Q4 añadidos. Devlog: entries/2026-08-29-sesion.md`
6. Al usuario: "Añadida F2b con 3 tareas (~1 día). F3 se retrasa un día. Necesito respuesta a
   Q4 (rectificación parcial sí/no; default: solo total) antes de F2b-T1. ¿Confirmas?"

## Checklist

- [ ] La tarea en curso está cerrada o dividida antes de replanificar.
- [ ] Cambio descrito en una frase con causa.
- [ ] Ninguna tarea `done` borrada ni reescrita; descartes con motivo.
- [ ] Brief, riesgos y preguntas actualizados si el alcance cambió.
- [ ] Línea en "Cambios" con fecha, etiqueta y enlace al devlog.
- [ ] Usuario informado del delta y de lo que necesita confirmar.
- [ ] Riesgos con impacto, mitigación concreta, dueño y estado; ≤ 10 vivos.
- [ ] Bloqueos con motivo, necesidad, dueño y alternativa; tarea alternativa elegida.
- [ ] Retro de fase escrita y ajustes aplicados al plan en el momento.
