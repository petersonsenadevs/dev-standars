#!/usr/bin/env node
// Suite de la auditoría geométrica de ui-verify (core/skills/ui-verify/scripts/geometria.mjs) en un navegador real.
// Páginas con fallos de alineación puestos a propósito (deben detectarse con su medida en px) y páginas correctas
// (no deben dar avisos). Necesita Playwright: 'playwright' instalado, o SENZU_PLAYWRIGHT=<ruta a playwright-core>
// y, si hace falta, SENZU_CHROMIUM=<ruta al ejecutable>. Sin navegador disponible, avisa y sale con 0 (SKIP).
//   node tools/test-geometria.mjs

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { auditarGeometria } = await import(pathToFileURL(path.join(ROOT, 'core', 'skills', 'ui-verify', 'scripts', 'geometria.mjs')).href);

let pw = null;
for (const m of [process.env.SENZU_PLAYWRIGHT, 'playwright', 'playwright-core'].filter(Boolean)) {
    try { pw = await import(m.includes(path.sep) || m.includes('/') ? pathToFileURL(path.join(m, 'index.mjs')).href : m); break; } catch {}
}
if (!pw) { console.log('SKIP test-geometria: no hay Playwright (npm i --no-save playwright && npx playwright install chromium)'); process.exit(0); }
const opciones = {};
if (process.env.SENZU_CHROMIUM) opciones.executablePath = process.env.SENZU_CHROMIUM;
let browser;
try { browser = await pw.chromium.launch(opciones); }
catch (e) { console.log('SKIP test-geometria: no se pudo abrir Chromium: ' + String(e).split('\n')[0]); process.exit(0); }

let casos = 0, fallos = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };
const base = `<!doctype html><meta name=viewport content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;font:16px/1.4 system-ui}
@keyframes giro{to{transform:rotate(360deg)}}
.spinner{width:40px;height:40px;border:4px solid #ddd;border-top-color:#333;border-radius:50%;animation:giro 1s linear infinite}
.barra{width:200px;height:6px;background:#eee;border-radius:3px}.barra>i{display:block;width:40%;height:100%;background:#333}
.overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#fff}</style>`;
async function medir(html, ancho = 1024) {
    const page = await browser.newPage({ viewport: { width: ancho, height: 768 } });
    await page.setContent(base + html);
    const r = await page.evaluate(auditarGeometria, { tolerancia: 1 });
    await page.close();
    return r;
}
const hay = (r, tipo, min, maxPx) => r.some(x => x.tipo === tipo && x.px >= min && x.px <= maxPx);
const resumen = r => r.map(x => `${x.tipo}:${x.px}`).join(', ') || '(nada)';

// ---------------------------------------------------------------- páginas correctas: cero avisos
{
    const r = await medir(`<div class=overlay><div class=bloque style="display:flex;flex-direction:column;align-items:center;gap:16px">
        <div class=spinner role=status></div><div class=barra role=progressbar aria-valuenow=40><i></i></div></div></div>`);
    ok(r.length === 0, 'loader + barra bien centrados en una capa a pantalla completa: sin avisos', resumen(r));
}
{
    const r = await medir(`<header style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px">
        <strong>Marca</strong><nav style="display:flex;gap:16px"><a href=#>Uno</a><a href=#>Dos</a><a href=#>Tres</a></nav></header>
        <main style="max-width:960px;margin:0 auto;padding:24px"><h1 style="text-align:center">Título</h1>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px"><div style="padding:16px;border:1px solid #ddd">A</div><div style="padding:16px;border:1px solid #ddd">B</div><div style="padding:16px;border:1px solid #ddd">C</div></div>
        <p style="display:flex;align-items:center;gap:8px"><svg width=20 height=20 viewBox="0 0 20 20"><circle cx=10 cy=10 r=8 /></svg><span>Con icono</span></p>
        <button style="display:block;margin:24px auto;padding:12px 24px">Centrado</button></main>`);
    ok(r.length === 0, 'página típica correcta (cabecera, rejilla, icono + texto, botón centrado): sin avisos', resumen(r));
}
{
    const r = await medir(`<div style="display:flex;justify-content:center;align-items:center;height:300px"><div class=spinner></div></div>`, 375);
    ok(r.length === 0, 'spinner centrado en móvil (375): sin avisos', resumen(r));
}

