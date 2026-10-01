// Hook PreToolUse (Edit|Write|MultiEdit): hace cumplir las CONVENCIONES ADOPTADAS del proyecto (/adoptar).
// Lee <raiz>/conventions.json (generado por el comando /adoptar tras analizar un proyecto existente) y
// bloquea (exit 2) lo que INTRODUCE un patrón prohibido por una regla. Igual que code-hygiene: solo lo
// nuevo cuenta (lo viejo ya estaba), y la línea con 'dev-standards-allow' escapa un caso puntual.
// Esquema de conventions.json:
//   { "_sello": "dev-standards:inmutable", "rules": [
//       { "files": "\\.(ts|tsx)$", "forbid": "\\binterface\\s", "why": "este proyecto usa 'type', no 'interface'" }
//   ] }
// files = regex sobre la ruta relativa (con /); forbid = regex sobre el contenido introducido; why = motivo mostrado.
// Sin conventions.json el hook no hace nada.

import path from 'node:path';
import {
    readHookInput, projectRoot, psRegex, testIntroduced, readText, ruta,
} from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);
const file = p.tool_input && p.tool_input.file_path ? String(p.tool_input.file_path) : '';
if (!file) process.exit(0);

const root = projectRoot();
let conv = null;
try { conv = JSON.parse(readText(ruta(root, 'conventions.json'))); } catch { process.exit(0); }
const rules = [].concat((conv && conv.rules) || []).filter(r => r && r.forbid);
if (!rules.length) process.exit(0);

let rel = file;
try {
    const full = path.resolve(file);
    if (full.toLowerCase().startsWith(String(root).toLowerCase())) rel = full.slice(String(root).length).replace(/^[\\/]+/, '');
} catch {}
rel = rel.replace(/\\/g, '/');
if (/(^|\/)(vendor|node_modules|\.git|dist|build)\//i.test(rel) || /(^|\/)conventions\.(md|json)$/i.test(rel)) process.exit(0);

const ti = p.tool_input || {};
const pairs = [];
if (p.tool_name === 'Edit') pairs.push([String(ti.new_string || ''), String(ti.old_string || '')]);
else if (p.tool_name === 'Write') pairs.push([String(ti.content || ''), '']);
else if (p.tool_name === 'MultiEdit') for (const e of [].concat(ti.edits || [])) pairs.push([String(e.new_string || ''), String(e.old_string || '')]);

for (const r of rules) {
    let filesRx = null, forbidRx = null;
    try {
        if (r.files) filesRx = psRegex(r.files);
        forbidRx = psRegex(r.forbid);
    } catch { continue; }   // regla malformada: no bloquear por ella
    if (filesRx && !filesRx.test(rel)) continue;
    for (const pair of pairs) {
        const hit = testIntroduced(forbidRx, pair[0], pair[1]);
        if (hit) {
            const why = r.why ? String(r.why) : `patron prohibido por convencion: ${r.forbid}`;
            process.stderr.write(`[BLOQUEADO por dev-standards] Convencion del proyecto (conventions.json): ${why}. Linea: '${hit}'.\n`);
            process.stderr.write("Las convenciones adoptadas GANAN a tus preferencias: escribe el codigo como lo hace este proyecto (conventions.md). Si el usuario decide cambiar la convencion, que lo diga explicitamente y se re-ejecuta /adoptar.\n");
            process.exit(2);
        }
    }
}
process.exit(0);
