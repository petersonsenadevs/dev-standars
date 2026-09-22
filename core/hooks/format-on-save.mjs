// Hook PostToolUse (Edit|Write|MultiEdit): formatea el archivo recién escrito con la herramienta del stack.
// Lee .claude/hooks/config.json -> formatters { "<ext>": "<comando con {file}>" } (generado por dev-standards
// a partir de stack.json) y ejecuta el formateador solo si su binario existe en el proyecto. No bloquea nunca;
// si formatea, informa por STDOUT (visible en el transcript). Timeout corto para no frenar al agente.
// Ejemplos por defecto si no hay config:
//   .php  -> vendor/bin/pint {file}
//   .ts .tsx .js .jsx .vue .astro .css .json .md -> npx prettier --write {file}   (solo si existe node_modules/.bin/prettier)
//   .py   -> ruff format {file}  (solo si ruff está en PATH)

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { readHookInput, projectRoot, hookConfig } from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);
const file = p.tool_input && p.tool_input.file_path ? String(p.tool_input.file_path) : '';
if (!file || !fs.existsSync(file)) process.exit(0);

const root = projectRoot();
const ext = path.extname(file).toLowerCase();
if (/[\\/](vendor|node_modules|\.git|dist|build)[\\/]/i.test(file)) process.exit(0);

function which(bin) {
    const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
    for (const dir of (process.env.PATH || '').split(path.delimiter)) {
        if (!dir) continue;
        for (const e of exts) { try { if (fs.existsSync(path.join(dir, bin + e))) return true; } catch {} }
    }
    return false;
}
function firstExisting(...candidates) { return candidates.find(c => fs.existsSync(path.join(root, c))) || null; }

const formatters = {};
const cfg = hookConfig(root);
if (cfg && cfg.formatters) for (const [k, v] of Object.entries(cfg.formatters)) formatters[k] = String(v);
if (!Object.keys(formatters).length) {
    const pint = firstExisting(path.join('vendor', 'bin', 'pint.bat'), path.join('vendor', 'bin', 'pint'));
    if (pint) formatters['.php'] = `"${path.join(root, pint)}" {file}`;
    if (firstExisting(path.join('node_modules', '.bin', 'prettier.cmd'), path.join('node_modules', '.bin', 'prettier'))) {
        for (const e of ['.ts', '.tsx', '.js', '.jsx', '.vue', '.astro', '.css', '.scss', '.json', '.md']) formatters[e] = 'npx prettier --write {file}';
    }
    if (which('ruff')) formatters['.py'] = 'ruff format {file}';
}
if (!formatters[ext]) process.exit(0);

const cmd = formatters[ext].replace('{file}', '"' + file + '"');
try {
    execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 25000, encoding: 'utf8' });
    process.stdout.write(`[format-on-save] ${path.basename(file)} formateado con: ${formatters[ext].split(' ')[0]}\n`);
} catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).split(/\r?\n/).filter(l => l).slice(0, 3).join(' | ');
    process.stdout.write(`[format-on-save] fallo al formatear ${path.basename(file)}: ${out}\n`);
}
process.exit(0);
