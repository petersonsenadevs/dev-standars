#!/usr/bin/env node
// Suite del envoltorio de la skill brand (core/skills-overlay/brand/scripts/sync-senzu.mjs): la guía de marca
// vive en senzu/design-system/<slug>/ y los tokens se generan a su lado, sin tocar el script original.
//   node tools/test-brand.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNC = path.join(ROOT, 'core', 'skills-overlay', 'brand', 'scripts', 'sync-senzu.mjs');
const GUIA = fs.readFileSync(path.join(ROOT, 'core', 'skills-vendor', 'brand', 'templates', 'brand-guidelines-starter.md'), 'utf8');
let casos = 0, fallos = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };
const nuevo = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ds-brand-'));
const w = (b, rel, t) => { const f = path.join(b, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); return f; };
const run = (cwd, ...a) => { const r = spawnSync(process.execPath, [SYNC, ...a], { cwd, encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
const gen = path.join(ROOT, 'core', 'skills-vendor', 'design-system', 'scripts', 'generate-tokens.cjs');
const conGenerador = (p, dir) => { fs.mkdirSync(path.join(p, dir), { recursive: true }); fs.copyFileSync(gen, path.join(p, dir, 'generate-tokens.cjs')); };

{   // ubicación nueva, proyecto de Claude
    const p = nuevo();
    w(p, 'senzu/design-system/acme/MASTER.md', '# M\n'); w(p, 'senzu/design-system/acme/brand-guidelines.md', GUIA);
    conGenerador(p, '.claude/skills/design-system/scripts');
    const r = run(p);
    ok(r.code === 0, 'senzu/design-system/<slug>: sincroniza', r.out.slice(-300));
    ok(fs.existsSync(path.join(p, 'senzu/design-system/acme/design-tokens.json')), 'tokens JSON junto a la guía');
    ok(fs.existsSync(path.join(p, 'senzu/design-system/acme/design-tokens.css')), 'tokens CSS junto a la guía');
    ok(!fs.existsSync(path.join(p, 'docs')) && !fs.existsSync(path.join(p, 'assets')), 'no crea docs/ ni assets/ en la raíz');
    const antes = fs.readFileSync(path.join(p, 'senzu/design-system/acme/design-tokens.json'), 'utf8');
    const j = JSON.parse(antes); j.propio = { valor: 'se conserva' };
    fs.writeFileSync(path.join(p, 'senzu/design-system/acme/design-tokens.json'), JSON.stringify(j));
    run(p);
    const despues = JSON.parse(fs.readFileSync(path.join(p, 'senzu/design-system/acme/design-tokens.json'), 'utf8'));
    ok(despues.propio && despues.propio.valor === 'se conserva', 'una segunda sincronización actualiza el JSON existente, no lo pisa');
}
{   // proyecto de Codex: el original no encontraría el generador en .agents/skills
    const p = nuevo();
    w(p, 'senzu/design-system/acme/brand-guidelines.md', GUIA);
    conGenerador(p, '.agents/skills/design-system/scripts');
    const r = run(p);
    ok(r.code === 0 && fs.existsSync(path.join(p, 'senzu/design-system/acme/design-tokens.css')), 'Codex (.agents/skills): también genera el CSS', r.out.slice(-300));
}
{   // ubicación antigua: docs/brand-guidelines.md
    const p = nuevo();
    w(p, 'docs/brand-guidelines.md', GUIA);
    const r = run(p);
    ok(r.code === 0 && fs.existsSync(path.join(p, 'assets/design-tokens.json')), 'docs/ (antigua): sigue funcionando como antes', r.out.slice(-200));
    ok(/ubicación antigua/.test(r.out), 'docs/ (antigua): avisa de que se mueva');
}
{   // varios design systems sin --slug
    const p = nuevo();
    w(p, 'senzu/design-system/a/brand-guidelines.md', GUIA); w(p, 'senzu/design-system/b/brand-guidelines.md', GUIA);
    const r = run(p);
    ok(r.code === 1 && /--slug/.test(r.out), 'dos design systems con guía y sin --slug: pide elegir', r.out.slice(-200));
    ok(run(p, '--slug', 'b').code === 0 && fs.existsSync(path.join(p, 'senzu/design-system/b/design-tokens.json')), '--slug elige cuál');
}
{   // sin guía
    const p = nuevo();
    const r = run(p);
    ok(r.code === 1 && /No encuentro la guía/.test(r.out), 'sin guía: error claro con dónde crearla');
}
{   // --dry-run no escribe
    const p = nuevo();
    w(p, 'senzu/design-system/acme/brand-guidelines.md', GUIA);
    const r = run(p, '--dry-run');
    ok(r.code === 0 && !fs.existsSync(path.join(p, 'senzu/design-system/acme/design-tokens.json')), '--dry-run no escribe nada', r.out.slice(-200));
}
{   // el original no se modifica
    const original = path.join(ROOT, 'core', 'skills-vendor', 'brand', 'scripts', 'sync-brand-to-tokens.cjs');
    ok(/const BRAND_GUIDELINES = 'docs\/brand-guidelines\.md'/.test(fs.readFileSync(original, 'utf8')), 'el script original de la skill sigue intacto');
}

console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
