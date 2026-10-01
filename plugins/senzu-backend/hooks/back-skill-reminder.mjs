// Hook PreToolUse (Edit|Write|MultiEdit): la PRIMERA vez por sesión que el agente va a editar código de
// backend (controladores, servicios, modelos, rutas, migraciones, API), le recuerda la receta de su stack,
// las convenciones selladas y las versiones reales. Equivalente de front-skill-reminder. No bloquea.

import fs from 'node:fs';
import path from 'node:path';
import {
    readHookInput, projectRoot, hookConfig, testOnce, outHookJson, ruta, rutaRel,
} from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);
const file = String((p.tool_input && p.tool_input.file_path) || '').replace(/\\/g, '/');
if (!file) process.exit(0);
if (!/\.(php|ts|js|mjs|cjs|py|go|java|kt|cs|rb)$/i.test(file) || /\.blade\.php$/i.test(file)) process.exit(0);
const esBackend = /(^|\/)(app\/(Http|Models|Services|Actions|Jobs|Policies|Listeners|Console|Domain)|routes|database\/migrations|server|api|services|domain|modules|controllers|repositories|internal|handlers|src\/main\/java|Controllers)\//i.test(file);
if (!esBackend || /(test|spec)/i.test(file)) process.exit(0);
if (!testOnce(p.session_id || 'default', 'back-reminder')) process.exit(0);

const root = projectRoot();
const cfg = hookConfig(root) || {};
const receta = {
    laravel: 'php-laravel.md', wordpress: 'wordpress.md', 'node-api': 'node-api.md', next: 'react-next.md',
    nuxt: 'nuxt.md', sveltekit: 'sveltekit.md', astro: 'astro.md', 'vue-ts': 'typescript.md', 'python-langgraph': 'python.md',
}[cfg.stack] || null;
const convenciones = fs.existsSync(ruta(root, 'conventions.md'));

outHookJson('PreToolUse', {
    additionalContext: `[senzu] Vas a editar backend (${path.basename(file)}). Aplica la skill code-quality`
        + (receta ? ` (receta del stack: references/${receta})` : '')
        + '; para un tema concreto, su catálogo references/backend-catalog.md. '
        + (convenciones ? `Hay convenciones selladas en ${rutaRel(root, 'conventions.md')}: mandan sobre tu preferencia. ` : 'Imita el estilo del código vecino. ')
        + 'Usa las prácticas de la versión REAL del framework (la indicó session-start). Valida la entrada en el borde, '
        + 'autorización en cada acción sensible, sin N+1, y el cambio va con su test. Si algo falla, skill depurar.',
});
process.exit(0);
