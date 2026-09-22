// Funciones compartidas por los hooks de dev-standards (Node >= 18, ESM).
// Port agnóstico de _common.ps1: mismo comportamiento en Windows, macOS y Linux.
// Los hooks leen stdin como UTF-8 directo (sin reparación de codepage OEM: eso era un problema de PowerShell).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export function readHookInput() {
    // Lectura de stdin robusta en Windows: readFileSync(0) falla con pipes de algunas shells
    // (EOF/EAGAIN a mitad); se lee por bloques tolerando esos errores.
    const chunks = [];
    const buf = Buffer.alloc(65536);
    for (;;) {
        let n = 0;
        try { n = fs.readSync(0, buf, 0, buf.length, null); }
        catch (e) { if (e && e.code === 'EAGAIN') continue; break; }
        if (n <= 0) break;
        chunks.push(Buffer.from(buf.subarray(0, n)));
    }
    let raw = Buffer.concat(chunks).toString('utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);   // PowerShell 5.1 antepone BOM al pipe
    if (!raw || !raw.trim()) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

// Regex del registro/config (sintaxis .NET): JS no soporta el inline (?i), se quita y se aplica el flag i.
export function psRegex(pattern, flags = 'i') {
    return new RegExp(String(pattern).replace(/\(\?i\)/g, ''), flags);
}

export function projectRoot() { return process.env.CLAUDE_PROJECT_DIR || process.cwd(); }

export function sessionFlag(sid, name) {
    const s = String(sid || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
    return path.join(os.tmpdir(), `dev-standards-${name}-${s}.flag`);
}

export function projectFlag(root, name) {
    // Flag keyed por proyecto (no por sesión): builds/tests son estado del proyecto.
    const hash = crypto.createHash('md5').update(String(root).toLowerCase(), 'utf8').digest('hex').slice(0, 12);
    return path.join(os.tmpdir(), `dev-standards-${name}-${hash}.flag`);
}

export function testOnce(sid, name) {   // true la PRIMERA vez por sesión; crea el marcador
    const f = sessionFlag(sid, name);
    if (fs.existsSync(f)) return false;
    try { fs.writeFileSync(f, ''); } catch {}
    return true;
}

function stripBom(s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }
function readJson(file) { try { return JSON.parse(stripBom(fs.readFileSync(file, 'utf8'))); } catch { return null; } }
export function readText(file) { try { return stripBom(fs.readFileSync(file, 'utf8')); } catch { return null; } }

export function hookConfig(root) {
    // Proyecto primero; en modo plugin, config.json neutro del plugin
    const candidates = [path.join(root, '.claude', 'hooks', 'config.json')];
    if (process.env.CLAUDE_PLUGIN_ROOT) candidates.push(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'hooks', 'config.json'));
    for (const c of candidates) {
        if (fs.existsSync(c)) { const j = readJson(c); if (j) return j; }
    }
    return null;
}

export function getMarker(root) {
    // .dev-standards.json del proyecto; si no existe (modo plugin), se reconstruye desde config.json
    const m = path.join(root, '.dev-standards.json');
    if (fs.existsSync(m)) { const j = readJson(m); if (j) return j; }
    const cfg = hookConfig(root);
    if (cfg && cfg.stack) return { stack: cfg.stack, frontProfile: cfg.frontProfile, extraSkills: [], bundles: [], fromConfig: true };
    return null;
}

function dirNames(d) {
    try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort(); }
    catch { return []; }
}
function fileNames(d) {
    try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name).sort(); }
    catch { return []; }
}

export function availableSkills(root, cfg) {
    // Modo hermético (suite test-router): solo skills del proyecto + config, ignorando ~/.claude global
    let a = [];
    const projSkills = path.join(root, '.claude', 'skills');
    if (process.env.DEV_STANDARDS_TEST_ISOLATED === '1') {
        a = a.concat(dirNames(projSkills));
        if (cfg && cfg.skills) a = a.concat(cfg.skills);
        return [...new Set(a)];
    }
    for (const d of [projSkills, path.join(os.homedir(), '.claude', 'skills')]) a = a.concat(dirNames(d));
    if (cfg && cfg.skills) a = a.concat(cfg.skills);
    // skills de TODOS los plugins instalados (no solo el que ejecuta el hook)
    const plugRoot = path.join(os.homedir(), '.claude', 'plugins');
    for (const sd of findDirsNamed(plugRoot, 'skills', 6)) {
        for (const n of dirNames(sd)) if (fs.existsSync(path.join(sd, n, 'SKILL.md'))) a.push(n);
    }
    if (process.env.CLAUDE_PLUGIN_ROOT) a = a.concat(dirNames(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'skills')));
    return [...new Set(a)];
}

