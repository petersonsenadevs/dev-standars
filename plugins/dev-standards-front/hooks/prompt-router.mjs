// Hook UserPromptSubmit: detecta por palabras clave qué skill(s) instaladas encajan con la petición y lo recuerda
// UNA sola vez por skill y sesión. Reglas = core/skills-registry.json (vía config.json -> router). No bloquea.
// Fuentes de reglas (primera que exista): <proyecto>/.claude/hooks/config.json -> router,
// $CLAUDE_PLUGIN_ROOT/hooks/config.json -> router. Skills disponibles: .claude/skills del proyecto,
// skills de TODOS los plugins instalados (~/.claude/plugins/**/skills), ~/.claude/skills y config.skills.
// Una skill con mayor "priority" gana a la genérica (react-three-fiber antes que threejs-webgl).

import fs from 'node:fs';
import path from 'node:path';
import {
    readHookInput, projectRoot, hookConfig, availableSkills, designSystemMaster, testOnce, outHookJson, psRegex, ruta,
} from './lib.mjs';

const p = readHookInput();
if (!p || !p.prompt) process.exit(0);
const prompt = String(p.prompt);
if (prompt.length < 12 || /^\s*\//.test(prompt)) process.exit(0);
const root = projectRoot();
const sid = p.session_id ? String(p.session_id) : 'default';
const cfg = hookConfig(root);
if (!cfg || !cfg.router) process.exit(0);

const available = availableSkills(root, cfg);
// Entrypoints primero (ui-ux-pro-max, project-planner, skill-router), luego por prioridad descendente.
// Array.prototype.sort es estable en Node: sin la lotería de Sort-Object de PowerShell 5.1.
const rules = [].concat(cfg.router)
    .filter(r => r && r.keywords && available.includes(r.name))
    .sort((a, b) => ((b.entrypoint ? 1 : 0) - (a.entrypoint ? 1 : 0)) || ((b.priority || 0) - (a.priority || 0)));

const FrontGroups = ['front', 'motion', '3d', 'design'];
// Acentos fuera en AMBOS lados: \b de JS no es Unicode ("í" no es \w), asi que una keyword que empiece
// por vocal acentuada jamas casaria. Normalizar tambien hace el match tolerante a prompts sin tildes.
const deaccent = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const nPrompt = deaccent(prompt);
let matched = rules.filter(r => { try { return psRegex(deaccent(r.keywords)).test(nPrompt); } catch { return false; } });
if (!matched.length) process.exit(0);

// Si algo de front matchea y el proyecto no tiene design system, el entrypoint de front entra SIEMPRE primero.
let dsNote = '';
const frontHit = matched.some(r => FrontGroups.includes(r.group));
if (frontHit && available.includes('ui-ux-pro-max') && !designSystemMaster(root)) {
    if (!matched.some(r => r.name === 'ui-ux-pro-max')) {
        const entry = [].concat(cfg.router).filter(r => r.name === 'ui-ux-pro-max');
        if (entry.length) matched = [entry[0], ...matched];
    }
    dsNote = ' No hay design-system/*/MASTER.md: primero ui-ux-pro-max (design system y patron), despues el efecto o el componente.';
    if (!fs.existsSync(path.join(ruta(root, 'plan'), 'brief.md'))) {
        dsNote += ' Tampoco hay plan/brief.md: pregunta al usuario primero (marca, referencias, objetivo; entrevista /brief o brief-discovery.md) en vez de inventar la direccion visual.';
    }
}

// Máximo 2 sugerencias, una vez por skill y sesión.
const hits = [];
for (const r of matched) {
    if (hits.length >= 2) break;
    if (testOnce(sid, `router-${r.name}`)) hits.push(r.name);
}
if (!hits.length) process.exit(0);
const msg = '[dev-standards] Esta peticion parece de: ' + hits.join(', ')
    + ". Antes de actuar lee el SKILL.md de la skill que aplique (su tabla 'Lectura minima por tarea' te dice que seccion abrir); las tareas de UI empiezan SIEMPRE por ui-ux-pro-max."
    + dsNote + ' Si crees que no aplica, ignora este aviso.';
outHookJson('UserPromptSubmit', { additionalContext: msg });
process.exit(0);
