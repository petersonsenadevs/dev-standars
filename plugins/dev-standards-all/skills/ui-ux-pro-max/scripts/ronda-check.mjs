#!/usr/bin/env node
// Verifica una ronda de maquetas ANTES de enseñarla (references/es/rondas.md):
//   node <skills-dir>/ui-ux-pro-max/scripts/ronda-check.mjs design-system/<slug> [--ronda N] [--sin-nuevo] [--indice]
// Comprueba en cada maqueta de propuestas/ronda-N/*.html:
//   - lo FIJADO en gustos.md (valores entre acentos graves de "## Fijado") aparece en TODAS las maquetas;
//   - nada de lo VETADO (acentos graves de "## No") aparece;
//   - banner de PROPUESTA con su ronda, piezas etiquetadas (data-pieza con data-cat y data-desc, ids únicos con
//     la letra de la maqueta), panel de opinión intacto y ningún {{hueco}} de la plantilla sin rellenar;
//   - desde la ronda 2: al menos una pieza NUEVA (data-nuevo) y lo fijado marcado con data-fijado;
//   - las maquetas de una ronda no son copias.
// --indice escribe propuestas/index.html con todas las rondas para abrirlas de un vistazo.
// Sale con 1 si algo falla: corrige y vuelve a ejecutarlo antes de enseñar la ronda.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const dir = args.find(a => !a.startsWith('--') && a !== opt('--ronda'));
if (!dir) { console.log('Uso: node ronda-check.mjs design-system/<slug> [--ronda N] [--sin-nuevo] [--indice]'); process.exit(2); }
const base = path.resolve(dir);
const propuestas = path.join(base, 'propuestas');
const leer = f => { try { return fs.readFileSync(f, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n'); } catch { return null; } };

const rondas = (fs.existsSync(propuestas) ? fs.readdirSync(propuestas) : [])
    .map(n => (/^ronda-(\d+)$/.exec(n) || [])[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
if (!rondas.length) { console.log(`No hay rondas en ${path.relative(process.cwd(), propuestas) || propuestas} (carpetas ronda-1, ronda-2…).`); process.exit(2); }
const N = opt('--ronda') ? Number(opt('--ronda')) : rondas[rondas.length - 1];
const dirRonda = path.join(propuestas, `ronda-${N}`);
if (!fs.existsSync(dirRonda)) { console.log(`No existe ${dirRonda}.`); process.exit(2); }

// ---------------------------------------------------------------- gustos.md
const gustos = leer(path.join(base, 'gustos.md')) || '';
const seccion = nombre => { const m = new RegExp('^##\\s*' + nombre + '\\b[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))', 'mi').exec(gustos); return m ? m[1].replace(/<!--[\s\S]*?-->/g, '') : ''; };
const fijado = [];
for (const l of seccion('Fijado').split('\n')) {
    if (/^\s*\|?\s*-{3,}/.test(l) || /^\s*\|\s*Categor/i.test(l)) continue;
    const valores = [...l.matchAll(/`([^`]+)`/g)].map(m => m[1]).filter(v => v.trim());
    if (valores.length) fijado.push({ linea: l.replace(/\s+/g, ' ').trim().slice(0, 90), valores });
}
const vetos = [...seccion('No').matchAll(/`([^`]{3,40})`/g)].map(m => m[1]);

// ---------------------------------------------------------------- comprobaciones
const norm = s => String(s).toLowerCase().replace(/\s*([:;,(){}])\s*/g, '$1').replace(/\s+/g, ' ');
// Lo que de verdad es el diseño: sin comentarios, sin el panel de opinión ni su CSS/JS, sin el banner y sin las
// descripciones de las piezas (que "Fraunces" salga en data-desc no significa que la maqueta use Fraunces).
function superficie(t) {
    return t.replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\* -+ sistema de opini[oó]n[\s\S]*?(?=<\/style>)/i, '')
        .replace(/<script>[\s\S]*?<\/script>/gi, '')
        .replace(/<div class="ds-banner"[\s\S]*?<\/div>/i, '')
        .replace(/<button[^>]*ds-op-boton[\s\S]*?<\/button>/i, '')
        .replace(/<div class="ds-op"[\s\S]*?<\/textarea>[\s\S]*?<\/div>\s*<\/div>/i, '')
        .replace(/<title>[\s\S]*?<\/title>/i, '')
        .replace(/\sdata-(desc|cat|pieza)=("[^"]*"|'[^']*')/gi, '');
}
const conAtributo = (t, a) => new RegExp(`<[a-z][^>]*\\s${a}(\\s|=|>|/)`, 'i').test(t);
const cuentaAtributo = (t, a) => (t.match(new RegExp(`<[a-z][^>]*\\s${a}(\\s|=|>|/)`, 'gi')) || []).length;
const maquetas = fs.readdirSync(dirRonda).filter(f => /\.html?$/i.test(f) && !/^(index|comparar)\.html?$/i.test(f)).sort();
let errores = 0;
const informe = [];
if (!maquetas.length) { console.log(`ronda-${N} no tiene maquetas .html.`); process.exit(1); }
if (N >= 2 && maquetas.length < 2) informe.push(`  AVISO  ronda-${N} solo tiene ${maquetas.length} maqueta: lo normal son 2 o 3 para poder elegir.`);

const contenidos = {};
for (const f of maquetas) {
    const t = leer(path.join(dirRonda, f));
    contenidos[f] = t;
    const mal = [];
    const letra = (/^([a-z])\b|^([a-z])[-_.]/i.exec(f) || [])[1] || (/^([a-z])/i.exec(f) || [])[1] || '';
    const L = letra.toUpperCase();
    const n = norm(superficie(t));
    // estructura
    if (/\{\{[^}]*\}\}/.test(t)) mal.push(`quedan huecos de la plantilla sin rellenar: ${(t.match(/\{\{[^}]*\}\}/) || [''])[0].slice(0, 50)}`);
    if (!new RegExp(`PROPUESTA[^<]*Ronda\\s*${N}\\b`, 'i').test(t)) mal.push(`falta el banner "PROPUESTA · Ronda ${N} · Maqueta ${L}"`);
    if (!/id=["']opinion["']/.test(t) || !/function textoOpinion/.test(t)) mal.push('falta el panel de opinión de la plantilla (id="opinion" y su script)');
    const piezas = [...t.matchAll(/<[a-z][^>]*\bdata-pieza=["']([^"']+)["'][^>]*>/gi)];
    if (piezas.length < 3) mal.push(`solo ${piezas.length} piezas etiquetadas (data-pieza): etiqueta cada decisión opinable (tipografía, color, botones, layout…)`);
    const ids = piezas.map(m => m[1]);
    const repes = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (repes.length) mal.push(`ids de pieza repetidos: ${[...new Set(repes)].join(', ')}`);
    const ajenas = ids.filter(x => L && !x.toUpperCase().startsWith(L + '·') && !x.toUpperCase().startsWith(L + '.'));
    if (ajenas.length) mal.push(`piezas que no empiezan por "${L}·" (la letra de la maqueta): ${ajenas.slice(0, 4).join(', ')}`);
    const sinDatos = piezas.filter(m => !/\bdata-cat=/.test(m[0]) || !/\bdata-desc=/.test(m[0])).map(m => m[1]);
    if (sinDatos.length) mal.push(`piezas sin data-cat o data-desc (el usuario no sabría qué vota): ${sinDatos.slice(0, 4).join(', ')}`);
    if (piezas.some(m => /^<(img|input)\b/i.test(m[0]))) mal.push('data-pieza puesto en <img> o <input>: no se ve la etiqueta; ponlo en un contenedor');
    // fijado y vetos
    for (const fx of fijado) {
        const faltan = fx.valores.filter(v => !n.includes(norm(v)));
        if (faltan.length) mal.push(`no respeta lo FIJADO (${fx.linea}): falta ${faltan.map(v => '`' + v + '`').join(', ')}`);
    }
    // los vetos se buscan en todo lo que no es la herramienta (también en comentarios: lo vetado no se cuela ni ahí)
    const sinPanel = norm(t.replace(/\/\* -+ sistema de opini[oó]n[\s\S]*?(?=<\/style>)/i, '').replace(/<script>[\s\S]*?<\/script>/gi, ''));
    for (const v of vetos) if (sinPanel.includes(norm(v))) mal.push(`contiene algo VETADO en gustos.md: \`${v}\``);
    // rondas siguientes
    if (N >= 2) {
        if (!args.includes('--sin-nuevo') && !conAtributo(t, 'data-nuevo')) mal.push('ninguna pieza NUEVA (data-nuevo): cada ronda debe enseñar algo que el usuario aún no ha visto en lo que sigue abierto');
        if (fijado.length && !conAtributo(t, 'data-fijado')) mal.push('lo fijado no está marcado con data-fijado (el usuario no debe volver a votarlo)');
    }
    errores += mal.length;
    informe.push(`${mal.length ? 'FAIL' : 'OK  '}  ${f}  (${piezas.length} piezas${N >= 2 ? `, ${cuentaAtributo(t, 'data-nuevo')} nuevas` : ''})`);
    for (const m of mal) informe.push(`        - ${m}`);
}
// copias
for (let i = 0; i < maquetas.length; i++) for (let j = i + 1; j < maquetas.length; j++) {
    const quitarLetra = s => s.replace(/data-pieza=["'][A-Z][·.]/gi, 'data-pieza="X·').replace(/Maqueta\s+[A-Z]\b/g, 'Maqueta X');
    if (quitarLetra(contenidos[maquetas[i]]) === quitarLetra(contenidos[maquetas[j]])) { errores++; informe.push(`FAIL  ${maquetas[i]} y ${maquetas[j]} son la misma maqueta: cada una tiene que explorar algo distinto`); }
}

console.log(`Ronda ${N} · ${maquetas.length} maqueta(s) · ${fijado.length} decisión(es) fijada(s) · ${vetos.length} veto(s)`);
for (const l of informe) console.log(l);

if (args.includes('--indice')) {
    const filas = rondas.map(r => {
        const fs2 = fs.readdirSync(path.join(propuestas, `ronda-${r}`)).filter(f => /\.html?$/i.test(f) && !/^(index|comparar)\./i.test(f)).sort();
        return `<li><strong>Ronda ${r}</strong> · ${fs2.map(f => `<a href="ronda-${r}/${f}">${f.replace(/\.html?$/i, '').toUpperCase()}</a>`).join(' · ')}</li>`;
    }).join('\n');
    fs.writeFileSync(path.join(propuestas, 'index.html'), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Propuestas</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px}a{margin:0 4px}</style></head><body><h1>Propuestas por rondas</h1><ul>\n${filas}\n</ul><p>Lo que ya está decidido y lo vetado está en gustos.md.</p></body></html>\n`);
    console.log(`Índice: ${path.relative(process.cwd(), path.join(propuestas, 'index.html'))}`);
}
if (errores) { console.log(`\n${errores} problema(s): corrige y vuelve a ejecutarlo antes de enseñar la ronda.`); process.exit(1); }
console.log('\nRonda lista para enseñar.');
process.exit(0);
