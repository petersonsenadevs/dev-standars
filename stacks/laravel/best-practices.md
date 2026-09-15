# Mejores prácticas — Laravel

## Arquitectura
- Controladores delgados; lógica en Actions/Services o métodos de modelo.
- Form Requests para validación; Policies/Gates para autorización.
- API Resources para serializar respuestas; no devuelvas modelos crudos.
- Eventos + Listeners para efectos secundarios; Jobs + colas para trabajo pesado.

## Eloquent
- Eager loading (`with`) para evitar N+1. Usa `select` para limitar columnas.
- `chunk`/`lazy` para datasets grandes. Transacciones (`DB::transaction`) para operaciones múltiples.
- Casts para tipos (`array`, `datetime`, enums). Scopes para queries reutilizables.

## Migraciones
- Reversibles (`down()` correcto). Índices y FKs explícitos.
- Nunca modificar una migración ya desplegada: nueva migración incremental.

## Testing
- Pest preferido. Factories para datos. `RefreshDatabase` solo en la suite de tests, nunca a mano en dev.
- Feature tests para endpoints; Unit para lógica pura.

## Rendimiento
- Cache (`Cache::remember`) para lecturas costosas. Config/route/view cache en prod.
- Colas para email, notificaciones, procesamiento.

## Seguridad
- Validación en servidor siempre. CSRF en formularios web. Rate limiting en APIs.
- `$fillable` explícito. Autorización en cada acción sensible.

> Detalle y ejemplos bajo demanda: skill `code-quality` → `references/php-laravel.md` (+ `testing.md`, `security-owasp.md`, `performance.md`, `api-design.md`).
