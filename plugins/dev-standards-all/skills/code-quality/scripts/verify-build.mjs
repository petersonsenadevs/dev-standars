#!/usr/bin/env node
// Verifica el proyecto tras editar código: lint, types, tests y build del stack, con veredicto.
// Ejecutar desde la RAÍZ del proyecto (cualquier agente, cualquier OS):
//   node <skills-dir>/code-quality/scripts/verify-build.mjs
// Comandos: 1) .claude/hooks/config.json -> commands (dev-standards); 2) si no existe, se infieren de
// package.json (scripts lint/typecheck/test/build + astro check) y composer.json (pint/phpstan/artisan test).
// Un script npm inexistente cuenta como SKIP, no como fallo. Si TODO pasa, deja constancia (flag que lee el
// stop-guard de Claude); sale con 1 si algo FALLA. El agente debe corregir y re-ejecutar hasta 0 fallos.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const root = process.cwd();
const cmds = new Map();

function readJson(f) { try { let s = fs.readFileSync(f, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); } catch { return null; } }

const cfg = readJson(path.join(root, '.claude', 'hooks', 'config.json'));
if (cfg && cfg.commands) {
    for (const k of ['lint', 'types', 'test', 'build']) if (cfg.commands[k]) cmds.set(k, String(cfg.commands[k]));
}
if (!cmds.size) {
    const pkg = readJson(path.join(root, 'package.json'));
    if (pkg) {
        const scripts = Object.keys(pkg.scripts || {});
        if (scripts.includes('lint')) cmds.set('lint', 'npm run lint');
        if (scripts.includes('typecheck')) cmds.set('types', 'npm run typecheck');
        else if ((pkg.dependencies && pkg.dependencies.astro) || (pkg.devDependencies && pkg.devDependencies.astro)) cmds.set('types', 'npx astro check');
        if (scripts.includes('test')) cmds.set('test', 'npm test');
        if (scripts.includes('build')) cmds.set('build', 'npm run build');
    }
    if (fs.existsSync(path.join(root, 'composer.json'))) {
        const pint = ['pint.bat', 'pint'].map(n => path.join(root, 'vendor', 'bin', n)).find(f => fs.existsSync(f));
        if (pint) cmds.set('lint', `"${pint}" --test`);
        const phpstan = ['phpstan.bat', 'phpstan'].map(n => path.join(root, 'vendor', 'bin', n)).find(f => fs.existsSync(f));
        if (phpstan) cmds.set('types', `"${phpstan}" analyse`);
        if (fs.existsSync(path.join(root, 'artisan'))) cmds.set('test', 'php artisan test');
    }
}
// Reglas de arquitectura (backend-audit references/reglas-arquitectura.md): si el proyecto tiene su
// configuracion, se comprueban siempre. Los tests de arquitectura de Pest/ArchUnit ya van en 'test'.
if (!cmds.has('arch')) {
    const deptracBin = ['deptrac.bat', 'deptrac'].map(n => path.join(root, 'vendor', 'bin', n)).find(f => fs.existsSync(f));
    const deptracCfg = ['deptrac.yaml', 'deptrac.yml'].find(f => fs.existsSync(path.join(root, f)));
    const depcruiseCfg = ['.dependency-cruiser.cjs', '.dependency-cruiser.js'].find(f => fs.existsSync(path.join(root, f)));
    if (deptracBin && deptracCfg) cmds.set('arch', `"${deptracBin}" analyse --no-progress`);
    else if (depcruiseCfg) cmds.set('arch', `npx depcruise src --config ${depcruiseCfg}`);
    else if (fs.existsSync(path.join(root, '.importlinter'))) cmds.set('arch', 'lint-imports');
}
if (!cmds.size) { console.log('[verify-build] No hay comandos que ejecutar (ni config.json ni package/composer reconocibles).'); process.exit(2); }

const results = [];
let fails = 0;
for (const [k, c] of cmds) {
    console.log(`== ${k}: ${c}`);
    let out = '', code = 0;
    try {
        out = execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    } catch (e) {
        code = e.status == null ? 1 : e.status;
        out = (e.stdout || '') + (e.stderr || '');
    }
    if (code !== 0 && /Missing script|no test specified|command not found|no se reconoce/i.test(out)) {
        results.push(`SKIP  ${k}  (no configurado en este proyecto)`);
        continue;
    }
    if (code !== 0) {
        fails++;
        const tail = out.split(/\r?\n/).filter(l => l).slice(-15).join('\n');
        results.push(`FAIL  ${k}  (exit ${code})`);
        console.log(tail);
    } else {
        results.push(`PASS  ${k}`);
    }
}

console.log('\n== Resumen ==');
for (const r of results) console.log(`  ${r}`);
if (fails) {
    console.log(`\n[verify-build] ${fails} comando(s) en FALLO: corrige y re-ejecuta hasta 0. No des la tarea por hecha en rojo.`);
    process.exit(1);
}
// Constancia para el stop-guard (mismo esquema de hash que core/hooks/lib.mjs)
const hash = crypto.createHash('md5').update(root.toLowerCase(), 'utf8').digest('hex').slice(0, 12);
fs.writeFileSync(path.join(os.tmpdir(), `dev-standards-verified-${hash}.flag`), '');
console.log('\n[verify-build] Todo en verde. Constancia registrada. Si tocaste UI, ademas ui-verify (movil primero).');
process.exit(0);
