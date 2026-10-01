# Metodología de Devlog (OBLIGATORIA)

Cada paso relevante y **cada commit** se documenta en la carpeta `senzu/devlog/` en la raíz del proyecto.

## Estructura dentro del proyecto

```
senzu/devlog/
├── INDEX.md                     # Índice global, numeración correlativa de TODOS los devlogs
├── MEMORIA.md                   # Lo VIGENTE: decisiones, reglas del cliente, lo que no funcionó, pendientes (≤ 60 líneas)
├── MEMORIA-historico.md         # Lo sustituido o cerrado que sale de la memoria (se crea cuando hace falta)
├── 2026-07-18/                  # Una carpeta por día (fecha ISO YYYY-MM-DD)
│   ├── 001-setup-inicial.md     # Un .md por entrada; numeración correlativa global
│   ├── 002-modelo-usuario.md    # Si un día es muy largo -> varios .md
│   ├── 003-fix-migracion.md
│   └── DECISIONES.md            # Decisiones de arquitectura/producto tomadas ese día
└── 2026-07-19/
    ├── 004-...
    └── DECISIONES.md
```

## Reglas

1. **Numeración correlativa global**: los devlogs se numeran `001`, `002`, `003`… a lo
   largo de TODA la vida del proyecto, no se reinicia cada día. El nombre del archivo es
   `NNN-slug-corto.md`.
2. **Un `.md` por día** como mínimo. Si el día produce mucho, se parte en varios `.md`
   (cada uno con su número correlativo).
3. **`DECISIONES.md` por día**: registra decisiones (por qué se eligió X sobre Y),
   con el número de devlog al que pertenece cada decisión. Cada decisión vigente va además, en una
   línea, a `MEMORIA.md` (`D-xxx · decisión · ver NNN`); si sustituye a otra, la antigua se marca como
   sustituida. Para consultar el pasado: `buscar.mjs` de la skill devlog, citando la entrada.
4. **Cada commit** debe quedar referenciado en un devlog (hash + mensaje).
5. **"Número de devlog que mejora"**: si una entrada corrige/mejora una anterior, se
   indica en el campo `Mejora a:` con el número de la entrada previa. Así queda la
   trazabilidad de qué evolucionó.
6. `INDEX.md` se actualiza en cada entrada nueva (tabla: nº, fecha, título, tipo, mejora-a, tarea).
7. **Campo `Tarea:`**: id de la tarjeta de `senzu/plan/PLAN.md` que cierra la entrada (`F1-T2`, `X-T1`)
   o `—` si no hay plan o la entrada no corresponde a una tarjeta.

## Plantilla de entrada (`NNN-slug.md`)

```markdown
# NNN — <título>

- **Fecha/hora:** 2026-07-18 14:32
- **Tipo:** feature | fix | refactor | infra | docs | decisión
- **Mejora a:** — (o el nº de devlog previo que este mejora/corrige)
- **Tarea:** <F1-T2 | X-T1 | —>
- **Stack:** laravel

## Qué se hizo
- Paso 1…
- Paso 2…

## Commits
- `a1b2c3d` feat: agrega modelo User con soft-deletes

## Decisiones (resumen; el detalle va en DECISIONES.md)
- Se usó soft-delete en vez de borrado físico (ver DECISIONES.md#dev-002)

## Verificación
- Cómo se comprobó que funciona (comando, salida, screenshot…)

## Próximos pasos
- …
```

## Plantilla `DECISIONES.md`

```markdown
# Decisiones — 2026-07-18

## dev-002 — Soft-delete en usuarios
- **Contexto:** requisito de auditoría.
- **Opciones:** borrado físico vs soft-delete.
- **Elección:** soft-delete (`deleted_at`).
- **Motivo:** recuperabilidad + cumplimiento.
- **Consecuencias:** todas las queries deben respetar el scope.
```

## Regla para el agente
- Antes de dar por terminada una tarea o de hacer un commit, **crea o actualiza la
  entrada de devlog del día** y el `INDEX.md`.
- Si no existe la carpeta del día, créala.
- Nunca inventes la fecha: usa la fecha real del sistema.
