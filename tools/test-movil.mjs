#!/usr/bin/env node
// Suite de las comprobaciones de MÓVIL de ui-verify (core/skills/ui-verify/scripts/movil.mjs) en un navegador real
// a 375 px. Páginas con fallos móviles puestos a propósito (deben detectarse) y páginas correctas (cero avisos),
// incluido el menú burger usado de verdad (pulsar, medir abierto, Escape) y la captura anotada.
// Necesita Playwright como test-geometria (SENZU_PLAYWRIGHT / SENZU_CHROMIUM); sin navegador, SKIP con 0.
//   node tools/test-movil.mjs

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mov = await import(pathToFileURL(path.join(ROOT, 'core', 'skills', 'ui-verify', 'scripts', 'movil.mjs')).href);
const { auditarGeometria } = await import(pathToFileURL(path.join(ROOT, 'core', 'skills', 'ui-verify', 'scripts', 'geometria.mjs')).href);

let pw = null;
for (const m of [process.env.SENZU_PLAYWRIGHT, 'playwright', 'playwright-core'].filter(Boolean)) {
    try { pw = await import(m.includes(path.sep) || m.includes('/') ? pathToFileURL(path.join(m, 'index.mjs')).href : m); break; } catch {}
}
if (!pw) { console.log('SKIP test-movil: no hay Playwright (npm i --no-save playwright && npx playwright install chromium)'); process.exit(0); }
const opciones = {};
if (process.env.SENZU_CHROMIUM) opciones.executablePath = process.env.SENZU_CHROMIUM;
let browser;
try { browser = await pw.chromium.launch(opciones); }
catch (e) { console.log('SKIP test-movil: no se pudo abrir Chromium: ' + String(e).split('\n')[0]); process.exit(0); }

let casos = 0, fallos = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };
const base = `<!doctype html><meta name=viewport content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui}
input,select,textarea{font-size:16px}h1{font-size:32px;margin:16px}p{margin:16px}</style>`;
// Menú burger accesible y correcto: botón 48×48 con aria, panel a pantalla completa, enlaces de 48 px, Escape cierra
const menuBueno = `<style>header{display:flex;justify-content:space-between;align-items:center;height:56px;padding:0 8px}
#menu{display:none;position:fixed;z-index:10;inset:56px 0 0 0;background:#fff;padding:16px}#menu.open{display:block}#menu a{display:block;height:48px;line-height:48px}
.burger{width:48px;height:48px}</style>
<header><strong>Marca</strong><button class=burger aria-label="Menú" aria-controls=menu aria-expanded=false>☰</button></header>
<nav id=menu aria-label=Principal><a href=#>Inicio</a><a href=#>Servicios</a><a href=#>Proyectos</a><a href=#>Equipo</a><a href=#>Contacto</a></nav>
<script>const b=document.querySelector('.burger'),m=document.getElementById('menu');
const pon=v=>{m.classList.toggle('open',v);b.setAttribute('aria-expanded',v)};
b.onclick=()=>pon(m.className!=='open');document.addEventListener('keydown',e=>{if(e.key==='Escape')pon(false)});</script>`;

async function pagina(html) {
    const page = await browser.newPage({ viewport: { width: 375, height: 720 } });
    await page.setContent(base + html);
    await page.waitForTimeout(50);
    return page;
}
async function auditar(html) { const p = await pagina(html); const r = await p.evaluate(mov.auditarMovil); await p.close(); return r; }
// El mismo flujo que verify-ui: buscar, pulsar, medir abierto, Escape, medir cerrado
async function usarMenu(html) {
    const page = await pagina(html);
    const menu = await page.evaluate(mov.buscarMenu);
    let abierto = { problemas: [] }, cerrado = { problemas: [] };
    if (menu.encontrado) {
        await page.click('[data-senzu-menu]');
        await page.waitForTimeout(100);
        abierto = await page.evaluate(mov.estadoMenu, true);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        cerrado = await page.evaluate(mov.estadoMenu, false);
    }
    await page.close();
    return { menu, abierto, cerrado, todos: [...menu.problemas, ...abierto.problemas, ...cerrado.problemas] };
}
const tipos = r => r.map(x => x.tipo).join(', ') || '(nada)';
const hay = (r, t) => r.some(x => x.tipo === t);

