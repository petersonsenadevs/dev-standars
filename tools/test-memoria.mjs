#!/usr/bin/env node
// Suite del buscador del devlog (core/skills/devlog/scripts/buscar.mjs) y de los hooks de memoria.
// Crea un devlog de prueba con trampas (acentos, erratas, plurales, sinónimos, falsos positivos, decisiones
// sustituidas, CRLF, BOM, caracteres raros) y comprueba el ranking. Sale con 1 si algo falla.
//   node tools/test-memoria.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUSCAR = path.join(ROOT, 'core', 'skills', 'devlog', 'scripts', 'buscar.mjs');
const HOOKS = path.join(ROOT, 'core', 'hooks');
let fallos = 0, casos = 0;
const ok = (cond, nombre, detalle = '') => { casos++; if (!cond) { fallos++; console.log(`FAIL ${nombre}${detalle ? ' -> ' + detalle : ''}`); } };

// ---------------------------------------------------------------- fixture
const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-memoria-'));
const dl = path.join(proj, 'devlog');
const escribir = (rel, txt, { crlf = false, bom = false } = {}) => {
    const f = path.join(dl, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    let t = txt.replace(/^\n/, '');
    if (crlf) t = t.replace(/\n/g, '\r\n');
    fs.writeFileSync(f, (bom ? '﻿' : '') + t, 'utf8');
};
const entrada = (num, fecha, titulo, tipo, cuerpo) => escribir(`${fecha}/${num}-${titulo.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)}.md`,
    `# ${num} — ${titulo}\n\n- **Fecha/hora:** ${fecha} 10:00\n- **Tipo:** ${tipo}\n- **Mejora a:** —\n\n${cuerpo}\n`);

entrada('001', '2026-08-01', 'Setup inicial del proyecto', 'infra', '## Qué se hizo\n- Laravel 11 con Inertia y Vue.\n- Colaborador externo da acceso al repositorio.\n\n## Próximos pasos\n- Definir la pasarela.');
entrada('002', '2026-08-03', 'Migración destructiva revertida', 'fix', '## Qué se hizo\n- La migración borraba la columna `phone`; se revierte y se crea una nueva migración aditiva.\n\n## Verificación\n- php artisan migrate en staging.');
entrada('003', '2026-08-05', 'Autenticación con Sanctum', 'feature', '## Qué se hizo\n- Inicio de sesión con Sanctum y verificación de email.\n- Throttle de 5 intentos.\n\n## Decisiones (resumen)\n- Sanctum en vez de Passport: no hay terceros que consuman la API.');
entrada('004', '2026-08-10', 'Pagos con Stripe Elements', 'feature', '## Qué se hizo\n- Formulario de pago con Stripe Elements.\n\n## Decisiones (resumen)\n- Elements para controlar el diseño del formulario.');
entrada('005', '2026-08-20', 'Webhook de Stripe duplicaba pedidos', 'fix', '## Qué se hizo\n- El webhook llegaba dos veces y se creaban pedidos duplicados.\n- Idempotencia por event.id en la tabla stripe_events.\n\n## Verificación\n- stripe trigger checkout.session.completed dos veces: un solo pedido.');
entrada('006', '2026-09-02', 'Cambio a Stripe Checkout', 'decisión', '## Qué se hizo\n- Se sustituye Elements por Checkout: 3DS, facturas y métodos locales sin código propio.\n\n## Decisiones (resumen)\n- Checkout alojado por Stripe (D-020), sustituye a D-012.');
entrada('007', '2026-09-05', 'Cola de correos con Horizon', 'infra', '## Qué se hizo\n- Los emails de confirmación salen por la cola `mail` con Horizon y Redis.\n- Supervisor reinicia el worker.');
entrada('008', '2026-09-08', 'Diseño de la home', 'feature', '## Qué se hizo\n- Paleta y tipografía del design system aplicadas a la home.\n- Hero con animación GSAP.');
entrada('009', '2026-09-10', 'Rendimiento de la ficha de producto', 'fix', '## Qué se hizo\n- La ficha tardaba 4 s: N+1 en variantes. Eager loading y caché de 10 min.\n\n## Verificación\n- LCP de 4,1 s a 1,6 s.');
entrada('010', '2026-09-12', 'Despliegue en Forge', 'infra', '## Qué se hizo\n- Producción en Forge con zero-downtime; script de deploy con migrate --force y queue:restart.');
entrada('011', '2026-09-15', 'Buscador de productos', 'feature', '## Qué se hizo\n- Búsqueda con Scout y filtros por categoría.\n- Menciona stripe una vez de pasada: el checkout no cambia.');
entrada('012', '2026-09-18', 'Backups diarios', 'infra', '## Qué se hizo\n- spatie/laravel-backup a R2 cada noche; restore probado el 18/09.');
// CRLF + BOM (Windows) y caracteres raros
escribir('2026-09-20/013-contrasenas-y-acceso.md', '# 013 — Recuperar contraseña\n\n- **Tipo:** fix\n\n## Qué se hizo\n- El enlace de recuperar contraseña caducaba en 1 minuto; ahora 60.\n- Símbolos raros: c++ (.*) [x] $var {llaves} ñandú\n\n## Próximos pasos\n- Revisar la caducidad en staging.\n', { crlf: true, bom: true });
escribir('2026-08-10/DECISIONES.md', '# Decisiones — 2026-08-10\n\n## D-012 · Stripe Elements (dev-004)\n- Elements para controlar el diseño. **Sustituida por D-020.**\n');
escribir('MEMORIA.md', `# Memoria del proyecto

## Decisiones vigentes
- D-020 · Pagos con Stripe Checkout alojado, no Elements (3DS y facturas sin código propio) · ver 006
- D-007 · Correos siempre por cola (Horizon + Redis), nunca síncronos · ver 007
- D-003 · Sanctum para la autenticación, no Passport · ver 003

## Reglas del cliente y del proyecto
- El cliente no quiere la palabra "barato" en ningún texto.

## Lo que no funcionó
- D-012 · Stripe Elements: sustituida por D-020 (demasiado código propio para 3DS) · ver 004
- Envío de correos síncrono: timeouts con el SMTP del cliente · ver 007

## Pendientes abiertos
- Falta el texto legal de la política de devoluciones.
`, { crlf: true });

const run = (args, cwd = proj) => {
    const r = spawnSync(process.execPath, [BUSCAR, ...args, '--json'], { cwd, encoding: 'utf8' });
    let j = null; try { j = JSON.parse(r.stdout); } catch {}
    return { code: r.status, j, out: r.stdout + r.stderr };
};
const top = (q, extra = []) => { const r = run([q, ...extra]); return r.j ? r.j.resultados : []; };
const nums = res => res.map(r => r.num || r.clase);
const primero = (q, esperado, nombre, extra = []) => {
    const res = top(q, extra);
    const p = res[0];
    const okk = p && (typeof esperado === 'function' ? esperado(p) : p.num === esperado);
    ok(okk, nombre, `primeros: ${res.slice(0, 4).map(r => `${r.num || '-'}/${r.clase}${r.sustituida ? '/S' : ''}`).join(', ')}`);
};

// ---------------------------------------------------------------- casos del buscador
primero('migracion', '002', 'acentos: migracion -> Migración');
primero('MIGRACIÓN destructiva', '002', 'mayúsculas y tilde');
primero('pagar', r => ['006', '004', '020'].includes(r.num) || /pago/i.test(r.fragmento), 'raíz: pagar -> pagos');
primero('stirpe webhook', '005', 'errata con transposición: stirpe');
primero('autenticasion', '003', 'errata en palabra larga sin tilde');
primero('login', r => r.num === '003', 'sinónimo: login -> autenticación/Sanctum');
primero('jobs correo', r => r.num === '007', 'sinónimos combinados: jobs + correo -> cola de correos');
primero('webhook stripe', '005', 'cobertura: entrada con las dos palabras gana a la que solo dice stripe');
primero('despliegue', '010', 'sinónimo directo en el título');
primero('lento ficha', '009', 'síntoma -> entrada de rendimiento');
primero('diseno', '008', 'ñ normalizada: diseno -> Diseño');
primero('contrasena', '013', 'CRLF + BOM + ñ en archivo de Windows');
primero('stripe elements', r => !r.sustituida, 'decisión vigente por delante de la sustituida');
primero('006', '006', 'búsqueda por número de entrada');
primero('barato', r => r.clase === 'memoria', 'regla del cliente desde MEMORIA');

{
    const res = top('cola');
    ok(!res.some(r => r.num === '001'), 'falso positivo: cola NO debe traer "Colaborador"', nums(res).join(','));
    ok(res[0] && (res[0].num === '007'), 'cola -> 007 primero', nums(res).join(','));
}
{
    const res = top('stripe');
    const i011 = res.findIndex(r => r.num === '011');
    ok(i011 === -1 || i011 > res.findIndex(r => r.num === '005'), 'mención de pasada (011) por detrás de una entrada sobre stripe (005)', nums(res).join(','));
}
{   // una entrada con su sección «Decisiones» que también coincide NO debe ocupar dos huecos
    for (const q of ['sanctum passport', 'stripe elements', 'checkout']) {
        const res = top(q, ['--max', '10']);
        const archivos = res.filter(r => r.clase !== 'memoria').map(r => r.archivo);
        ok(new Set(archivos).size === archivos.length, `sin resultados duplicados de la misma entrada ("${q}")`, archivos.join(', '));
    }
}
{
    const res = top('stripe', ['--desde', '2026-09']);
    ok(res.length && res.every(r => r.clase === 'memoria' || (r.fecha && r.fecha >= '2026-09')), '--desde filtra por fecha (la memoria vigente se mantiene)', res.map(r => r.fecha).join(','));
    ok(!res.some(r => r.num === '004' && r.clase === 'entrada'), '--desde excluye la 004', nums(res).join(','));
}
{
    const res = top('stripe', ['--tipo', 'fix']);
    ok(res.length && res.every(r => /fix/.test(r.tipo)), '--tipo fix solo devuelve fixes', res.map(r => r.tipo).join(','));
}
{
    const r = run(['c++ (.*) [x] $var {llaves}']);
    ok(r.code === 0 && r.j, 'caracteres especiales no rompen (no hay regex con la consulta)', r.out.slice(0, 200));
}
{
    const r = run(['por qué lo hicimos']);
    ok(r.code === 2 && r.j && r.j.aviso && /vac/i.test(r.j.aviso), 'consulta solo con palabras vacías -> aviso y código 2', r.out.slice(0, 200));
}
{
    const r = run(['kubernetes helm']);
    ok(r.code === 0 && r.j && r.j.resultados.length === 0 && /NO hay nada registrado/.test(r.j.aviso || ''), 'sin resultados -> aviso de no suponer', r.out.slice(0, 200));
}
{
    const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-sin-devlog-'));
    const r = run(['stripe'], vacio);
    ok(r.code === 2 && /No hay carpeta devlog/.test(r.out), 'proyecto sin devlog -> aviso claro', r.out.slice(0, 200));
}
{
    fs.writeFileSync(path.join(dl, 'sinonimos.json'), JSON.stringify([['datafono', 'tpv', 'cobro']]));
    primero('datafono', r => /stripe|pago/i.test(r.fragmento + r.titulo), 'sinonimos.json del proyecto amplía la lista', []);
    fs.writeFileSync(path.join(dl, 'sinonimos.json'), '{ esto no es json');
    const r = run(['stripe']);
    ok(r.code === 0 && r.j && r.j.resultados.length, 'sinonimos.json roto no rompe la búsqueda');
    fs.rmSync(path.join(dl, 'sinonimos.json'));
}
{   // devlog propio del proyecto (archivos sueltos con 4 cifras, sin carpeta por día) y ADRs: como en un monorepo
    const docsDl = path.join(proj, 'docs', 'devlog'); fs.mkdirSync(docsDl, { recursive: true });
    fs.writeFileSync(path.join(docsDl, '0137-tiers-editables.md'), '# 0137 — Tiers aplicados: límites editables en runtime\n\n2026-06-22 · done\n\n## Qué\n- Límites por tier en la tabla plan_limits, editables sin redeploy.\n');
    const adr = path.join(proj, 'docs', 'adr'); fs.mkdirSync(adr, { recursive: true });
    fs.writeFileSync(path.join(adr, '0003-proxy-de-captura.md'), '# ADR 0003: Sandbox con salida a internet vía proxy de captura\n\nFecha: 2026-09-22\n\n## Decisión\nEl sandbox sale a internet por un proxy que lo registra todo.\n');
    const r = run(['plan_limits tier editables']);
    ok(r.j && r.j.resultados[0] && r.j.resultados[0].num === '0137' && r.j.resultados[0].fecha === '2026-06-22', 'encuentra el devlog propio (docs/devlog, 4 cifras, fecha en el texto)', JSON.stringify(r.j && r.j.resultados[0]));
    ok(r.j && r.j.fuentes.includes('docs/devlog') && r.j.fuentes.includes('docs/adr'), 'informa de todas las fuentes leídas', r.j && r.j.fuentes.join(','));
    const r2 = run(['proxy captura sandbox']);
    ok(r2.j && r2.j.resultados[0] && r2.j.resultados[0].clase === 'decision' && /proxy de captura/i.test(r2.j.resultados[0].titulo) && !/ADR 0003/.test(r2.j.resultados[0].titulo), 'los ADR cuentan como decisión y el título sale limpio', JSON.stringify(r2.j && r2.j.resultados[0]));
    const r3 = run(['plan_limits tier editables', '--solo-devlog']);
    ok(r3.j && !r3.j.resultados.some(x => x.num === '0137'), '--solo-devlog no mira docs/devlog');
    // proyecto sin devlog/ pero con docs/devlog: busca igual
    const p5 = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-solo-docs-'));
    fs.cpSync(path.join(proj, 'docs'), path.join(p5, 'docs'), { recursive: true });
    const r4 = run(['tiers editables'], p5);
    ok(r4.code === 0 && r4.j && r4.j.resultados[0] && r4.j.resultados[0].num === '0137', 'sin devlog/ pero con docs/devlog: busca en lo que hay', r4.out.slice(0, 160));
    fs.rmSync(p5, { recursive: true, force: true });
    fs.rmSync(path.join(proj, 'docs'), { recursive: true, force: true });
}
{   // salida de texto (la que lee el agente): compacta y con ruta
    const r = spawnSync(process.execPath, [BUSCAR, 'webhook stripe'], { cwd: proj, encoding: 'utf8' });
    ok(/devlog\/2026-08-20\/005-/.test(r.stdout) && r.stdout.length < 1600, 'salida de texto compacta con la ruta de la entrada', `${r.stdout.length} caracteres`);
}

// ---------------------------------------------------------------- rendimiento: 3000 entradas
{
    const big = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-memoria-big-'));
    const palabras = 'modelo controlador vista ruta servicio repositorio evento listener politica middleware componente pagina layout tabla indice consulta'.split(' ');
    for (let i = 1; i <= 3000; i++) {
        const fecha = `2025-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`;
        const d = path.join(big, 'devlog', fecha);
        fs.mkdirSync(d, { recursive: true });
        const w = () => palabras[(i * 7 + Math.floor(i / 3)) % palabras.length];
        fs.writeFileSync(path.join(d, `${String(i).padStart(4, '0')}-entrada.md`), `# ${i} — Cambio en ${w()}\n\n- **Tipo:** feature\n\n## Qué se hizo\n- ${Array.from({ length: 40 }, w).join(' ')}\n`);
    }
    fs.mkdirSync(path.join(big, 'devlog', '2025-06-15'), { recursive: true });
    fs.writeFileSync(path.join(big, 'devlog', '2025-06-15', '9999-aguja.md'), '# 9999 — Aguja en el pajar\n\n- **Tipo:** fix\n\n## Qué se hizo\n- El webhook de Holded perdía facturas.\n');
    const t0 = Date.now();
    const r = run(['holded facturas'], big);
    const ms = Date.now() - t0;
    ok(r.j && r.j.resultados[0] && r.j.resultados[0].num === '9999', 'aguja en 3000 entradas', r.out.slice(0, 200));
    ok(ms < 5000, `3000 entradas en menos de 5 s (${ms} ms)`);
    fs.rmSync(big, { recursive: true, force: true });
}

// ---------------------------------------------------------------- hooks de memoria
const hook = (nombre, input, cwd = proj, env = {}) => spawnSync(process.execPath, [path.join(HOOKS, nombre)], {
    cwd, input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: cwd, ...env },
});
{
    const r = hook('session-start.mjs', { session_id: 'mem-ss' });
    ok(/D-020/.test(r.stdout) && /MEMORIA\.md/.test(r.stdout), 'session-start inyecta la memoria', r.stdout.slice(0, 300));
    ok(/buscar\.mjs/.test(r.stdout), 'session-start indica cómo buscar en el pasado');
    ok(/Revisar la caducidad en staging/.test(r.stdout), 'session-start da los próximos pasos de la ÚLTIMA entrada (013, CRLF+BOM)', r.stdout.slice(0, 300));
    ok(!/Definir la pasarela/.test(r.stdout), 'no mezcla los próximos pasos de entradas antiguas');
    ok(r.stdout.length < 12000, `session-start acotado (${r.stdout.length} caracteres)`);
}
{   // memoria recién instalada (solo la plantilla con comentarios) cuenta como vacía
    const p4 = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-memoria-tpl-'));
    fs.cpSync(dl, path.join(p4, 'devlog'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'templates', 'devlog-memoria.md'), path.join(p4, 'devlog', 'MEMORIA.md'));
    const r = hook('session-start.mjs', { session_id: 'mem-tpl' }, p4);
    ok(/créala AHORA/.test(r.stdout), 'plantilla sin rellenar + historial -> pide crear la memoria', r.stdout.slice(0, 300));
    const b = spawnSync(process.execPath, [BUSCAR, 'decisiones', '--json'], { cwd: p4, encoding: 'utf8' });
    const j = JSON.parse(b.stdout);
    ok(!j.resultados.some(x => x.clase === 'memoria'), 'el ejemplo comentado de la plantilla no sale como resultado');
    fs.rmSync(p4, { recursive: true, force: true });
}
{
    const r = hook('pre-compact.mjs', { session_id: 'mem-pc' });
    ok(/D-020/.test(r.stdout), 'pre-compact re-inyecta la memoria', r.stdout.slice(0, 300));
}
{   // proyecto con historial y SIN memoria -> pide crearla desde lo que hay
    const p2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-memoria-sin-'));
    fs.cpSync(dl, path.join(p2, 'devlog'), { recursive: true });
    fs.rmSync(path.join(p2, 'devlog', 'MEMORIA.md'));
    const r = hook('session-start.mjs', { session_id: 'mem-ss2' }, p2);
    ok(/crea(la)? .*MEMORIA|MEMORIA\.md.*(no existe|vac)/i.test(r.stdout), 'sin MEMORIA y con historial -> pide crearla', r.stdout.slice(0, 400));
    fs.rmSync(p2, { recursive: true, force: true });
}
{   // stop-guard: decisión hoy y memoria sin tocar -> bloquea una vez
    const p3 = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-memoria-stop-'));
    const hoy = new Date(); const f = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    fs.mkdirSync(path.join(p3, 'devlog', f), { recursive: true });
    fs.writeFileSync(path.join(p3, 'devlog', 'MEMORIA.md'), '# Memoria del proyecto\n\n## Decisiones vigentes\n- D-001 · Algo · ver 001\n');
    const viejo = new Date(Date.now() - 3 * 3600 * 1000);
    fs.utimesSync(path.join(p3, 'devlog', 'MEMORIA.md'), viejo, viejo);
    fs.writeFileSync(path.join(p3, 'devlog', 'INDEX.md'), '| 002 | x |\n');
    fs.writeFileSync(path.join(p3, 'devlog', f, '002-cambio.md'), '# 002 — Cambio\n\n## Decisiones (resumen)\n- Usamos Resend en vez de SMTP.\n');
    const sid = 'mem-stop-' + Date.now();
    const r1 = hook('stop-guard.mjs', { session_id: sid }, p3);
    ok(/"decision":"block"/.test(r1.stdout) && /MEMORIA/.test(r1.stdout), 'stop-guard bloquea si hay decisión y la memoria no se actualizó', r1.stdout.slice(0, 300));
    const r2 = hook('stop-guard.mjs', { session_id: sid }, p3);
    ok(!/"decision":"block"/.test(r2.stdout), 'stop-guard solo bloquea una vez por sesión', r2.stdout.slice(0, 200));
    // tocar la memoria SIN recoger la decisión no basta (se mira el contenido, no la fecha)
    fs.utimesSync(path.join(p3, 'devlog', 'MEMORIA.md'), new Date(), new Date());
    const r3a = hook('stop-guard.mjs', { session_id: sid + '-a2' }, p3);
    ok(/MEMORIA\.md sin actualizar/.test(r3a.stdout), 'memoria más reciente pero sin la decisión -> sigue pidiéndola', r3a.stdout.slice(0, 200));
    // memoria que cita la entrada -> no bloquea, aunque sea MÁS ANTIGUA que la entrada (el caso de un monorepo)
    fs.writeFileSync(path.join(p3, 'devlog', 'MEMORIA.md'), '# Memoria del proyecto\n\n## Decisiones vigentes\n- D-001 · Algo · ver 001\n- D-002 · Resend en vez de SMTP · ver 002\n');
    fs.utimesSync(path.join(p3, 'devlog', 'MEMORIA.md'), viejo, viejo);
    const r3 = hook('stop-guard.mjs', { session_id: sid + '-b' }, p3);
    ok(!/MEMORIA\.md sin actualizar/.test(r3.stdout), 'memoria escrita ANTES que la entrada pero que la cita -> sin aviso', r3.stdout.slice(0, 200));
    // recogida por D-xxx aunque la memoria no cite el número de entrada
    fs.writeFileSync(path.join(p3, 'devlog', f, '002-cambio.md'), '# 002 — Cambio\n\n## Decisiones (resumen)\n- D-007 · Usamos Resend en vez de SMTP.\n');
    fs.writeFileSync(path.join(p3, 'devlog', 'MEMORIA.md'), '# Memoria\n\n## Decisiones vigentes\n- D-007 · Resend para correos\n');
    const r3b = hook('stop-guard.mjs', { session_id: sid + '-b2' }, p3);
    ok(!/MEMORIA\.md sin actualizar/.test(r3b.stdout), 'recogida por su D-xxx -> sin aviso', r3b.stdout.slice(0, 200));
    // trampa: "D-002" en la memoria NO es citar la entrada 002
    fs.writeFileSync(path.join(p3, 'devlog', f, '002-cambio.md'), '# 002 — Cambio\n\n## Decisiones (resumen)\n- Usamos Resend en vez de SMTP.\n');
    fs.writeFileSync(path.join(p3, 'devlog', 'MEMORIA.md'), '# Memoria\n\n## Decisiones vigentes\n- D-002 · Otra cosa distinta · ver 001\n');
    const r3c = hook('stop-guard.mjs', { session_id: sid + '-b3' }, p3);
    ok(/MEMORIA\.md sin actualizar/.test(r3c.stdout), 'un D-002 en la memoria no cuenta como citar la entrada 002', r3c.stdout.slice(0, 200));
    // cita en lista ("ver 001, 002") y en el histórico también cuentan
    fs.writeFileSync(path.join(p3, 'devlog', 'MEMORIA.md'), '# Memoria\n\n## Decisiones vigentes\n- D-003 · Dos cosas · ver 001, 002\n');
    const r3d = hook('stop-guard.mjs', { session_id: sid + '-b4' }, p3);
    ok(!/MEMORIA\.md sin actualizar/.test(r3d.stdout), '"ver 001, 002" cita las dos entradas', r3d.stdout.slice(0, 200));
    fs.writeFileSync(path.join(p3, 'devlog', 'MEMORIA.md'), '# Memoria\n\n## Decisiones vigentes\n- D-001 · Algo · ver 001\n');
    fs.writeFileSync(path.join(p3, 'devlog', 'MEMORIA-historico.md'), '# Histórico\n\n- D-002 · Resend: sustituida por D-009 · ver 002\n');
    const r3e = hook('stop-guard.mjs', { session_id: sid + '-b5' }, p3);
    ok(!/MEMORIA\.md sin actualizar/.test(r3e.stdout), 'recogida en MEMORIA-historico.md también cuenta', r3e.stdout.slice(0, 200));
    fs.rmSync(path.join(p3, 'devlog', 'MEMORIA-historico.md'));
    // decisión vacía ("…") -> no cuenta como decisión
    fs.writeFileSync(path.join(p3, 'devlog', f, '002-cambio.md'), '# 002 — Cambio\n\n## Decisiones (resumen)\n- …\n\n## Verificación\n- ok\n');
    fs.utimesSync(path.join(p3, 'devlog', 'MEMORIA.md'), viejo, viejo);
    const r4 = hook('stop-guard.mjs', { session_id: sid + '-c' }, p3);
    ok(!/MEMORIA/.test(r4.stdout), 'sección de decisiones vacía (…) no exige memoria', r4.stdout.slice(0, 200));
    // memoria demasiado larga -> aviso de pasar al histórico
    fs.writeFileSync(path.join(p3, 'devlog', 'MEMORIA.md'), '# Memoria\n\n' + Array.from({ length: 75 }, (_, i) => `- D-${i} · cosa ${i}`).join('\n'));
    const r5 = hook('stop-guard.mjs', { session_id: sid + '-d' }, p3);
    ok(/hist[oó]rico/i.test(r5.stdout), 'memoria > 60 líneas -> aviso de pasar al histórico', r5.stdout.slice(0, 300));
    fs.rmSync(p3, { recursive: true, force: true });
}

fs.rmSync(proj, { recursive: true, force: true });
console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
