# Mejores prácticas — WordPress

## Arquitectura
- Lógica de negocio en un **plugin propio** (sobrevive a cambios de theme); presentación en el child theme.
- Un prefijo único (`miweb_`) en funciones, options, transients, handles de assets y tablas propias.
- Custom Post Types y taxonomías por código (plugin), no con builders; campos con ACF o `register_meta`.
- Plantillas: jerarquía de WP (`single-{cpt}.php`, `archive-…`) y `get_template_part()` para trocear.

## Rendimiento
- `WP_Query` con `no_found_rows`, `fields` y paginación; nunca `posts_per_page => -1` en listados públicos.
- Transients (`get_transient`/`set_transient`) para consultas caras y APIs externas.
- Assets: encolar solo donde se usan (`wp_enqueue_*` condicional), imágenes con `srcset` nativo de WP.
- Caché de página (hosting o plugin) + object cache si el hosting lo da; medir con Query Monitor.

## Actualizaciones y mantenimiento
- Core, plugins y themes actualizados en staging primero; changelog leído antes de subir majors.
- Plugins: pocos y de calidad (activos, mantenidos); cada plugin nuevo es superficie de ataque.
- Backups automáticos con restore probado ANTES de cualquier update grande (deploy-ops §backups).

## Seguridad
- Sanitizar entrada / escapar salida / prepare en SQL / nonces + capabilities — SIEMPRE, sin excepción.
- Usuarios con el rol mínimo; sin `admin` como nombre de usuario; login protegido (limitar intentos).
- `DISALLOW_FILE_EDIT` activo; claves/salt únicos; nada de credenciales en el repo (wp-config fuera o con env).

## Testing
- Como mínimo smoke manual documentado (páginas clave + formularios + compra si hay Woo).
- Para lógica de plugin propia: PHPUnit con el test suite de WP (`wp scaffold plugin-tests`) si el proyecto da para ello.

> Detalle y ejemplos bajo demanda: skill `code-quality` → `references/wordpress.md` (+ `security-owasp.md`, `performance.md`).
