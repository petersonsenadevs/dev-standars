// Hook Stop: antes de que el agente termine, comprueba el cierre de la tarea.
// Si hay cambios de código sin commitear (git) y NO hay entrada de devlog de hoy, BLOQUEA la parada UNA vez por
// sesión pidiendo crear/actualizar el devlog (decision=block + reason). Si ya se bloqueó antes (stop_hook_active
// o marcador de sesión), deja parar y solo recuerda. Sin git o sin cambios: solo recordatorio si falta devlog.

import fs from 'node:fs';
import path from 'node:path';
import {
    readHookInput, projectRoot, planStatus, sessionFlag, projectFlag, testOnce,
    todayDevlog, devlogIndexed, hookConfig, gitBranch, gitDirty, todayStr,
    memoriaProyecto, seccionMd, tieneContenido, readText,
} from './lib.mjs';

const p = readHookInput();
// Recordatorio sin bloquear. Codex exige JSON en la salida del Stop (el texto plano es invalido); Claude
// muestra systemMessage al usuario. Mismo formato para los dos.
const recordar = msg => process.stdout.write(JSON.stringify({ systemMessage: msg }) + '\n');
const root = projectRoot();
const sid = p && p.session_id ? String(p.session_id) : 'default';
const plan = planStatus(root);
let planMsg = '';
if (plan.exists && plan.doing.length) planMsg = ` Ademas hay tarea(s) en curso en plan/PLAN.md (${plan.doing.join('; ')}): si la has terminado, marcala done con el enlace al devlog y propon la siguiente.`;
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

// Memoria del proyecto: si el devlog de hoy trae decisiones y devlog/MEMORIA.md no se ha tocado después, se
// exige actualizarla (bloquea una vez por sesión). Si pasa de 60 líneas, se recuerda pasar lo viejo al histórico.
let memMsg = '', memLarga = '';
{
    const dirHoy = path.join(root, 'devlog', todayStr());
    const conDecision = [];
    let tDec = 0;
    for (const n of todayDevlog(root)) {
        const f = path.join(dirHoy, n);
        if (tieneContenido(seccionMd(readText(f), 'Decisiones'))) {
            conDecision.push(n.slice(0, 3));
            try { tDec = Math.max(tDec, fs.statSync(f).mtimeMs); } catch {}
        }
    }
    const fDec = path.join(dirHoy, 'DECISIONES.md');
    if (fs.existsSync(fDec) && tieneContenido((readText(fDec) || '').replace(/^#\s.*$/gm, ''))) {
        conDecision.push('DECISIONES.md');
        try { tDec = Math.max(tDec, fs.statSync(fDec).mtimeMs); } catch {}
    }
    const mem = memoriaProyecto(root);
    if (conDecision.length && (!mem.existe || mem.mtime < tDec)) {
        memMsg = ` Hay decisiones nuevas en el devlog de hoy (${conDecision.join(', ')}) y devlog/MEMORIA.md sin actualizar: añádelas como vigentes con su D-xxx y su entrada (o marca como sustituida la que cambian), con la skill devlog (references/memoria.md).`;
    }
    if (mem.existe && mem.lineas.length > 60) {
        memLarga = ` devlog/MEMORIA.md tiene ${mem.lineas.length} líneas (máximo 60): pasa lo sustituido o cerrado a devlog/MEMORIA-historico.md.`;
    }
}

const today = todayDevlog(root);
if (today.length) {
    const notIdx = today.filter(n => !devlogIndexed(root, n));
    let extra = '';
    if (notIdx.length) extra = ` Falta indexar en devlog/INDEX.md: ${notIdx.join(', ')}.`;
    const cfg = hookConfig(root);
    if (cfg && cfg.commands && gitBranch(root) && gitDirty(root) > 0) {
        extra += ' Hay cambios sin commitear: ejecuta los comandos del stack (lint/test/types de config.json) y pega la salida antes de cerrar.';
    }
    extra += memLarga;
    const bloqueaUi = (frontMsg || buildMsg) && !alreadyActive && testOnce(sid, 'stop-ui');
    const bloqueaMem = memMsg && !alreadyActive && testOnce(sid, 'stop-memoria');
    if (bloqueaUi || bloqueaMem) {
        process.stdout.write(JSON.stringify({ decision: 'block', reason: '[dev-standards]' + buildMsg + frontMsg + memMsg + planMsg + extra }) + '\n');
        process.exit(0);
    }
    if (planMsg || extra || frontMsg || buildMsg || memMsg) recordar('recordatorio:' + buildMsg + frontMsg + memMsg + planMsg + extra);
    process.exit(0);
}

let dirty = 0;
if (gitBranch(root)) dirty = gitDirty(root);
const date = todayStr();
const reason = `[dev-standards] Hay ${dirty} archivo(s) con cambios y no existe ninguna entrada en devlog/${date}/. Antes de terminar: crea devlog/${date}/NNN-<slug>.md (numeracion global correlativa) con que se hizo, verificacion y proximos pasos, y actualiza devlog/INDEX.md (skill devlog). Si el cambio es trivial y no merece devlog, dilo explicitamente y termina.` + buildMsg + frontMsg + planMsg;

if (dirty > 0 && !alreadyActive && testOnce(sid, 'stop-devlog')) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
    process.exit(0);
}
recordar(`recordatorio: aun no hay entrada de devlog para hoy (${date}). Documenta el avance en devlog/${date}/ antes de cerrar.` + buildMsg + frontMsg + planMsg);
process.exit(0);
