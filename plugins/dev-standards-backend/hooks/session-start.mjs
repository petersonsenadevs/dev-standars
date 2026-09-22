// Hook SessionStart: inyecta el estado del proyecto (stack, perfil de front, rama, cambios pendientes,
// design system, devlog de hoy, skills instaladas) y el protocolo de carga de skills. No bloquea.

import {
    readHookInput, projectRoot, getMarker, gitBranch, gitDirty, designSystemMaster,
    planStatus, todayDevlog, devlogNextNumber, hookConfig, outHookJson, todayStr, pad3,
} from './lib.mjs';

readHookInput();
const root = projectRoot();
const marker = getMarker(root);
const L = [];
L.push('[dev-standards] Estado del proyecto al iniciar la sesion:');
if (marker) {
    L.push(`- Stack: ${marker.stack}` + (marker.frontProfile ? ` | Perfil de front: ${marker.frontProfile.label} (stacks del buscador: ${[].concat(marker.frontProfile.stacks || []).join(', ')})` : ''));
    const inst = [].concat(marker.extraSkills || []).concat([].concat(marker.bundles || []).map(b => `bundle:${b}`));
    if (inst.length) L.push(`- Skills/bundles opcionales instalados: ${inst.join(', ')}`);
} else {
    L.push('- Sin .dev-standards.json: detecta el stack (composer.json / package.json / pyproject.toml) antes de asumir nada.');
}
const branch = gitBranch(root);
if (branch) {
    const dirty = gitDirty(root);
    const warn = ['main', 'master', 'develop'].includes(branch) ? ' -> NO commitees aqui: crea una rama primero.' : '';
    L.push(`- Git: rama '${branch}', ${dirty} archivo(s) con cambios sin commitear.${warn}`);
}
const ds = designSystemMaster(root);
if (ds) L.push(`- Design system del proyecto: ${ds} (fuente de verdad de UI).`);
else if (marker && marker.frontProfile) L.push('- No hay design-system/*/MASTER.md: genera uno con ui-ux-pro-max antes de maquetar.');
const plan = planStatus(root);
if (plan.exists) {
    L.push(`- Plan del proyecto: plan/PLAN.md (${plan.done}/${plan.total} tareas hechas).`
        + (plan.doing.length ? ` EN CURSO: ${plan.doing.join('; ')}.` : '')
        + (plan.next.length ? ` Siguientes: ${plan.next.join('; ')}.` : '')
        + ' Sigue el plan (skill project-planner, task-protocol) antes de hacer otra cosa.');
} else if (marker) {
    L.push('- No hay plan/PLAN.md: si la tarea es un proyecto o feature (no un arreglo puntual), usa la skill project-planner para crear el plan antes de codificar.');
}
const today = todayDevlog(root);
const next = devlogNextNumber(root);
L.push(today.length
    ? `- Devlog de hoy: ${today.join(', ')} (siguiente numero global: ${pad3(next)})`
    : `- Devlog de hoy: ninguno todavia; la siguiente entrada es devlog/${todayStr()}/${pad3(next)}-<slug>.md (crea la entrada antes de cerrar la tarea o commitear).`);
const cfg = hookConfig(root);
if (cfg && cfg.commands) {
    const cm = Object.entries(cfg.commands).map(([k, v]) => `${k}: ${v}`);
    if (cm.length) L.push('- Comandos del stack para verificar antes de dar algo por hecho: ' + cm.join(' | '));
}
L.push('- Puertas de entrada (empieza SIEMPRE por ellas): tarea de UI/front -> skill ui-ux-pro-max (via front-activation si dudas del stack); logica/backend -> code-quality (dominio rico: ddd-hexagonal); proyecto o feature nueva -> project-planner; duda general -> skill-router y su references/decision-trees.md.');
L.push("- Protocolo: lee UNA skill por tarea y solo su seccion de 'Lectura minima'; SKILL.upstream.md y references/ por secciones, nunca enteros.");
outHookJson('SessionStart', { additionalContext: L.join('\n') });
process.exit(0);
