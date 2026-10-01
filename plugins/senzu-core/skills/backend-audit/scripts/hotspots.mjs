#!/usr/bin/env node
// Hotspots: archivos que cambian MUCHO (historial de git) y son GRANDES. Ahí se concentra el riesgo:
// código complejo que se toca a menudo es donde nacen los bugs. Primera evidencia de /auditar.
//   node hotspots.mjs [--months 6] [--top 20] [--path app]
// Ejecutar desde la raíz del repositorio. Solo lectura: no modifica nada.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const months = parseInt(opt('--months', '6'), 10);
const top = parseInt(opt('--top', '20'), 10);
const onlyPath = opt('--path', '').replace(/\\/g, '/');

const CODE = /\.(php|ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|py|go|java|kt|cs|rb)$/i;
const SKIP = /(^|\/)(vendor|node_modules|dist|build|\.next|\.nuxt|storage|public\/build|__pycache__|\.venv|bin|obj)\//i;

let log;
try {
    log = execFileSync('git', ['log', `--since=${months} months ago`, '--name-only', '--pretty=format:'],
        { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
    console.error('No se pudo leer el historial de git: ejecuta el script desde la raíz de un repositorio.');
    process.exit(1);
}

const commits = new Map();
for (const raw of log.split(/\r?\n/)) {
    const f = raw.trim();
    if (!f || !CODE.test(f) || SKIP.test(f)) continue;
    if (onlyPath && !f.startsWith(onlyPath)) continue;
    commits.set(f, (commits.get(f) || 0) + 1);
}

const rows = [];
for (const [file, n] of commits) {
    if (!fs.existsSync(file)) continue;                // borrado o renombrado desde entonces
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
    rows.push({ file, commits: n, lines, score: n * lines });
}
if (!rows.length) {
    console.log(`Sin cambios en archivos de código en los últimos ${months} meses${onlyPath ? ` bajo ${onlyPath}` : ''}.`);
    process.exit(0);
}
rows.sort((a, b) => b.score - a.score);
const max = rows[0].score;

console.log(`# Hotspots (últimos ${months} meses${onlyPath ? `, ${onlyPath}` : ''})\n`);
console.log('Riesgo = nº de commits × líneas, relativo al primero (100). Revisa los primeros antes que nada.\n');
console.log('| # | Archivo | Commits | Líneas | Riesgo |');
console.log('|---|---|---|---|---|');
rows.slice(0, top).forEach((r, i) => {
    console.log(`| ${i + 1} | \`${r.file}\` | ${r.commits} | ${r.lines} | ${Math.round(r.score / max * 100)} |`);
});
console.log(`\nArchivos de código con cambios: ${rows.length}. El 20% superior concentra el ${
    Math.round(rows.slice(0, Math.ceil(rows.length * 0.2)).reduce((s, r) => s + r.score, 0) /
        rows.reduce((s, r) => s + r.score, 0) * 100)}% del riesgo.`);
