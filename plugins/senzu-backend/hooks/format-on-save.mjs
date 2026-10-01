// Hook PostToolUse (Edit|Write|MultiEdit; en Codex, apply_patch): formatea el archivo recién escrito con la
// herramienta del stack. Lee .claude/hooks/config.json -> formatters { "<ext>": "<comando con {file}>" }.
// Nunca impone un estilo que el proyecto no tiene:
//   1) Prettier solo si el proyecto tiene su configuración (.prettierrc*, prettier.config.*, "prettier" en
//      package.json) y Prettier instalado en node_modules; jamás con valores por defecto ni descargándolo (npx --no-install).
//      Ruff solo con ruff.toml/.ruff.toml o [tool.ruff] en pyproject.toml. Pint solo si está en vendor/bin.
//   2) Si al formatear una EDICIÓN cambian muchas más líneas de las que tocó el agente, el archivo no sigue el
//      estilo del formateador: se deshace el formateo, se avisa y ese formateador se apaga para esa extensión
//      el resto de la sesión.
// No bloquea nunca. Avisa al agente por additionalContext (vuelve a leer el archivo antes de otra edición).

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { readHookInput, projectRoot, hookConfig, outHookJson, sessionFlag, readText } from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);
const ti = p.tool_input || {};
const file = ti.file_path ? String(ti.file_path) : '';
if (!file || !fs.existsSync(file)) process.exit(0);
const sid = p.session_id ? String(p.session_id) : 'default';

const root = projectRoot();
const ext = path.extname(file).toLowerCase();
if (/[\\/](vendor|node_modules|\.git|dist|build)[\\/]/i.test(file)) process.exit(0);
const apagado = sessionFlag(sid, 'fmtoff' + ext.replace('.', '-'));
if (fs.existsSync(apagado)) process.exit(0);

const existe = (...rel) => rel.some(r => fs.existsSync(path.join(root, r)));
function which(bin) {
    const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
    for (const dir of (process.env.PATH || '').split(path.delimiter)) {
        if (!dir) continue;
        for (const e of exts) { try { if (fs.existsSync(path.join(dir, bin + e))) return true; } catch {} }
    }
    return false;
}
function tieneConfigPrettier() {
    if (existe('.prettierrc', '.prettierrc.json', '.prettierrc.json5', '.prettierrc.yaml', '.prettierrc.yml', '.prettierrc.toml',
        '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs', '.prettierrc.ts', 'prettier.config.js', 'prettier.config.cjs',
        'prettier.config.mjs', 'prettier.config.ts')) return true;
    try { return !!JSON.parse(readText(path.join(root, 'package.json')) || '{}').prettier; } catch { return false; }
}
const prettierInstalado = () => existe(path.join('node_modules', '.bin', 'prettier.cmd'), path.join('node_modules', '.bin', 'prettier'));
const tieneConfigRuff = () => existe('ruff.toml', '.ruff.toml') || /^\[tool\.ruff/m.test(readText(path.join(root, 'pyproject.toml')) || '');

const formatters = {};
const cfg = hookConfig(root);
if (cfg && cfg.formatters) for (const [k, v] of Object.entries(cfg.formatters)) formatters[k] = String(v);
if (!Object.keys(formatters).length) {
    if (existe(path.join('vendor', 'bin', 'pint.bat'), path.join('vendor', 'bin', 'pint'))) formatters['.php'] = 'php vendor/bin/pint {file}';
    for (const e of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.astro', '.svelte', '.css', '.scss', '.json', '.md']) formatters[e] = 'npx prettier --write {file}';
    if (which('ruff')) formatters['.py'] = 'ruff format {file}';
}
let cmdTpl = formatters[ext];
if (!cmdTpl) process.exit(0);

// 1) Sin configuración del formateador en el proyecto no se formatea (evita imponer valores por defecto)
if (/\bprettier\b/.test(cmdTpl)) {
    if (!tieneConfigPrettier() || !prettierInstalado()) process.exit(0);
    cmdTpl = cmdTpl.replace(/\bnpx\s+(?!--no-install)/, 'npx --no-install ');
}
if (/\bruff\b/.test(cmdTpl) && !tieneConfigRuff()) process.exit(0);
if (/vendor\/bin\/pint/.test(cmdTpl) && !existe(path.join('vendor', 'bin', 'pint'), path.join('vendor', 'bin', 'pint.bat'))) process.exit(0);

const antes = fs.readFileSync(file, 'utf8');
const cmd = cmdTpl.replace('{file}', '"' + file + '"');
const nombre = cmdTpl.replace(/^npx\s+(--no-install\s+)?/, '').split(' ')[0];
try {
    execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 25000, encoding: 'utf8' });
} catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).split(/\r?\n/).filter(l => l).slice(0, 3).join(' | ');
    outHookJson('PostToolUse', { additionalContext: `[format-on-save] no se pudo formatear ${path.basename(file)} con ${nombre}: ${out}` });
    process.exit(0);
}
const despues = fs.readFileSync(file, 'utf8');
if (despues === antes) process.exit(0);

// 2) Una edición solo puede cambiar sus propias líneas (más un margen). Write = archivo completo del agente.
if (p.tool_name !== 'Write') {
    const tocadas = [].concat(p.tool_name === 'Edit' ? [ti.new_string] : (ti.edits || []).map(e => e && e.new_string))
        .reduce((n, s) => n + String(s || '').split('\n').length, 0);
    const cambiadas = lineasCambiadas(antes, despues);
    if (cambiadas > tocadas + 5) {
        fs.writeFileSync(file, antes, 'utf8');
        fs.writeFileSync(apagado, '');
        outHookJson('PostToolUse', { additionalContext: `[format-on-save] ${nombre} cambiaba ${cambiadas} líneas de ${path.basename(file)} y tu edición solo tocaba unas ${tocadas}: el archivo no sigue el estilo de ese formateador. Formateo DESHECHO (el archivo queda como lo dejaste) y ${nombre} desactivado para ${ext} en esta sesión. Respeta el estilo que ya tiene el archivo.` });
        process.exit(0);
    }
}
outHookJson('PostToolUse', { additionalContext: `[format-on-save] ${path.basename(file)} formateado con ${nombre}: vuelve a leerlo antes de la siguiente edición.` });
process.exit(0);

function lineasCambiadas(a, b) {   // líneas de b que no estaban en a (multiconjunto): barato y suficiente
    const cuenta = new Map();
    for (const l of a.split(/\r?\n/)) cuenta.set(l, (cuenta.get(l) || 0) + 1);
    let n = 0;
    for (const l of b.split(/\r?\n/)) { const c = cuenta.get(l) || 0; if (c) cuenta.set(l, c - 1); else n++; }
    return n;
}
