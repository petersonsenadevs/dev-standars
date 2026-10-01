# Stack: WordPress / PHP clásico

> Este prompt es EVOLUTIVO: se ajusta a medida que avanza el proyecto (quitar/añadir indicaciones).

Trabajas en un proyecto WordPress (theme/plugin a medida, quizá WooCommerce). Sigue las reglas base + estas.

## Convenciones
- **Nunca toques el core** (`wp-admin/`, `wp-includes/`) ni themes/plugins de terceros: todo va en el
  **child theme** o en un plugin propio, vía hooks (`add_action`/`add_filter`).
- WordPress Coding Standards (WPCS): tabs, snake_case en funciones, prefijo propio en todo lo global
  (`miweb_`), `wp_enqueue_script/style` para assets (nunca `<script src>` a mano en templates).
- Texto siempre traducible: `__( 'Texto', 'textdomain' )` / `esc_html__()`. Español por defecto.
- PHP moderno dentro de lo que permita el hosting (mínimo el `Requires PHP` del theme).

## Seguridad (innegociable en WP)
- **Sanitizar al entrar, escapar al salir**: `sanitize_text_field()` y compañía en inputs;
  `esc_html()`/`esc_attr()`/`esc_url()`/`wp_kses_post()` en TODA salida.
- SQL solo con `$wpdb->prepare()`; mejor aún, la API de WP (`WP_Query`, `get_posts`, metadatos).
- Nonces (`wp_nonce_field`/`check_admin_referer`) + `current_user_can()` en cada acción de admin/AJAX.
- Uploads validados por tipo; nada de `eval`, `extract` ni includes con variables.

## WooCommerce (si aplica)
- Personaliza con **hooks de Woo** antes que sobreescribir templates; si hay override, en
  `child-theme/woocommerce/` copiando la versión del template (se revisa en cada update de Woo).
- Nada de tocar el checkout sin probar el flujo de compra completo después.

## Datos y entorno
- `wp db reset/drop` y `wp site empty` **prohibidos sin aprobación** (destruyen el sitio).
- Cambios de BD por código (migraciones propias en el plugin con `dbDelta`), no ediciones manuales en producción.
- `wp-config.php` y `.htaccess` no se editan desde el agente (protegidos): pide al usuario.

## Antes de dar por hecho
1. `./vendor/bin/phpcs -ps` (WPCS) si está instalado 2. probar la página afectada logueado Y anónimo
3. si tocaste Woo: una compra de prueba 4. actualizar `senzu/devlog/`.

## Front y diseño
- Este stack tiene **perfil de front**: antes de crear o editar UI aplica la skill `ui-ux-pro-max` y el
  `senzu/design-system/*/MASTER.md` del proyecto (ver bloque "Front y diseño" generado por Senzu).

## Plan y tareas
- Antes de una feature o proyecto: `senzu/plan/PLAN.md` (skill `project-planner`); una tarea `doing` a la vez.
- El cuerpo del commit lleva `Tarea: <id>` y la tarjeta se marca `done` con el enlace al devlog.
