#!/usr/bin/env node
// Genera la documentación PÚBLICA del catálogo de efectos (la consume la web de Senzu):
//   docs/efectos.md   — página legible: demos que funcionan + catálogo completo por categoría + reglas
//   docs/efectos.json — contrato para la web: categorías, efectos (skill, receta, archivo y sección), demos (con
//                       su ficha: título, descripción, dependencias, parámetros, móvil, reducir movimiento)
// Fuentes (nunca se escribe a mano lo generado):
//   core/skills-plugin/front-activation/references/effects-catalog.md   (tablas por categoría)
//   core/skills-plugin/front-activation/references/recipes/demos/*.html (bloque <script id="senzu-demo">)
// Salida determinista (sin fechas): el CI comprueba que está al día. Lo ejecuta build-docs.ps1.
//   node tools/build-efectos.mjs [--comprobar]   (--comprobar: falla si una demo no tiene ficha o el JSON no cuadra)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FA = 'core/skills-plugin/front-activation';
const CATALOGO = `${FA}/references/effects-catalog.md`;
const DEMOS = `${FA}/references/recipes/demos`;
const DIRS_SKILLS = ['core/skills', 'core/skills-plugin', 'core/skills-overlay', 'core/skills-vendor'];
const leer = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const existe = f => fs.existsSync(path.join(ROOT, f));
const slug = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ancla = t => t.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');   // como GitHub
const errores = [];

