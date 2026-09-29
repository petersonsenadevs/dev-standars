// Hook PreToolUse (Edit|Write|MultiEdit): bloquea BASURA DE DEBUG introducida en código fuente, los
// VETOS de design-system/*/gustos.md (términos entre acentos graves en la sección "## No"), los
// MARCADORES DE CONFLICTO de git escritos en cualquier archivo de código, y `.only`/`.skip`
// INTRODUCIDOS en archivos de test (desactivan media suite en CI sin que nadie lo vea).
// Bloquea solo lo que se INTRODUCE (patrón en lo nuevo y no en lo viejo). Escape puntual: si la línea
// que contiene el match lleva "dev-standards-allow", se permite (para scripts CLI legítimos).

import fs from 'node:fs';
import path from 'node:path';
import { readHookInput, projectRoot, findFirstFile, testIntroduced } from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);
const file = p.tool_input && p.tool_input.file_path ? String(p.tool_input.file_path) : '';
if (!file) process.exit(0);
if (!/\.(ts|tsx|js|jsx|mjs|cjs|vue|astro|svelte|php|html|css|blade\.php)$/i.test(file)) process.exit(0);
const isExcluded = /(\.config\.|vite\.config|astro\.config|tailwind\.config|[\\/](scripts?|tools|\.claude|devlog|design-system|node_modules|vendor)[\\/])/i.test(file);
const isTest = /(test|spec)/i.test(file);

// pares (nuevo, viejo) según la herramienta (testIntroduced compartido en lib.mjs)
const pairs = [];
const ti = p.tool_input || {};
if (p.tool_name === 'Edit') pairs.push([String(ti.new_string || ''), String(ti.old_string || '')]);
else if (p.tool_name === 'Write') pairs.push([String(ti.content || ''), '']);
else if (p.tool_name === 'MultiEdit') for (const e of [].concat(ti.edits || [])) pairs.push([String(e.new_string || ''), String(e.old_string || '')]);

// --- 0a. Marcadores de conflicto de git (aplica a TODO archivo de código, tests y configs incluidos) ---
for (const pair of pairs) {
    const hit = testIntroduced(/^(<{7}|>{7})( |$)|^={7}$/m, pair[0], pair[1]);
    if (hit) {
        process.stderr.write(`[BLOQUEADO por dev-standards] Estas escribiendo un MARCADOR DE CONFLICTO de git ('${hit}'): resuelve el merge de verdad (elige o combina el contenido) en vez de guardar el archivo con los marcadores dentro.\n`);
        process.exit(2);
    }
}

// --- 0b. Tests desactivados: .only / .skip / xit INTRODUCIDOS en archivos de test ---
if (isTest) {
    const skipPatterns = [
        { p: /\b(it|test|describe)\s*\.\s*(only|skip)\s*[(.]/, m: '.only/.skip' },
        { p: /\b(fit|fdescribe|xit|xdescribe|xtest)\s*\(/,     m: 'fit/xit (test enfocado o apagado)' },
        { p: /->\s*(only|skip)\s*\(/,                          m: '->only()/->skip() de Pest' },
        { p: /\bmarkTestSkipped|\bmarkTestIncomplete/,         m: 'markTestSkipped/Incomplete' },
    ];
    for (const pair of pairs) {
        for (const sp of skipPatterns) {
            const hit = testIntroduced(sp.p, pair[0], pair[1]);
            if (hit) {
                process.stderr.write(`[BLOQUEADO por dev-standards] Estas introduciendo ${sp.m} en un test: '${hit}'. Un test enfocado o apagado que llega a CI desactiva la suite en silencio. Si es a proposito (bug documentado), anade 'dev-standards-allow' con el motivo en esa linea.\n`);
                process.exit(2);
            }
        }
    }
    process.exit(0);   // en tests, el resto (console.log, vetos de diseño) esta permitido
}
if (isExcluded) process.exit(0);

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
