#!/usr/bin/env node
// Instalador AGNÓSTICO de dev-standards (Node >= 18): funciona en Windows, WSL, Linux y macOS.
// Port fiel de init-project.ps1 + sync.ps1 para las herramientas claude y codex/antigravity
// (cursor/windsurf siguen en la versión PowerShell). La suite tools/test-init-parity.ps1 compara
// la salida de ambos instaladores en cada commit: si divergen, el pre-commit falla.
//
//   node tools/init.mjs --stack laravel --path /var/www/mi-app --tools claude,codex
//   node tools/init.mjs --path /var/www/mi-app                    # con .dev-standards.json = sync
//
// Flags: --stack <n> · --path <ruta> (default: cwd) · --tools claude,codex · --skills a,b · --bundle x,y

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));   // raíz del repo dev-standards
const FRONT_GROUPS = ['front', 'motion', '3d', 'design'];
const CORE_GROUPS = ['planning', 'routing', 'quality', 'architecture', 'growth', 'ops', 'docs'];

// ---------------------------------------------------------------- helpers
const stripBom = s => (s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);
const readUtf8 = f => { try { return stripBom(fs.readFileSync(f, 'utf8')); } catch { return ''; } };
const readJson = f => { const t = readUtf8(f); return t ? JSON.parse(t) : null; };
const exists = f => fs.existsSync(f);
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function writeUtf8(f, content) { ensureDir(path.dirname(f)); fs.writeFileSync(f, content, 'utf8'); }
function copyTree(src, dst) {
    if (!exists(src)) return;
    ensureDir(dst);
    fs.cpSync(src, dst, { recursive: true, force: true });
}
function rmTree(d) { fs.rmSync(d, { recursive: true, force: true }); }
function log(msg) { console.log(msg); }
function warn(msg) { console.warn('AVISO: ' + msg); }

async function askYesNo(message, defaultYes = true) {
    if (process.env.DEV_STANDARDS_ASSUME_YES === '1') return defaultYes;
    if (!process.stdin.isTTY) return defaultYes;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const hint = defaultYes ? '[S/n]' : '[s/N]';
    const r = await new Promise(res => rl.question(`${message} ${hint} `, res));
    rl.close();
    if (!r || !r.trim()) return defaultYes;
    return /^(s|si|sí|y|yes)$/i.test(r.trim());
}

// ---------------------------------------------------------------- registro, bundles, skills
const registry = readJson(path.join(ROOT, 'core', 'skills-registry.json'));

function getBundles() {
    const obj = readJson(path.join(ROOT, 'core', 'bundles.json')) || {};
    const h = {};
    for (const [k, v] of Object.entries(obj)) if (!k.startsWith('_')) h[k] = [].concat(v);
    return h;
}
function expandBundles(bundles) {
    const b = getBundles(); const out = [];
    for (const name of bundles || []) {
        if (!name) continue;
        const k = name.toLowerCase();
        if (b[k]) out.push(...b[k]); else warn(`Bundle desconocido: ${name} (disponibles: ${Object.keys(b).join(', ')})`);
    }
    return [...new Set(out)];
}
function expandRequires(names) {
    const out = []; const queue = [...(names || []).filter(Boolean)];
    while (queue.length) {
        const n = queue.shift();
        if (out.includes(n)) continue;
        out.push(n);
        const e = registry.skills.find(s => s.name === n);
        if (e) for (const r of [].concat(e.requires || [])) if (r && !out.includes(r)) queue.push(r);
    }
    return out;
}
function resolveSkillDir(stack, name) {
    const candidates = [
        path.join(stack.dir, 'skills', name),
        path.join(ROOT, 'core', 'skills', name),
        path.join(ROOT, 'core', 'skills-plugin', name),
        path.join(ROOT, 'core', 'skills-vendor', name),
        path.join(stack.dir, name),
        name,
    ];
    for (const c of candidates) if (exists(c) && exists(path.join(c, 'SKILL.md'))) return path.resolve(c);
    return null;
}
// Selección (instalador interactivo o flags): todo | categorias (grupos del registro) | a-medida (skills sueltas).
// El núcleo va SIEMPRE: sin él los hooks (plan, devlog, cierre) no tienen a qué apuntar.
const NUCLEO = ['skill-router', 'project-planner', 'devlog', 'code-quality'];

