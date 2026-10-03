#!/usr/bin/env node
// Suite del acumulador de tráfico (tools/trafico.mjs): GitHub da una ventana móvil de 14 días y aquí se
// comprueba que el histórico la fusiona bien: sin contar dos veces un día, sin perder los que salen de la
// ventana, con el día en curso creciendo, sin token y con los endpoints de shields.io. Sin red.
//   node tools/test-trafico.mjs

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { fusionar, badges, VACIO } = await import(pathToFileURL(path.join(ROOT, 'tools', 'trafico.mjs')).href);

let casos = 0, fallos = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };
// ventana de la API: n días hasta «hasta» (incluido), con cifras de la función f(día)
const ventana = (hasta, n, f) => Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.parse(hasta) - (n - 1 - i) * 864e5).toISOString().slice(0, 10);
    const [count, uniques] = f(d, i);
    return { timestamp: `${d}T00:00:00Z`, count, uniques };
});
const api = (hasta, n, f) => ({ clones: { clones: ventana(hasta, n, f) }, vistas: { views: ventana(hasta, n, (d, i) => f(d, i).map(x => x * 10)) } });
const repo = { stargazers_count: 12, forks_count: 3, subscribers_count: 2 };

// 1. primera pasada: 14 días de 2 clones (1 único)
let h = fusionar(VACIO, { repo: 'a/b', ahora: '2026-10-14T05:17:00Z', ...api('2026-10-14', 14, () => [2, 1]), repositorio: repo });
ok(h.totales.clones === 28 && h.totales.clonesUnicos === 14 && h.totales.dias === 14, 'primera pasada: 14 días sumados', JSON.stringify(h.totales));
ok(h.totales.visitas === 280, 'visitas acumuladas igual que los clones', String(h.totales.visitas));
ok(h.repositorio.estrellas === 12 && h.repositorio.forks === 3, 'estrellas y forks guardados', JSON.stringify(h.repositorio));
ok(h.totales.desde === '2026-10-01', 'fecha de inicio del histórico', h.totales.desde);

// 2. misma ventana otra vez (el workflow se lanza dos veces el mismo día): no se cuenta doble
const h2 = fusionar(h, { repo: 'a/b', ahora: '2026-10-14T09:00:00Z', ...api('2026-10-14', 14, () => [2, 1]), repositorio: repo });
ok(h2.totales.clones === 28, 'la misma ventana dos veces no cuenta doble', String(h2.totales.clones));

// 3. al día siguiente la ventana se mueve: el 1 de octubre sale de la API pero se conserva en el histórico
const h3 = fusionar(h2, { repo: 'a/b', ahora: '2026-10-15T05:17:00Z', ...api('2026-10-15', 14, () => [2, 1]), repositorio: repo });
ok(h3.dias['2026-10-01'] && h3.dias['2026-10-01'].clones === 2, 'un día que sale de la ventana de 14 se conserva', JSON.stringify(h3.dias['2026-10-01']));
ok(h3.totales.clones === 30 && h3.totales.dias === 15, 'el día nuevo se suma (15 días, 30 clones)', JSON.stringify(h3.totales));

// 4. el día en curso crece (por la mañana 1 clon, por la noche 5): se queda con el más alto, nunca resta
const manana = fusionar(h3, { repo: 'a/b', ...api('2026-10-16', 14, (d) => d === '2026-10-16' ? [1, 1] : [2, 1]) });
const noche = fusionar(manana, { repo: 'a/b', ...api('2026-10-16', 14, (d) => d === '2026-10-16' ? [5, 3] : [2, 1]) });
ok(noche.dias['2026-10-16'].clones === 5 && noche.dias['2026-10-16'].clonesUnicos === 3, 'el día en curso se actualiza al valor más alto', JSON.stringify(noche.dias['2026-10-16']));
const menos = fusionar(noche, { repo: 'a/b', ...api('2026-10-16', 14, (d) => d === '2026-10-16' ? [4, 2] : [2, 1]) });
ok(menos.dias['2026-10-16'].clones === 5, 'una lectura menor no resta', String(menos.dias['2026-10-16'].clones));

// 5. sin token: no hay tráfico, pero sí estrellas; el histórico anterior no se pierde
const sinToken = fusionar(noche, { repo: 'a/b', clones: null, vistas: null, repositorio: { ...repo, stargazers_count: 13 } });
ok(sinToken.totales.clones === noche.totales.clones && sinToken.repositorio.estrellas === 13, 'sin token: conserva el histórico y actualiza estrellas', JSON.stringify(sinToken.totales));
const nuevoSinToken = fusionar(VACIO, { repo: 'a/b', clones: null, vistas: null, repositorio: repo });
ok(nuevoSinToken.totales.traficoDisponible === false && nuevoSinToken.totales.clones === 0, 'sin token desde cero: tráfico no disponible');

// 6. badges de shields.io
const b = badges(h3), bVacio = badges(nuevoSinToken);
ok(b['badge-clones.json'].schemaVersion === 1 && b['badge-clones.json'].message === '30' && b['badge-clones.json'].label === 'clones', 'badge de clones con el total', JSON.stringify(b['badge-clones.json']));
ok(b['badge-clones-unicos.json'].message === '15', 'badge de clones únicos', JSON.stringify(b['badge-clones-unicos.json']));
ok(bVacio['badge-clones.json'].message === 'sin datos' && bVacio['badge-clones.json'].color === 'lightgrey', 'sin tráfico, el badge dice «sin datos» (no un 0 falso)', JSON.stringify(bVacio['badge-clones.json']));
const grande = badges(fusionar(VACIO, { repo: 'a/b', ...api('2026-10-14', 1, () => [12345, 900]) }));
ok(grande['badge-clones.json'].message === '12.3k', 'cifras grandes abreviadas (12.3k)', grande['badge-clones.json'].message);

// 7. días ordenados y sin mutar el histórico de entrada
const desordenado = fusionar({ ...VACIO, dias: { '2026-10-09': { clones: 1, clonesUnicos: 1, visitas: 0, visitasUnicas: 0 } } }, { repo: 'a/b', ...api('2026-10-02', 2, () => [1, 1]) });
ok(Object.keys(desordenado.dias).join() === '2026-10-01,2026-10-02,2026-10-09', 'los días quedan en orden', Object.keys(desordenado.dias).join());
ok(h.totales.clones === 28, 'fusionar no modifica el histórico que recibe');

console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
