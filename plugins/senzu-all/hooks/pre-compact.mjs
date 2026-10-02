// Hook PreCompact: re-inyecta lo que no debe perderse al compactar el contexto: stack/perfil, design system,
// devlog de hoy, rama y protocolo de carga de skills. No bloquea.

import fs from 'node:fs';
import path from 'node:path';
import {
    readHookInput, projectRoot, getMarker, designSystemMaster, todayDevlog, gitBranch, planStatus, devlogNextNumber, outHookJson, pad3, detectVersions, bloqueMemoria, ruta, rutaRel, textoLogos,
} from './lib.mjs';

readHookInput();
const root = projectRoot();
const DL = rutaRel(root, 'devlog'), PL = rutaRel(root, 'plan'), DS = rutaRel(root, 'design-system'), CV = rutaRel(root, 'conventions.md');   // rutas reales (senzu/ o antiguas)
const marker = getMarker(root);
const L = ['[senzu] Conserva tras la compactacion:'];
if (marker) L.push(`- Stack ${marker.stack}` + (marker.frontProfile ? ` | perfil de front: ${marker.frontProfile.label}` : ''));
const versions = detectVersions(root);
if (versions.length) L.push(`- Versiones: ${versions.map(v => `${v.name} ${v.spec}`).join(', ')} (practicas de ESAS versiones)`);
if (fs.existsSync(ruta(root, 'conventions.md'))) L.push(`- Convenciones adoptadas: ${rutaRel(root, 'conventions.md')} (inmutables, ganan a tus preferencias)`);
const ds = designSystemMaster(root); if (ds) L.push(`- Design system: ${ds}`);
const logos = textoLogos(root); if (logos) L.push('- ' + logos);
const today = todayDevlog(root); if (today.length) L.push(`- Devlog de hoy: ${today.join(', ')} (sigue numerando desde ahi)`);
const b = gitBranch(root); if (b) L.push(`- Rama git: ${b}`);
const plan = planStatus(root);
if (plan.exists) L.push(`- Plan: ${PL}/PLAN.md (${plan.done}/${plan.total})` + (plan.doing.length ? ` | en curso: ${plan.doing.join('; ')}` : ''));
L.push(`- Siguiente numero de devlog: ${pad3(devlogNextNumber(root))}`);
L.push(...bloqueMemoria(root, 40));
L.push('- Reglas: sin git push ni operaciones destructivas sin aprobacion; commits Conventional sin co-autor; devlog antes de cerrar.');
L.push('- Skills: una por tarea, solo su seccion de lectura minima; upstream y references por secciones.');
outHookJson('PreCompact', { additionalContext: L.join('\n') });
process.exit(0);
