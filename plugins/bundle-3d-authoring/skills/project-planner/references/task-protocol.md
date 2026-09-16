# Protocolo de ejecución de UNA tarea

Este protocolo se aplica a cada tarjeta de `plan/PLAN.md`, sin excepciones y sin saltos.
Su objetivo es que una tarea empiece, termine y quede documentada en una sola sesión,
usando solo la skill que necesita.

## Índice

- [Los ocho pasos](#los-ocho-pasos)
- [Paso 1: leer la tarjeta](#paso-1-leer-la-tarjeta)
- [Paso 2: marcar doing](#paso-2-marcar-doing)
- [Paso 3: leer solo la skill indicada](#paso-3-leer-solo-la-skill-indicada)
- [Paso 4: implementar completo](#paso-4-implementar-completo)
- [Paso 5: verificar y pegar salida](#paso-5-verificar-y-pegar-salida)
- [Paso 6: devlog y commit](#paso-6-devlog-y-commit)
- [Paso 7: marcar done y anotar desviaciones](#paso-7-marcar-done-y-anotar-desviaciones)
- [Paso 8: elegir la siguiente](#paso-8-elegir-la-siguiente)
- [Situaciones especiales](#situaciones-especiales)
- [Formato de cierre de tarea](#formato-de-cierre-de-tarea)
- [Checklist](#checklist)

## Los ocho pasos

| # | Paso | Salida |
|---|------|--------|
| 1 | Leer la tarjeta | Entiendo qué, cómo se verifica y de qué depende |
| 2 | Marcar `doing` | PLAN.md actualizado (tarjeta + tabla de fases) |
| 3 | Leer solo la skill/sección indicada | Reglas concretas en contexto, nada más |
| 4 | Implementar completo | Código + tests según DoD |
| 5 | Verificar como dice la tarjeta | Salida real pegada |
| 6 | Devlog + commit Conventional | Entrada creada, commit hecho |
| 7 | Marcar `done` y anotar desviaciones | PLAN.md actualizado, notas escritas |
| 8 | Elegir la siguiente por dependencias | Propuesta al usuario |

Duración objetivo: una tarea S o M por sesión; nunca dos tareas a medias.

## Paso 1: leer la tarjeta

Leer la tarjeta completa y responder mentalmente tres preguntas:

- ¿Qué comportamiento observable tengo que producir? ("Hecho cuando")
- ¿Cómo lo demuestro? ("Verificar")
- ¿Están `done` todas las dependencias? Si no, la tarea no se empieza.

Si la tarjeta no permite responder a las tres, se corrige la tarjeta antes de tocar código
(y se anota en "Cambios"). Tarjetas vagas producen trabajo vago.

## Paso 2: marcar doing

Edición mínima en PLAN.md:

```markdown
### F1-T3 · Crear caso de uso EmitirFactura  [M] [doing]
```

y en la tabla `## Fases`, la fila de la fase pasa a `doing` si no lo estaba. Comprobar con
`grep -c '\[doing\]' plan/PLAN.md` que el resultado es `1`. Si es `2`, hay una tarea
abandonada: cerrarla o pasarla a `blocked` antes de seguir.

## Paso 3: leer solo la skill indicada

La tarjeta dice, por ejemplo, `ui-ux-pro-max §references/es/components-spec "Form"`. Eso significa:

1. Abrir el `SKILL.md` de esa skill solo para localizar el archivo de la sección.
2. Leer ese archivo o esa sección. No leer el resto de la skill "por si acaso".
3. Si la tarjeta lista dos skills con `+`, leerlas en ese orden.
4. Si al leer se detecta que la sección no cubre el caso, se busca la sección correcta,
   se anota en "Notas" de la tarjeta y se sigue.

Presupuesto de lectura: un par de archivos de referencia. Más que eso indica que la tarea
está mal acotada o mal asignada.

## Paso 4: implementar completo

- Implementar todo lo que dice "Hecho cuando", incluido el caso negativo.
- Tests se escriben en la misma tarea (no "luego"). Para lógica: test primero cuando sea barato.
- Sin TODO sin issue, sin `console.log`/`dd()` residuales, sin secretos.
- Tocar solo los archivos previstos y los estrictamente necesarios; si se tocan otros, anotarlo.
- Si la implementación pide una decisión de diseño no trivial, escribir un ADR corto
  (`ddd-hexagonal templates/docs/adr.md`) y enlazarlo en "Notas".

Completo significa "usable en producto", no "funciona en el caso feliz".

## Paso 5: verificar y pegar salida

Ejecutar exactamente lo que dice la tarjeta en "Verificar" y capturar la salida real:

```text
$ php artisan test --filter=EmitirFactura
PASS  Tests\Unit\Facturacion\EmitirFacturaTest
- emite factura desde pedido cerrado
- copia líneas e importes
- asigna número correlativo
- rechaza pedido abierto
Tests: 4 passed (11 assertions) · Duration: 0.42s
```

Para UI: URL abierta + captura guardada en `devlog/assets/` + comprobación responsive y teclado.
Para migraciones: `migrate --pretend` sin sentencias destructivas + `migrate:rollback` probado.

Si la verificación falla, se vuelve al paso 4. No se marca `done` con verificación parcial.
Además de lo indicado, siempre se ejecutan lint y tipos del área tocada.

## Paso 6: devlog y commit

1. Crear la entrada de devlog siguiendo `devlog §Plantilla de entrada` (skill `devlog`):
   `devlog/<YYYY-MM-DD>/NNN-<slug>.md` con numeración global correlativa, campo `Tarea: <id>`,
   qué se hizo, decisiones, salida de verificación, desviaciones, siguiente paso. Actualizar
   `devlog/INDEX.md` (y `DECISIONES.md` del día si hubo decisiones).
2. Commit Conventional; el cuerpo lleva siempre la línea `Tarea: <id>`:

```text
feat(facturacion): emitir factura desde pedido cerrado

Caso de uso EmitirFactura con numeración por serie y validación de estado.
Tarea: F1-T3
```

Tipos habituales: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`. Un commit por
tarea es lo normal; varios si la tarea tuvo pasos claramente separables.

## Paso 7: marcar done y anotar desviaciones

Actualizar la tarjeta:

```markdown
### F1-T3 · Crear caso de uso EmitirFactura  [M] [done]
- ...
- Devlog: devlog/2026-08-25/014-f1-t3-emitir-factura.md
- Notas: tamaño real S. Se añadió `PedidoNoCerrado` como excepción de dominio (no prevista). Archivos extra: app/Facturacion/Domain/Exceptions/PedidoNoCerrado.php.
```

Desviaciones que siempre se anotan: tamaño real distinto, archivos no previstos, decisiones
tomadas, supuestos nuevos, cosas que quedaron fuera y por qué. Actualizar la fila de la fase
en `## Fases` (estado `done` si era la última tarjeta) y la fecha "Actualizado" de la cabecera.

## Paso 8: elegir la siguiente

Candidatas: tareas `todo` cuyas dependencias están todas `done`. Entre ellas:

1. La de la fase en curso antes que cualquier otra.
2. La que reduce más riesgo (ver `slicing-and-sequencing.md`).
3. La que sigue el orden escrito en el plan.

Se propone al usuario con una línea: "Siguiente: F1-T4 (M) Crear ruta y página de listado.
¿Sigo?". Si la sesión tiene margen y el usuario ya dio permiso para encadenar, se continúa
con el paso 1 de la siguiente.

## Situaciones especiales

**La tarea es más grande de lo previsto.** Dividir, no inflar. Se crea `F1-T3a` con lo que ya
está encaminado y `F1-T3b` con el resto (sufijo `a`/`b` sobre el id original, sin renumerar
las demás); se cierra T3a con su verificación y se anota en "Cambios al plan". Nunca se deja una tarea `doing` "casi acabada" al cerrar la sesión.

**Aparece un bug ajeno a la tarea.** Se crea una tarjeta nueva (`F1-T9` o `X-T1` si es
urgente) con el bug descrito y cómo reproducirlo. No se arregla dentro de la tarea actual,
salvo que impida verificarla; en ese caso se anota como desviación.

**Falta una skill.** La tarjeta pide `gsap-scrolltrigger` y no está en `.dev-standards.json`.
Se pasa la tarea a `blocked` con nota "requiere instalar skill gsap-scrolltrigger" y se pide
al usuario que la instale (o autorice instalarla). No se improvisa sin la skill si la tarea
depende de ella; sí se puede avanzar en otra tarea desbloqueada.

**La verificación no se puede ejecutar** (falta servicio, credencial, dato). `blocked` con
"necesito: ...". Se ofrece al usuario una alternativa verificable (mock, fixture) si existe.

**El usuario cambia el alcance a mitad de tarea.** Se termina o se divide la tarea actual
(nunca se abandona a medias), y luego se replanifica (`replanning-and-risks.md`).

**La skill indicada contradice el código existente.** Prevalece CLAUDE.md del proyecto; se
anota la contradicción en "Notas" y, si es relevante, se abre una entrada de backlog.

## Formato de cierre de tarea

Bloque que cierra la respuesta al usuario tras cada tarea. Debe permitir entender todo sin
leer el hilo.

```markdown
### Cierre F1-T3 · Crear caso de uso EmitirFactura · done
- Hecho: caso de uso con numeración por serie; excepción `PedidoNoCerrado`; 4 tests.
- Verificación: `php artisan test --filter=EmitirFactura` -> 4 passed (0.42 s). Lint y tipos limpios.
- Archivos: app/Facturacion/Application/EmitirFactura.php, app/Facturacion/Domain/Exceptions/PedidoNoCerrado.php, tests/Unit/Facturacion/EmitirFacturaTest.php
- Commit: `feat(facturacion): emitir factura desde pedido cerrado` (a1b2c3d)
- Devlog: devlog/2026-08-25/014-f1-t3-emitir-factura.md
- Desviaciones: tamaño real S; excepción de dominio no prevista.
- Plan: F1 3/4 · siguiente F1-T4 (M) Crear ruta y página de listado.
- Preguntas: ninguna.
```

Siete a nueve líneas. Sin narrativa del proceso; solo resultado, prueba y siguiente paso.

## Checklist

- [ ] Dependencias `done` antes de empezar.
- [ ] Exactamente una tarjeta `doing` durante la tarea.
- [ ] Solo se leyó la skill/sección indicada (o se anotó la corrección).
- [ ] Implementación completa, con caso negativo y tests.
- [ ] Verificación ejecutada tal como dice la tarjeta, salida pegada; lint y tipos limpios.
- [ ] Devlog creado e indexado (`devlog/<YYYY-MM-DD>/NNN-<slug>.md`); commit Conventional con `Tarea: <id>` en el cuerpo.
- [ ] Tarjeta `[done]` con desviaciones y enlace al devlog; tabla de fases y fecha actualizadas.
- [ ] Siguiente tarea propuesta según dependencias.
- [ ] Bloque de cierre de tarea en la respuesta.