function getSkillDirs(stack, extra, bundles) {
    const dirs = [];
    const add = d => { if (d && !dirs.includes(d)) dirs.push(d); };
    const sel = stack.selection;
    if (sel && (sel.modo === 'categorias' || sel.modo === 'a-medida')) {
        const elegidas = sel.modo === 'categorias'
            ? registry.skills.filter(s => [].concat(sel.grupos || []).includes(s.group)).map(s => s.name)
            : [].concat(sel.skills || []);
        for (const e of expandRequires([...NUCLEO, ...elegidas, ...(extra || []), ...expandBundles(bundles)])) {
            const d = resolveSkillDir(stack, e);
            if (d) add(d); else warn(`Skill '${e}' no encontrada. Ignorada.`);
        }
        return dirs;
    }
    for (const s of [].concat(stack.meta.skills || [])) {
        // rutas relativas del stack.json vienen con \ o /: normalizar para Linux
        const rel = String(s).replace(/\\/g, '/');
        const p = path.isAbsolute(rel) ? rel : path.resolve(stack.dir, rel);
        if (exists(p)) {
            if (exists(path.join(p, 'SKILL.md'))) { add(path.resolve(p)); continue; }
            for (const e of fs.readdirSync(p, { withFileTypes: true }))
                if (e.isDirectory() && exists(path.join(p, e.name, 'SKILL.md'))) add(path.join(p, e.name));
            continue;
        }
        if (rel === 'skills') continue;   // carpeta convencional stacks/<x>/skills/ aún sin crear: silencio
        const d = resolveSkillDir(stack, rel);
        if (d) add(d); else warn(`Skill '${s}' declarada en stack.json no encontrada. Ignorada.`);
    }
    for (const e of expandRequires([...(extra || []), ...expandBundles(bundles)])) {
        if (!e) continue;
        const d = resolveSkillDir(stack, e);
        if (d) add(d); else warn(`Skill opcional '${e}' no encontrada. Ignorada.`);
    }
    return dirs;
}
function mergeExtraCsv(skillDst, overlayDir) {
    const extraDir = path.join(overlayDir, 'data', 'stacks');
    if (!exists(extraDir)) return;
    for (const f of fs.readdirSync(extraDir).filter(n => n.endsWith('.extra.csv'))) {
        const target = path.join(skillDst, 'data', 'stacks', f.replace(/\.extra\.csv$/, '.csv'));
        if (!exists(target)) { warn(`extra.csv sin CSV upstream: ${f}`); continue; }
        let base = readUtf8(target);
        const extraLines = readUtf8(path.join(extraDir, f)).split(/\r?\n/).slice(1).filter(l => l !== '');
        if (!base.endsWith('\n')) base += '\n';
        writeUtf8(target, base + extraLines.join('\n') + '\n');
        fs.rmSync(path.join(skillDst, 'data', 'stacks', f), { force: true });
    }
}
function copySkills(stack, dst, extra, bundles) {
    const dirs = getSkillDirs(stack, extra, bundles);
    ensureDir(dst);
    // Quitar skills de dev-standards que ya no están seleccionadas (las propias del proyecto no se tocan)
    const elegidas = new Set(dirs.map(d => path.basename(d)));
    for (const s of registry.skills) if (!elegidas.has(s.name)) rmTree(path.join(dst, s.name));
    for (const d of dirs) {
        const name = path.basename(d);
        const skillDst = path.join(dst, name);
        rmTree(skillDst);
        copyTree(d, skillDst);
        const overlay = path.join(ROOT, 'core', 'skills-overlay', name);
        if (exists(overlay)) {
            if (exists(path.join(overlay, 'SKILL.md')) && exists(path.join(skillDst, 'SKILL.md'))) {
                fs.renameSync(path.join(skillDst, 'SKILL.md'), path.join(skillDst, 'SKILL.upstream.md'));
            }
            copyTree(overlay, skillDst);
            mergeExtraCsv(skillDst, overlay);
        }
    }
    return dirs.map(d => path.basename(d));
}
function getSkillMeta(dir) {
    const name0 = path.basename(dir);
    const overlay = path.join(ROOT, 'core', 'skills-overlay', name0, 'SKILL.md');
    const txt = readUtf8(exists(overlay) ? overlay : path.join(dir, 'SKILL.md'));
    let name = name0, desc = '';
    let m = /^name:\s*"?([^"\r\n]+)"?\s*$/m.exec(txt); if (m) name = m[1].trim();
    m = /^description:\s*"?(.+?)"?\s*$/m.exec(txt); if (m) desc = m[1].trim();
    return { name, desc };
}

// ---------------------------------------------------------------- secciones generadas (paridad con _lib.ps1)
const LOAD_PROTOCOL = [
    '**Protocolo de carga de contexto:** lee una sola skill por tarea (dos si cruza UI + lógica) y, dentro, solo la sección o referencia',
    'que indique su tabla "Lectura mínima por tarea". `SKILL.upstream.md` y `references/` se leen por secciones (Read con offset/limit o Grep),',
    'nunca enteros. No releas lo ya leído. Si la skill necesaria no está instalada, dilo y propón instalarla; no improvises esa librería.',
].join('\n');

