// Hook PreToolUse (Edit|Write|MultiEdit) para Claude Code en stacks de front.
// La PRIMERA vez por sesión que el agente va a crear/editar un archivo de UI, inyecta contexto
// recordando la skill ui-ux-pro-max y el design system del proyecto. Muro: primera edición de UI
// sin design system NI brief bloquea UNA vez por sesión.
// Entrada: JSON por STDIN { session_id, tool_name, tool_input: { file_path } }.
// Salida: JSON con hookSpecificOutput.additionalContext (solo la primera vez por sesión).
// Marcador de sesión: <tmp>/dev-standards-front-<session_id>.flag

import fs from 'node:fs';
import path from 'node:path';
import {
    readHookInput, projectRoot, sessionFlag, testOnce, designSystemMaster, findFirstFile, outHookJson, ruta,
} from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);
const file = p.tool_input && p.tool_input.file_path ? String(p.tool_input.file_path) : '';
if (!file) process.exit(0);
if (!/\.(vue|tsx|jsx|astro|blade\.php|html|css|scss|svelte)$/i.test(file)) process.exit(0);
const sid = p.session_id ? String(p.session_id) : 'default';
// Marcador persistente "esta sesión ha editado UI": lo lee stop-guard para exigir la verificación móvil (ui-verify).
const editFlag = sessionFlag(sid, 'frontedit');
if (!fs.existsSync(editFlag)) { try { fs.writeFileSync(editFlag, ''); } catch {} }
if (!testOnce(sid, 'front')) process.exit(0);
const root = projectRoot();
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
const skillsDir = (pluginRoot && fs.existsSync(path.join(pluginRoot, 'skills', 'ui-ux-pro-max'))) ? '$CLAUDE_PLUGIN_ROOT/skills'
    : fs.existsSync(path.join(root, '.claude', 'skills', 'ui-ux-pro-max')) ? '.claude/skills'
    : '<skills-dir>';
const master = designSystemMaster(root);
const hasBrief = fs.existsSync(path.join(ruta(root, 'plan'), 'brief.md'))
    || (fs.existsSync(ruta(root, 'design-system')) && !!findFirstFile(ruta(root, 'design-system'), 'BRAND.md'));
// MURO (una vez por sesión): primera edición de UI sin design system NI brief -> bloquear y obligar a decidir.
if (!master && !hasBrief && testOnce(sid, 'front-block')) {
    try { fs.rmSync(sessionFlag(sid, 'front'), { force: true }); } catch {}   // el reintento recibirá el aviso contextual
    process.stderr.write('[BLOQUEADO por dev-standards] Primera edicion de UI sin design-system/*/MASTER.md NI plan/brief.md.\n');
    process.stderr.write('Antes de tocar UI: (1) pregunta al usuario (entrevista /brief: marca, referencias, objetivo) y genera el design system, O (2) si es un arreglo trivial en algo ya construido, dilo explicitamente y reintenta la edicion: este muro solo salta UNA vez por sesion.\n');
    process.exit(2);
}
const dsMsg = master
    ? `Lee primero el design system del proyecto: ${master}.`
    : !hasBrief
        ? 'No hay design system NI brief: ANTES de maquetar PREGUNTA al usuario (entrevista de ui-ux-pro-max references/es/brief-discovery.md o comando /brief): si tiene logo/colores/manual de marca, 2-3 webs que le gusten y que debe hacer el visitante. Con eso genera y persiste el design system (search.py --design-system --persist). Si el usuario no responde, decide por el playbook de su negocio (business-playbooks.md) y documentalo como decision propia.'
        : `Hay brief pero no design-system/*/MASTER.md: generalo antes de maquetar: py -3 ${skillsDir}/ui-ux-pro-max/scripts/search.py "<producto industria keywords>" --design-system -p "<Proyecto>" --persist -o .  (python3 fuera de Windows). Si hay plan, es la primera tarjeta de UI.`;
const ctx = `Vas a editar UI (${path.basename(file)}). Aplica la skill ui-ux-pro-max (lee su SKILL.md si no lo has hecho en esta sesion; si esta instalada la skill front-activation, empieza por ella para detectar el stack). ${dsMsg} Reglas duras: contraste 4.5:1, estados hover/focus/disabled/loading/empty/error, 375/768/1440 px sin scroll horizontal, prefers-reduced-motion, iconos SVG del set fijado en el MASTER (nunca emojis), tokens en vez de valores sueltos, y NADA de la lista negra anti-IA (references/es/anti-ia.md: badges de disponibilidad, numeracion de secciones, trusted-by gris, metricas inventadas).`;
outHookJson('PreToolUse', { additionalContext: ctx });
process.exit(0);
