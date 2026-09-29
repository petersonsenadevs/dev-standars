---
name: devlog
description: Crea o actualiza la entrada de devlog del día y el INDEX.md antes de cerrar una tarea o hacer un commit. Úsalo siempre que termines un paso relevante, corrijas algo o vayas a commitear.
---

# Skill: devlog

Documenta el trabajo en `devlog/` en la raíz del proyecto siguiendo la metodología del equipo.

## Cuándo usar
- Antes de cada `git commit`.
- Al terminar un paso/feature/fix relevante.
- Cuando una entrada corrige o mejora una anterior.

## Proyecto con diario propio
Si el proyecto ya documenta a su manera (CHANGELOG.md, `docs/decisions/`, ADRs) y aún no hay decisión
tomada: pregunta UNA vez al usuario qué prefiere (su formato, este devlog, o ambos con roles distintos),
anota la decisión en la primera entrada (o en su diario) y respétala el resto del proyecto sin re-preguntar.

## Pasos
1. Determina la fecha real: `Get-Date -Format 'yyyy-MM-dd HH:mm'`.
2. Asegura la carpeta del día: `devlog/<YYYY-MM-DD>/`.
3. Calcula el siguiente número correlativo GLOBAL leyendo el mayor `NNN` existente en
   todo `devlog/**` y sumando 1 (formato de 3 dígitos: `001`, `002`…).
4. Crea `devlog/<fecha>/NNN-<slug>.md` con la plantilla de entrada.
5. Si esta entrada mejora/corrige otra, rellena `Mejora a: NNN`.
6. Registra los commits del paso (hash corto + mensaje).
7. Si hubo decisiones, añádelas a `devlog/<fecha>/DECISIONES.md`.
8. Actualiza `devlog/INDEX.md` (tabla: nº, fecha, título, tipo, mejora-a, tarea).
9. Si la entrada cierra una tarjeta de `plan/PLAN.md`, rellena `Tarea: <id>` y pon la ruta de la
   entrada en el campo `Devlog:` de la tarjeta al marcarla `done`.

## Plantilla de entrada
Ver `templates/devlog-day.md` de esta skill. Campos mínimos:
`# NNN — título`, Fecha/hora, Tipo, Mejora a, Tarea (`F1-T2` | `X-T1` | `—`), Stack, Qué se hizo,
Commits, Decisiones, Verificación, Próximos pasos.

## Resumen de fase
Al cerrar una fase de `plan/PLAN.md` se escribe una entrada normal de tipo `docs` (misma plantilla
y numeración; `Tarea:` con el id de la tarjeta de cierre si existe) con: qué se entregó y cómo lo
verifica el usuario paso a paso, enlaces a las entradas de cada tarea de la fase, verificación
global (suite, CI) y una retro corta (qué mantener, qué cambiar). Se enlaza desde la tarjeta de
cierre y desde la fila de la fase en `## Fases`.

## Reglas
- Numeración correlativa **global**, no se reinicia por día.
- Nunca inventes la fecha; usa la del sistema.
- Un `.md` por día mínimo; si el día es muy largo, varios `.md`.
