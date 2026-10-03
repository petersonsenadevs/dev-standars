#!/usr/bin/env node
// Tráfico del repositorio de Senzu: clones, visitas, estrellas y forks, ACUMULADOS por día.
// GitHub solo guarda los últimos 14 días de clones y visitas, y solo los enseña a quien tiene permiso de
// administración: este script los lee cada día (workflow .github/workflows/trafico.yml), los fusiona con el
// histórico y escribe, en la carpeta de salida (la rama `stats`):
//   trafico.json             histórico por día + totales (lo consume la web de Senzu en cada build)
//   badge-clones.json        endpoint de shields.io: clones totales
//   badge-clones-unicos.json endpoint de shields.io: clones únicos (suma de los únicos de cada día)
// Un día ya guardado no se cuenta dos veces: se queda con el valor más alto visto (el día en curso crece).
// Ojo al leerlo: incluye NUESTROS clones (CI de cada push, builds de la web, tarea semanal de terceros).
//   node tools/trafico.mjs --salida <carpeta> [--repo dueño/repo]
//   Variables: TRAFFIC_TOKEN (permiso «Administration: read» sobre el repo; sin él solo estrellas y forks)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VACIO = { _generado: 'tools/trafico.mjs (no editar)', repo: null, actualizado: null, dias: {}, totales: {}, repositorio: {} };

const dia = ts => String(ts).slice(0, 10);
const mil = n => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.0', '') + 'k' : String(n);

/**
 * Fusiona lo que devuelve la API con el histórico. Pura: no lee red ni disco (la prueban los tests).
 * @param historico  contenido previo de trafico.json (o VACIO)
 * @param datos      { repo, ahora, clones: {clones:[{timestamp,count,uniques}]} | null, vistas: {views:[…]} | null,
 *                     repositorio: {stargazers_count, forks_count, subscribers_count} | null }
 */
export function fusionar(historico, datos) {
    const h = JSON.parse(JSON.stringify(historico && historico.dias ? historico : VACIO));
    h._generado = VACIO._generado;
    h.repo = datos.repo || h.repo;
    const poner = (lista, campo, campoU) => {
        for (const x of lista || []) {
            const d = dia(x.timestamp);
            const r = h.dias[d] || (h.dias[d] = { clones: 0, clonesUnicos: 0, visitas: 0, visitasUnicas: 0 });
            r[campo] = Math.max(r[campo] || 0, x.count || 0);          // el día en curso crece: nunca se resta
            r[campoU] = Math.max(r[campoU] || 0, x.uniques || 0);
        }
    };
    if (datos.clones) poner(datos.clones.clones, 'clones', 'clonesUnicos');
    if (datos.vistas) poner(datos.vistas.views, 'visitas', 'visitasUnicas');
    // días en orden (el JSON se lee y se compara mejor)
    h.dias = Object.fromEntries(Object.entries(h.dias).sort(([a], [b]) => a.localeCompare(b)));
    const suma = c => Object.values(h.dias).reduce((n, r) => n + (r[c] || 0), 0);
    const fechas = Object.keys(h.dias);
    h.totales = {
        clones: suma('clones'), clonesUnicos: suma('clonesUnicos'),
        visitas: suma('visitas'), visitasUnicas: suma('visitasUnicas'),
        desde: fechas[0] || null, dias: fechas.length,
        traficoDisponible: !!(datos.clones || datos.vistas) || !!(historico && historico.totales && historico.totales.traficoDisponible),
    };
    if (datos.repositorio) h.repositorio = { estrellas: datos.repositorio.stargazers_count, forks: datos.repositorio.forks_count, seguidores: datos.repositorio.subscribers_count };
    h.actualizado = datos.ahora || new Date().toISOString();
    return h;
}

/** Endpoints de shields.io (https://shields.io/badges/endpoint-badge). */
export function badges(h) {
    const hay = h.totales && h.totales.traficoDisponible;
    const b = (label, n) => ({ schemaVersion: 1, label, message: hay ? mil(n) : 'sin datos', color: hay ? 'brightgreen' : 'lightgrey' });
    return { 'badge-clones.json': b('clones', h.totales.clones || 0), 'badge-clones-unicos.json': b('clones únicos', h.totales.clonesUnicos || 0) };
}

async function api(ruta, token) {
    const r = await fetch(`https://api.github.com${ruta}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'senzu-trafico', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!r.ok) throw new Error(`${ruta}: ${r.status} ${(await r.text()).slice(0, 120)}`);
    return r.json();
}

async function main() {
    const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
    const salida = arg('--salida');
    if (!salida) { console.error('Uso: node tools/trafico.mjs --salida <carpeta> [--repo dueño/repo]'); process.exit(2); }
    const repo = arg('--repo') || process.env.GITHUB_REPOSITORY || 'petersonsenadevs/senzu';
    const token = process.env.TRAFFIC_TOKEN || '';
    const archivo = path.join(salida, 'trafico.json');
    const previo = fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, 'utf8')) : VACIO;

    const datos = { repo, ahora: new Date().toISOString(), clones: null, vistas: null, repositorio: null };
    try { datos.repositorio = await api(`/repos/${repo}`, token || process.env.GITHUB_TOKEN); }
    catch (e) { console.log(`[trafico] AVISO: no se pudo leer el repositorio (${e.message})`); }
    if (token) {
        try { datos.clones = await api(`/repos/${repo}/traffic/clones?per=day`, token); } catch (e) { console.log(`[trafico] AVISO clones: ${e.message}`); }
        try { datos.vistas = await api(`/repos/${repo}/traffic/views?per=day`, token); } catch (e) { console.log(`[trafico] AVISO visitas: ${e.message}`); }
    } else {
        console.log('[trafico] Sin TRAFFIC_TOKEN: solo estrellas y forks. Crea el secreto: instrucciones en la cabecera de .github/workflows/trafico.yml.');
    }

    const h = fusionar(previo, datos);
    fs.mkdirSync(salida, { recursive: true });
    fs.writeFileSync(archivo, JSON.stringify(h, null, 2) + '\n');
    for (const [f, contenido] of Object.entries(badges(h))) fs.writeFileSync(path.join(salida, f), JSON.stringify(contenido) + '\n');
    const t = h.totales;
    console.log(`[trafico] ${repo}: ${t.clones} clones (${t.clonesUnicos} únicos) y ${t.visitas} visitas en ${t.dias} días desde ${t.desde || '—'}; ★ ${h.repositorio.estrellas ?? '—'} · forks ${h.repositorio.forks ?? '—'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