function activationRows(installed, relPath, groups) {
    const sorted = [...registry.skills].sort((a, b) => ((b.priority || 0) - (a.priority || 0)) || String(a.name).localeCompare(String(b.name), 'en'));
    const rows = [];
    for (const sk of sorted) {
        if (!groups.includes(sk.group)) continue;
        if (installed.includes(sk.name)) rows.push(`| ${sk.when} | \`${relPath}/${sk.name}/SKILL.md\` |`);
    }
    return rows;
}
function activationSection(stack, extra, bundles, relPath) {
    const installed = getSkillDirs(stack, extra, bundles).map(d => path.basename(d));
    const L = [];
    const core = activationRows(installed, relPath, CORE_GROUPS);
    if (core.length) {
        L.push('\n---\n\n# Planificación y calidad\n');
        if (installed.includes('project-planner')) {
            L.push('**Plan del proyecto:** si existe `plan/PLAN.md`, es la fuente de verdad de qué se hace ahora: elige la tarea `doing` o la primera `todo` y sigue su tarjeta (skill + sección, hecho cuando, verificar). Si no existe y la petición es un proyecto o feature (no un arreglo puntual), crea el plan con la skill `project-planner` antes de codificar.');
            L.push('');
        }
        L.push(LOAD_PROTOCOL);
        L.push('');
        L.push('| Si la tarea implica… | Lee antes |');
        L.push('|---|---|');
        L.push(...core);
        if (!installed.includes('ddd-hexagonal')) {
            L.push('');
            L.push('Para dominios complejos (reglas de negocio ricas, varios contextos) existe la skill opcional `ddd-hexagonal`: pídeme instalarla con `sync.ps1 -Bundle architecture`.');
        }
    }
    const fp = stack.meta.frontProfile;
    const frontInstalled = registry.skills.filter(s => FRONT_GROUPS.includes(s.group) && installed.includes(s.name));
    if (fp || frontInstalled.length) {
        L.push('\n---\n\n# Front y diseño' + (fp ? ` (perfil: ${fp.label})` : '') + '\n');
        if (fp) {
            const stacks = [].concat(fp.stacks); const primary = stacks[0];
            L.push(`Este proyecto es de **${fp.label}**. Para cualquier trabajo de UI se aplica la skill \`ui-ux-pro-max\` con estos stacks del`);
            L.push('buscador, en este orden de prioridad: ' + stacks.map(s => '`' + s + '`').join(', ') + '.');
            L.push('');
            L.push('**Antes de crear o editar UI** (páginas, componentes, estilos, layouts, formularios):');
            L.push(`1. Lee \`${relPath}/ui-ux-pro-max/SKILL.md\` (flujo, perfiles y reglas duras) si aún no lo has hecho en esta sesión; solo su tabla de lectura mínima te dirá qué referencia abrir.`);
            L.push('2. Si existe `design-system/*/MASTER.md`, es la fuente de verdad de estilo, color y tipografía. Si no existe, genéralo (y si hay plan, es la primera tarjeta de UI):');
            L.push('   ```bash');
            L.push(`   python3 ${relPath}/ui-ux-pro-max/scripts/search.py "<producto industria keywords>" --design-system -p "<Proyecto>" --persist -o .`);
            L.push(`   # Windows: py -3 ${relPath}/ui-ux-pro-max/scripts/search.py ...`);
            L.push('   ```');
            L.push(`3. Guías del stack: \`python3 ${relPath}/ui-ux-pro-max/scripts/search.py "<tema>" --stack ${primary}\` (y el resto de stacks del perfil si aplica).`);
            L.push('4. Antes de entregar, pasa el checklist de `references/pro-rules.md` (contraste, teclado, 375/768/1440 px, estados, reduced-motion, sin emojis como iconos).');
            L.push('');
        } else {
            L.push('Este stack no tiene perfil de front, pero hay skills de front/animación/3D instaladas. Detecta el stack de UI como indica `skill-router` antes de usarlas.');
            L.push('');
        }
        L.push('## Activación de skills de front (lee el SKILL.md indicado ANTES de actuar)');
        L.push('');
        L.push('| Si la tarea implica… | Skill |');
        L.push('|---|---|');
        L.push(...activationRows(installed, relPath, FRONT_GROUPS));
        const notInstalled = registry.skills
            .filter(s => !installed.includes(s.name) && ['gsap-scrolltrigger', 'threejs-webgl', 'react-three-fiber', 'motion-framer'].includes(s.name))
            .map(s => s.name);
        if (notInstalled.length) {
            L.push('');
            L.push('Skills opcionales NO instaladas en este proyecto: ' + notInstalled.map(n => '`' + n + '`').join(', ') +
                '. Si la tarea las necesita, pídeme instalarlas con `sync.ps1 -Skills <nombre>` o `-Bundle core-3d-animation`; no improvises esas librerías sin su skill.');
        }
    }
    if (!L.length) return '';
    return L.join('\n') + '\n';
}
function sessionSection(stack) {
    const L = ['\n---\n\n# Sesión y comandos del proyecto\n'];
    L.push('**Al iniciar cada sesión** (si no hay hooks que lo hagan por ti, hazlo tú): ejecuta y lee `git status -sb`, `git log --oneline -5`,');
    L.push('la cabecera y la fase activa de `plan/PLAN.md` (si existe) y `devlog/<hoy>/` + última entrada de `devlog/INDEX.md`. No commitees en `main`/`master`/`develop`.');
    L.push('**Al cerrar**: tarea del plan actualizada (`done` con enlace al devlog), devlog del día escrito, siguiente tarea propuesta.');
    const cmds = stack.meta.commands;
    if (cmds && Object.keys(cmds).length) {
        L.push('');
        L.push('**Comandos del stack** (úsalos para verificar antes de decir "hecho" y pega su salida):');
        L.push('');
        L.push('| Acción | Comando |');
        L.push('|---|---|');
        for (const [k, v] of Object.entries(cmds)) L.push(`| ${k} | \`${v}\` |`);
    }
    return L.join('\n') + '\n';
}
function skillsSection(stack, extra, bundles, relPath) {
    const dirs = getSkillDirs(stack, extra, bundles);
    if (!dirs.length) return '';
    const lines = ['\n---\n\n# Skills disponibles en este proyecto\n',
        'Cada skill es una carpeta con `SKILL.md` (instrucciones), `references/`, `scripts/` y `templates/`.',
        'Cuando la tarea encaje con la descripción, **lee su `SKILL.md` completo antes de actuar** y sigue su flujo. ' +
        'En Codex puedes invocarla explícitamente con `$<nombre>`.\n'];
    for (const d of dirs) {
        const m = getSkillMeta(d);
        const short = m.desc.length > 200 ? m.desc.substring(0, 197) + '...' : m.desc;
        lines.push(`- **${m.name}** (\`${relPath}/${m.name}/SKILL.md\`): ${short}`);
    }
    return lines.join('\n') + '\n';
}
// Modo ahorro (opcional, solo en CLAUDE.md): quita lo que en Claude Code ya cubren las skills y los hooks
// (lista de skills, metodología completa de devlog y git) y pide respuestas técnicas telegráficas, salvo lo
// dirigido al cliente. AGENTS.md (Codex, sin hooks) queda completo. Mismo texto exacto que _lib.ps1.
const AHORRO_DEVLOG = 'Documenta cada paso relevante en `devlog/<fecha>/NNN-slug.md` con la skill `devlog` (numeración global e INDEX.md al día). El hook stop-guard lo exige al cerrar la tarea.\n';
const AHORRO_GIT = 'Una rama por tarea (nunca commits en main, master ni develop), Conventional Commits de 72 caracteres como máximo y sin co-autores, y nunca `git push` sin aprobación explícita. El hook guard lo hace cumplir.\n';
const AHORRO_ESTILO = '\n---\n\n# Modo ahorro\n\nRespuestas técnicas en estilo telegráfico: sin preámbulos ni resúmenes repetidos, frases cortas, primero el resultado y el código. Excepciones, en lenguaje normal y completo: `/brief`, `/propuestas`, `/repaso`, `/estimar` y `/entregar`, cualquier texto para el cliente y cualquier explicación que pida el usuario. Las skills cargan sus descripciones solas: abre solo la sección que necesites.\n';

function combinedRules(stack, extra, bundles, relPath) {
    const md = f => readUtf8(f);
    const sd = stack.dir;
    const ahorro = !!stack.ahorro && relPath === '.claude/skills';
    const parts = [
        md(path.join(ROOT, 'core', 'prompts', 'base-systemprompt.md')),
        '\n---\n\n# Acciones prohibidas (global)\n',
        md(path.join(ROOT, 'core', 'methodology', 'prohibited-actions.md')),
        '\n---\n\n# Metodología de devlog\n',
        ahorro ? AHORRO_DEVLOG : md(path.join(ROOT, 'core', 'methodology', 'devlog.md')),
        '\n---\n\n# Flujo de Git\n',
        ahorro ? AHORRO_GIT : md(path.join(ROOT, 'core', 'methodology', 'git-workflow.md')),
        '\n---\n',
        md(path.join(sd, stack.meta.systemprompt)),
        '\n---\n\n# Mejores prácticas del stack\n',
        md(path.join(sd, stack.meta.bestPractices)),
        '\n---\n\n# Prohibiciones del stack\n',
        md(path.join(sd, stack.meta.prohibited)),
    ];
    const rulesDir = path.join(sd, 'rules');
    if (exists(rulesDir)) {
        for (const rf of fs.readdirSync(rulesDir).filter(n => n.endsWith('.md') && n !== 'README.md').sort()) {
            parts.push(`\n---\n\n# Reglas aprendidas: ${rf.replace(/\.md$/, '')}\n`);
            parts.push(md(path.join(rulesDir, rf)));
        }
    }
    const header = `<!-- GENERADO por dev-standards. NO editar a mano: edita stacks\\${stack.name}\\ y corre sync.ps1. Stack: ${stack.name} -->\n\n`;
    return header + parts.join('\n')
        + activationSection(stack, extra, bundles, relPath)
        + sessionSection(stack)
        + (ahorro ? AHORRO_ESTILO : skillsSection(stack, extra, bundles, relPath));
}

