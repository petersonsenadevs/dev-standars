#!/usr/bin/env node
// Suite de las demos de «Física e impacto» (front-activation/references/recipes/demos/) en Chromium real:
//   - intro-rotura: cae, se agrieta, se rompe y DESAPARECE antes de su tope; una vez por sesión; Escape la
//     salta; «reducir movimiento» no la muestra; el modo loader espera a la carga; sin destello de contenido.
//   - objeto-cae: el objeto acaba apoyado (0-2 px), recto y dentro del bloque destino (y del de móvil a 375),
//     sin tapar ningún CTA, y quieto; «reducir movimiento» = ya apoyado sin cargar el motor.
//   - pagina-desmorona: todo cae dentro de la pantalla y Escape lo devuelve exactamente a su sitio.
// Las dos últimas cargan matter-js desde jsdelivr: sin red, esos casos se saltan (SKIP) sin fallar.
// Necesita Playwright como test-geometria (SENZU_PLAYWRIGHT / SENZU_CHROMIUM); sin navegador, SKIP con 0.
//   node tools/test-fisica.mjs

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMOS = path.join(ROOT, 'core', 'skills-plugin', 'front-activation', 'references', 'recipes', 'demos');
const url = (f, q = '') => pathToFileURL(path.join(DEMOS, f)).href + q;

let pw = null;
for (const m of [process.env.SENZU_PLAYWRIGHT, 'playwright', 'playwright-core'].filter(Boolean)) {
    try { pw = await import(m.includes(path.sep) || m.includes('/') ? pathToFileURL(path.join(m, 'index.mjs')).href : m); break; } catch {}
}
if (!pw) { console.log('SKIP test-fisica: no hay Playwright (npm i --no-save playwright && npx playwright install chromium)'); process.exit(0); }
const opciones = {};
if (process.env.SENZU_CHROMIUM) opciones.executablePath = process.env.SENZU_CHROMIUM;
let browser;
try { browser = await pw.chromium.launch(opciones); }
catch (e) { console.log('SKIP test-fisica: no se pudo abrir Chromium: ' + String(e).split('\n')[0]); process.exit(0); }

let casos = 0, fallos = 0, saltados = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };
async function pagina(ancho, alto, extra = {}) {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, ...extra });
    const page = await ctx.newPage();
    page.errores = [];
    page.on('pageerror', e => page.errores.push(String(e).slice(0, 160)));
    return { page, cerrar: () => ctx.close() };
}

// ---------------------------------------------------------------- intro con caída y pantalla rota
for (const [w, h] of [[1440, 900], [375, 720]]) {
    const { page, cerrar } = await pagina(w, h);
    await page.goto(url('intro-rotura.html', '?intro=1'), { waitUntil: 'domcontentloaded' });
    const tapada = await page.evaluate(() => document.documentElement.classList.contains('intro-activa') || !!document.querySelector('.intro'));
    ok(tapada, `intro ${w}: la página está tapada desde el primer momento (sin destello de contenido)`);
    const t0 = Date.now(), fases = new Set();
    while (Date.now() - t0 < 3500) {
        const e = await page.evaluate(() => ({ ...window.senzuIntro }));
        fases.add(e.fase); if (e.fin) break;
        await page.waitForTimeout(40);
    }
    const ms = Date.now() - t0;
    const fin = await page.evaluate(() => ({ ...window.senzuIntro, capa: !!document.querySelector('.intro'), clases: document.documentElement.className }));
    ok(['caida', 'grietas', 'rotura'].every(f => fases.has(f)), `intro ${w}: pasa por caída, grietas y rotura`, [...fases].join(','));
    ok(fin.fin && ms <= 3200, `intro ${w}: termina antes de su tope`, `${ms} ms`);
    ok(!fin.capa && !/intro-/.test(fin.clases), `intro ${w}: al acabar quita su capa y devuelve el scroll`, `${fin.capa} "${fin.clases}"`);
    ok(fin.fragmentos >= (w < 500 ? 40 : 80), `intro ${w}: rompe el cristal en trozos (${fin.fragmentos})`);
    ok(!page.errores.length, `intro ${w}: sin errores`, page.errores.join(' | '));
    // segunda visita en la misma sesión: no se repite
    await page.goto(url('intro-rotura.html'), { waitUntil: 'domcontentloaded' });
    const otra = await page.evaluate(() => ({ fase: window.senzuIntro && window.senzuIntro.fase, capa: !!document.querySelector('.intro'), velo: document.documentElement.classList.contains('intro-activa') }));
    ok(otra.fase === 'omitida' && !otra.capa && !otra.velo, `intro ${w}: la segunda visita de la sesión no la repite`, JSON.stringify(otra));
    await cerrar();
}
{
    const { page, cerrar } = await pagina(1440, 900);
    await page.goto(url('intro-rotura.html', '?intro=1'));
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    const e = await page.evaluate(() => ({ fin: window.senzuIntro.fin, capa: !!document.querySelector('.intro') }));
    ok(e.fin && !e.capa, 'intro: Escape la salta al momento', JSON.stringify(e));
    await cerrar();
}
{
    const { page, cerrar } = await pagina(1440, 900, { reducedMotion: 'reduce' });
    await page.goto(url('intro-rotura.html'));
    const e = await page.evaluate(() => ({ fase: window.senzuIntro.fase, capa: !!document.querySelector('.intro') }));
    ok(e.fase === 'omitida' && !e.capa, 'intro: con «reducir movimiento» no existe', JSON.stringify(e));
    await cerrar();
}
{   // loader: no se rompe antes de 600 ms aunque cargue al instante, y termina
    const { page, cerrar } = await pagina(1440, 900);
    await page.goto(url('intro-rotura.html', '?intro=1&modo=loader'));
    await page.waitForTimeout(900);
    const pronto = await page.evaluate(() => window.senzuIntro.fase);
    await page.waitForFunction(() => window.senzuIntro.fin, null, { timeout: 6000 }).catch(() => {});
    const fin = await page.evaluate(() => window.senzuIntro.fin);
    ok(['grietas', 'rotura'].includes(pronto) && fin, 'loader: se agrieta, espera a la carga y termina', `${pronto} ${fin}`);
    await cerrar();
}