// ---------------------------------------------------------------- catálogo: categorías con tabla
const texto = leer(CATALOGO);
const secciones = texto.split(/^## /m).slice(1).map(s => { const [titulo, ...resto] = s.split('\n'); return { titulo: titulo.trim(), cuerpo: resto.join('\n') }; });
// una skill puede estar partida: capa en castellano (overlay) + original (vendor); se busca el archivo en todas
const rutaEnSkill = (n, archivo) => DIRS_SKILLS.map(d => `${d}/${n}/${archivo}`).find(existe) || null;
function receta(celda) {
    const skill = (/^\s*([a-z0-9-]+)\s*→/.exec(celda) || [])[1] || null;
    const archivo = (/`([^`]+\.(?:md|html|vue|tsx?|mjs|js))`/.exec(celda) || [])[1] || null;
    // «§3 Pin + scrub timeline» es una sección; «§x + `templates/…`» son dos referencias: se corta en la segunda
    const seccion = (/§\s*(.+?)\s*(?:\(|;\s|:\s`|\s\+\s*(?:`|[a-z-]+ →)|$)/.exec(celda) || [])[1] || null;
    const ruta = skill && archivo ? rutaEnSkill(skill, archivo) : null;
    return { skill, archivo: ruta, seccion: seccion ? seccion.trim() : null, texto: celda.trim() };
}
const categorias = [];
let reglas = [];
for (const s of secciones) {
    if (/^Reglas al aplicar/i.test(s.titulo)) { reglas = s.cuerpo.split('\n').filter(l => /^- /.test(l)).map(l => l.slice(2).trim()); continue; }
    const filas = s.cuerpo.split('\n').filter(l => /^\|/.test(l) && !/^\|\s*-/.test(l) && !/^\|\s*Efecto/i.test(l));
    if (!filas.length) continue;
    const descripcion = s.cuerpo.split('\n').filter(l => l.trim() && !/^\|/.test(l)).join(' ').trim();
    const efectos = filas.map(l => {
        const c = l.replace(/^\||\|\s*$/g, '').split('|').map(x => x.trim());
        const [es, en] = c[0].split(' / ').map(x => x.trim());
        return { es, en: en || null, receta: receta(c[1] || ''), stacks: c[2] || null, reducirMovimiento: c[3] || null, costeMovil: c[4] || null };
    });
    categorias.push({ nombre: s.titulo, slug: slug(s.titulo), descripcion, efectos });
}

// ---------------------------------------------------------------- demos: la ficha de cada HTML
const demos = fs.readdirSync(path.join(ROOT, DEMOS)).filter(f => f.endsWith('.html')).sort().map(f => {
    const html = leer(`${DEMOS}/${f}`);
    const m = /<script type="application\/json" id="senzu-demo">([\s\S]*?)<\/script>/.exec(html);
    if (!m) { errores.push(`${DEMOS}/${f}: sin ficha <script type="application/json" id="senzu-demo">`); return null; }
    let ficha; try { ficha = JSON.parse(m[1]); } catch (e) { errores.push(`${DEMOS}/${f}: ficha con JSON inválido (${e.message})`); return null; }
    for (const campo of ['titulo', 'descripcion', 'categoria', 'receta']) if (!ficha[campo]) errores.push(`${DEMOS}/${f}: a la ficha le falta «${campo}»`);
    const archivoReceta = (ficha.receta || '').split('#')[0];
    if (archivoReceta && !existe(archivoReceta)) errores.push(`${DEMOS}/${f}: la receta ${archivoReceta} no existe`);
    if (ficha.categoria && !categorias.some(c => c.nombre === ficha.categoria)) errores.push(`${DEMOS}/${f}: la categoría «${ficha.categoria}» no está en el catálogo`);
    return { slug: f.replace(/\.html$/, ''), archivo: `${DEMOS}/${f}`, ...ficha };
}).filter(Boolean);

if (errores.length) { console.error(errores.map(e => 'ERROR ' + e).join('\n')); process.exit(1); }

// ---------------------------------------------------------------- docs/efectos.json
const json = { _generado: 'tools/build-efectos.mjs (no editar)', fuente: { catalogo: CATALOGO, demos: DEMOS }, categorias, demos, reglas };
const salidaJson = JSON.stringify(json, null, 2) + '\n';

// ---------------------------------------------------------------- docs/efectos.md
const rel = r => `../${r}`;   // los enlaces se escriben relativos a docs/ (la web los reescribe a GitHub)
const enlaceReceta = r => {
    const [archivo, frag] = r.split('#');
    const sec = frag ? decodeURIComponent(frag) : null;
    return `[${path.posix.basename(archivo)}${sec ? ` §${sec.replace(/-/g, ' ')}` : ''}](${rel(archivo)}${frag ? '#' + frag : ''})`;
};
const md = [
    '# Efectos',
    '',
    '<!-- GENERADO por tools/build-efectos.mjs desde el catálogo de efectos y las fichas de las demos. No editar. -->',
    '[← Volver al README](../README.md)',
    '',
    'Senzu trae un catálogo de efectos de front con receta por stack (Astro, Next/React, Vue/Inertia): se piden en',
    'llano («ponle un parallax», «que caiga el logo y se rompa la pantalla») o con `/efecto`, y el agente abre SOLO',
    'la receta de ese efecto. Todos tienen versión para «reducir movimiento» y su coste en móvil decidido.',
    '',
    '## Demos que funcionan',
    '',
    'Archivos HTML autocontenidos: se abren con doble clic y son la base que el agente adapta al proyecto.',
    '',
    ...demos.flatMap(d => [
        `### ${d.titulo}`,
        '',
        d.descripcion,
        '',
        `- **Demo:** [\`${path.posix.basename(d.archivo)}\`](${rel(d.archivo)})`,
        `- **Receta:** ${enlaceReceta(d.receta)}`,
        `- **Dependencias:** ${d.dependencias && d.dependencias.length ? d.dependencias.map(x => `${x.nombre} ${x.version} (${x.licencia}; ${x.carga})`).join(' · ') : 'ninguna'}`,
        d.interaccion ? `- **Interacción:** ${d.interaccion}` : null,
        d.reducirMovimiento ? `- **Con «reducir movimiento»:** ${d.reducirMovimiento}` : null,
        d.movil ? `- **En móvil:** ${d.movil}` : null,
        d.parametros && d.parametros.length ? `- **Pruébala:** ${d.parametros.map(p => `\`${p.valor}\` (${p.que})`).join(' · ')}` : null,
        '',
    ].filter(l => l !== null)),
    '## Catálogo',
    '',
    ...categorias.flatMap(c => [
        `### ${c.nombre}`,
        '',
        ...(c.descripcion ? [c.descripcion, ''] : []),
        '| Efecto | Skill y receta | Stacks | Con «reducir movimiento» | Coste en móvil |',
        '|---|---|---|---|---|',
        ...c.efectos.map(e => {
            const r = e.receta;
            const donde = r.archivo ? `\`${r.skill}\` → [${path.posix.basename(r.archivo)}](${rel(r.archivo)}${r.seccion ? '#' + ancla(r.seccion) : ''})${r.seccion ? ` §${r.seccion}` : ''}` : (r.skill ? `\`${r.skill}\`` : r.texto);
            return `| ${e.es}${e.en ? ` *(${e.en})*` : ''} | ${donde} | ${e.stacks || ''} | ${e.reducirMovimiento || ''} | ${e.costeMovil || ''} |`;
        }),
        '',
    ]),
    '## Reglas al aplicar cualquier efecto',
    '',
    ...reglas.map(r => `- ${r}`),
    '',
].join('\n');

const escribir = (f, contenido) => {
    const p = path.join(ROOT, f);
    const antes = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
    if (antes === contenido) return false;
    fs.writeFileSync(p, contenido); return true;
};
if (process.argv.includes('--comprobar')) {
    const igual = f => existe(f) && leer(f) === (f.endsWith('.json') ? salidaJson : md);
    const mal = ['docs/efectos.md', 'docs/efectos.json'].filter(f => !igual(f));
    if (mal.length) { console.error(`Sin actualizar: ${mal.join(', ')} (ejecuta node tools/build-efectos.mjs)`); process.exit(1); }
    console.log(`Efectos: ${categorias.length} categorías, ${categorias.reduce((n, c) => n + c.efectos.length, 0)} efectos, ${demos.length} demos; todo al día.`);
} else {
    const cambios = [escribir('docs/efectos.md', md), escribir('docs/efectos.json', salidaJson)];
    console.log(`  [docs] efectos.md + efectos.json (${categorias.length} categorías, ${categorias.reduce((n, c) => n + c.efectos.length, 0)} efectos, ${demos.length} demos)${cambios.some(Boolean) ? '' : ' sin cambios'}`);
}
