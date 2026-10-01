// Hook SessionEnd: limpia los marcadores de sesión de Senzu en el temp (prefijo interno dev-standards-) (rápido: presupuesto de 1,5 s).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readHookInput } from './lib.mjs';

const p = readHookInput();
const sid = p && p.session_id ? String(p.session_id).replace(/[^a-zA-Z0-9_-]/g, '') : 'default';
const tmp = os.tmpdir();
let entries = [];
try { entries = fs.readdirSync(tmp).filter(n => n.startsWith('dev-standards-') && n.endsWith('.flag')); } catch {}   // compat-dev-standards
const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
for (const n of entries) {
    const f = path.join(tmp, n);
    try {
        if (sid && n.endsWith(`-${sid}.flag`)) { fs.rmSync(f, { force: true }); continue; }
        // Limpieza de marcadores antiguos (> 2 días)
        if (fs.statSync(f).mtimeMs < cutoff) fs.rmSync(f, { force: true });
    } catch {}
}
process.exit(0);