// ---------------------------------------------------------------- páginas correctas: cero avisos
{
    const html = menuBueno + `<main><h1>Título razonable</h1><p>Texto de párrafo con longitud suficiente para leerse bien en un móvil sin problemas.</p>
        <form><label>Email <input type=email></label></form>
        <style>.card .extra{opacity:0}@media (hover:hover){.card:hover .extra{opacity:1}}</style><div class=card>Tarjeta<span class=extra>más</span></div>
        <style>.card2 .extra{opacity:0}.card2:hover .extra,.card2:focus-within .extra{opacity:1}</style><div class=card2>Otra<span class=extra>más</span></div>
        <style>@keyframes sube{to{transform:translateY(-4px)}}.anim{animation:sube 1s infinite alternate}@media (prefers-reduced-motion:reduce){.anim{animation:none}}</style><div class=anim>Animado</div></main>`;
    const r = await auditar(html);
    ok(r.length === 0, 'página móvil correcta (hover limitado o con :focus-within, input 16 px, movimiento reducido): sin avisos', tipos(r));
    const m = await usarMenu(html);
    ok(m.menu.encontrado, 'encuentra el botón burger');
    ok(m.todos.length === 0, 'menú burger correcto: abre, enlaces de 48 px dentro de pantalla, Escape cierra: sin avisos', m.todos.join(' | '));
    ok(m.abierto.enlaces === 5, 'cuenta los 5 enlaces del menú abierto', String(m.abierto.enlaces));
}
{
    const r = await auditar(`<header style="position:sticky;top:0;height:56px;background:#fff">Cabecera</header><h1>Hola</h1><nav aria-label=Pie><a href=#>Uno</a> <a href=#>Dos</a> <a href=#>Tres</a></nav>`);
    ok(r.length === 0, 'cabecera pegajosa de 56 px y nav corta que cabe: sin avisos', tipos(r));
}
{
    const p = await pagina(`<h1>Hola</h1><p>Un párrafo de ejemplo con suficiente texto como para contar los caracteres por línea.</p><a href=# style="display:inline-block;padding:14px 20px;background:#111;color:#fff;margin:16px">Pedir presupuesto</a>`);
    const res = await p.evaluate(mov.resumenMovil); await p.close();
    ok(/h1 32 px/.test(res[0]) && /párrafo 16 px/.test(res[0]), 'resumen de tamaños: h1 y párrafo en px', res.join(' | '));
    ok(res.some(l => /primer CTA «Pedir presupuesto».*visible sin hacer scroll/.test(l)), 'resumen: primer CTA medido y visible sin scroll', res.join(' | '));
}

