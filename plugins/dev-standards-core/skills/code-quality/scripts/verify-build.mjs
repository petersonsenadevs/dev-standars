#!/usr/bin/env node
// Verifica el proyecto tras editar código: lint, types, tests y build, con veredicto.
// Ejecutar desde la RAÍZ del proyecto (cualquier agente, cualquier OS):
//   node <skills-dir>/code-quality/scripts/verify-build.mjs [--todos] [--paquete apps/web] [--sin-build]
// Proyecto simple: comandos de .claude/hooks/config.json -> commands o, si no hay, inferidos del manifiesto.
// Monorepo (pnpm/yarn/npm workspaces, turbo, o paquetes en apps/*, packages/*, services/*, libs/*):
// verifica CADA paquete en su carpeta, con su lenguaje: package.json (con el gestor del lockfile),
// pyproject.toml (ruff/mypy/pytest según su configuración, vía uv o poetry si los usa), composer.json
// (pint/phpstan/artisan test) y go.mod (go vet/go test). Por defecto solo los paquetes con cambios sin
// commitear (si no hay cambios o no hay git, todos); --todos fuerza todos.
// Una herramienta no instalada o un script inexistente cuenta como SKIP con su motivo, no como fallo.
// Si nada FALLA, deja constancia (flag que lee el stop-guard); sale con 1 si algo falla.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync, execFileSync } from 'node:child_process';

const root = process.cwd();
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const todos = args.includes('--todos');
const sinBuild = args.includes('--sin-build');
const soloPaquete = opt('--paquete');

const existe = (...p) => fs.existsSync(path.join(...p));
function readJson(f) { try { let s = fs.readFileSync(f, 'utf8'); if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); return JSON.parse(s); } catch { return null; } }
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } }
const rel = d => (path.relative(root, d) || '.').replace(/\\/g, '/');

// Los comandos del stack vienen en formato POSIX ("./vendor/bin/pint --test"). En Windows cmd.exe no entiende
// "./" y responde "no se reconoce...": se resuelve el binario local a su ruta real (pint.bat, eslint.cmd...).
function resolverComando(c, dir) {
    const m = /^(?:\.\/)?((?:vendor\/bin|node_modules\/\.bin)\/[\w.-]+)(.*)$/.exec(c.trim());
    if (!m) return c;
    const base = path.join(dir, ...m[1].split('/'));
    const candidatos = process.platform === 'win32' ? [base + '.bat', base + '.cmd', base] : [base];
    const real = candidatos.find(f => fs.existsSync(f));
    if (!real) return c;
    const prefijo = process.platform === 'win32' && real === base && m[1].startsWith('vendor/') ? 'php ' : '';
    return `${prefijo}"${real}"${m[2]}`;
}

