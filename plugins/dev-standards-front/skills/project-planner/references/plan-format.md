# Formato canónico de `plan/PLAN.md`

`plan/PLAN.md` es el único documento de planificación. Lo lee el agente al empezar cada sesión
(y el hook `session-start`, que extrae el tablero de las tarjetas), lo actualiza al cerrar cada
tarea y lo lee el usuario. Legible en 2 minutos, editable con un `Edit` pequeño. Plantilla vacía:
`templates/PLAN.md`.

## Índice

- [Principios](#principios)
- [Estructura del archivo](#estructura-del-archivo)
- [Cabecera](#cabecera)
- [Fases](#fases)
- [Tarjeta de tarea](#tarjeta-de-tarea)
- [Campos de la tarjeta](#campos-de-la-tarjeta)
- [Reglas de estado](#reglas-de-estado)
- [Secciones finales](#secciones-finales)
- [Ejemplo completo](#ejemplo-completo)
- [Checklist](#checklist)

## Principios

- Un archivo, Markdown plano, sin herramientas externas.
- Cada tarea es ejecutable por un agente en una sesión con solo la tarjeta, la skill indicada y el repo.
- La skill y la sección se fijan al planificar, no al ejecutar: evita leer skills enteras.
- La historia no se borra: las tareas hechas se quedan con `done` y enlace a devlog.
- El brief vive en `plan/brief.md` y se enlaza desde la cabecera; no se copia en el plan.

## Estructura del archivo

Es exactamente la de `templates/PLAN.md`:

```
# Plan — <nombre del proyecto o feature>
(cabecera con viñetas: objetivo, estado, stack, brief, design system, devlog, DoD global)
## Alcance                 (IN / OUT explícito / supuestos / riesgos)
## Fases                   (tabla: fase, entregable verificable, estado)
## F1 — <título>           (una sección por fase, con sus tarjetas ###; luego F2, F3...)
## Tareas ad hoc           (tarjetas X-T<n>, fuera del plan original)
## Cambios al plan         (tabla: fecha, cambio, motivo)
## Riesgos y bloqueos      (tabla: riesgo, impacto, mitigación, estado)
```

## Cabecera

Título `# Plan — <nombre>` y cinco viñetas: **Objetivo**, **Estado** + **Actualizado**,
**Stack / perfil**, enlaces a **Brief** / **Design system** / **Devlog**, y **Definición de hecho
global** (ver el ejemplo completo). La tarea en curso no se anota en la cabecera: se deduce de la
única tarjeta `[doing]` (`grep -c '\[doing\]' plan/PLAN.md` debe dar 0 o 1). El progreso se lee
de la tabla `## Fases`.

## Fases

Una fase es un conjunto de tareas que, terminadas, dejan algo usable por el usuario o el equipo.

- F1 es siempre el walking skeleton: el camino más corto de extremo a extremo que ya funciona
  (ruta -> caso de uso -> persistencia -> UI mínima) con tests, CI y devlog.
- Cada fase tiene una fila en la tabla `## Fases` (entregable verificable + estado) y una
  sección `## F<n> — <título>` con 3-8 tarjetas en orden de ejecución previsto.
- Las fases se numeran F1..Fn; no se reordenan una vez empezadas (se añade F2b si hace falta).
- Si hay UI y no existe `design-system/<slug>/MASTER.md`, la primera tarjeta de la fase de UI
  es generarlo con `ui-ux-pro-max`.

## Tarjeta de tarea

Formato fijo, un bloque por tarea. La primera línea es un encabezado `###` con
`id · título  [tamaño] [estado]`; debajo, las viñetas en este orden:

```markdown
### F1-T2 · Crear caso de uso IssueInvoice  [M] [todo]
- Skill: <skill → referencia/sección>
- Archivos: …
- Hecho cuando: …
- Verificar: …
- Depende de: —
- Devlog: —
```

La primera línea de cada tarjeta la parsea el hook `session-start`
(`Get-PlanStatus` en `core/hooks/_common.ps1`): **no cambies su forma**. La regex exige
`### <id> · <título> [S|M|L] [todo|doing|blocked|done]` (el separador puede ser `·` o `-`).
Un `grep '^### '` sobre el plan da el tablero completo.

## Campos de la tarjeta

| Campo | Regla |
|-------|-------|
| Id | `F<fase>-T<n>`; subdivisión: `F1-T3a`, `F1-T3b`; ad hoc fuera de plan: `X-T<n>` (ver `session-rhythm.md`) |
| Título | Verbo en infinitivo + objeto concreto: "Crear migración de facturas", no "Facturas" |
| Tamaño | `[S]` ≤ 1 h · `[M]` ≤ 3 h · `[L]` ≤ 1 día. Una `L` se divide antes de pasar a `doing` |
| Estado | `[todo]` · `[doing]` · `[blocked]` · `[done]` |
| Skill | Nombre de skill + `§sección` real (ver `skill-map.md`). Varias skills: separadas por `+`, en orden de lectura; o `sin skill: cambio trivial` |
| Archivos | Rutas previstas (crear o modificar). Orientativo, se corrige al cerrar |
| Hecho cuando | Comportamiento observable, no actividad. Incluye el caso negativo si existe |
| Verificar | Comando con resultado esperado, URL con qué mirar, o captura. Siempre reproducible |
| Depende de | Ids, o `—` si puede empezar ya |
| Devlog | `—` hasta cerrar; después la ruta `devlog/<YYYY-MM-DD>/NNN-<slug>.md` |
| Notas (opcional) | Desviaciones, motivo de bloqueo, por qué se dividió, enlace a ADR |

## Reglas de estado

1. Máximo UNA tarjeta `[doing]` en todo el plan. Si hay dos, algo se cerró mal.
2. Una tarea pasa a `[doing]` solo si sus dependencias están `[done]` y su tamaño es S o M.
3. `[blocked]` lleva motivo y qué se necesita para desbloquear, en "Notas".
4. `[done]` exige: verificación ejecutada con salida registrada + entrada de devlog enlazada en
   la tarjeta + commit con `Tarea: <id>` en el cuerpo.
5. Toda tarea cabe en una sesión. Si no cabe, se divide en `T3a`/`T3b` antes de empezar.
6. Las tareas no se borran; si se descartan, `[done]` con nota "descartada: motivo".
7. Al cambiar un estado se actualizan la fila de la fase en `## Fases` y la fecha de la cabecera.

## Secciones finales

`## Tareas ad hoc` (tarjetas `X-T<n>`, mismo formato), `## Cambios al plan` (fecha / cambio /
motivo) y `## Riesgos y bloqueos` (ver `replanning-and-risks.md`). Existen aunque estén vacías.

## Ejemplo completo

```markdown
# Plan — Facturación en AppPedidos

- **Objetivo:** emitir, enviar y mostrar facturas de pedidos cerrados.
- **Estado:** en curso · **Actualizado:** 2026-08-25
- **Stack / perfil:** laravel · Laravel 12 + Inertia + Vue 3 + Tailwind
- **Brief:** `plan/brief.md` · **Design system:** `design-system/app/MASTER.md` · **Devlog:** `devlog/INDEX.md`
- **Definición de hecho global:** tests y lint en verde, a11y básica, sin secretos, devlog al día, sin deploy

## Alcance
- **IN:** emitir factura desde pedido cerrado; PDF; envío por email; listado admin y de cliente.
- **OUT (explícito):** rectificativas; cobro online; facturación intracomunitaria.
- **Supuestos:** solo España, IVA 21 %; numeración por serie anual.
- **Riesgos:** ver sección final

## Fases
| Fase | Entregable verificable por el usuario | Estado |
|---|---|---|
| F1 | Walking skeleton: `/admin/facturas` lista la factura creada desde el pedido #1 | doing |
| F2 | PDF por email (Mailpit) y panel `/mi-cuenta/facturas` | todo |

## F1 — Walking skeleton de facturación

### F1-T1 · Crear migración y modelo Factura con líneas  [S] [done]
- Skill: code-quality §references/php-laravel "Migraciones seguras" + ddd-hexagonal §references/persistence/migrations-and-domain
- Archivos: database/migrations/*_create_facturas_table.php, app/Facturacion/Domain/Factura.php
- Hecho cuando: migración aditiva crea `facturas` y `factura_lineas`; modelo con relaciones; factory.
- Verificar: `php artisan migrate --pretend` sin drops; `php artisan test --filter=FacturaModel` verde.
- Depende de: —
- Devlog: devlog/2026-08-25/012-migracion-facturas.md

### F1-T2 · Implementar numeración correlativa por serie  [M] [doing]
- Skill: ddd-hexagonal §references/tactical/value-objects + code-quality §references/testing "Integración con BD real"
- Archivos: app/Facturacion/Domain/NumeroFactura.php, app/Facturacion/Infrastructure/SecuenciaRepository.php
- Hecho cuando: dos emisiones concurrentes obtienen números consecutivos sin hueco ni duplicado.
- Verificar: `php artisan test --filter=NumeroFactura` (incluye test con 10 procesos paralelos).
- Depende de: F1-T1
- Devlog: —

### F1-T3 · Crear caso de uso EmitirFactura  [M] [todo]
- Skill: ddd-hexagonal §references/application/use-cases
- Archivos: app/Facturacion/Application/EmitirFactura.php, tests/Unit/Facturacion/EmitirFacturaTest.php
- Hecho cuando: pedido cerrado -> factura con líneas e importes; pedido abierto -> excepción.
- Verificar: `php artisan test --filter=EmitirFactura` -> 4 verdes.
- Depende de: F1-T2
- Devlog: —

### F1-T4 · Crear ruta, controlador y página Inertia de listado  [M] [todo]
- Skill: code-quality §references/php-laravel "Arquitectura: controladores, Form Requests, Actions y Services" + ui-ux-pro-max §references/es/components-spec "Table"
- Archivos: routes/web.php, app/Http/Controllers/Admin/FacturaController.php, resources/js/Pages/Admin/Facturas/Index.vue
- Hecho cuando: `/admin/facturas` lista facturas paginadas con número, cliente, total y estado; solo rol admin.
- Verificar: `php artisan test --filter=FacturaIndex`; abrir URL y captura en devlog.
- Depende de: F1-T3
- Devlog: —

## F2 — PDF y envío

### F2-T1 · Generar PDF de factura con DomPDF  [M] [todo]
- Skill: code-quality §references/php-laravel "Arquitectura: controladores, Form Requests, Actions y Services"
- Archivos: app/Facturacion/Application/GenerarPdf.php, resources/views/pdf/factura.blade.php
- Hecho cuando: PDF con datos fiscales, líneas, totales e IVA; nombre `F-2026-000001.pdf`.
- Verificar: `php artisan facturas:pdf 1` genera el archivo; captura en devlog.
- Depende de: F1-T3
- Devlog: —

### F2-T2 · Cerrar fase: resumen de fase y ADR de numeración  [S] [todo]
- Skill: devlog §Resumen de fase + ddd-hexagonal §templates/docs/adr
- Archivos: devlog/<fecha>/NNN-cierre-f2.md, docs/adr/001-numeracion-por-serie.md
- Hecho cuando: entrada tipo docs con lo entregado, verificación y retro; ADR enlazado.
- Verificar: enlaces válidos desde `devlog/INDEX.md`.
- Depende de: F2-T1
- Devlog: —

## Tareas ad hoc (fuera del plan original)
### X-T1 · Corregir error 500 al exportar pedidos sin cliente  [S] [done]
- Skill: code-quality §references/errors-logging "Mapeo a HTTP y respuestas de error"
- Archivos: app/Exports/PedidosExport.php
- Hecho cuando: exportar un pedido sin cliente devuelve CSV con campo vacío; test de regresión.
- Verificar: `php artisan test --filter=ExportarPedidos`. Depende de: —
- Devlog: devlog/2026-08-25/013-fix-export-pedidos.md

## Cambios al plan
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-08-25 | Plan creado | — |

## Riesgos y bloqueos
| Riesgo / bloqueo | Impacto | Mitigación / qué se necesita | Estado |
|---|---|---|---|
| Huecos de numeración | Alto | F1-T2 con bloqueo + test concurrente | Abierto |
```

## Checklist

- [ ] Cabecera con objetivo, estado y fecha, stack/perfil, enlaces a brief, design system y devlog, DoD global.
- [ ] `plan/brief.md` existe y está enlazado (no copiado).
- [ ] F1 es un walking skeleton entregable; tabla `## Fases` con entregable verificable por fase.
- [ ] Si hay UI y no existe `design-system/<slug>/MASTER.md`, la primera tarjeta de la fase de UI lo genera con `ui-ux-pro-max`.
- [ ] Cada tarjeta: `### id · título  [S|M] [estado]`, skill+sección real, archivos, hecho cuando, verificar, depende de, devlog.
- [ ] Ninguna tarea L sin dividir; ninguna tarea sin verificación reproducible.
- [ ] `grep -c '\[doing\]' plan/PLAN.md` da 0 o 1.
- [ ] Secciones `## Tareas ad hoc`, `## Cambios al plan` y `## Riesgos y bloqueos` presentes aunque estén vacías.
- [ ] `grep '^### '` produce un tablero legible (formato que parsea el hook).