// ---------------------------------------------------------------- fallos móviles: se detectan
{
    const r = await auditar(`<style>.card .info{opacity:0}.card:hover .info{opacity:1}</style><div class=card>Proyecto<div class=info>Detalles que solo salen con el ratón</div></div>`);
    ok(hay(r, 'solo-hover'), 'contenido que solo aparece con :hover (sin focus ni media hover): detectado', tipos(r));
    ok(r.find(x => x.tipo === 'solo-hover')?.marca, 'y marca el elemento para la captura anotada');
}
{
    const r = await auditar(`<style>.menu ul{display:none}.menu:hover ul{display:block}</style><nav class=menu><a href=#>Servicios</a><ul><li><a href=#>Web</a></li></ul></nav>`);
    ok(hay(r, 'solo-hover'), 'submenú desplegable solo con hover (display:none → block): detectado', tipos(r));
}
{
    const r = await auditar(`<form><label>Buscar <input type=search style="font-size:14px"></label></form>`);
    ok(hay(r, 'input-zoom') && /14 px/.test(r.find(x => x.tipo === 'input-zoom').mensaje), 'input de 14 px (zoom en iPhone): detectado con su tamaño', tipos(r));
}
{
    const r = await auditar(`<div style="position:fixed;bottom:0;left:0;right:0;height:240px;background:#eee">Aceptas las cookies…</div><h1>Hola</h1>`);
    ok(hay(r, 'fijo-tapa'), 'banner fijo de 240 px (33 % de la pantalla): detectado', tipos(r));
}
{
    const r = await auditar(`<section style="height:400px;background:url(data:image/gif;base64,R0lGODlhAQABAAAAACw=) center/cover fixed">Parallax</section>`);
    ok(hay(r, 'fondo-fijo'), 'background-attachment: fixed (parallax que en iPhone no va): detectado', tipos(r));
}
{
    const r = await auditar(`<style>@keyframes g{to{transform:rotate(360deg)}}.logo{width:40px;height:40px;animation:g 3s linear infinite}</style><div class=logo></div>`);
    ok(hay(r, 'sin-movimiento-reducido'), 'animación sin @media (prefers-reduced-motion): detectado', tipos(r));
}
{
    const r = await auditar(`<style>html{cursor:none}.cursor{position:fixed;top:0;left:0;width:24px;height:24px;border-radius:50%;background:#000;pointer-events:none}</style><div class=cursor></div><h1>Hola</h1>`);
    ok(hay(r, 'efecto-raton'), 'cursor personalizado visible en móvil: detectado', tipos(r));
}
{
    const r = await auditar(`<h1 style="font-size:96px;line-height:1">Diseñamos experiencias digitales memorables</h1>`);
    ok(hay(r, 'titulo-enorme'), 'h1 de 96 px que ocupa más de media pantalla: detectado', tipos(r));
}
{
    const r = await auditar(`<header><nav aria-label=Principal style="display:flex;gap:24px;white-space:nowrap"><a href=#>Inicio</a><a href=#>Servicios</a><a href=#>Proyectos</a><a href=#>Equipo</a><a href=#>Blog</a><a href=#>Contacto</a></nav></header>`);
    ok(hay(r, 'nav-no-cabe'), 'navegación de escritorio con 6 enlaces que se sale a 375 px: detectado (pide burger)', tipos(r));
}
{
    const r = await auditar(`<style>@media (max-width:600px){header nav{display:none}}</style><header><nav aria-label=Principal><a href=#>Inicio</a><a href=#>Servicios</a><a href=#>Contacto</a></nav></header>`);
    ok(hay(r, 'nav-desaparece'), 'nav oculta en móvil sin ningún botón para abrirla: detectado', tipos(r));
}
{   // menú con fallos: botón pequeño sin nombre ni aria-expanded, enlaces bajos, Escape no cierra
    const m = await usarMenu(`<style>header{display:flex;justify-content:space-between;height:48px}#m{display:none}#m.open{display:block;position:fixed;top:48px;left:0;right:0;background:#fff}#m a{display:block;height:28px}.menu-toggle{width:32px;height:32px;padding:0}</style>
        <header>Marca<button class=menu-toggle></button></header><nav id=m><a href=#>Inicio</a><a href=#>Servicios</a><a href=#>Contacto</a></nav>
        <script>document.querySelector('.menu-toggle').onclick=()=>document.getElementById('m').classList.toggle('open')</script>`);
    const t = m.todos.join(' | ');
    ok(m.menu.encontrado, 'menú defectuoso: encuentra el botón por su clase');
    ok(/32×32/.test(t), 'botón del menú de 32×32: detectado (mínimo 44)', t);
    ok(/nombre accesible/.test(t), 'botón sin aria-label ni texto: detectado', t);
    ok(/aria-expanded/.test(t), 'botón sin aria-expanded: detectado', t);
    ok(/menos de 44 px de alto/.test(t), 'enlaces del menú abierto de 28 px: detectado', t);
}
{   // menú sin z-index: un bloque con transform (que pinta encima) tapa parte del menú abierto
    const m = await usarMenu(menuBueno.replace('z-index:10;', '') + '<main><div style="transform:translateZ(0);height:400px;margin-top:150px;background:#eee">Contenido</div></main>');
    ok(m.todos.some(p => /TAPADOS/.test(p)), 'enlaces del menú abierto tapados por contenido de la página (falta z-index): detectado', m.todos.join(' | '));
}
{   // botón que no abre nada
    const m = await usarMenu(`<header style="height:56px"><button aria-label="Menú" aria-controls=m aria-expanded=false style="width:48px;height:48px">☰</button></header><nav id=m style="display:none"><a href=#>Inicio</a><a href=#>Contacto</a></nav>`);
    ok(m.todos.some(p => /no aparece ningún enlace/.test(p)), 'botón de menú que no abre el menú: detectado', m.todos.join(' | '));
}
{   // menú abierto con Escape que no cierra
    const m = await usarMenu(menuBueno.replace("document.addEventListener('keydown',e=>{if(e.key==='Escape')pon(false)});", ''));
    ok(m.todos.some(p => /Escape/.test(p)), 'menú que no se cierra con Escape: detectado', m.todos.join(' | '));
}
{   // kebab para la navegación principal
    const m = await usarMenu(menuBueno.replace('aria-label="Menú"', 'aria-label="Más opciones"').replace('☰', '⋮'));
    ok(m.todos.some(p => /kebab/.test(p)), 'navegación principal con icono kebab (⋮): detectado (va con burger)', m.todos.join(' | '));
}

// ---------------------------------------------------------------- captura anotada: geometría y móvil numerados juntos
{
    const page = await pagina(`<style>.c .i{opacity:0}.c:hover .i{opacity:1}</style><div class=c>Tarjeta<span class=i>x</span></div>
        <div style="display:grid;place-items:center;height:200px"><div class=loader style="width:60px;height:60px;background:#333;margin-top:8px"></div></div>`);
    const g = await page.evaluate(auditarGeometria, { tolerancia: 1 });
    const m = await page.evaluate(mov.auditarMovil);
    const n = await page.evaluate(mov.marcarAvisos);
    const etiquetas = await page.evaluate(() => [...document.querySelectorAll('#senzu-anotaciones > div > div')].map(e => e.textContent));
    await page.close();
    ok(g[0]?.marca === 'g1', 'el aviso de geometría lleva su número (g1)', JSON.stringify(g.map(x => x.marca)));
    ok(m.some(x => x.marca && x.marca.startsWith('m')), 'el aviso móvil lleva su número (m…)', JSON.stringify(m.map(x => x.marca)));
    ok(n === 2 && etiquetas.includes('g1') && etiquetas.some(e => e.startsWith('m')), 'la capa de anotaciones dibuja los dos recuadros con su número', `${n} ${etiquetas}`);
}

await browser.close();
console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
