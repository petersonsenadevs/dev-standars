// Hook Stop: antes de que el agente termine, comprueba el cierre de la tarea.
// Si hay cambios de código sin commitear (git) y NO hay entrada de devlog de hoy, BLOQUEA la parada UNA vez por
// sesión pidiendo crear/actualizar el devlog (decision=block + reason). Si ya se bloqueó antes (stop_hook_active
// o marcador de sesión), deja parar y solo recuerda. Sin git o sin cambios: solo recordatorio si falta devlog.

import fs from 'node:fs';
import path from 'node:path';
import {
    readHookInput, projectRoot, planStatus, sessionFlag, projectFlag, testOnce, todayDevlog, devlogIndexed, hookConfig, gitBranch, gitDirty, todayStr, memoriaProyecto, seccionMd, tieneContenido, readText, ruta, rutaRel,
} from './lib.mjs';

const p = readHookInput();
// Recordatorio sin bloquear. Codex exige JSON en la salida del Stop (el texto plano es invalido); Claude
// muestra systemMessage al usuario. Mismo formato para los dos.
const recordar = msg => process.stdout.write(JSON.stringify({ systemMessage: msg }) + '\n');
const root = projectRoot();
const DL = rutaRel(root, 'devlog'), PL = rutaRel(root, 'plan'), DS = rutaRel(root, 'design-system'), CV = rutaRel(root, 'conventions.md');   // rutas reales (senzu/ o antiguas)
const sid = p && p.session_id ? String(p.session_id) : 'default';
const plan = planStatus(root);
let planMsg = '';
if (plan.exists && plan.doing.length) planMsg = ` Ademas hay tarea(s) en curso en ${PL}/PLAN.md (${plan.doing.join('; ')}): si la has terminado, marcala done con el enlace al devlog y propon la siguiente.`;
// Si la sesión editó UI (marcador de front-skill-reminder), exigir la verificación con móvil primero (skill ui-verify).
let frontMsg = '';
if (fs.existsSync(sessionFlag(sid, 'frontedit'))) {
    frontMsg = " Has editado archivos de UI en esta sesion: NO la des por hecha sin verificarla (skill ui-verify): ejecuta 'node <skills-dir>/ui-verify/scripts/verify-ui.mjs <url-local>' (o la pasada con navegador) EMPEZANDO POR MOVIL 375px, corrige hasta 0 problemas y pega el resultado en el devlog.";
}
const alreadyActive = !!(p && p.stop_hook_active === true);
// Código editado sin verificación posterior (flags por proyecto: edit-tracker vs verify-build).
let buildMsg = '';
const ceFlag = projectFlag(root, 'codeedit');
if (fs.existsSync(ceFlag)) {
    const vfFlag = projectFlag(root, 'verified');
    let stale = true;
    try { stale = !fs.existsSync(vfFlag) || fs.statSync(vfFlag).mtimeMs < fs.statSync(ceFlag).mtimeMs; } catch {}
    if (stale) {
        buildMsg = " Has editado codigo y NO hay verificacion posterior: ejecuta 'node <skills-dir>/code-quality/scripts/verify-build.mjs' (corre lint/types/tests/build del stack y deja constancia) o los comandos del stack a mano, corrige los fallos y pega el resultado antes de cerrar.";
    }
}
// Guardia de assets: imágenes pesadas, fuentes sin woff2 y vídeos grandes añadidos en las últimas 24 h.
// Es la causa nº 1 de webs lentas. Solo avisa (va dentro del mensaje), no bloquea por sí sola.
function revisarAssets(base) {
    const dirs = ['public', 'static', 'assets', 'images', 'img', 'src/assets', 'src/images', 'resources/images', 'resources/img', 'resources/js/assets', 'wp-content/themes', 'wp-content/uploads'];
    const limite = Date.now() - 24 * 60 * 60 * 1000;
    const avisos = [];
    const visitar = (d, prof) => {
        if (prof > 5 || avisos.length >= 8) return;
        let entradas = [];
        try { entradas = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of entradas) {
            const f = path.join(d, e.name);
            if (e.isDirectory()) { if (!/^(node_modules|vendor|build|dist|\.git|cache)$/i.test(e.name)) visitar(f, prof + 1); continue; }
            let st; try { st = fs.statSync(f); } catch { continue; }
            if (st.mtimeMs < limite) continue;
            const kb = Math.round(st.size / 1024), rel = path.relative(base, f).replace(/\\/g, '/');
            if (/\.(jpe?g|png|gif|webp|avif)$/i.test(e.name) && kb > 500) avisos.push(`${rel} (${kb} KB: comprímela a WebP o AVIF, idealmente < 300 KB)`);
            else if (/\.svg$/i.test(e.name) && kb > 150) avisos.push(`${rel} (${kb} KB: optimiza el SVG con SVGO)`);
            else if (/\.(ttf|otf)$/i.test(e.name)) avisos.push(`${rel} (fuente sin comprimir: usa woff2)`);
            else if (/\.(mp4|mov|webm)$/i.test(e.name) && kb > 5 * 1024) avisos.push(`${rel} (${Math.round(kb / 1024)} MB: vídeo pesado, comprímelo y añade poster)`);
        }
    };
    for (const d of dirs) visitar(path.join(base, d), 0);
    return avisos.length ? ` Assets pesados añadidos hoy: ${avisos.join('; ')}. Revísalos antes de cerrar (ui-verify references/web-performance.md).` : '';
}
planMsg += revisarAssets(root);

