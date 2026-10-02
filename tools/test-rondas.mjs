#!/usr/bin/env node
// Suite de las rondas de maquetas: plantilla (references/es/plantilla-maqueta.html) y verificador
// (scripts/ronda-check.mjs). Monta un design-system de prueba con lo fijado y lo vetado en gustos.md y
// comprueba que el verificador caza cada forma de saltárselo.
//   node tools/test-rondas.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OVER = path.join(ROOT, 'core', 'skills-overlay', 'ui-ux-pro-max');
const PLANTILLA = fs.readFileSync(path.join(OVER, 'references', 'es', 'plantilla-maqueta.html'), 'utf8');
const CHECK = path.join(OVER, 'scripts', 'ronda-check.mjs');
let casos = 0, fallos = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };

const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-rondas-'));
const ds = path.join(proj, 'design-system', 'acme');
const w = (rel, txt) => { const f = path.join(ds, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); return f; };
w('gustos.md', [
    '# Gustos del cliente', '',
    '## Fijado (se mantiene igual en todas las rondas)',
    '| Categoría | Decisión | Valor | Desde |', '|---|---|---|---|',
    '| Tipografía titulares | Fraunces 600 | `Fraunces` | R1 · B·T1 |',
    '| Botón principal | píldora | `border-radius: 999px` | R1 · A·B2 |',
    '| Acento | terracota | `#C2410C` | R1 · B·C1 |',
    '| Nota sin valor | solo texto, sin acentos graves | — | R1 |', '',
    '## Sí (le gusta)', '- fotos a sangre', '',
    '## No (vetado)', '- verde salvia (A·C1) — términos bloqueados: `#7C9A7E`', '- carrusel — términos bloqueados: `carousel`', '',
    '## Dudas / abierto', '- layout del hero', ''].join('\r\n'));   // CRLF a propósito

