#!/usr/bin/env node
// Buscador del devlog: encuentra decisiones y entradas pasadas sin leer archivos enteros.
// Ejecutar desde la RAÍZ del proyecto (cualquier agente, cualquier OS, sin dependencias):
//   node <skills-dir>/devlog/scripts/buscar.mjs "pagos stripe" [--max 5] [--desde 2026-09] [--hasta 2026-10-15]
//        [--tipo fix|feature|decisión|memoria...] [--devlog <carpeta>] [--json]
// Busca en devlog/MEMORIA.md (+ MEMORIA-historico.md), en cada entrada NNN-*.md por secciones y en los
// DECISIONES.md. Tolera acentos, mayúsculas, plurales y conjugaciones (raíces), erratas de una letra y
// sinónimos técnicos (lista base + devlog/sinonimos.json del proyecto). Ranking BM25 con más peso para
// títulos, decisiones y memoria; premia cubrir todas las palabras; a igualdad, lo más reciente.
// Salida compacta: el agente abre después SOLO la entrada que necesite.

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------- argumentos
const argv = process.argv.slice(2);
const opts = { max: 5, desde: null, hasta: null, tipo: null, devlog: null, json: false, soloDevlog: false };
const libres = [];
let nEntradas = 0;
let fuentes = [];
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const sig = () => argv[++i];
    if (a === '--max') opts.max = Math.max(1, parseInt(sig(), 10) || 5);
    else if (a === '--desde') opts.desde = sig();
    else if (a === '--hasta') opts.hasta = sig();
    else if (a === '--tipo') opts.tipo = sig();
    else if (a === '--devlog') opts.devlog = sig();
    else if (a === '--json') opts.json = true;
    else if (a === '--solo-devlog') opts.soloDevlog = true;
    else if (a === '--help' || a === '-h') { ayuda(); process.exit(0); }
    else libres.push(a);
}
function ayuda() {
    console.log('Uso: node buscar.mjs "<palabras>" [--max 5] [--desde AAAA-MM[-DD]] [--hasta AAAA-MM[-DD]] [--tipo fix|feature|decisión|memoria] [--devlog <carpeta>] [--solo-devlog] [--json]');
}
const consulta = libres.join(' ').trim();
if (!consulta) { ayuda(); process.exit(2); }
// senzu/devlog (proyectos actuales) o devlog/ (proyectos antiguos sin migrar)
const devlogDir = path.resolve(opts.devlog || [path.join(process.cwd(), 'senzu', 'devlog'), path.join(process.cwd(), 'devlog')].find(d => fs.existsSync(d)) || path.join(process.cwd(), 'senzu', 'devlog'));

// ---------------------------------------------------------------- normalización
const quitarAcentos = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalizar = s => quitarAcentos(String(s).toLowerCase());
const VACIAS = new Set(('de la el los las un una unos unas y e o u en a al del que por para con sin se su sus lo le les ' +
    'es son era fue fueron ser estar esta este esto ese esa eso estos estas hay ha han he me mi mis nos tu te ' +
    'como mas pero ya no si muy tambien entre sobre hasta desde cuando donde porque cual cuales quien ' +
    'hicimos hice hizo hacemos hacer hecho cambiamos cambio decidimos decidio paso pasa pasado ' +
    'algo todo toda todos nada otra otro ver vez veces dia hoy ayer the of and to in for is on with at by an ' +
    'what why when how did was were it this that').split(' '));
const SUFIJOS = ['amientos', 'imientos', 'aciones', 'iciones', 'amiento', 'imiento', 'idades', 'adoras', 'adores',
    'acion', 'icion', 'mente', 'idad', 'ables', 'ibles', 'adora', 'ador', 'ando', 'iendo', 'ados', 'adas', 'idos',
    'idas', 'able', 'ible', 'istas', 'ista', 'ing', 'ado', 'ada', 'ido', 'ida', 'ed', 'ar', 'er', 'ir', 'es', 'os',
    'as', 's', 'o', 'a', 'e'];
