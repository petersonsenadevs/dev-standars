#!/usr/bin/env node
// Genera CREDITOS.md: todo lo de terceros que incluye o del que parte Senzu, con autor, enlace y licencia.
// Fuentes: core/skills-vendor/VENDOR.json (+ LICENSE.upstream de cada skill) y core/effects-vendor/manifest.json.
// Lo llama build-docs.ps1; no se edita a mano. Con --comprobar, además falla (exit 1) si alguna licencia no
// está en la lista de permitidas o falta su archivo: lo usan el CI y la actualización semanal de terceros.
//   node tools/build-creditos.mjs [--comprobar]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const comprobar = process.argv.includes('--comprobar');
const PERMITIDAS = ['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'CC0-1.0', 'Unlicense'];
const leer = f => { try { return fs.readFileSync(f, 'utf8').replace(/^﻿/, ''); } catch { return null; } };
const json = f => { const t = leer(f); return t ? JSON.parse(t) : null; };
const problemas = [];

function licenciaDe(texto) {
    if (!texto) return null;
    const t = texto.slice(0, 1500);
    if (/MIT License|Permission is hereby granted, free of charge/i.test(t)) return 'MIT';
    if (/Apache License,?\s+Version 2\.0/i.test(t)) return 'Apache-2.0';
    if (/ISC License|Permission to use, copy, modify, and\/or distribute/i.test(t)) return 'ISC';
    if (/BSD 3-Clause|Redistribution and use in source and binary forms[\s\S]*Neither the name/i.test(t)) return 'BSD-3-Clause';
    if (/BSD 2-Clause|Redistribution and use in source and binary forms/i.test(t)) return 'BSD-2-Clause';
    if (/This is free and unencumbered software released into the public domain/i.test(t)) return 'Unlicense';
    if (/CC0 1\.0/i.test(t)) return 'CC0-1.0';
    return 'DESCONOCIDA';
}
const copyrightDe = texto => ((texto || '').match(/^\s*Copyright \(c\)\s*(.+)$/im) || [])[1]?.trim() || '';

// ---------------------------------------------------------------- skills de terceros
const vendor = json(path.join(ROOT, 'core', 'skills-vendor', 'VENDOR.json')) || { repos: [], skills: {} };
const porRepo = new Map();
for (const r of vendor.repos || []) porRepo.set(r.name, { ...r, skills: [], licencias: new Set(), copyright: '' });
for (const [skill, info] of Object.entries(vendor.skills || {})) {
    const r = porRepo.get(info.repo); if (!r) continue;
    const lic = leer(path.join(ROOT, 'core', 'skills-vendor', skill, 'LICENSE.upstream'));
    const tipo = licenciaDe(lic);
    if (!lic) problemas.push(`skill ${skill}: falta LICENSE.upstream`);
    else if (!PERMITIDAS.includes(tipo)) problemas.push(`skill ${skill}: licencia ${tipo} (no está en la lista de permitidas)`);
    r.skills.push(skill); if (tipo) r.licencias.add(tipo);
    if (!r.copyright) r.copyright = copyrightDe(lic);
}

// ---------------------------------------------------------------- colección de efectos
const efectos = (json(path.join(ROOT, 'core', 'effects-vendor', 'manifest.json')) || { repos: [] }).repos || [];
for (const e of efectos) {
    if (!PERMITIDAS.includes(e.license)) problemas.push(`efecto ${e.name}: licencia ${e.license} (no está en la lista de permitidas)`);
    // Si la copia local existe (no está en git), se comprueba también su archivo de licencia real
    const dir = path.join(ROOT, 'core', 'effects-vendor', e.name);
    if (fs.existsSync(dir)) {
        const f = fs.readdirSync(dir).find(n => /^(licen[cs]e|copying)/i.test(n));
        const real = f ? licenciaDe(leer(path.join(dir, f))) : null;
        if (!f) problemas.push(`efecto ${e.name}: la copia local no tiene archivo de licencia`);
        else if (real !== e.license && real !== 'DESCONOCIDA') problemas.push(`efecto ${e.name}: el manifiesto dice ${e.license} y su LICENSE es ${real}`);
    }
}

// ---------------------------------------------------------------- CREDITOS.md
const L = [];
L.push('<!-- GENERADO por tools/build-creditos.mjs desde los manifiestos de terceros. No editar a mano. -->', '');
L.push('# Créditos', '');
L.push('Senzu se apoya en el trabajo de otras personas. Todo lo de terceros conserva su licencia original y su');
L.push('aviso de copyright (`LICENSE.upstream` en cada skill; el archivo de licencia en cada efecto). Nuestro');
L.push('código es MIT ([LICENSE](LICENSE)). Se actualiza cada semana desde los repositorios originales.', '');
L.push('## Skills de terceros', '');
L.push('Copiadas tal cual y con una capa en castellano encima (`core/skills-overlay/`); el original no se modifica.', '');
L.push('| Repositorio | Autor | Licencia | Skills |', '|---|---|---|---|');
for (const r of porRepo.values()) {
    const url = String(r.url || '').replace(/\.git$/, '');
    L.push(`| [${r.name}](${url}) | ${r.copyright.replace(/^\d{4}(-\d{4})?\s*/, '') || '—'} | ${[...r.licencias].join(', ') || '—'} | ${r.skills.length}: ${r.skills.sort().join(', ')} |`);
}
L.push('', `## Colección de efectos (${efectos.length} repositorios)`, '');
L.push('Fuente de las recetas del catálogo de efectos de `front-activation`. No va en el repositorio: se descarga');
L.push('con `tools/vendor-effects.ps1`.', '');
const porCategoria = new Map();
for (const e of efectos) { if (!porCategoria.has(e.category)) porCategoria.set(e.category, []); porCategoria.get(e.category).push(e); }
for (const [cat, lista] of [...porCategoria].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    L.push(`### ${cat}`, '', '| Repositorio | Licencia | Para qué |', '|---|---|---|');
    for (const e of lista.sort((a, b) => a.repo.localeCompare(b.repo))) L.push(`| [${e.repo}](https://github.com/${e.repo}) | ${e.license} | ${String(e.for || '').replace(/\|/g, '/')} |`);
    L.push('');
}
L.push('## Ideas, no código', '');
L.push('- **Modo ahorro**: inspirado en la idea de [caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); implementación y textos propios.');
L.push('- **Recetas con Pretext**: usan la librería [@chenglou/pretext](https://github.com/chenglou/pretext) (MIT) como dependencia del proyecto que la instale; no se incluye su código.');
L.push('');
fs.writeFileSync(path.join(ROOT, 'CREDITOS.md'), L.join('\n'));
console.log(`  [docs] CREDITOS.md (${[...porRepo.values()].reduce((n, r) => n + r.skills.length, 0)} skills de ${porRepo.size} repos, ${efectos.length} repos de efectos)`);

if (comprobar) {
    if (problemas.length) { console.log('Licencias: ' + problemas.length + ' problema(s):'); for (const p of problemas) console.log('  - ' + p); process.exit(1); }
    console.log('Licencias: todo con licencia permitida y su archivo.');
}
