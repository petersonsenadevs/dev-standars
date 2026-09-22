# Prohibiciones específicas — WordPress

Además de las globales (`core/methodology/prohibited-actions.md`):

- Editar el core (`wp-admin/`, `wp-includes/`) o themes/plugins de terceros — child theme o plugin propio.
- `wp db reset`, `wp db drop`, `wp site empty` — destruyen el sitio. Aprobación explícita.
- Editar `wp-config.php` o `.htaccess` desde el agente — los toca el usuario.
- SQL sin `$wpdb->prepare()`; salida sin escapar; formularios/AJAX sin nonce + `current_user_can()`.
- Desactivar actualizaciones de seguridad o instalar plugins/themes nulled o sin mantenimiento.
- Subir cambios por FTP a pelo a producción sin pasar por el flujo de deploy pactado.
