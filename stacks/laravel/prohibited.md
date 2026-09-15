# Prohibiciones específicas — Laravel

Además de las globales (`core/methodology/prohibited-actions.md`):

- `php artisan migrate:fresh`, `migrate:refresh`, `db:wipe` — destruyen datos. Aprobación explícita.
- `php artisan db:seed` sobre datos reales — solo en entorno de desarrollo limpio.
- Editar migraciones ya ejecutadas/compartidas — crea una migración nueva en su lugar.
- `DB::statement`/`DB::unprepared` con DROP/TRUNCATE/DELETE sin WHERE.
- Tocar `.env`, `config/*` con credenciales, o `php artisan key:generate` en un proyecto existente.
- Desactivar CSRF, validación o mass-assignment protection.