// ---------------------------------------------------------------- perfil de front efectivo
function effectiveFrontProfile(stack, projectPath, marker) {
    const fp = stack.meta.frontProfile;
    if (!fp) return null;
    if (marker && marker.frontProfileSource === 'manual' && marker.frontProfile) return { profile: marker.frontProfile, source: 'manual' };
    const pkg = readJson(path.join(projectPath, 'package.json'));
    if (!pkg) return { profile: fp, source: 'default' };
    const deps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
    const hasReact = deps.includes('react') || deps.includes('@astrojs/react');
    const hasTw = deps.some(d => d === 'tailwindcss' || d.startsWith('@tailwindcss/'));
    let stacks = [].concat(fp.stacks);
    let label = String(fp.label);
    if (stack.name === 'astro' && !hasReact) {
        stacks = stacks.filter(s => !['react', 'shadcn'].includes(s));
        label = label.replace(' + React islands', '');
    }
    if (!hasTw) {
        stacks = stacks.filter(s => !['html-tailwind', 'shadcn'].includes(s));
        label = label.replace(' + Tailwind', ' + CSS propio');
    }
    if (!stacks.length) stacks = [fp.stacks[0]];
    if (stacks.length === [].concat(fp.stacks).length) return { profile: fp, source: 'default' };
    return { profile: { label, stacks }, source: 'auto' };
}

// ---------------------------------------------------------------- guía propia (CLAUDE.md / AGENTS.md)
async function resolveGuideTarget(projectPath, fileName, rules, importSyntax) {
    const main = path.join(projectPath, fileName);
    const base = fileName.replace(/\.md$/, '');
    const alt = path.join(projectPath, `${base}.dev-standards.md`);
    const backupName = `${base}.project.md`;
    const backup = path.join(projectPath, backupName);
    let target = main;
    if (exists(alt)) {
        target = alt;
    } else if (exists(main)) {
        const existing = readUtf8(main);
        if (existing && !/GENERADO por dev-standards/.test(existing)) {
            if (await askYesNo(`Este proyecto ya tiene ${fileName} propio. ¿Respaldarlo en ${backupName} y referenciarlo desde el generado?`, true)) {
                if (!exists(backup)) writeUtf8(backup, existing);
                log(`  [guia]       ${fileName} respaldado en ${backupName} (referenciado desde el generado)`);
            } else {
                target = alt;
                log(`  [guia]       ${fileName} intacto; reglas generadas en ${base}.dev-standards.md (referencialo tu desde ${fileName} si quieres cargarlas)`);
            }
        }
    }
    if (target === main && exists(backup)) {
        const head = importSyntax || `LEE PRIMERO ${backupName} (guia propia de este proyecto) antes de aplicar lo de abajo.`;
        rules = `${head}\n\n> Este proyecto tiene guia PROPIA en ${backupName}: sus reglas especificas (dominio, comandos,\n> estructura) MANDAN sobre lo generico de este archivo cuando choquen.\n\n` + rules;
    }
    return { target, rules };
}

// ---------------------------------------------------------------- renderers
const BASE_DENY = [
    'Bash(git push:*)', 'PowerShell(git push:*)',
    'Bash(git reset --hard:*)', 'PowerShell(git reset --hard:*)',
    'Bash(git clean:*)',
    'Bash(rm -rf:*)', 'PowerShell(Remove-Item * -Recurse -Force:*)',
    'Bash(npm publish:*)',
];
function hookSet(hasFront) {
    return {
        SessionStart: [{ matcher: null, files: ['session-start.mjs'] }],
        UserPromptSubmit: [{ matcher: null, files: ['prompt-router.mjs'] }],
        PreToolUse: [
            { matcher: 'Bash|PowerShell', files: ['guard.mjs'] },
            { matcher: 'Edit|Write|MultiEdit|NotebookEdit', files: ['protect-files.mjs', 'secrets-guard.mjs', 'code-hygiene.mjs', 'conventions-guard.mjs', 'backend-guard.mjs', 'back-skill-reminder.mjs', ...(hasFront ? ['front-skill-reminder.mjs'] : [])] },
        ],
        PostToolUse: [{ matcher: 'Edit|Write|MultiEdit', files: ['format-on-save.mjs', 'edit-tracker.mjs'] }, { matcher: 'Bash|PowerShell', files: ['depurar-coach.mjs'] }],
        Stop: [{ matcher: null, files: ['stop-guard.mjs'] }],
        PreCompact: [{ matcher: null, files: ['pre-compact.mjs'] }],
        SessionEnd: [{ matcher: null, files: ['session-end.mjs'] }],
    };
}
// Hooks elegibles uno a uno en el instalador. Los "compañeros" van con su hook: edit-tracker solo sirve a
// stop-guard, pre-compact prolonga session-start y session-end (limpieza) va siempre.
const HOOKS_ELEGIBLES = [
    ['guard', 'Muro de terminal: push, borrados, deploy a producción, commits'],
    ['protect-files', 'Archivos protegidos: .env, generados, migraciones subidas'],
    ['secrets-guard', 'Bloquea escribir claves y contraseñas en el código'],
    ['code-hygiene', 'console.log, tests desactivados, conflictos, vetos y clichés de IA'],
    ['conventions-guard', 'Hace cumplir las convenciones selladas con /adoptar'],
    ['backend-guard', 'Backend: migraciones destructivas, env() fuera de config, datos personales en logs'],
    ['back-skill-reminder', 'Backend: recuerda la receta del stack en la primera edición'],
    ['depurar-coach', 'Si falla un test o un build, activa el método de depuración'],
    ['front-skill-reminder', 'Front: pregunta antes de diseñar y recuerda las reglas de UI'],
    ['format-on-save', 'Formatea cada archivo con la herramienta del stack'],
    ['stop-guard', 'No deja cerrar sin verificar ni documentar'],
    ['session-start', 'Contexto del proyecto al arrancar la sesión'],
    ['prompt-router', 'Sugiere la skill adecuada en cada petición'],
];
const HOOK_COMPANEROS = { 'stop-guard': ['edit-tracker'], 'session-start': ['pre-compact'] };
function hooksPermitidos(sel) {
    if (!sel || !sel.hooks) return null;                         // null = todos
    const s = new Set(['session-end']);
    for (const h of sel.hooks) { s.add(h); for (const c of HOOK_COMPANEROS[h] || []) s.add(c); }
    return s;
}

