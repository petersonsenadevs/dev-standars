# WordPress: recetas de theme/plugin a medida y WooCommerce

Índice: 1 Dónde va cada cosa · 2 Seguridad (el 90% de los hacks) · 3 Datos y queries · 4 Hooks bien usados ·
5 WooCommerce · 6 Rendimiento · 7 Gutenberg/ACF · 8 Errores típicos del agente

## 1. Dónde va cada cosa
- **Plugin propio**: lógica de negocio, CPTs, taxonomías, shortcodes, endpoints REST, integraciones.
  Sobrevive a cambios de theme. Un solo plugin "miweb-core" mejor que diez micro-plugins.
- **Child theme**: presentación (templates, CSS, `functions.php` solo para lo visual del theme).
- **Nunca**: core, themes/plugins de terceros (se pierde en el siguiente update).

## 2. Seguridad — sanitizar/escapar/prepare/nonce, sin excepción
```php
// ENTRADA: sanitizar según el tipo
$email = sanitize_email( wp_unslash( $_POST['email'] ?? '' ) );
$texto = sanitize_text_field( wp_unslash( $_POST['nombre'] ?? '' ) );
// SALIDA: escapar según el contexto
echo esc_html( $titulo );  echo esc_url( $enlace );  echo esc_attr( $clase );  echo wp_kses_post( $html_permitido );
// ACCIÓN admin/AJAX: nonce + capability, siempre los dos
check_ajax_referer( 'miweb_accion', 'nonce' );
if ( ! current_user_can( 'edit_posts' ) ) { wp_send_json_error( null, 403 ); }
```
- REST API propia: `register_rest_route` con `permission_callback` REAL (nunca `__return_true` en escritura).
- Uploads: `wp_handle_upload` + lista blanca de mimes. Nada de `move_uploaded_file` a mano.

## 3. Datos y queries
- API de WP primero: `WP_Query`, `get_posts`, `get_post_meta`, `wp_insert_post`. SQL directo solo si no hay API:
  `$wpdb->get_results( $wpdb->prepare( "SELECT ... WHERE id = %d", $id ) )` — **siempre prepare**.
- Options para config (autoload solo si se usa en cada carga); transients para caché con TTL;
  post meta para datos por entrada (indexa con meta_key si filtras mucho — o tabla propia con `dbDelta`).
- `WP_Query`: `no_found_rows => true` si no paginas, `fields => 'ids'` si solo necesitas IDs,
  jamás `posts_per_page => -1` en público.

## 4. Hooks bien usados
- `add_action`/`add_filter` con prioridad explícita si importa el orden; callbacks con prefijo o clase propia.
- Encolar assets: `wp_enqueue_scripts` (front) / `admin_enqueue_scripts`, con versión (`filemtime`) para cache-busting.
- Al quitar un hook de un tercero: mismos argumentos y prioridad exactos o no se quita (fallo silencioso).

## 5. WooCommerce
- Personaliza con hooks de Woo (`woocommerce_before_add_to_cart_button`, filtros de precio, etc.) antes que
  overrides; si hay override: `child-theme/woocommerce/<ruta-exacta>` y revisar tras cada update de Woo
  (Woo avisa de templates desactualizados en Estado del sistema).
- Checkout: cada cambio se prueba con una compra completa (invitado + registrado). Pasarelas: sandbox primero.
- Datos de pedido: `$order->get_meta()` / CRUD de Woo, no SQL directo a postmeta (HPOS lo rompe).

## 6. Rendimiento
- Medir con Query Monitor antes de optimizar. Caché de página (hosting/WP Rocket) + object cache si hay Redis.
- Transients para APIs externas y queries caras. Imágenes: tamaños registrados + `srcset` automático.
- Cron de WP es pseudo-cron (visitas): para tareas críticas, cron real del sistema llamando a `wp cron event run`.

## 7. Gutenberg / ACF
- Bloques a medida: ACF Blocks (rápido, PHP) o bloque nativo (JS) según el proyecto — no mezclar enfoques.
- ACF: grupos de campos versionados en código (JSON local en `acf-json/`) para que viajen por git.

## 8. Errores típicos del agente
- Escribir en `functions.php` del theme PADRE, o editar un plugin de terceros "solo esta línea".
- Olvidar `wp_unslash` antes de sanitizar `$_POST`; escapar al guardar en vez de al mostrar.
- Crear tablas sin `dbDelta` ni versión de esquema; queries a `wp_posts` con SQL cuando `WP_Query` bastaba.
- Meter jQuery nuevo (regla dura global): WP moderno funciona sin él; usa vanilla o el stack del theme.
