# Plantilla del informe de auditoría

Archivo: `docs/auditoria/<AAAA-MM-DD>-<area>.md`. En el idioma del usuario, sin jerga innecesaria en
el resumen (lo lee quien decide, no solo quien programa).

```markdown
# Auditoría de backend — <área> (<AAAA-MM-DD>)

## Resumen ejecutivo
<3-5 frases: estado general, los riesgos que importan y qué recomiendas hacer primero.>

| Gravedad | Confirmados | Probables |
|---|---|---|
| Crítica | 0 | 0 |
| Alta | 0 | 0 |
| Media | 0 | 0 |
| Baja | 0 | 0 |

## Alcance y método
- Área: <…> · Objetivo: <antes de refactor / heredar / incidente / producción>
- Stack y versiones: <…>
- Herramientas ejecutadas: <comando → resultado resumido>
- Límites: <herramientas que no se pudieron usar, zonas no revisadas>

## Mapa de riesgo
<Top 10 de hotspots.mjs con nota de lo encontrado en cada uno.>

## Hallazgos
<Uno por bloque, ordenados por prioridad.>

## Sospechas sin confirmar
| Qué | Dónde | Qué haría falta para confirmarlo |
|---|---|---|

## Plan propuesto
| Prioridad | Hallazgo | Arreglo | Esfuerzo |
|---|---|---|---|
```

## Plantilla de un hallazgo

```markdown
### H-03 · Un cliente puede ver los pedidos de otro · Crítica · Confirmado

**Dónde**: `app/Http/Controllers/OrderController.php:42` (método `show`)

**Evidencia**:
- Test de reproducción `tests/Feature/Audit/OrderIdorTest.php` (falla hoy):
  el usuario A pide `/orders/{id-del-usuario-B}` y recibe 200 con los datos.
- Salida: `php artisan test --filter=OrderIdorTest` → FAIL (expected 403, got 200)

**Por qué está mal**: la ruta recibe el id y consulta el pedido sin comprobar su propietario.
Cualquier usuario autenticado puede recorrer ids y ver pedidos ajenos (datos personales: RGPD).

**Impacto**: exposición de datos de todos los clientes; obligación de notificar si se explota.

**Arreglo**: policy `OrderPolicy@view` + `$this->authorize('view', $order)`, o scope por usuario.
Receta: `code-quality/references/auth-patterns.md`. El test de reproducción pasa a verde con el arreglo.

**Esfuerzo**: S
```

## Reglas del informe
- Cada hallazgo con evidencia; la confianza (confirmado o probable) siempre visible.
- Sin secretos ni datos personales en el informe: se describen, no se copian.
- Los tests de reproducción se guardan (por ejemplo en `tests/Feature/Audit/`) y se quedan como
  regresión cuando se arreglen.
- Números reales, no "muchos" ni "bastante lento".
