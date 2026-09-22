// Hook PreToolUse (Edit|Write|MultiEdit|NotebookEdit): bloquea la edición de archivos protegidos.
// Bloquea (exit 2 + motivo en STDERR):
//   - archivos GENERADOS por dev-standards (CLAUDE.md, AGENTS.md, .cursor/rules, .windsurf/rules, .claude/skills/**, ...)
//   - secretos y config sensible: .env, .env.*, *.pem, *.key, id_rsa*, credentials*, secrets*
//   - dependencias y artefactos: vendor/**, node_modules/**, .git/**, dist/**, build/**, storage/framework/**, __pycache__/**
//   - migraciones ya ejecutadas/compartidas: que existan en git (no nuevas)
//   - rutas extra definidas en .claude/hooks/config.json -> protectedPaths (glob simples con * y **)
// Permite todo lo demás. Nunca bloquea la creación de archivos nuevos salvo secretos.

import fs from 'node:fs';
import path from 'node:path';
import { readHookInput, projectRoot, hookConfig, git, readText } from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(p.tool_name)) process.exit(0);

let file = p.tool_input && p.tool_input.file_path ? String(p.tool_input.file_path) : '';
if (!file && p.tool_input && p.tool_input.notebook_path) file = String(p.tool_input.notebook_path);
if (!file) process.exit(0);

const root = projectRoot();
let rel = file;
try {
    const full = path.resolve(file);
    if (full.toLowerCase().startsWith(String(root).toLowerCase())) rel = full.slice(String(root).length).replace(/^[\\/]+/, '');
} catch {}
rel = rel.replace(/\\/g, '/');
const exists = fs.existsSync(file);

function deny(why) {
    process.stderr.write(`[BLOQUEADO por dev-standards] ${why}\n`);
    process.stderr.write(`Archivo: ${rel}\n`);
    process.exit(2);
}

// 1) Generados por dev-standards
if (/^(CLAUDE\.md|AGENTS\.md)$/i.test(rel) && exists) {
    const head = (readText(file) || '').split(/\r?\n/).slice(0, 2).join(' ');
    if (/GENERADO por dev-standards/i.test(head)) deny('Archivo generado por dev-standards. Edita stacks\\<stack>\\ o core\\ en D:\\dev-standards y corre sync.ps1.');
}
if (/^(\.claude\/skills|\.agents\/skills|\.cursor\/skills|\.windsurf\/skills|\.cursor\/rules|\.windsurf\/rules|\.claude\/hooks)\//i.test(rel)
    || /^(\.claude\/settings\.json|\.mcp\.json|\.dev-standards\.json)$/i.test(rel)) {
    deny('Archivo generado por dev-standards (skills, reglas, hooks, settings, mcp, marcador). Edita el origen en dev-standards y corre sync.ps1; para permisos locales usa .claude/settings.local.json.');
}
if (/^(plugins|core\/skills-vendor)\//i.test(rel) && fs.existsSync(path.join(root, 'tools', 'vendor.ps1'))) {
    deny('Carpeta generada de dev-standards (plugins/ o core/skills-vendor/). Edita core/skills-overlay o core/skills y regenera con build-plugins.ps1 / vendor.ps1.');
}

// 2) Secretos
if (/(^|\/)\.env(\.|$)/i.test(rel) || /\.(pem|key|p12|pfx)$/i.test(rel) || /(^|\/)(id_rsa|id_ed25519)/i.test(rel) || /(^|\/)(credentials|secrets?)(\.|\/|$)/i.test(rel)) {
    deny('Archivo de secretos/credenciales. No se edita desde el agente: hazlo tu a mano.');
}

// 3) Dependencias y artefactos
if (/(^|\/)(vendor|node_modules|\.git|dist|build|\.next|\.nuxt|\.astro|__pycache__|\.venv|venv)\//i.test(rel) || /(^|\/)storage\/framework\//i.test(rel)) {
    deny('Dependencias o artefactos generados: no se editan a mano (cambia la fuente o la configuracion).');
}

// 4) Migraciones ya versionadas (Laravel/Prisma/Alembic): solo bloquea si el archivo ya esta en git
if (exists && /(^|\/)(database\/migrations|prisma\/migrations|alembic\/versions|migrations)\/[^/]+/i.test(rel)) {
    if (git(root, ['ls-files', '--error-unmatch', '--', rel])) deny('Migracion ya versionada/compartida: no se edita. Crea una migracion nueva.');
}

// 5) Rutas extra del proyecto (config.json -> protectedPaths)
const cfg = hookConfig(root);
if (cfg && cfg.protectedPaths) {
    try {
        for (const g of [].concat(cfg.protectedPaths)) {
            if (!g) continue;
            const esc = String(g).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp('^' + esc.replace(/\\\*\\\*\//g, '(.*/)?').replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^/]*') + '$', 'i');
            if (rx.test(rel)) deny(`Ruta protegida por el proyecto (${g}). Pide aprobacion explicita.`);
        }
    } catch {}
}
process.exit(0);
