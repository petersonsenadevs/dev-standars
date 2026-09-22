// Hook Stop: antes de que el agente termine, comprueba el cierre de la tarea.
// Si hay cambios de código sin commitear (git) y NO hay entrada de devlog de hoy, BLOQUEA la parada UNA vez por
// sesión pidiendo crear/actualizar el devlog (decision=block + reason). Si ya se bloqueó antes (stop_hook_active
// o marcador de sesión), deja parar y solo recuerda. Sin git o sin cambios: solo recordatorio si falta devlog.

import fs from 'node:fs';
import {
    readHookInput, projectRoot, planStatus, sessionFlag, projectFlag, testOnce,
    todayDevlog, devlogIndexed, hookConfig, gitBranch, gitDirty, todayStr,
} from './lib.mjs';

const p = readHookInput();
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
const today = todayDevlog(root);
if (today.length) {
    const notIdx = today.filter(n => !devlogIndexed(root, n));
    let extra = '';
    if (notIdx.length) extra = ` Falta indexar en devlog/INDEX.md: ${notIdx.join(', ')}.`;
    const cfg = hookConfig(root);
    if (cfg && cfg.commands && gitBranch(root) && gitDirty(root) > 0) {
        extra += ' Hay cambios sin commitear: ejecuta los comandos del stack (lint/test/types de config.json) y pega la salida antes de cerrar.';
    }
    if ((frontMsg || buildMsg) && !alreadyActive && testOnce(sid, 'stop-ui')) {
        process.stdout.write(JSON.stringify({ decision: 'block', reason: '[dev-standards]' + buildMsg + frontMsg + planMsg + extra }) + '\n');
        process.exit(0);
    }
    if (planMsg || extra || frontMsg || buildMsg) process.stdout.write('recordatorio:' + buildMsg + frontMsg + planMsg + extra + '\n');
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
process.stdout.write(`recordatorio: aun no hay entrada de devlog para hoy (${date}). Documenta el avance en devlog/${date}/ antes de cerrar.` + buildMsg + frontMsg + planMsg + '\n');
process.exit(0);