function newHooksJson(hasFront, pathPrefix, timeout = 30, permitidos = null) {
    const set = hookSet(hasFront);
    const hooks = {};
    for (const [ev, groups] of Object.entries(set)) {
        const outGroups = [];
        for (const g of groups) {
            const files = permitidos ? g.files.filter(f => permitidos.has(f.replace(/\.mjs$/, ''))) : g.files;
            if (!files.length) continue;
            const cmds = files.map(f => ({ type: 'command', command: `node "${pathPrefix}${f}"`, timeout: ev === 'SessionEnd' ? 5 : timeout }));
            const grp = {};
            if (g.matcher) grp.matcher = g.matcher;
            grp.hooks = cmds;
            outGroups.push(grp);
        }
        if (outGroups.length) hooks[ev] = outGroups;
    }
    return hooks;
}
function routerRules() {
    return registry.skills.filter(s => s.keywords).map(s => ({
        name: s.name, group: s.group, entrypoint: !!s.entrypoint, keywords: s.keywords,
        priority: s.priority, requires: [].concat(s.requires || []),
    }));
}
function mergeSettings(file, permissions, hooks) {
    let existing = null;
    try { existing = readJson(file); } catch {}
    const out = {};
    if (existing) for (const [k, v] of Object.entries(existing)) if (!['permissions', 'hooks'].includes(k)) out[k] = v;
    let deny = [...permissions.deny], ask = [...permissions.ask], allow = [];
    if (existing && existing.permissions) {
        deny.push(...[].concat(existing.permissions.deny || []));
        ask.push(...[].concat(existing.permissions.ask || []));
        allow.push(...[].concat(existing.permissions.allow || []));
    }
    const perm = { deny: [...new Set(deny)], ask: [...new Set(ask)] };
    if (allow.length) perm.allow = [...new Set(allow)];
    out.permissions = perm;
    const merged = {};
    for (const [ev, v] of Object.entries(hooks)) merged[ev] = [...v];
    if (existing && existing.hooks) {
        for (const [ev, groups] of Object.entries(existing.hooks)) {
            for (const grp of [].concat(groups)) {
                const isOurs = [].concat(grp.hooks || []).some(h => /[\\/]\.claude[\\/]hooks[\\/]/.test(h.command || ''));
                if (!isOurs) { if (!merged[ev]) merged[ev] = []; merged[ev].push(grp); }
            }
        }
    }
    out.hooks = merged;
    writeUtf8(file, JSON.stringify(out, null, 2));
}

async function renderClaude(stack, projectPath, extra, bundles) {
    const rules = combinedRules(stack, extra, bundles, '.claude/skills');
    const hasFront = !!stack.meta.frontProfile;
    const guide = await resolveGuideTarget(projectPath, 'CLAUDE.md', rules, '@CLAUDE.project.md');
    writeUtf8(guide.target, guide.rules);

    const installed = copySkills(stack, path.join(projectPath, '.claude', 'skills'), extra, bundles);
    const frontInstalled = registry.skills.some(s => FRONT_GROUPS.includes(s.group) && installed.includes(s.name));
    const useFrontHook = hasFront || frontInstalled;

    const hooksDst = path.join(projectPath, '.claude', 'hooks');
    ensureDir(hooksDst);
    for (const f of fs.readdirSync(path.join(ROOT, 'core', 'hooks')).filter(n => n.endsWith('.mjs'))) {
        fs.copyFileSync(path.join(ROOT, 'core', 'hooks', f), path.join(hooksDst, f));
    }
    for (const f of fs.readdirSync(hooksDst).filter(n => n.endsWith('.ps1'))) {
        if (exists(path.join(ROOT, 'core', 'hooks', f.replace(/\.ps1$/, '.mjs'))) || f === '_common.ps1') fs.rmSync(path.join(hooksDst, f), { force: true });
    }
    copyTree(path.join(stack.dir, 'hooks'), hooksDst);

    const cmdSrc = path.join(ROOT, 'core', 'commands');
    if (exists(cmdSrc)) {
        const cmdDst = path.join(projectPath, '.claude', 'commands');
        ensureDir(cmdDst);
        const names = ['instalar.md', 'plan.md', 'siguiente.md', 'verificar.md', 'desplegar.md', 'adoptar.md', 'auditar.md', 'refactor.md', 'depurar.md', 'estimar.md', 'entregar.md', 'mapa.md',
            ...(hasFront ? ['brief.md', 'propuestas.md', 'design-system.md', 'efecto.md', 'revisar-ui.md', 'repaso.md', 'lanzar.md'] : [])];
        const cmdSel = stack.selection && stack.selection.comandos ? new Set(stack.selection.comandos) : null;
        for (const n of fs.readdirSync(cmdSrc).filter(f => f.endsWith('.md'))) {
            const quiero = names.includes(n) && (!cmdSel || cmdSel.has(n.replace(/\.md$/, '')));
            if (quiero) fs.copyFileSync(path.join(cmdSrc, n), path.join(cmdDst, n));
            else fs.rmSync(path.join(cmdDst, n), { force: true });      // comando nuestro ya no elegido
        }
    }

    const cfg = {
        stack: stack.name,
        frontProfile: stack.meta.frontProfile || null,
        formatters: stack.meta.formatters || {},
        protectedPaths: [].concat(stack.meta.protectedPaths || []),
        skills: installed,
        commands: stack.meta.commands || null,
        router: routerRules(),
    };
    writeUtf8(path.join(hooksDst, 'config.json'), JSON.stringify(cfg, null, 2));

    let deny = [...BASE_DENY], ask = [];
    const partial = readJson(path.join(stack.dir, stack.meta.settingsPartial)) || {};
    if (partial.permissions) {
        deny.push(...[].concat(partial.permissions.deny || []));
        ask.push(...[].concat(partial.permissions.ask || []));
    }
    mergeSettings(path.join(projectPath, '.claude', 'settings.json'), { deny, ask },
        newHooksJson(useFrontHook, '$CLAUDE_PROJECT_DIR/.claude/hooks/', 30, hooksPermitidos(stack.selection)));

    const mcp = readJson(path.join(stack.dir, stack.meta.mcp));
    if (mcp) writeUtf8(path.join(projectPath, '.mcp.json'), JSON.stringify({ mcpServers: mcp.mcpServers || {} }, null, 2));

    log(`  [claude]     ${path.basename(guide.target)} + .claude/{skills,hooks,settings.json} + .mcp.json  (skills: ${installed.join(', ')})`);
}