// Rellena la plantilla como lo haría el agente
function maqueta(L, N, o = {}) {
    const fijado = o.sinFijadoMarcado ? '' : ' data-fijado';
    const piezas = o.piezas || [
        `<h1 data-pieza="${L}·T1" data-cat="Tipografía" data-desc="Titulares en Fraunces"${fijado}>Tu obra limpia, sin esperas</h1>`,
        `<a class="boton" data-pieza="${L}·B1" data-cat="Botones" data-desc="Píldora sólida"${fijado}>Pide presupuesto</a>`,
        `<section data-pieza="${L}·L1" data-cat="Layout" data-desc="${o.layout || 'Hero partido'}"${o.nuevo === false ? '' : ' data-nuevo'}><p>Contenido</p></section>`,
        `<div data-pieza="${L}·C1" data-cat="Color" data-desc="Fondo ${o.fondo || 'crema'}"><p>Bloque</p></div>`,
        ...(o.sinMovil ? [] : [`<button data-pieza="${L}·V1" data-cat="Versión móvil" data-desc="En móvil: menú burger a pantalla completa" aria-label="Menú">Menú</button>`]),
    ];
    let t = PLANTILLA.split('{{Proyecto}}').join('Acme').split('{{N}}').join(String(N)).split('{{LETRA}}').join(L);
    t = t.replace(/\{\{<link de Google Fonts[^}]*\}\}/, `<link href="https://fonts.googleapis.com/css2?family=${o.fuente || 'Fraunces'}:wght@600&display=swap" rel="stylesheet">`);
    t = t.replace(/\{\{--color-fondo[\s\S]*?\}\}/, `--color-acento: ${o.acento || '#C2410C'}; --fuente-titulos: '${o.fuente || 'Fraunces'}', serif; --radio: ${o.radio || '999px'};`);
    t = t.replace('{{estilos de la maqueta}}', `.boton { border-radius:${o.radio || '999px'}; background: var(--color-acento); } h1 { font-family: var(--fuente-titulos); } ${o.css || ''}`);
    t = t.replace(/\{\{Qué cambia[^}]*\}\}/, o.cambia || 'Fijado: letra y botones. Probamos: hero. Nuevo: mosaico');
    t = t.replace(/\{\{CONTENIDO DE LA MAQUETA[\s\S]*?\}\}/, piezas.join('\n') + (o.extra || ''));
    if (o.banner) t = t.replace(/PROPUESTA · Ronda \d+/, o.banner);
    return t;
}
const run = (...extra) => { const r = spawnSync(process.execPath, [CHECK, path.join('design-system', 'acme'), ...extra], { cwd: proj, encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
const ronda = (N, archivos) => { fs.rmSync(path.join(ds, 'propuestas', `ronda-${N}`), { recursive: true, force: true }); for (const [f, t] of Object.entries(archivos)) w(`propuestas/ronda-${N}/${f}`, t); };
const debeFallar = (nombre, patron, ...extra) => { const r = run(...extra); ok(r.code === 1 && patron.test(r.out), nombre, `exit ${r.code} :: ${r.out.split('\n').filter(l => /FAIL|-/.test(l)).slice(0, 3).join(' | ')}`); };
const debePasar = (nombre, ...extra) => { const r = run(...extra); ok(r.code === 0 && /Ronda lista para enseñar/.test(r.out), nombre, `exit ${r.code} :: ${r.out.slice(0, 400)}`); };

// ---------------------------------------------------------------- sin rondas
{ const r = run(); ok(r.code === 2 && /No hay rondas/.test(r.out), 'sin carpeta de rondas -> aviso claro', r.out.slice(0, 120)); }

// ---------------------------------------------------------------- ronda 1
ronda(1, { 'a.html': maqueta('A', 1, { nuevo: false, sinFijadoMarcado: true }), 'b.html': maqueta('B', 1, { nuevo: false, sinFijadoMarcado: true, layout: 'Hero centrado', fondo: 'blanco' }) });
debePasar('ronda 1 correcta (sin exigir nuevo ni fijado marcado)');
ronda(1, { 'a.html': PLANTILLA, 'b.html': maqueta('B', 1, { nuevo: false }) });
debeFallar('plantilla copiada sin rellenar', /huecos de la plantilla/);

// ---------------------------------------------------------------- ronda 2: lo bueno pasa
ronda(1, { 'a.html': maqueta('A', 1, { nuevo: false }), 'b.html': maqueta('B', 1, { nuevo: false, layout: 'Hero centrado' }) });
const buenas = {
    'a.html': maqueta('A', 2, { layout: 'Mosaico editorial', fondo: 'arena' }),
    'b.html': maqueta('B', 2, { layout: 'Hero a sangre', fondo: 'carbón' }),
    'c.html': maqueta('C', 2, { layout: 'Pantalla dividida', fondo: 'hueso' }),
};
ronda(2, buenas);
debePasar('ronda 2 correcta: fijado en todas, nada vetado, algo nuevo');
debePasar('--ronda 1 revisa la ronda indicada, no la última', '--ronda', '1');

// ---------------------------------------------------------------- ronda 2: cada trampa
ronda(2, { ...buenas, 'b.html': maqueta('B', 2, { fuente: 'Playfair Display', layout: 'Hero a sangre' }) });
debeFallar('falta la tipografía fijada en UNA maqueta (b)', /b\.html[\s\S]*FIJADO[\s\S]*Fraunces/);
ronda(2, { ...buenas, 'a.html': maqueta('A', 2, { radio: '12px', layout: 'Mosaico editorial' }) });
debeFallar('cambia el radio del botón fijado', /border-radius: 999px/);
ronda(2, { ...buenas, 'c.html': maqueta('C', 2, { acento: '#c2410c', layout: 'Pantalla dividida', css: '.x{border-radius :  999px}' }) });
debePasar('mayúsculas y espacios distintos en lo fijado siguen contando (#c2410c, border-radius :  999px)');
ronda(2, { ...buenas, 'a.html': maqueta('A', 2, { layout: 'Mosaico', extra: '<div class="Carousel-testimonios"></div>' }) });
debeFallar('veto "carousel" escrito con mayúscula en una clase', /VETADO[\s\S]*carousel/i);
ronda(2, { ...buenas, 'b.html': maqueta('B', 2, { layout: 'Hero a sangre', css: '.fondo{background:#7c9a7e}' }) });
debeFallar('veto de color en minúsculas (#7c9a7e)', /VETADO[\s\S]*7C9A7E/i);
ronda(2, { ...buenas, 'a.html': maqueta('A', 2, { nuevo: false, layout: 'Mosaico' }) });
debeFallar('ronda 2 sin nada nuevo', /ninguna pieza NUEVA/);
debePasar('... salvo con --sin-nuevo', '--sin-nuevo');
ronda(2, { ...buenas, 'b.html': maqueta('B', 2, { sinMovil: true, layout: 'Hero a sangre' }) });
debeFallar('maqueta sin ninguna decisión de móvil (pieza V)', /VERSIÓN MÓVIL/);
debePasar('... salvo con --sin-movil', '--sin-movil');
ronda(2, { ...buenas, 'c.html': maqueta('C', 2, { sinFijadoMarcado: true, layout: 'Pantalla dividida' }) });
debeFallar('lo fijado sin marcar con data-fijado', /data-fijado/);
ronda(2, { 'a.html': maqueta('A', 2, { layout: 'Igual' }), 'b.html': maqueta('B', 2, { layout: 'Igual' }) });
debeFallar('dos maquetas iguales salvo la letra', /misma maqueta/);
ronda(2, { ...buenas, 'b.html': maqueta('A', 2, { layout: 'Hero a sangre' }).replace('Maqueta A', 'Maqueta B') });
debeFallar('piezas con la letra de otra maqueta (A· en b.html)', /no empiezan por "B·"/);
ronda(2, { ...buenas, 'c.html': maqueta('C', 2, { piezas: ['<img data-pieza="C·I1" data-cat="Imágenes" data-desc="Foto" src="x.jpg">', '<h1 data-pieza="C·T1" data-cat="Tipografía" data-desc="Fraunces" data-fijado>t</h1>', '<a data-pieza="C·B1" data-cat="Botones" data-desc="p" data-fijado>b</a>', '<section data-pieza="C·L1" data-cat="Layout" data-desc="x" data-nuevo>s</section>'] }) });
debeFallar('data-pieza en una <img>', /<img> o <input>/);
ronda(2, { ...buenas, 'a.html': maqueta('A', 2, { piezas: ['<h1 data-pieza="A·T1" data-cat="Tipografía" data-fijado>t</h1>', '<a data-pieza="A·B1" data-cat="Botones" data-desc="p" data-fijado>b</a>', '<section data-pieza="A·L1" data-cat="Layout" data-desc="x" data-nuevo>s</section>'] }) });
debeFallar('pieza sin data-desc (el usuario no sabría qué vota)', /sin data-cat o data-desc/);
ronda(2, { ...buenas, 'a.html': maqueta('A', 2, { layout: 'Mosaico', banner: 'PROPUESTA · Ronda 1' }) });
debeFallar('banner con la ronda equivocada', /banner/);
ronda(2, { ...buenas, 'b.html': maqueta('B', 2, { layout: 'Hero', piezas: ['<h1 data-pieza="B·T1" data-cat="T" data-desc="d" data-fijado>t</h1>', '<h2 data-pieza="B·T1" data-cat="T" data-desc="d" data-nuevo>t</h2>', '<a data-pieza="B·B1" data-cat="B" data-desc="d" data-fijado>b</a>'] }) });
debeFallar('ids de pieza repetidos', /repetidos/);

// ---------------------------------------------------------------- índice
ronda(2, buenas);
{
    const r = run('--indice');
    const idx = path.join(ds, 'propuestas', 'index.html');
    const t = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : '';
    ok(r.code === 0 && /ronda-1\/a\.html/.test(t) && /ronda-2\/c\.html/.test(t), '--indice lista todas las rondas y maquetas', r.out.slice(-200));
}

// ---------------------------------------------------------------- texto que copia el panel
{
    const script = /<script>([\s\S]*?)<\/script>/.exec(PLANTILLA)[1];
    const mod = { exports: {} };
    vm.runInNewContext(script, { module: mod });
    const { textoOpinion } = mod.exports;
    ok(typeof textoOpinion === 'function', 'el script de la plantilla expone textoOpinion fuera del navegador');
    const piezas = [{ id: 'B·T1', cat: 'Tipografía', desc: 'Titulares en Fraunces' }, { id: 'A·C1', cat: 'Color', desc: 'Verde salvia' }, { id: 'A·B2', cat: 'Botones', desc: 'Píldora' }];
    const t = textoOpinion('Acme · Ronda 2 · Maqueta B', piezas, { 'B·T1': 'si', 'A·C1': 'no' }, '  más aire entre secciones ');
    ok(/^Opinión · Acme · Ronda 2 · Maqueta B$/m.test(t), 'cabecera con el título de la maqueta', t);
    ok(/Me gusta: B·T1 \(Tipografía: Titulares en Fraunces\)$/m.test(t), 'me gusta con id, categoría y descripción', t);
    ok(/No me gusta: A·C1 \(Color: Verde salvia\)$/m.test(t), 'no me gusta', t);
    ok(!/A·B2/.test(t), 'lo no votado no aparece', t);
    ok(/Comentario: más aire entre secciones$/m.test(t), 'comentario recortado', t);
    const vacio = textoOpinion('X', piezas, {}, '');
    ok(/Me gusta: —/.test(vacio) && /No me gusta: —/.test(vacio) && !/Comentario/.test(vacio), 'sin votos ni comentario: guiones y sin línea de comentario', vacio);
}
{   // la plantilla no usa emojis como iconos (regla de ui-ux-pro-max)
    ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(PLANTILLA), 'la plantilla no lleva emojis');
}

fs.rmSync(proj, { recursive: true, force: true });
console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