function raiz(t) {
    if (/^\d+$/.test(t) || t.length <= 3) return t;
    for (const suf of SUFIJOS) {
        if (t.endsWith(suf) && t.length - suf.length >= 3) return t.slice(0, -suf.length);
    }
    return t;
}
const tokens = s => normalizar(s).split(/[^a-z0-9ñ]+/).filter(t => t.length >= 2 || /^\d$/.test(t));

// Damerau-Levenshtein acotado a 1 (sustitución, inserción, borrado o transposición)
function distanciaUno(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0;
    while (i < la && i < lb && a[i] === b[i]) i++;
    if (la === lb) {
        if (a.slice(i + 1) === b.slice(i + 1)) return true;                                // sustitución
        return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // transposición
    }
    return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);         // borrado / inserción
}

// ---------------------------------------------------------------- sinónimos
const SINONIMOS_BASE = [
    ['pago', 'pagos', 'pagar', 'cobro', 'cobrar', 'stripe', 'checkout', 'pasarela', 'redsys', 'paypal', 'factura', 'facturacion'],
    ['login', 'auth', 'autenticacion', 'autenticar', 'sesion', 'sanctum', 'jwt', 'oauth', 'passport', 'socialite'],
    ['contrasena', 'password', 'clave', 'recuperar', 'reset'],
    ['cola', 'colas', 'queue', 'job', 'jobs', 'worker', 'horizon', 'supervisor'],
    ['despliegue', 'desplegar', 'deploy', 'produccion', 'prod', 'forge', 'vercel', 'netlify', 'servidor'],
    ['migracion', 'migrar', 'migration', 'esquema', 'schema', 'columna', 'tabla'],
    ['correo', 'email', 'mail', 'newsletter', 'smtp', 'mailgun', 'resend'],
    ['cache', 'redis', 'memcached'],
    ['test', 'tests', 'prueba', 'pruebas', 'pest', 'phpunit', 'vitest', 'jest', 'playwright'],
    ['error', 'fallo', 'bug', 'excepcion', 'exception', 'falla', 'roto'],
    ['lento', 'rendimiento', 'performance', 'optimizar', 'velocidad', 'lcp', 'carga'],
    ['diseno', 'design', 'estilo', 'paleta', 'tipografia', 'ui', 'maqueta'],
    ['buscador', 'busqueda', 'search', 'filtro', 'filtros'],
    ['imagen', 'imagenes', 'foto', 'fotos', 'webp', 'avif', 'media'],
    ['seo', 'posicionamiento', 'sitemap', 'metadatos', 'serp'],
    ['cliente', 'clienta', 'usuario', 'jefe'],
    ['backup', 'copia', 'respaldo', 'restore', 'restaurar'],
    ['animacion', 'gsap', 'scroll', 'efecto', 'parallax'],
    ['formulario', 'form', 'formularios', 'validacion', 'contacto'],
];
function cargarSinonimos() {
    const grupos = SINONIMOS_BASE.map(g => g.slice());
    try {
        const extra = JSON.parse(fs.readFileSync(path.join(devlogDir, 'sinonimos.json'), 'utf8').replace(/^﻿/, ''));
        // Un grupo del proyecto que comparte palabra con uno de base lo amplía ("datafono, cobro" -> todo pagos)
        for (const g of [].concat(extra || [])) {
            if (!Array.isArray(g) || g.length < 2) continue;
            const propio = g.map(w => normalizar(String(w)));
            const raices = new Set(propio.map(raiz));
            const enlazados = grupos.filter(b => b.some(w => raices.has(raiz(normalizar(w)))));
            if (enlazados.length) for (const b of enlazados) b.push(...propio); else grupos.push(propio);
        }
    } catch { /* sin archivo propio o mal formado: se usa la lista base */ }
    return grupos.map(g => new Set(g.map(w => raiz(normalizar(w)))));
}