async function renderCodex(stack, projectPath, extra, bundles, label = 'codex') {
    const rules = combinedRules(stack, extra, bundles, '.agents/skills');
    const guide = await resolveGuideTarget(projectPath, 'AGENTS.md', rules, '');
    writeUtf8(guide.target, guide.rules);
    const installed = copySkills(stack, path.join(projectPath, '.agents', 'skills'), extra, bundles);
    log(`  [${label}]      ${path.basename(guide.target)} + .agents/skills/ (${installed.join(', ')})`);
}

// ---------------------------------------------------------------- init (devlog + plan) y main
function pad(n, w) { return String(n).padStart(w, '0'); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`; }

async function seedProject(projectPath) {
    const today = todayStr();
    const devlog = path.join(projectPath, 'devlog');
    const ownDiary = ['CHANGELOG.md', 'HISTORY.md', path.join('docs', 'decisions'), path.join('docs', 'adr')]
        .find(f => exists(path.join(projectPath, f)));
    let makeDevlog = true;
    if (ownDiary && !exists(devlog)) {
        makeDevlog = await askYesNo(`El proyecto ya lleva su propio diario (${ownDiary}). ¿Crear tambien devlog/ de dev-standards? (los hooks lo piden al cerrar tareas)`, true);
        if (!makeDevlog) log(`  devlog/ omitido: se respeta el diario propio (${ownDiary}). El agente preguntara como documentar.`);
    }
    if (makeDevlog) {
        const dayDir = path.join(devlog, today);
        ensureDir(dayDir);
        if (!exists(path.join(devlog, 'INDEX.md'))) fs.copyFileSync(path.join(ROOT, 'templates', 'devlog-index.md'), path.join(devlog, 'INDEX.md'));
        const firstEntry = path.join(dayDir, '001-setup-inicial.md');
        if (!exists(firstEntry)) {
            const d = new Date();
            const tpl = readUtf8(path.join(ROOT, 'templates', 'devlog-day.md'))
                .replace('NNN', '001')
                .replace('YYYY-MM-DD HH:MM', `${today} ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`);
            writeUtf8(firstEntry, tpl);
        }
        if (!exists(path.join(dayDir, 'DECISIONES.md'))) writeUtf8(path.join(dayDir, 'DECISIONES.md'), `# Decisiones - ${today}\n\n`);
        log(`  devlog/ inicializado (${today})`);
    }
    const planDir = path.join(projectPath, 'plan');
    ensureDir(planDir);
    const planTpl = path.join(ROOT, 'core', 'skills', 'project-planner', 'templates');
    if (!exists(path.join(planDir, 'PLAN.md'))) fs.copyFileSync(path.join(planTpl, 'PLAN.md'), path.join(planDir, 'PLAN.md'));
    if (!exists(path.join(planDir, 'brief.md'))) fs.copyFileSync(path.join(planTpl, 'brief.md'), path.join(planDir, 'brief.md'));
    log('  plan/ inicializado (PLAN.md y brief.md son plantillas: rellenalos con la skill project-planner)');
}

function lista(v) { return String(v || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean); }

function parseArgs(argv) {
    const a = { path: process.cwd(), tools: null, stack: null, skills: [], bundle: [], seleccion: null, grupos: null, soloSkills: null, hooks: null, comandos: null, interactivo: false, ahorro: null };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const next = () => argv[++i];
        if (k === '--stack') a.stack = next();
        else if (k === '--path') a.path = next();
        else if (k === '--tools') a.tools = lista(next());
        else if (k === '--skills') a.skills = lista(next());
        else if (k === '--bundle') a.bundle = lista(next());
        else if (k === '--seleccion') a.seleccion = next();
        else if (k === '--grupos') a.grupos = lista(next());
        else if (k === '--solo-skills') a.soloSkills = lista(next());
        else if (k === '--hooks') a.hooks = lista(next());
        else if (k === '--comandos') a.comandos = lista(next());
        else if (k === '--interactivo' || k === '-i') a.interactivo = true;
        else if (k === '--ahorro') a.ahorro = true;
        else if (k === '--sin-ahorro') a.ahorro = false;
        else if (k === '--help' || k === '-h') { a.help = true; }
        else warn(`Flag desconocido: ${k}`);
    }
    return a;
}