// ---------------------------------------------------------------- objeto que cae (matter-js desde CDN)
async function conMotor(page) { return page.waitForFunction(() => !!window.Matter, null, { timeout: 8000 }).then(() => true, () => false); }
for (const [w, h, sel] of [[1440, 900, '[data-fisica-destino]'], [375, 720, '[data-fisica-destino-movil]']]) {
    const { page, cerrar } = await pagina(w, h);
    await page.goto(url('objeto-cae.html'));
    await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
    if (!(await conMotor(page))) { saltados++; console.log(`SKIP objeto ${w}: no se pudo cargar matter-js (¿sin red?)`); await cerrar(); continue; }
    await page.waitForFunction(() => window.senzuFisica.reposo, null, { timeout: 10000 }).catch(() => {});
    const m = await page.evaluate(s => {
        const o = document.querySelector('[data-fisica="objeto"] path').getBoundingClientRect(), d = document.querySelector(s).getBoundingClientRect();
        const tr = document.querySelector('[data-fisica="objeto"]').style.transform;
        const pisa = [...document.querySelectorAll('.cta')].some(c => { const r = c.getBoundingClientRect(); return o.left < r.right && r.left < o.right && o.top < r.bottom && r.top < o.bottom; });
        return { reposo: window.senzuFisica.reposo, hueco: d.top - o.bottom, dentro: o.left >= d.left - 1 && o.right <= d.right + 1, angulo: parseFloat((tr.split('rotate(')[1] || '0')), pisa, tr };
    }, sel);
    ok(m.reposo, `objeto ${w}: acaba en reposo (motor parado)`);
    ok(Math.abs(m.hueco) <= 2, `objeto ${w}: apoyado sobre el bloque destino (0-2 px)`, `${m.hueco.toFixed(1)} px`);
    ok(m.dentro, `objeto ${w}: dentro del ancho del bloque destino`);
    ok(Math.abs(m.angulo) < 0.05, `objeto ${w}: acaba recto (enderezado)`, `${m.angulo} rad`);
    ok(!m.pisa, `objeto ${w}: no tapa ningún CTA`);
    await page.waitForTimeout(400);
    const quieto = await page.evaluate(t => document.querySelector('[data-fisica="objeto"]').style.transform === t, m.tr);
    ok(quieto, `objeto ${w}: quieto de verdad (no sigue moviéndose)`);
    ok(!page.errores.length, `objeto ${w}: sin errores`, page.errores.join(' | '));
    await cerrar();
}
{
    const { page, cerrar } = await pagina(1440, 900, { reducedMotion: 'reduce' });
    await page.goto(url('objeto-cae.html'));
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => ({ reposo: window.senzuFisica.reposo, motor: !!window.Matter,
        hueco: document.querySelector('[data-fisica-destino]').getBoundingClientRect().top - document.querySelector('[data-fisica="objeto"] path').getBoundingClientRect().bottom }));
    ok(m.reposo && !m.motor && Math.abs(m.hueco) <= 2, 'objeto: con «reducir movimiento» aparece ya apoyado y sin cargar el motor', JSON.stringify(m));
    await cerrar();
}

// ---------------------------------------------------------------- la página se desmorona
for (const [w, h] of [[1440, 900], [375, 720]]) {
    const { page, cerrar } = await pagina(w, h);
    await page.goto(url('pagina-desmorona.html'));
    const antes = await page.evaluate(() => [...document.querySelectorAll('[data-fisica="cae"]')].map(e => Math.round(e.getBoundingClientRect().top)));
    await page.click('.gravedad');
    if (!(await conMotor(page))) { saltados++; console.log(`SKIP desmorona ${w}: no se pudo cargar matter-js`); await cerrar(); continue; }
    await page.waitForTimeout(2500);
    const caido = await page.evaluate(() => [...document.querySelectorAll('[data-fisica="cae"]')].map(e => { const r = e.getBoundingClientRect(); return { top: r.top, centro: r.top + r.height / 2 }; }));
    ok(caido.every((c, i) => c.top > antes[i] + 20), `desmorona ${w}: todo cae`, caido.map(c => Math.round(c.top)).join(','));
    ok(caido.every(c => c.centro <= h + 2), `desmorona ${w}: se apila dentro de la pantalla`, caido.map(c => Math.round(c.centro)).join(','));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1300);
    const despues = await page.evaluate(() => [...document.querySelectorAll('[data-fisica="cae"]')].map(e => Math.round(e.getBoundingClientRect().top)));
    ok(despues.every((t, i) => Math.abs(t - antes[i]) <= 1), `desmorona ${w}: Escape lo devuelve todo a su sitio`, `${antes} -> ${despues}`);
    ok(!page.errores.length, `desmorona ${w}: sin errores`, page.errores.join(' | '));
    await cerrar();
}
{
    const { page, cerrar } = await pagina(1440, 900, { reducedMotion: 'reduce' });
    await page.goto(url('pagina-desmorona.html'));
    ok(await page.evaluate(() => document.querySelector('.gravedad').hidden), 'desmorona: con «reducir movimiento» no hay botón de gravedad');
    await cerrar();
}

await browser.close();
console.log(`Casos: ${casos}  Fallos: ${fallos}${saltados ? `  Saltados (sin red): ${saltados}` : ''}`);
process.exit(fallos ? 1 : 0);
