// Hook PreCompact: re-inyecta lo que no debe perderse al compactar el contexto: stack/perfil, design system,
// devlog de hoy, rama y protocolo de carga de skills. No bloquea.

import {
    readHookInput, projectRoot, getMarker, designSystemMaster, todayDevlog,
    gitBranch, planStatus, devlogNextNumber, outHookJson, pad3,
} from './lib.mjs';

readHookInput();
const root = projectRoot();
const marker = getMarker(root);
const L = ['[dev-standards] Conserva tras la compactacion:'];
if (marker) L.push(`- Stack ${marker.stack}` + (marker.frontProfile ? ` | perfil de front: ${marker.frontProfile.label}` : ''));
const ds = designSystemMaster(root); if (ds) L.push(`- Design system: ${ds}`);
const today = todayDevlog(root); if (today.length) L.push(`- Devlog de hoy: ${today.join(', ')} (sigue numerando desde ahi)`);
const b = gitBranch(root); if (b) L.push(`- Rama git: ${b}`);
const plan = planStatus(root);
if (plan.exists) L.push(`- Plan: plan/PLAN.md (${plan.done}/${plan.total})` + (plan.doing.length ? ` | en curso: ${plan.doing.join('; ')}` : ''));
L.push(`- Siguiente numero de devlog: ${pad3(devlogNextNumber(root))}`);
L.push('- Reglas: sin git push ni operaciones destructivas sin aprobacion; commits Conventional sin co-autor; devlog antes de cerrar.');
L.push('- Skills: una por tarea, solo su seccion de lectura minima; upstream y references por secciones.');
outHookJson('PreCompact', { additionalContext: L.join('\n') });
process.exit(0);
