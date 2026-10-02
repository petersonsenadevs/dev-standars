#!/usr/bin/env node
// Senzu · brand: sincroniza la guía de marca con los design tokens SIN tocar el script original.
// El original (sync-brand-to-tokens.cjs) tiene rutas fijas respecto a la carpeta actual: lee
// docs/brand-guidelines.md, escribe assets/design-tokens.json y busca el generador de CSS solo en
// .claude/skills (en Codex, .agents/skills, no lo encuentra). Este envoltorio lo ejecuta en una carpeta
// temporal con esa estructura y deja el resultado junto a la guía, en senzu/design-system/<slug>/.
// Ejecutar desde la RAÍZ del proyecto:
//   node <skills-dir>/brand/scripts/sync-senzu.mjs [--slug <slug>] [--guia <ruta>] [--dry-run]
// Dónde busca la guía (la primera que exista): --guia · senzu/design-system/<slug>/brand-guidelines.md ·
// design-system/<slug>/brand-guidelines.md (proyecto sin migrar) · docs/brand-guidelines.md (ubicación
// antigua de la skill: funciona, y avisa de que se mueva junto al design system).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = process.cwd();
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const seco = args.includes('--dry-run');
const aqui = path.dirname(fileURLToPath(import.meta.url));
const existe = f => { try { return fs.existsSync(f); } catch { return false; } };
const fallo = msg => { console.error('[sync-senzu] ' + msg); process.exit(1); };

// ---------------------------------------------------------------- la guía y su destino
function slugs(base) { try { return fs.readdirSync(base, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); } catch { return []; } }
function elegirSlug(base) {
    if (opt('--slug')) return opt('--slug');
    const todos = slugs(base);
    const conGuia = todos.filter(s => existe(path.join(base, s, 'brand-guidelines.md')));
    if (conGuia.length === 1) return conGuia[0];
    const conMaster = todos.filter(s => existe(path.join(base, s, 'MASTER.md')));
    if (conMaster.length === 1) return conMaster[0];
    if (todos.length === 1) return todos[0];
    return null;
}
let guia = null, destino = null, antigua = false;
if (opt('--guia')) { guia = path.resolve(opt('--guia')); destino = path.dirname(guia); }
else {
    for (const base of [path.join(raiz, 'senzu', 'design-system'), path.join(raiz, 'design-system')]) {
        if (!existe(base)) continue;
        const slug = elegirSlug(base);
        if (slug && existe(path.join(base, slug, 'brand-guidelines.md'))) { guia = path.join(base, slug, 'brand-guidelines.md'); destino = path.join(base, slug); break; }
    }
    if (!guia && existe(path.join(raiz, 'docs', 'brand-guidelines.md'))) {
        guia = path.join(raiz, 'docs', 'brand-guidelines.md'); destino = path.join(raiz, 'assets'); antigua = true;
    }
}
if (!guia || !existe(guia)) fallo('No encuentro la guía de marca. Créala en senzu/design-system/<slug>/brand-guidelines.md (plantilla: templates/brand-guidelines-starter.md) o pasa --guia <ruta>. Con varios design systems, --slug <slug>.');

// ---------------------------------------------------------------- scripts: el original y el generador de CSS
const candidatosSync = [path.join(aqui, 'sync-brand-to-tokens.cjs'), path.join(aqui, '..', '..', '..', 'skills-vendor', 'brand', 'scripts', 'sync-brand-to-tokens.cjs')];
const sync = candidatosSync.find(existe);
if (!sync) fallo('No encuentro sync-brand-to-tokens.cjs junto a este script: reinstala la skill brand.');
const candidatosGen = [
    path.join(raiz, '.claude', 'skills', 'design-system', 'scripts', 'generate-tokens.cjs'),
    path.join(raiz, '.agents', 'skills', 'design-system', 'scripts', 'generate-tokens.cjs'),
    path.join(aqui, '..', '..', 'design-system', 'scripts', 'generate-tokens.cjs'),
    path.join(aqui, '..', '..', '..', 'skills-vendor', 'design-system', 'scripts', 'generate-tokens.cjs'),
];
const generador = candidatosGen.find(existe);

// ---------------------------------------------------------------- ejecutar en una carpeta temporal
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'senzu-brand-'));
try {
    fs.mkdirSync(path.join(tmp, 'docs')); fs.mkdirSync(path.join(tmp, 'assets'));
    fs.copyFileSync(guia, path.join(tmp, 'docs', 'brand-guidelines.md'));
    const jsonDestino = path.join(destino, 'design-tokens.json');
    if (existe(jsonDestino)) fs.copyFileSync(jsonDestino, path.join(tmp, 'assets', 'design-tokens.json'));   // se actualiza, no se pisa
    execFileSync(process.execPath, [sync, ...(seco ? ['--dry-run'] : [])], { cwd: tmp, stdio: 'inherit' });
    if (seco) { console.log('[sync-senzu] --dry-run: no se ha escrito nada.'); process.exit(0); }
    const jsonTmp = path.join(tmp, 'assets', 'design-tokens.json');
    if (!existe(jsonTmp)) fallo('El script original no generó design-tokens.json.');
    fs.mkdirSync(destino, { recursive: true });
    fs.copyFileSync(jsonTmp, jsonDestino);
    const cssDestino = path.join(destino, 'design-tokens.css');
    if (generador) execFileSync(process.execPath, [generador, '--config', jsonDestino, '-o', cssDestino], { cwd: raiz, stdio: 'inherit' });
    const rel = f => path.relative(raiz, f).replace(/\\/g, '/');
    console.log(`[sync-senzu] Guía: ${rel(guia)} → ${rel(jsonDestino)}${generador ? ' y ' + rel(cssDestino) : ' (sin generador de CSS: instala la skill design-system para el .css)'}`);
    if (antigua) console.log('[sync-senzu] La guía está en docs/ (ubicación antigua): muévela a senzu/design-system/<slug>/brand-guidelines.md para tenerla junto a MASTER.md y gustos.md.');
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