function findDirsNamed(base, name, maxDepth) {
    const out = [];
    const stack = [[base, 0]];
    while (stack.length) {
        const [d, depth] = stack.pop();
        for (const n of dirNames(d)) {
            const p = path.join(d, n);
            if (n === name) out.push(p);
            else if (depth < maxDepth) stack.push([p, depth + 1]);
        }
    }
    return out;
}

export function git(root, args) {
    try {
        return execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
    } catch { return ''; }
}
export function gitBranch(root) { return git(root, ['rev-parse', '--abbrev-ref', 'HEAD']); }
export function gitDirty(root) {   // número de archivos con cambios (tracked + untracked, sin ignorados)
    const o = git(root, ['status', '--porcelain']);
    return o ? o.split(/\r?\n/).filter(l => l).length : 0;
}

function findFirstFile(dir, fileName) {
    if (!fs.existsSync(dir)) return null;
    for (const f of fileNames(dir)) if (f === fileName) return path.join(dir, f);
    for (const d of dirNames(dir)) {
        const hit = findFirstFile(path.join(dir, d), fileName);
        if (hit) return hit;
    }
    return null;
}
export { findFirstFile };

export function designSystemMaster(root) {
    const f = findFirstFile(path.join(root, 'design-system'), 'MASTER.md');
    return f ? path.relative(root, f).replace(/\\/g, '/') : null;
}

export function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayDevlog(root) {
    const d = path.join(root, 'devlog', todayStr());
    return fileNames(d).filter(n => n.endsWith('.md') && n !== 'DECISIONES.md');
}

export function devlogNextNumber(root) {   // mayor NNN global + 1 (numeración correlativa de toda la vida del proyecto)
    const base = path.join(root, 'devlog');
    if (!fs.existsSync(base)) return 1;
    let max = 0;
    const stack = [base];
    while (stack.length) {
        const d = stack.pop();
        for (const f of fileNames(d)) {
            const m = /^(\d{3})-/.exec(f);
            if (f.endsWith('.md') && m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
        }
        for (const sd of dirNames(d)) stack.push(path.join(d, sd));
    }
    return max + 1;
}

export function devlogIndexed(root, name) {   // ¿aparece el NNN de la entrada en devlog/INDEX.md?
    const idx = path.join(root, 'devlog', 'INDEX.md');
    const m = /^(\d{3})-/.exec(name);
    if (!fs.existsSync(idx) || !m) return true;
    const txt = readText(idx) || '';
    return new RegExp('\\|\\s*' + m[1] + '\\s*\\|').test(txt);
}

export function outHookJson(event, extra) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, ...extra } }) + '\n');
}

export function planStatus(root) {
    // Devuelve { exists, doing: [], next: [], done, total } leyendo plan/PLAN.md (tarjetas "### ID · Titulo [S] [estado]")
    const f = path.join(root, 'plan', 'PLAN.md');
    const r = { exists: false, doing: [], next: [], done: 0, total: 0 };
    const txt = readText(f);
    if (txt === null) return r;
    r.exists = true;
    for (const line of txt.split(/\r?\n/)) {
        const m = /^###\s+([A-Z]+\d*-T\d+[a-z]?)\s*[·\-]\s*(.+?)\s*\[(S|M|L)\]\s*\[(todo|doing|blocked|done)\]/.exec(line);
        if (m) {
            r.total++;
            const [, id, title, , st] = m;
            if (st === 'done') r.done++;
            else if (st === 'doing') r.doing.push(`${id} ${title}`);
            else if (st === 'todo' && r.next.length < 2) r.next.push(`${id} ${title}`);
        }
    }
    return r;
}

export function pad3(n) { return String(n).padStart(3, '0'); }