// ---------------------------------------------------------------- páginas con fallos: se detectan con su medida
{
    const r = await medir(`<div class=overlay><div class=spinner style="margin-left:6px"></div></div>`);
    ok(hay(r, 'loader-descentrado', 2.5, 6.5), 'spinner con margin-left: 6px en una capa centrada: detectado (≈3 px)', resumen(r));
    ok(r.some(x => /margin-left: 6px/.test(x.mensaje)), 'y señala la causa (margin-left: 6px)', r.map(x => x.mensaje).join(' | ').slice(0, 200));
}
{
    const r = await medir(`<div class=overlay><div style="display:flex;flex-direction:column;gap:16px;align-items:flex-start">
        <div class=spinner style="margin-left:60px"></div><div class=barra role=progressbar><i></i></div></div></div>`);
    ok(hay(r, 'loaders-desalineados', 1, 100), 'loader y barra apilados que no comparten eje: detectado', resumen(r));
}
{
    const r = await medir(`<div class=overlay><div class=spinner style="transform-origin:30% 50%"></div></div>`);
    ok(hay(r, 'spinner-baila', 1.5, 40), 'spinner con transform-origin descentrado (se desplaza al girar): detectado', resumen(r));
}
{
    const r = await medir(`<button style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;padding:0">
        <svg class=icono width=24 height=24 viewBox="0 0 24 24"><circle cx=15 cy=12 r=6 /></svg></button>`);
    ok(hay(r, 'svg-descentrado', 2.5, 3.5), 'dibujo del SVG desplazado 3 px dentro de su viewBox: detectado (3 px)', resumen(r));
}
{
    const r = await medir(`<p style="display:flex;align-items:center;gap:8px"><svg width=20 height=20 viewBox="0 0 20 20" style="position:relative;top:2px"><circle cx=10 cy=10 r=8 /></svg><span>Texto</span><span>Más</span></p>`);
    ok(hay(r, 'casi-alineado', 1.5, 2.5) || hay(r, 'descentrado', 1.5, 2.5), 'icono con position:relative; top:2px en una fila centrada: detectado (2 px)', resumen(r));
}
{
    const r = await medir(`<div style="position:relative;height:200px"><div class=loader style="position:absolute;left:50%;top:40px;transform:translateX(-40%);width:100px;height:20px;background:#333"></div></div>`);
    ok(hay(r, 'loader-descentrado', 9, 11), 'left:50% con translateX(-40%) en vez de -50%: detectado (10 px)', resumen(r));
}
{
    const r = await medir(`<div style="display:grid;place-items:center;height:200px"><div class=loader style="width:60px;height:60px;background:#333;margin-top:8px"></div></div>`);
    ok(hay(r, 'loader-descentrado', 3.5, 4.5), 'grid place-items:center con margin-top:8px: detectado (4 px en vertical)', resumen(r));
}
{   // EL CASO REAL: loader + barra en una capa (columna centrada); el loader con margin-left: 8px
    const r = await medir(`<div class=overlay style="flex-direction:column;gap:16px"><div class=spinner role=status style="margin-left:8px"></div><div class=barra role=progressbar><i></i></div></div>`, 375);
    ok(r.length === 1, 'caso real (loader + barra, loader desplazado): UN solo aviso, no tres', resumen(r));
    ok(r[0] && /spinner/.test(r[0].mensaje) && /margin-left: 8px/.test(r[0].mensaje) && r[0].px >= 3.5 && r[0].px <= 4.5, 'culpa al loader, con la causa y la medida (4 px)', r[0] && r[0].mensaje);
    ok(!r.some(x => /barra/.test(x.mensaje) && /centro vertical de la pantalla/.test(x.mensaje)), 'no acusa a la barra de estar descentrada en la pantalla (lo centrado es el grupo)', resumen(r));
}
{   // desplazamiento intencionado marcado: no se avisa
    const r = await medir(`<div class=overlay><div class=spinner style="margin-left:6px" data-geometria="ignorar"></div></div>`);
    ok(r.length === 0, 'data-geometria="ignorar" (ajuste intencionado): sin aviso', resumen(r));
}
{   // el mismo fallo repetido se agrupa
    const icono = `<button style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;padding:0"><svg class=icono width=24 height=24 viewBox="0 0 24 24"><circle cx=15 cy=12 r=6 /></svg></button>`;
    const r = await medir(icono.repeat(12));
    ok(r.filter(x => x.tipo === 'svg-descentrado').length === 1 && /×12/.test(r[0].mensaje), 'el mismo icono descentrado 12 veces: un solo aviso con ×12', resumen(r) + ' ' + (r[0] && r[0].mensaje.slice(-12)));
}
{   // un dibujo que se sale de su caja a propósito (flecha animada al pasar el ratón): no es un hueco en el viewBox
    const r = await medir(`<a href=#>Ver más <svg width=10 height=16 viewBox="0 0 5 8"><path d="M-10 4h14M1 1l3 3-3 3" stroke=black fill=none /></svg></a>`);
    ok(!r.some(x => x.tipo === 'svg-descentrado'), 'SVG cuyo dibujo se sale de su caja a propósito: sin aviso', resumen(r));
}
{   // animación de entrada: se mide en su posición final, no en la inicial
    const r = await medir(`<style>@keyframes entra{from{transform:translateY(20px)}to{transform:none}}</style><div class=overlay><div class=loader style="width:60px;height:60px;background:#333;animation:entra 2s"></div></div>`);
    ok(r.length === 0, 'animación de entrada en curso: se mide en reposo (sin aviso falso)', resumen(r));
}
{   // tolerancia: 0,5 px no es un fallo
    const r = await medir(`<div class=overlay><div class=spinner style="margin-left:1px"></div></div>`);
    ok(r.length === 0, 'desplazamiento de 0,5 px (subpíxel): dentro de la tolerancia', resumen(r));
}

await browser.close();
console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