// Memoria del proyecto: si el devlog de hoy trae decisiones que devlog/MEMORIA.md (o su histórico) no recoge,
// se exige apuntarlas (bloquea una vez por sesión). Se mira el CONTENIDO, no la fecha de los archivos: una
// entrada está recogida si la memoria la cita ("ver 015", "dev-015", "#015") o menciona alguno de sus D-xxx.
// Así no salta cuando el agente apunta primero la memoria y escribe después la entrada.
let memMsg = '', memLarga = '';
{
    const dirDevlog = ruta(root, 'devlog');
    const dirHoy = path.join(dirDevlog, todayStr());
    const mem = memoriaProyecto(root);
    const textoMem = (readText(path.join(dirDevlog, 'MEMORIA.md')) || '') + '\n' + (readText(path.join(dirDevlog, 'MEMORIA-historico.md')) || '');
    const citadas = new Set();
    for (const m of textoMem.matchAll(/(?:\bver\b|\bentradas?\b|\bdevlog\b|\bdev-|#)\s*((?:\d{3,4}(?:\s*(?:,|y|e|\/)\s*)?)+)/gi)) {
        for (const n of m[1].match(/\d{3,4}/g) || []) citadas.add(String(parseInt(n, 10)));
    }
    const idsMem = new Set((textoMem.match(/\bD-\d{1,4}\b/g) || []).map(s => s.toUpperCase()));
    const recogida = (num, texto) => citadas.has(String(parseInt(num, 10))) || (texto.match(/\bD-\d{1,4}\b/g) || []).some(id => idsMem.has(id.toUpperCase()));
    const conDecision = [];
    for (const n of todayDevlog(root)) {
        const dec = seccionMd(readText(path.join(dirHoy, n)), 'Decisiones');
        const num = (/^(\d{3,4})/.exec(n) || [])[1];
        if (num && tieneContenido(dec) && !recogida(num, dec)) conDecision.push(num);
    }
    const fDec = path.join(dirHoy, 'DECISIONES.md');
    const txtDec = (readText(fDec) || '').replace(/^#\s.*$/gm, '');
    if (tieneContenido(txtDec)) {
        // DECISIONES.md: recogido si la memoria cita alguna de sus entradas (dev-NNN) o alguno de sus D-xxx
        const refs = (txtDec.match(/(?:dev-|#|devlog\s*|ver\s+)(\d{3,4})\b/gi) || []).map(r => r.match(/\d{3,4}/)[0]);
        if (!refs.some(r => recogida(r, '')) && !recogida('-1', txtDec)) conDecision.push('DECISIONES.md');
    }
    if (conDecision.length) {
        memMsg = ` Hay decisiones nuevas en el devlog de hoy (${conDecision.join(', ')}) y ${DL}/MEMORIA.md sin actualizar: añádelas como vigentes con su D-xxx y su entrada (o marca como sustituida la que cambian), con la skill devlog (references/memoria.md).`;
    }
    if (mem.existe && mem.lineas.length > 60) {
        memLarga = ` ${DL}/MEMORIA.md tiene ${mem.lineas.length} líneas (máximo 60): pasa lo sustituido o cerrado a ${DL}/MEMORIA-historico.md.`;
    }
}

const today = todayDevlog(root);
if (today.length) {
    const notIdx = today.filter(n => !devlogIndexed(root, n));
    let extra = '';
    if (notIdx.length) extra = ` Falta indexar en ${DL}/INDEX.md: ${notIdx.join(', ')}.`;
    const cfg = hookConfig(root);
    if (cfg && cfg.commands && gitBranch(root) && gitDirty(root) > 0) {
        extra += ' Hay cambios sin commitear: ejecuta los comandos del stack (lint/test/types de config.json) y pega la salida antes de cerrar.';
    }
    extra += memLarga;
    const bloqueaUi = (frontMsg || buildMsg) && !alreadyActive && testOnce(sid, 'stop-ui');
    const bloqueaMem = memMsg && !alreadyActive && testOnce(sid, 'stop-memoria');
    if (bloqueaUi || bloqueaMem) {
        process.stdout.write(JSON.stringify({ decision: 'block', reason: '[senzu]' + buildMsg + frontMsg + memMsg + planMsg + extra }) + '\n');
        process.exit(0);
    }
    if (planMsg || extra || frontMsg || buildMsg || memMsg) recordar('recordatorio:' + buildMsg + frontMsg + memMsg + planMsg + extra);
    process.exit(0);
}

let dirty = 0;
if (gitBranch(root)) dirty = gitDirty(root);
const date = todayStr();
const reason = `[senzu] Hay ${dirty} archivo(s) con cambios y no existe ninguna entrada en ${DL}/${date}/. Antes de terminar: crea ${DL}/${date}/NNN-<slug>.md (numeracion global correlativa) con que se hizo, verificacion y proximos pasos, y actualiza ${DL}/INDEX.md (skill devlog). Si el cambio es trivial y no merece devlog, dilo explicitamente y termina.` + buildMsg + frontMsg + planMsg;

if (dirty > 0 && !alreadyActive && testOnce(sid, 'stop-devlog')) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
    process.exit(0);
}
recordar(`recordatorio: aun no hay entrada de devlog para hoy (${date}). Documenta el avance en ${DL}/${date}/ antes de cerrar.` + buildMsg + frontMsg + planMsg);
process.exit(0);
