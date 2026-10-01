// Hook PreToolUse (Edit|Write|MultiEdit): muros de backend. Bloquea lo que se INTRODUCE (lo que ya estaba
// no cuenta) y admite el escape puntual 'senzu-allow' en la línea, con el motivo:
//   1. Migraciones destructivas en la parte "up" (borrar o renombrar columnas o tablas en un solo paso):
//      en producción se pierden datos o se rompe la app mientras se despliega. Patrón seguro: expandir → contraer.
//   2. env() de Laravel fuera de config/: con la configuración cacheada (producción) devuelve null.
//   3. Datos personales en logs: volcar la request entera, cuerpos de petición o contraseñas y tokens (RGPD).

import fs from 'node:fs';
import { readHookInput, testIntroduced } from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);
const ti = p.tool_input || {};
const file = String(ti.file_path || '').replace(/\\/g, '/');
if (!/\.(php|ts|js|mjs|cjs|py|sql|go|java|cs|rb)$/i.test(file)) process.exit(0);
if (/(^|\/)(vendor|node_modules)\//i.test(file)) process.exit(0);

// Contenido completo antes y después (para Edit se aplica el cambio sobre el archivo real)
let antes = '';
try { antes = fs.readFileSync(file, 'utf8'); } catch {}
let despues = antes;
if (p.tool_name === 'Write') despues = String(ti.content || '');
else if (p.tool_name === 'Edit') despues = antes.replace(String(ti.old_string || ''), String(ti.new_string || ''));
else for (const e of [].concat(ti.edits || [])) despues = despues.replace(String(e.old_string || ''), String(e.new_string || ''));

function bloquear(msg, linea) {
    process.stderr.write(`[BLOQUEADO por Senzu] ${msg}\nLínea: '${linea}'\nSi el usuario lo ha aprobado explícitamente, añade 'senzu-allow' con el motivo en esa línea y anótalo en el devlog.\n`);
    process.exit(2);
}

// 1. Migraciones destructivas (solo la parte que se aplica al migrar)
if (/(database\/migrations|migrations|alembic\/versions|prisma\/migrations)\//i.test(file)) {
    const parteUp = t => t.split(/(function\s+down\s*\(|def\s+downgrade\s*\(|exports\.down\b|async\s+down\s*\(|public\s+async\s+down\s*\()/i)[0];
    const destructivo = /(->dropColumn\s*\(|->renameColumn\s*\(|Schema::(drop|dropIfExists|rename)\s*\(|->dropIfExists\s*\(|\bDROP\s+(TABLE|COLUMN)\b|\bRENAME\s+(COLUMN|TO)\b|op\.drop_(column|table)\s*\(|new_column_name\s*=|\.dropColumn\s*\(|\.dropTable\s*\(|\.renameColumn\s*\()/i;
    const hit = testIntroduced(destructivo, parteUp(despues), parteUp(antes));
    if (hit) bloquear('Migración destructiva (borrar o renombrar columnas o tablas) en la parte que se aplica al migrar. '
        + 'En producción pierde datos o rompe la versión que sigue desplegada. Haz expandir → migrar datos → contraer en despliegues '
        + 'separados (code-quality references/database-design.md, migraciones seguras) y confirma con el usuario que hay backup.', hit);
}

// 2. env() fuera de config/ (Laravel)
if (/\.php$/i.test(file) && !/(^|\/)config\//i.test(file)) {
    const hit = testIntroduced(/(?<![\w>$:])env\s*\(\s*['"]/, despues, antes);
    if (hit) bloquear('env() fuera de config/: con la configuración cacheada (php artisan config:cache, lo normal en producción) '
        + 'devuelve null y falla solo en producción. Define la clave en config/<archivo>.php y usa config(\'archivo.clave\').', hit);
}

// 3. Datos personales en logs
const pii = /((Log::\w+|logger\s*\(|->(info|debug|warning|error|notice)\s*\()[^\n]*\$request->(all|input)\s*\(\s*\)|(logger|log|console)\.(info|debug|warn|error|log)\s*\([^\n]*\breq\.(body|headers|query)\b|(logger|logging|log)\.\w+\s*\([^\n]*\brequest\.(json|body|form|headers|data)\b|(Log::\w+|logger\s*\(|\blog(ger)?\.\w+\s*\()[^\n]*(password|contrase[nñ]a|passwd|api[_-]?key|access[_-]?token|secret)\b)/i;
const hitPii = testIntroduced(pii, despues, antes);
if (hitPii) bloquear('Estás registrando en logs la petición completa o un dato sensible (contraseña, token, clave). '
    + 'Los logs se guardan, se copian y los lee más gente: eso es una fuga de datos personales (RGPD). '
    + 'Registra solo identificadores y los campos necesarios (code-quality references/errors-logging.md).', hitPii);

process.exit(0);