// ---------------------------------------------------------------- lectura del devlog
const leer = f => { try { return fs.readFileSync(f, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n'); } catch { return null; } };
const docs = [];   // { id, clase, num, fecha, titulo, tipo, seccion, texto, archivo, sustituida }

function trocearMemoria(archivo, clase) {
    const t = leer(archivo); if (t == null) return;
    let seccion = '';
    for (const linea of t.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
        const h = /^#{1,6}\s+(.*)/.exec(linea);
        if (h) { seccion = h[1].trim(); continue; }
        const item = /^\s*[-*]\s+(.+)/.exec(linea);
        if (!item) continue;
        const texto = item[1].trim();
        const ref = /\b(?:ver|entrada|devlog)\s*#?(\d{3})\b/i.exec(texto);
        docs.push({ clase, seccion, texto, titulo: '', num: ref ? ref[1] : null, fecha: null, tipo: clase,
            archivo: path.relative(process.cwd(), archivo), sustituida: /sustitui|reemplazad|obsolet|ya no aplica/i.test(texto) });
    }
}
function trocearEntrada(archivo, fecha, esAdr = false) {
    const t = leer(archivo); if (t == null) return;
    const num = (/^(\d{3,})[-_]/.exec(path.basename(archivo)) || [])[1];
    const tit = (/^#\s+(.+)/m.exec(t) || [])[1] || path.basename(archivo, '.md');
    const titulo = tit.replace(/^(adr[-\s]*)?\d{3,}\s*[—–\-:.]\s*/i, '').trim();
    const tipo = esAdr ? 'decision' : (normalizar((/\*\*Tipo:\*\*\s*([^\n·|]+)/i.exec(t) || [])[1] || '').trim().split(/\s+/)[0] || '');
    // Fecha: campo **Fecha:**, la carpeta del día o la primera fecha de las primeras líneas (devlogs propios y ADRs)
    const fechaMeta = (/\*\*Fecha(?:\/hora)?:\*\*\s*(\d{4}-\d{2}-\d{2})/i.exec(t) || [])[1] || fecha
        || (/\b(\d{4}-\d{2}-\d{2})\b/.exec(t.split('\n').slice(0, 8).join('\n')) || [])[1] || null;
    const partes = t.split(/^(?=##\s)/m);
    for (const p of partes) {
        const h = /^##\s+(.*)/.exec(p);
        const seccion = h ? h[1].trim() : '';
        const cuerpo = (h ? p.slice(h[0].length) : p.replace(/^#\s+.*\n?/, '')).trim();
        if (!cuerpo && !h) continue;
        docs.push({ clase: esAdr || /decisi/i.test(seccion) ? 'decision' : 'entrada', deEntrada: true, seccion, texto: cuerpo, titulo,
            num, fecha: fechaMeta, tipo, archivo: path.relative(process.cwd(), archivo), sustituida: false });
    }
}
function trocearDecisiones(archivo, fecha) {
    const t = leer(archivo); if (t == null) return;
    const cuerpo = t.replace(/^#\s+.*\n?/m, '');
    // Una decisión = un bloque "## ..." con sus viñetas; si el archivo no usa "##", cada viñeta es una decisión
    const bloques = /^##\s/m.test(cuerpo) ? cuerpo.split(/^(?=##\s)/m) : cuerpo.split(/^(?=[-*]\s)/m);
    for (const b of bloques) {
        const texto = b.trim();
        if (!texto) continue;
        // Solo referencias explícitas a una entrada (dev-004, #004, devlog 004, ver 004): "100 ms" no es una entrada
        const ref = /(?:dev-|#|devlog\s*|ver\s+|entrada\s+)(\d{3})\b/i.exec(texto);
        const cab = (/^##\s+(.*)/.exec(texto) || [])[1] || texto.replace(/^[-*]\s+/, '').split('\n')[0];
        docs.push({ clase: 'decision', seccion: 'Decisiones', texto: texto.replace(/^##\s+.*\n?/, '') || texto,
            titulo: cab.length > 90 ? cab.slice(0, 87) + '…' : cab,
            num: ref ? ref[1] : null, fecha, tipo: 'decision', archivo: path.relative(process.cwd(), archivo),
            sustituida: /sustitui|reemplazad|obsolet/i.test(texto) });
    }
}

trocearMemoria(path.join(devlogDir, 'MEMORIA.md'), 'memoria');
trocearMemoria(path.join(devlogDir, 'MEMORIA-historico.md'), 'historico');
// Entradas: en carpetas por día (devlog/2026-10-01/063-x.md) o sueltas (docs/devlog/0137-x.md), hasta 3 niveles
function recorrer(dir, prof, fechaCarpeta, esAdr) {
    for (const n of safeDir(dir)) {
        const ruta = path.join(dir, n);
        if (esDir(ruta)) {
            if (prof < 3 && !/^(node_modules|\.git|vendor|dist|build)$/i.test(n)) recorrer(ruta, prof + 1, /^\d{4}-\d{2}-\d{2}$/.test(n) ? n : fechaCarpeta, esAdr);
            continue;
        }
        if (/^\d{3,}[-_].*\.md$/i.test(n)) { trocearEntrada(ruta, fechaCarpeta, esAdr); nEntradas++; }
        else if (/^decisiones\.md$/i.test(n)) trocearDecisiones(ruta, fechaCarpeta);
    }
}
recorrer(devlogDir, 0, null, false);
// Además, el diario y las decisiones PROPIOS del proyecto si los tiene (p. ej. un docs/devlog histórico o ADRs):
// sin esto, un proyecto con dos devlogs solo encontraría la mitad de su historia. --solo-devlog lo desactiva.
if (fs.existsSync(devlogDir)) fuentes.push((path.relative(process.cwd(), devlogDir) || 'devlog').replace(/\\/g, '/'));
if (!opts.soloDevlog) {
    for (const [rel, esAdr] of [['docs/devlog', false], ['docs/adr', true], ['docs/adrs', true], ['docs/decisions', true],
        ['docs/architecture/decisions', true], ['doc/adr', true], ['adr', true]]) {
        const d = path.resolve(process.cwd(), rel);
        if (d === devlogDir || !esDir(d)) continue;
        const antes = nEntradas;
        recorrer(d, 0, null, esAdr);
        if (nEntradas > antes) fuentes.push(rel);
    }
}
if (!fuentes.length) salir([], `No hay carpeta devlog en ${devlogDir} (ni docs/devlog ni ADRs): no hay historial que buscar.`, 2);
function safeDir(d) { try { return fs.readdirSync(d); } catch { return []; } }
function esDir(d) { try { return fs.statSync(d).isDirectory(); } catch { return false; } }

// ---------------------------------------------------------------- filtros
const enRango = f => {
    if (!f) return !(opts.desde || opts.hasta);
    if (opts.desde && f < opts.desde) return false;
    if (opts.hasta && f.slice(0, opts.hasta.length) > opts.hasta) return false;
    return true;
};
const tipoFiltro = opts.tipo ? raiz(normalizar(opts.tipo)) : null;
const candidatos = docs.filter(d => {
    if ((opts.desde || opts.hasta) && d.clase !== 'memoria' && !enRango(d.fecha)) return false;
    if (tipoFiltro) {
        const t = raiz(normalizar(d.clase === 'entrada' ? d.tipo : d.clase));
        if (!(t === tipoFiltro || raiz(normalizar(d.tipo)) === tipoFiltro)) return false;
    }
    return true;
});

// ---------------------------------------------------------------- índice
const PESO_TITULO = 3, PESO_SECCION = 1.5;
for (const d of candidatos) {
    const tf = new Map();
    const sumar = (txt, peso) => { for (const t of tokens(txt)) { if (VACIAS.has(t)) continue; const r = raiz(t); tf.set(r, (tf.get(r) || 0) + peso); tf.set('§' + t, (tf.get('§' + t) || 0) + peso); } };
    sumar(d.texto, 1); sumar(d.titulo, PESO_TITULO); sumar(d.seccion, PESO_SECCION);
    if (d.num) tf.set(d.num, (tf.get(d.num) || 0) + 2);
    d.tf = tf;
    d.largo = [...tf.entries()].filter(([k]) => !k.startsWith('§')).reduce((s, [, v]) => s + v, 0) || 1;
}
const N = candidatos.length || 1;
const largoMedio = candidatos.reduce((s, d) => s + d.largo, 0) / N || 1;
const df = new Map();
for (const d of candidatos) for (const k of d.tf.keys()) if (!k.startsWith('§')) df.set(k, (df.get(k) || 0) + 1);
const vocab = [...df.keys()];
const rawVocab = new Set(); for (const d of candidatos) for (const k of d.tf.keys()) if (k.startsWith('§')) rawVocab.add(k.slice(1));

// ---------------------------------------------------------------- consulta -> conceptos con variantes
const grupos = cargarSinonimos();
const palabras = tokens(consulta).filter(t => !VACIAS.has(t));
if (!palabras.length) salir([], 'La búsqueda solo tiene palabras vacías (que, por, cuando…): usa palabras con contenido, p. ej. "stripe webhook".', 2);
const conceptos = [...new Set(palabras)].map(p => {
    const r = raiz(p);
    const variantes = new Map([[r, 1]]);
    // raíz exacta o forma exacta
    // erratas de una letra (palabras de 5+ letras), sobre raíces y formas sin raíz
    if (p.length >= 5) {
        for (const v of vocab) if (v.length >= 4 && !variantes.has(v) && distanciaUno(r, v)) variantes.set(v, 0.8);
        for (const w of rawVocab) if (w.length >= 5 && distanciaUno(p, w)) { const rw = raiz(w); if (!variantes.has(rw)) variantes.set(rw, 0.8); }
    }
    // prefijo: "migr" -> migracion, migrar. Solo si lo escrito parece cortado (no tiene sufijo propio): "cola" es
    // palabra completa y NO debe traer "colaborador"
    if (p.length >= 4 && r === p) for (const v of vocab) if (v !== r && v.startsWith(p) && !variantes.has(v)) variantes.set(v, 0.6);
    // sinónimos (también de la variante corregida por errata)
    const base = [...variantes.keys()];
    for (const g of grupos) if (base.some(b => g.has(b))) for (const s of g) if (!variantes.has(s)) variantes.set(s, 0.55);
    return { palabra: p, variantes };
});

function idf(k) { const n = df.get(k) || 0; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); }
const K1 = 1.2, B = 0.75;
function bm25(d, k) { const f = d.tf.get(k) || 0; if (!f) return 0; return idf(k) * (f * (K1 + 1)) / (f + K1 * (1 - B + B * d.largo / largoMedio)); }

const consultaNorm = normalizar(consulta).replace(/\s+/g, ' ').trim();
for (const d of candidatos) {
    let total = 0, cubiertos = 0;
    d.aciertos = new Set();
    for (const c of conceptos) {
        let mejor = 0, mejorK = null, resto = 0;
        for (const [k, w] of c.variantes) {
            const s = w * bm25(d, k);
            if (!s) continue;
            d.aciertos.add(k);
            if (s > mejor) { resto += mejor; mejor = s; mejorK = k; } else resto += s;
        }
        if (mejor > 0) { total += mejor + 0.3 * resto; cubiertos++; }
    }
    if (!cubiertos) { d.puntos = 0; continue; }
    const cobertura = cubiertos / conceptos.length;
    let puntos = total * (0.35 + 0.65 * cobertura * cobertura);
    if (conceptos.length > 1 && normalizar(d.texto + ' ' + d.titulo).includes(consultaNorm)) puntos *= 1.3;   // frase exacta
    if (d.clase === 'memoria') puntos *= 1.5;
    else if (d.clase === 'decision') puntos *= 1.35;
    else if (d.clase === 'historico') puntos *= 0.9;
    if (d.sustituida) puntos *= 0.55;
    d.puntos = puntos;
    d.cobertura = cobertura;
}

// ---------------------------------------------------------------- agrupar por entrada y ordenar
const grupos2 = new Map();
for (const d of candidatos) {
    if (!d.puntos) continue;
    // Las secciones de una misma entrada (también su «Decisiones») cuentan como UN resultado
    const clave = d.deEntrada ? `e:${d.archivo}` : `${d.clase}:${d.archivo}:${d.texto.slice(0, 60)}`;
    const g = grupos2.get(clave);
    if (!g) grupos2.set(clave, { mejor: d, puntos: d.puntos, extra: 0 });
    else {
        if (d.puntos > g.mejor.puntos) { g.extra += g.mejor.puntos; g.mejor = d; } else g.extra += d.puntos;
        g.puntos = g.mejor.puntos + 0.25 * g.extra;
    }
}
const resultados = [...grupos2.values()]
    .sort((a, b) => (b.puntos - a.puntos) || String(b.mejor.fecha || '9999').localeCompare(String(a.mejor.fecha || '9999')) || String(b.mejor.num || '').localeCompare(String(a.mejor.num || '')))
    .slice(0, opts.max)
    .map(g => {
        const d = g.mejor;
        return { clase: d.clase, num: d.num, fecha: d.fecha, titulo: d.titulo || d.seccion, tipo: d.tipo, seccion: d.seccion,
            archivo: d.archivo.replace(/\\/g, '/'), sustituida: d.sustituida, puntos: Math.round(g.puntos * 100) / 100,
            fragmento: fragmento(d) };
    });

function fragmento(d) {
    const lineas = d.texto.split('\n').map(l => l.replace(/^[\s>*#-]+/, '').replace(/[`*_]/g, '').trim()).filter(Boolean);
    let mejor = lineas[0] || '', mejorN = -1;
    for (const l of lineas) {
        const ts = new Set(tokens(l).map(raiz));
        let n = 0; for (const k of d.aciertos) if (ts.has(k)) n++;
        if (n > mejorN) { mejorN = n; mejor = l; }
    }
    return mejor.length > 170 ? mejor.slice(0, 167) + '…' : mejor;
}

const vacio = !resultados.length
    ? `Sin resultados para "${consulta}" en ${nEntradas} entradas. Prueba con otra palabra o un sinónimo; si sigue sin aparecer, di que NO hay nada registrado (no lo supongas).`
    : null;
salir(resultados, vacio, 0);

function salir(res, aviso, code) {
    if (opts.json) { console.log(JSON.stringify({ consulta, entradas: nEntradas, fuentes, aviso, resultados: res }, null, 1)); process.exit(code); }
    if (aviso) { console.log(aviso); process.exit(code); }
    console.log(`${res.length} resultado(s) para "${consulta}" (${nEntradas} entradas en ${fuentes.join(' + ')}):\n`);
    res.forEach((r, i) => {
        const etiqueta = r.clase === 'memoria' ? 'MEMORIA' : r.clase === 'historico' ? 'MEMORIA (histórico)' : r.clase === 'decision' ? 'decisión' : (r.tipo || 'entrada');
        const cab = [r.num, r.fecha, r.titulo].filter(Boolean).join(' · ');
        console.log(`${i + 1}. ${cab || r.seccion} [${etiqueta}${r.sustituida ? ', SUSTITUIDA' : ''}]`);
        console.log(`   «${r.fragmento}»`);
        console.log(`   ${r.archivo}${r.seccion && r.clase === 'entrada' ? ' § ' + r.seccion : ''}`);
    });
    console.log('\nAbre solo la entrada que necesites (por la sección indicada) y cita su número al responder.');
    process.exit(code);
}