// ---------------------------------------------------------------- modo interactivo
// Cola de líneas: rl.question pierde líneas cuando la entrada llega de golpe (pegada o por tubería).
function crearLector() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
    const cola = []; const esperando = []; let cerrado = false;
    rl.on('line', l => { const r = esperando.shift(); if (r) r(l); else cola.push(l); });
    rl.on('close', () => { cerrado = true; while (esperando.length) esperando.shift()(''); });
    rl.leer = () => cola.length ? Promise.resolve(cola.shift()) : (cerrado ? Promise.resolve('') : new Promise(r => esperando.push(r)));
    return rl;
}
async function preguntar(rl, q) { process.stdout.write(q); const r = await rl.leer(); if (!process.stdin.isTTY) process.stdout.write(r + '\n'); return (r || '').trim(); }
async function elegirUno(rl, titulo, opciones, def = 1) {
    log(`\n${titulo}`);
    opciones.forEach((o, i) => log(`  ${i + 1}) ${o}`));
    for (;;) {
        const r = await preguntar(rl, `Elige [${def}]: `);
        const n = r ? parseInt(r, 10) : def;
        if (n >= 1 && n <= opciones.length) return n;
        log('  Número no válido.');
    }
}
async function elegirVarios(rl, titulo, opciones, porDefecto = 'todos') {
    log(`\n${titulo}`);
    opciones.forEach(([, texto], i) => log(`  ${String(i + 1).padStart(2)}) ${texto}`));
    for (;;) {
        const r = await preguntar(rl, `Números separados por comas, "todos" o "ninguno" [${porDefecto}]: `);
        const v = (r || porDefecto).toLowerCase();
        if (v === 'todos') return opciones.map(([id]) => id);
        if (v === 'ninguno') return [];
        // Vale el número o el nombre (y "/plan" también): "1,8" o "plan,verificar"
        const ids = opciones.map(([id]) => id);
        const elegidos = v.split(/[\s,]+/).filter(Boolean).map(x => {
            const n = parseInt(x, 10);
            if (String(n) === x && n >= 1 && n <= opciones.length) return ids[n - 1];
            const nombre = x.replace(/^\//, '');
            return ids.includes(nombre) ? nombre : null;
        });
        if (elegidos.length && elegidos.every(Boolean)) return [...new Set(elegidos)];
        log(`  No reconozco: ${v.split(/[\s,]+/).filter((x, i) => !elegidos[i]).join(', ')}. Usa números o nombres de la lista.`);
    }
}
function detectarStack(p) {
    const j = f => readJson(path.join(p, f));
    const composer = j('composer.json');
    if (composer && composer.require && composer.require['laravel/framework']) return 'laravel';
    if (exists(path.join(p, 'wp-includes')) || exists(path.join(p, 'wp-content'))) return 'wordpress';
    const pkg = j('package.json');
    if (pkg) {
        const d = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (d.next) return 'next';
        if (d.nuxt) return 'nuxt';
        if (d['@sveltejs/kit']) return 'sveltekit';
        if (d.astro) return 'astro';
        if (d.vue) return 'vue-ts';
        if (d.express || d['@nestjs/core']) return 'node-api';
    }
    if (exists(path.join(p, 'pyproject.toml'))) return 'python-langgraph';
    return null;
}
function comprobarRequisitos() {
    const probar = (cmd, args) => { try { return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim().split(/\r?\n/)[0]; } catch { return null; } };
    const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
    const filas = [
        ['Node 18+', nodeMajor >= 18 ? `v${process.versions.node}` : null, true, 'hooks, instalador, /verificar'],
        ['Git', probar('git', ['--version']), true, 'actualizar, hotspots, muros de commits'],
        ['Python 3', probar('python3', ['--version']) || probar('python', ['--version']) || probar('py', ['-3', '--version']), false, 'buscador de diseño de ui-ux-pro-max'],
    ];
    log('\nRequisitos:');
    for (const [n, v, obligatorio, uso] of filas) log(`  ${v ? 'OK ' : (obligatorio ? 'FALTA' : 'no  ')} ${n.padEnd(9)} ${v || (obligatorio ? 'OBLIGATORIO' : 'opcional')} — ${uso}`);
    log('  (Playwright para ui-verify se instala por proyecto cuando haga falta: npx playwright install chromium)');
}

async function modoInteractivo(a) {
    const rl = crearLector();
    try {
        log('== dev-standards :: instalador interactivo ==');
        comprobarRequisitos();
        const ruta = await preguntar(rl, `\nCarpeta del proyecto [${a.path}]: `);
        if (ruta) a.path = ruta;
        const projectPath = path.resolve(a.path);
        const marker = readJson(path.join(projectPath, '.dev-standards.json'));
        const stacks = fs.readdirSync(path.join(ROOT, 'stacks')).filter(s => exists(path.join(ROOT, 'stacks', s, 'stack.json')));
        const detectado = (marker && marker.stack) || detectarStack(projectPath);
        const iStack = await elegirUno(rl, `Stack${detectado ? ` (detectado: ${detectado})` : ''}:`, stacks, detectado ? stacks.indexOf(detectado) + 1 : 1);
        a.stack = stacks[iStack - 1];
        const iTools = await elegirUno(rl, 'Herramientas:', ['Claude Code', 'Claude Code + Codex', 'Solo Codex'], 1);
        a.tools = [['claude'], ['claude', 'codex'], ['codex']][iTools - 1];
        const iModo = await elegirUno(rl, '¿Qué quieres instalar?', [
            'Todo (recomendado): todas las skills del stack, muros y comandos',
            'Por categorías: eliges grupos de skills (front, animación, 3D, backend…)',
            'A medida: eliges skills, muros y comandos uno a uno',
        ], 1);
        a.seleccion = ['todo', 'categorias', 'a-medida'][iModo - 1];
        if (a.seleccion === 'categorias') {
            const grupos = Object.entries(registry.groups).filter(([g]) => !['routing', 'planning', 'docs'].includes(g))
                .map(([g, label]) => [g, `${label} (${registry.skills.filter(s => s.group === g).length} skills)`]);
            a.grupos = await elegirVarios(rl, 'Categorías (el núcleo de plan, devlog y calidad va siempre):', grupos);
        }
        if (a.seleccion === 'a-medida') {
            const opciones = registry.skills.filter(s => !NUCLEO.includes(s.name))
                .map(s => [s.name, `${s.name} — ${String(s.when).slice(0, 70)}`]);
            a.soloSkills = await elegirVarios(rl, 'Skills (el núcleo de plan, devlog y calidad va siempre):', opciones);
            a.hooks = await elegirVarios(rl, 'Muros y hooks:', HOOKS_ELEGIBLES);
            const cmds = fs.readdirSync(path.join(ROOT, 'core', 'commands')).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
            a.comandos = await elegirVarios(rl, 'Comandos:', cmds.map(c => [c, `/${c}`]));
        }
        const ah = await preguntar(rl, '\n¿Modo ahorro de tokens? CLAUDE.md compacto y respuestas técnicas telegráficas (lo del cliente sigue en lenguaje normal) [s/N]: ');
        a.ahorro = /^s/i.test(ah);
        const ok = await preguntar(rl, '\n¿Instalar con esta selección? [S/n]: ');
        if (/^n/i.test(ok)) { log('Cancelado. No se ha tocado nada.'); process.exit(0); }
    } finally { rl.close(); }
}

async function main() {
    const a = parseArgs(process.argv.slice(2));
    if (a.help) {
        log('Uso: node tools/init.mjs                       -> instalador interactivo (sin argumentos, en terminal)');
        log('     node tools/init.mjs --stack <nombre> --path <ruta> [--tools claude,codex]');
        log('       [--seleccion todo|categorias|a-medida] [--grupos front,motion,3d,quality,architecture,growth,ops,design]');
        log('       [--solo-skills a,b] [--hooks guard,stop-guard,...] [--comandos plan,verificar,...] [--skills a,b] [--bundle x] [--ahorro|--sin-ahorro]');
        log('Stacks: ' + fs.readdirSync(path.join(ROOT, 'stacks')).join(', '));
        return;
    }
    const sinArgumentos = process.argv.length <= 2;
    if (a.interactivo || (sinArgumentos && process.stdin.isTTY && process.env.DEV_STANDARDS_ASSUME_YES !== '1')) await modoInteractivo(a);

    const projectPath = path.resolve(a.path);
    ensureDir(projectPath);
    const markerPath = path.join(projectPath, '.dev-standards.json');
    const marker = readJson(markerPath);
    const stackName = a.stack || (marker && marker.stack);
    if (!stackName) throw new Error(`Falta --stack (o un .dev-standards.json previo). Stacks: ${fs.readdirSync(path.join(ROOT, 'stacks')).join(', ')}`);
    const stackDir = path.join(ROOT, 'stacks', stackName);
    if (!exists(stackDir)) throw new Error(`Stack '${stackName}' no existe. Stacks: ${fs.readdirSync(path.join(ROOT, 'stacks')).join(', ')}`);
    const stack = { name: stackName, dir: stackDir, meta: readJson(path.join(stackDir, 'stack.json')) };
    let tools = a.tools || (marker && [].concat(marker.tools || [])) || ['claude'];
    tools = [...new Set(tools)];
    if (tools.includes('codex') && tools.includes('antigravity')) tools = tools.filter(t => t !== 'antigravity');   // mismo AGENTS.md
    const skills = a.skills.length ? a.skills : [].concat((marker && marker.extraSkills) || []);
    const bundles = a.bundle.length ? a.bundle : [].concat((marker && marker.bundles) || []);

    // Selección: la de los flags o el menú; si no hay, la guardada en el marcador (sync la respeta).
    let seleccion = null;
    if (a.seleccion) {
        if (!['todo', 'categorias', 'a-medida'].includes(a.seleccion)) throw new Error(`--seleccion debe ser todo, categorias o a-medida (recibido: ${a.seleccion})`);
        if (a.seleccion !== 'todo' || a.hooks || a.comandos) {
            seleccion = { modo: a.seleccion };
            if (a.seleccion === 'categorias') seleccion.grupos = a.grupos || [];
            if (a.seleccion === 'a-medida') seleccion.skills = a.soloSkills || [];
            if (a.hooks) seleccion.hooks = a.hooks;
            if (a.comandos) seleccion.comandos = a.comandos;
        }
    } else if (marker && marker.seleccion) {
        seleccion = marker.seleccion;
    }
    stack.selection = seleccion;
    stack.ahorro = a.ahorro !== null ? a.ahorro : !!(marker && marker.ahorro);

    log('== dev-standards :: init (Node, agnóstico de OS) ==');
    log(`Stack: ${stack.name}`);
    log(`Proyecto: ${projectPath}`);
    if (seleccion) log(`Selección: ${seleccion.modo}${seleccion.grupos ? ` (${seleccion.grupos.join(', ')})` : ''}${seleccion.hooks ? ` · hooks: ${seleccion.hooks.length}` : ''}${seleccion.comandos ? ` · comandos: ${seleccion.comandos.length}` : ''}`);
    if (!marker) await seedProject(projectPath);

    log(`Sincronizando '${stack.name}' en ${projectPath}`);
    log(`Herramientas: ${tools.join(', ')}`);
    let fpSource = null;
    if (stack.meta.frontProfile) {
        const eff = effectiveFrontProfile(stack, projectPath, marker);
        stack.meta.frontProfile = eff.profile;
        fpSource = eff.source;
        const srcTxt = eff.source === 'manual' ? ' (fijado a mano en .dev-standards.json)' : eff.source === 'auto' ? ' (detectado de package.json)' : '';
        log(`Perfil de front: ${stack.meta.frontProfile.label}${srcTxt}`);
    }
    for (const t of tools) {
        if (t === 'claude') await renderClaude(stack, projectPath, skills, bundles);
        else if (t === 'codex') await renderCodex(stack, projectPath, skills, bundles, 'codex');
        else if (t === 'antigravity') await renderCodex(stack, projectPath, skills, bundles, 'antigravity');
        else warn(`Herramienta '${t}' aún no soportada por init.mjs (usa sync.ps1 en Windows para cursor/windsurf).`);
    }
    if (marker && marker.gitHooks) warn('gitHooks del marcador: aún no soportado por init.mjs (usa sync.ps1 -GitHooks en Windows). Se conserva la marca.');

    const markerObj = { stack: stack.name, tools, extraSkills: skills, bundles, standardsRoot: ROOT };
    if (marker && marker.gitHooks) markerObj.gitHooks = true;
    if (stack.meta.frontProfile) {
        markerObj.frontProfile = stack.meta.frontProfile;
        if (fpSource) markerObj.frontProfileSource = fpSource;
    }
    if (seleccion) markerObj.seleccion = seleccion;
    if (stack.ahorro) markerObj.ahorro = true;
    writeUtf8(markerPath, JSON.stringify(markerObj, null, 2));
    log('Listo. Config regenerada. Abre una sesión NUEVA del agente para que cargue todo.');
}

main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
