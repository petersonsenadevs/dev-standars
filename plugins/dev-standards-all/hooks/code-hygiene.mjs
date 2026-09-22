// Hook PreToolUse (Edit|Write|MultiEdit): bloquea BASURA DE DEBUG introducida en código fuente y los
// VETOS de design-system/*/gustos.md (términos entre acentos graves en la sección "## No").
// Bloquea solo lo que se INTRODUCE (patrón en lo nuevo y no en lo viejo). Escape puntual: si la línea
// que contiene el match lleva "dev-standards-allow", se permite (para scripts CLI legítimos).
// Debug: console.log/debug, debugger, dd(), var_dump(), ray(). El resto (any, lint) es del linter.

import fs from 'node:fs';
import path from 'node:path';
import { readHookInput, projectRoot, findFirstFile, testIntroduced } from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);
const file = p.tool_input && p.tool_input.file_path ? String(p.tool_input.file_path) : '';
if (!file) process.exit(0);
if (!/\.(ts|tsx|js|jsx|mjs|cjs|vue|astro|svelte|php|html|css|blade\.php)$/i.test(file)) process.exit(0);
if (/(test|spec|\.config\.|vite\.config|astro\.config|tailwind\.config|[\\/](scripts?|tools|\.claude|devlog|design-system|node_modules|vendor)[\\/])/i.test(file)) process.exit(0);

// pares (nuevo, viejo) según la herramienta (testIntroduced compartido en lib.mjs)
const pairs = [];
const ti = p.tool_input || {};
if (p.tool_name === 'Edit') pairs.push([String(ti.new_string || ''), String(ti.old_string || '')]);
else if (p.tool_name === 'Write') pairs.push([String(ti.content || ''), '']);
else if (p.tool_name === 'MultiEdit') for (const e of [].concat(ti.edits || [])) pairs.push([String(e.new_string || ''), String(e.old_string || '')]);

// --- 1. Debug introducido ---
const debugPatterns = [
    { p: /console\.(log|debug)\s*\(/, m: 'console.log/debug en codigo fuente' },
    { p: /^\s*debugger\b/m,           m: 'sentencia debugger' },
    { p: /(?<![\w$])dd\s*\(/,         m: 'dd() de depuracion' },
    { p: /\bvar_dump\s*\(/,           m: 'var_dump()' },
    { p: /(?<![\w$])ray\s*\(/,        m: 'ray() de depuracion' },
];
for (const pair of pairs) {
    for (const dp of debugPatterns) {
        const hit = testIntroduced(dp.p, pair[0], pair[1]);
        if (hit) {
            process.stderr.write(`[BLOQUEADO por dev-standards] Estas introduciendo ${dp.m}: '${hit}'. Usa el logger del proyecto o eliminalo antes de guardar. Si es intencional (script CLI), anade 'dev-standards-allow' como comentario en esa linea.\n`);
            process.exit(2);
        }
    }
}

// --- 2. Vetos de gustos.md (términos entre acentos graves bajo "## No") ---
const root = projectRoot();
const gustos = findFirstFile(path.join(root, 'design-system'), 'gustos.md');
if (gustos) {
    let txt = '';
    try { txt = fs.readFileSync(gustos, 'utf8'); } catch {}
    let noSection = '';
    const sec = /##\s*No\b([\s\S]*?)(\n##\s|$)/.exec(txt);
    if (sec) noSection = sec[1];
    const vetoes = [...noSection.matchAll(/`([^`]{3,40})`/g)].map(m => m[1]);
    for (const pair of pairs) {
        for (const v of vetoes) {
            const pat = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const hit = testIntroduced(pat, pair[0], pair[1]);
            if (hit) {
                process.stderr.write(`[BLOQUEADO por dev-standards] '${v}' esta VETADO por el cliente en ${path.relative(root, gustos).replace(/\\/g, '/')} (seccion No): '${hit}'. No se re-propone un veto sin preguntar explicitamente al usuario.\n`);
                process.exit(2);
            }
        }
    }
}
process.exit(0);