// ---------------------------------------------------------------- paquetes
const MANIFIESTOS = ['package.json', 'pyproject.toml', 'composer.json', 'go.mod'];
const tieneManifiesto = d => MANIFIESTOS.some(m => existe(d, m));
function expandir(patron) {   // "apps/*", "packages/**", "apps/web" (sin dependencias de glob)
    const limpio = patron.replace(/^["']|["']$/g, '').replace(/\/+$/, '');
    if (!limpio || limpio.startsWith('!')) return [];
    let actuales = [root];
    for (const p of limpio.split('/')) {
        const sig = [];
        for (const a of actuales) {
            if (p.includes('*')) {
                const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*+/g, '.*') + '$');
                try { for (const e of fs.readdirSync(a, { withFileTypes: true })) if (e.isDirectory() && re.test(e.name) && !/^(node_modules|\.|dist|build|vendor)/.test(e.name)) sig.push(path.join(a, e.name)); } catch {}
            } else if (existe(a, p)) sig.push(path.join(a, p));
        }
        actuales = sig;
    }
    return actuales;
}
function patronesWorkspace() {
    const pats = [];
    const ws = readText(path.join(root, 'pnpm-workspace.yaml'));
    if (ws) { const bloque = /packages:\s*\r?\n((?:[ \t]*-.*(?:\r?\n|$))+)/.exec(ws); if (bloque) for (const l of bloque[1].split(/\r?\n/)) { const m = /^\s*-\s*(.+?)\s*(#.*)?$/.exec(l); if (m) pats.push(m[1]); } }
    const pkg = readJson(path.join(root, 'package.json'));
    if (pkg && pkg.workspaces) pats.push(...[].concat(Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces.packages || [])));
    const lerna = readJson(path.join(root, 'lerna.json')); if (lerna && lerna.packages) pats.push(...lerna.packages);
    return pats;
}
const subpaquetes = [...new Set([...patronesWorkspace(), 'apps/*', 'packages/*', 'services/*', 'libs/*', 'backend', 'frontend', 'api', 'web', 'server', 'client']
    .flatMap(expandir).map(d => path.resolve(d)))].filter(d => d !== root && tieneManifiesto(d)).sort();
const raizEsPaquete = tieneManifiesto(root);
const esMonorepo = subpaquetes.length > 0;

// ---------------------------------------------------------------- gestor de paquetes y prefijo de Python
function gestorJs(dir) {
    for (const d of [dir, root]) {
        if (existe(d, 'pnpm-lock.yaml')) return 'pnpm';
        if (existe(d, 'yarn.lock')) return 'yarn';
        if (existe(d, 'bun.lockb') || existe(d, 'bun.lock')) return 'bun';
        if (existe(d, 'package-lock.json')) return 'npm';
    }
    return 'npm';
}
const correr = (gestor, script) => gestor === 'yarn' ? `yarn ${script}` : `${gestor} run ${script}`;
function prefijoPy(dir) {
    for (const d of [dir, root]) { if (existe(d, 'uv.lock')) return 'uv run '; if (existe(d, 'poetry.lock')) return 'poetry run '; }
    return '';
}

// ---------------------------------------------------------------- comandos por paquete
function comandosDe(dir, esRaiz) {
    const cmds = new Map();
    // config.json manda en un proyecto simple (sus comandos son de raíz; en un monorepo no aplican)
    const cfg = esRaiz && !esMonorepo ? readJson(path.join(root, '.claude', 'hooks', 'config.json')) : null;
    if (cfg && cfg.commands) for (const k of ['lint', 'types', 'test', 'build']) if (cfg.commands[k]) cmds.set(k, resolverComando(String(cfg.commands[k]), dir));
    if (cmds.size) return cmds;
    const pkg = readJson(path.join(dir, 'package.json'));
    if (pkg) {
        const s = pkg.scripts || {};
        const g = gestorJs(dir);
        const uno = (...nombres) => nombres.find(n => s[n] && !/no test specified/i.test(s[n]));
        const lint = uno('lint'); if (lint) cmds.set('lint', correr(g, lint));
        const tipos = uno('typecheck', 'type-check', 'types', 'check-types', 'tsc', 'check');
        if (tipos) cmds.set('types', correr(g, tipos));
        else if ((pkg.dependencies && pkg.dependencies.astro) || (pkg.devDependencies && pkg.devDependencies.astro)) cmds.set('types', 'npx --no-install astro check');
        const test = uno('test', 'test:unit'); if (test) cmds.set('test', correr(g, test));
        const build = uno('build'); if (build && !sinBuild) cmds.set('build', correr(g, build));
    }
    const py = readText(path.join(dir, 'pyproject.toml'));
    if (py) {
        const pre = prefijoPy(dir);
        if (/^\[tool\.ruff/m.test(py) || existe(dir, 'ruff.toml') || existe(dir, '.ruff.toml')) cmds.set(cmds.has('lint') ? 'lint-py' : 'lint', `${pre}ruff check .`);
        if (/^\[tool\.mypy/m.test(py) || existe(dir, 'mypy.ini')) {
            // Respeta lo que la configuración dice que se revisa: con files/packages/modules, mypy sin rutas
            // (pasarle "." lo pisaría y revisaría también los tests); si no, src/ cuando existe.
            const secMypy = (/^\[tool\.mypy\][^[]*/m.exec(py) || [''])[0] + readText(path.join(dir, 'mypy.ini'));
            const objetivoMypy = /^\s*(files|packages|modules)\s*=/m.test(secMypy) ? '' : existe(dir, 'src') ? ' src' : ' .';
            cmds.set(cmds.has('types') ? 'types-py' : 'types', `${pre}mypy${objetivoMypy}`);
        }
        if (/^\[tool\.pytest/m.test(py) || existe(dir, 'pytest.ini') || existe(dir, 'tests')) cmds.set(cmds.has('test') ? 'test-py' : 'test', `${pre}pytest -q`);
    }
    if (existe(dir, 'composer.json')) {
        const bin = n => [n + '.bat', n].map(x => path.join(dir, 'vendor', 'bin', x)).find(f => fs.existsSync(f));
        const pint = bin('pint'); if (pint) cmds.set(cmds.has('lint') ? 'lint-php' : 'lint', `"${pint}" --test`);
        const phpstan = bin('phpstan'); if (phpstan) cmds.set(cmds.has('types') ? 'types-php' : 'types', `"${phpstan}" analyse`);
        if (existe(dir, 'artisan')) cmds.set(cmds.has('test') ? 'test-php' : 'test', 'php artisan test');
    }
    if (existe(dir, 'go.mod')) { cmds.set(cmds.has('lint') ? 'vet-go' : 'lint', 'go vet ./...'); cmds.set(cmds.has('test') ? 'test-go' : 'test', 'go test ./...'); }
    // Reglas de arquitectura (backend-audit references/reglas-arquitectura.md)
    const deptracBin = ['deptrac.bat', 'deptrac'].map(n => path.join(dir, 'vendor', 'bin', n)).find(f => fs.existsSync(f));
    const deptracCfg = ['deptrac.yaml', 'deptrac.yml'].find(f => existe(dir, f));
    const depcruiseCfg = ['.dependency-cruiser.cjs', '.dependency-cruiser.js'].find(f => existe(dir, f));
    if (deptracBin && deptracCfg) cmds.set('arch', `"${deptracBin}" analyse --no-progress`);
    else if (depcruiseCfg) cmds.set('arch', `npx --no-install depcruise src --config ${depcruiseCfg}`);
    else if (existe(dir, '.importlinter')) cmds.set('arch', `${prefijoPy(dir)}lint-imports`);
    return cmds;
}

// ---------------------------------------------------------------- qué paquetes verificar
function cambiados() {
    try {
        const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return out.split('\n').map(l => l.slice(3).trim().split(' -> ').pop().replace(/^"|"$/g, '')).filter(Boolean).map(f => path.resolve(root, f));
    } catch { return null; }
}
const candidatos = [...(raizEsPaquete ? [root] : []), ...subpaquetes];
let objetivo = [];
if (soloPaquete) objetivo = candidatos.filter(d => rel(d) === soloPaquete.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, ''));
else if (todos || !esMonorepo) objetivo = candidatos;
else {
    const cam = cambiados();
    if (!cam || !cam.length) objetivo = candidatos;
    else {
        objetivo = subpaquetes.filter(d => cam.some(f => f.startsWith(d + path.sep)));
        const sueltos = cam.filter(f => !subpaquetes.some(d => f.startsWith(d + path.sep)));
        const codigoSuelto = sueltos.filter(f => /\.(m?[jt]sx?|cjs|vue|svelte|astro|php|py|go|rs|css|scss)$/i.test(f) || /^(package|tsconfig[\w.-]*|turbo|composer|pyproject|biome|\.?eslint[\w.-]*|\.prettierrc[\w.-]*|prettier\.config[\w.-]*)\.(json|jsonc|toml|js|cjs|mjs|ya?ml)$|^(pnpm-workspace\.yaml|\.eslintrc|\.prettierrc)$/i.test(path.basename(f)));
        if (codigoSuelto.length) objetivo = raizEsPaquete ? [root, ...objetivo] : candidatos;   // config compartida: afecta a todos
        if (!objetivo.length) {
            console.log(`[verify-build] Monorepo: los cambios sin commitear no tocan ningún paquete ni código (${sueltos.length} archivo(s): docs, devlog o configuración). Nada que verificar.`);
            constancia();
            process.exit(0);
        }
    }
}
if (soloPaquete && !objetivo.length) { console.log(`[verify-build] No encuentro el paquete "${soloPaquete}". Paquetes: ${candidatos.map(rel).join(', ') || '(ninguno)'}`); process.exit(2); }

const plan = objetivo.map(d => ({ dir: d, cmds: comandosDe(d, d === root) })).filter(p => p.cmds.size);
if (!plan.length) {
    console.log(`[verify-build] No hay comandos que ejecutar${esMonorepo ? ` en ${objetivo.map(rel).join(', ')}` : ''} (sin config.json ni scripts de lint/types/test/build reconocibles).`);
    process.exit(2);
}
if (esMonorepo) console.log(`[verify-build] Monorepo: ${plan.map(p => rel(p.dir)).join(', ')}${!todos && !soloPaquete ? ' (los paquetes con cambios; --todos para todos)' : ''}`);
if (args.includes('--plan')) {   // solo enseña qué ejecutaría
    for (const { dir, cmds } of plan) for (const [k, c] of cmds) console.log(`  ${rel(dir)} · ${k}: ${c}`);
    process.exit(0);
}

// ---------------------------------------------------------------- ejecutar
// Herramienta no instalada o script que no existe = SKIP con motivo (no es un fallo del código).
const NO_CONFIGURADO = /Missing script|no test specified|command not found|no se reconoce|is not recognized|ERR_PNPM_NO_SCRIPT|Couldn't find a script|No module named '?(ruff|mypy|pytest)\b|Failed to spawn: `(ruff|mypy|pytest)`|executable file not found|no tests ran|collected 0 items/i;
const results = [];
let fails = 0;
for (const { dir, cmds } of plan) {
    const pre = esMonorepo ? `${rel(dir)} · ` : '';
    for (const [k, c] of cmds) {
        console.log(`== ${pre}${k}: ${c}`);
        let out = '', code = 0;
        try {
            out = execSync(c, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
        } catch (e) {
            code = e.status == null ? 1 : e.status;
            out = (e.stdout || '') + (e.stderr || '');
        }
        // pytest sale con 5 cuando no hay tests: no es un fallo
        if (code !== 0 && (NO_CONFIGURADO.test(out) || (code === 5 && /pytest/.test(c)))) {
            const motivo = out.split(/\r?\n/).find(l => NO_CONFIGURADO.test(l)) || out.split(/\r?\n/).find(l => l.trim()) || '';
            results.push(`SKIP  ${pre}${k}  (no configurado: ${motivo.trim().slice(0, 110)})`);
            continue;
        }
        if (code !== 0) {
            fails++;
            results.push(`FAIL  ${pre}${k}  (exit ${code})`);
            console.log(out.split(/\r?\n/).filter(l => l).slice(-15).join('\n'));
        } else results.push(`PASS  ${pre}${k}`);
    }
}

console.log('\n== Resumen ==');
for (const r of results) console.log(`  ${r}`);
if (fails) {
    console.log(`\n[verify-build] ${fails} comando(s) en FALLO: corrige y re-ejecuta hasta 0. No des la tarea por hecha en rojo.`);
    process.exit(1);
}
constancia();
console.log('\n[verify-build] Todo en verde. Constancia registrada. Si tocaste UI, ademas ui-verify (movil primero).');
process.exit(0);

function constancia() {   // flag para el stop-guard (mismo esquema de hash que core/hooks/lib.mjs)
    const hash = crypto.createHash('md5').update(root.toLowerCase(), 'utf8').digest('hex').slice(0, 12);
    fs.writeFileSync(path.join(os.tmpdir(), `dev-standards-verified-${hash}.flag`), '');
}
