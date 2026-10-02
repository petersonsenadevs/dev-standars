#!/usr/bin/env node
// Suite del «logo ya elegido»: si existe <design-system>/<slug>/logos/final/<tipo>/, ningún agente (Claude o Codex)
// hace bocetos ni variantes sin que el usuario lo pida, y lo elegido queda registrado en gustos.md y la memoria.
//   node tools/test-logos.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = path.join(ROOT, 'core', 'hooks');
let casos = 0, fallos = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };

function proyecto({ conLogo = true, registrado = true } = {}) {
    const p = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-logos-'));
    const w = (rel, txt) => { const f = path.join(p, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); return f; };
    w('senzu/senzu.json', JSON.stringify({ stack: 'astro' }));
    w('senzu/design-system/acme/MASTER.md', '# Master\n');
    w('senzu/design-system/acme/logos/generados/simbolo/A-1.png', 'png');
    if (conLogo) {
        for (const f of ['acme-symbol.svg', 'acme-symbol-black.svg', 'acme-symbol-32.png']) w(`senzu/design-system/acme/logos/final/simbolo/${f}`, '<svg/>');
    }
    w('senzu/design-system/acme/gustos.md', '# Gustos\n\n## Fijado\n| Categoría | Decisión | Valor | Desde |\n|---|---|---|---|\n'
        + (registrado ? '| Símbolo | A-3 | `logos/final/simbolo/acme-symbol.svg` | 2026-10-02 |\n' : '') + '\n## No\n');
    w('senzu/devlog/MEMORIA.md', '# Memoria\n\n## Decisiones vigentes\n' + (registrado ? '- D-007 · Símbolo fijado: A-3 · ver 006\n' : '- D-001 · Otra cosa · ver 001\n'));
    const hoy = new Date(); const f = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    w(`senzu/devlog/${f}/001-x.md`, '# 001 — x\n\n## Qué se hizo\n- algo\n');
    w('senzu/devlog/INDEX.md', '| 001 | x |\n');
    return p;
}
const env = p => { const e = { ...process.env, CLAUDE_PROJECT_DIR: p }; delete e.SENZU_ALLOW_LOGO; delete e.DEV_STANDARDS_ALLOW_LOGO; return e; };
const hook = (nombre, p, input, extraEnv = {}) => spawnSync(process.execPath, [path.join(HOOKS, nombre)], { input: JSON.stringify({ session_id: 'lg-' + Math.random().toString(36).slice(2), cwd: p, ...input }), encoding: 'utf8', env: { ...env(p), ...extraEnv }, cwd: p });
const bash = (p, cmd, e) => hook('guard.mjs', p, { tool_name: 'Bash', tool_input: { command: cmd } }, e);

const P = proyecto();
// ---------------------------------------------------------------- contexto
{
    const r = hook('session-start.mjs', P, { hook_event_name: 'SessionStart' });
    ok(/IDENTIDAD YA ELEGIDA: simbolo → senzu\/design-system\/acme\/logos\/final\/simbolo\/acme-symbol\.svg/.test(r.stdout), 'session-start: anuncia el símbolo elegido y su maestro (el .svg sin sufijo)', r.stdout.slice(0, 300));
    ok(!/sin registrar/.test(r.stdout), 'registrado en gustos y memoria: sin aviso de registro');
    const c = hook('pre-compact.mjs', P, {});
    ok(/IDENTIDAD YA ELEGIDA/.test(c.stdout), 'pre-compact: lo re-inyecta al compactar');
}
{
    for (const prompt of ['hazme unos bocetos de logo para la web', 'quiero cambiar el símbolo de la marca', 'genera el favicon']) {
        const r = hook('prompt-router.mjs', P, { prompt });
        ok(/IDENTIDAD YA ELEGIDA/.test(r.stdout), `router (sin config de router): avisa del logo elegido: "${prompt}"`, r.stdout.slice(0, 160));
    }
    const r = hook('prompt-router.mjs', P, { prompt: 'arregla el webhook de pagos del checkout' });
    ok(!/IDENTIDAD/.test(r.stdout), 'router: no habla del logo si la petición no va de eso');
}
// ---------------------------------------------------------------- muro: generadores
{
    const gen = 'py -3 .claude/skills/graphic-design/scripts/logo/generate.py --brand "Acme" --prompt "seed" --batch 4';
    ok(bash(P, gen).status === 2, 'guard: bloquea el generador de logos con logo ya elegido');
    ok(bash(P, 'python3 .agents/skills/graphic-design/scripts/icon/generate.py --prompt x').status === 2, 'guard: bloquea el generador de iconos (ruta de Codex)');
    ok(bash(P, 'node .claude/skills/image-gen/scripts/generate.mjs --prompt "logo minimalista de una semilla"').status === 2, 'guard: bloquea image-gen con un prompt de logo');
    ok(bash(P, 'node .claude/skills/image-gen/scripts/generate.mjs --prompt "foto de producto para el hero"').status === 0, 'guard: image-gen para otras imágenes sí');
    ok(bash(P, gen, { SENZU_ALLOW_LOGO: '1' }).status === 0, 'guard: con SENZU_ALLOW_LOGO=1 (pedido por el usuario) pasa');
    const sin = proyecto({ conLogo: false });
    ok(bash(sin, gen).status === 0, 'guard: sin logo elegido, generar logos está permitido');
}
// ---------------------------------------------------------------- muro: maestros
{
    const maestro = path.join(P, 'senzu/design-system/acme/logos/final/simbolo/acme-symbol.svg');
    ok(hook('protect-files.mjs', P, { tool_name: 'Write', tool_input: { file_path: maestro, content: '<svg>otro</svg>' } }).status === 2, 'protect-files: no se sobrescribe el maestro elegido (Claude)');
    ok(hook('protect-files.mjs', P, { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: senzu/design-system/acme/logos/final/simbolo/acme-symbol.svg\n@@\n-<svg/>\n+<svg>otro</svg>\n*** End Patch' } }).status === 2, 'protect-files: ni con un parche de Codex');
    ok(hook('protect-files.mjs', P, { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Delete File: senzu/design-system/acme/logos/final/simbolo/acme-symbol.svg\n*** End Patch' } }).status === 2, 'protect-files: ni borrarlo');
    ok(hook('protect-files.mjs', P, { tool_name: 'Write', tool_input: { file_path: path.join(P, 'senzu/design-system/acme/logos/final/simbolo/acme-symbol-128.png'), content: 'x' } }).status === 0, 'protect-files: añadir un tamaño nuevo al final sí');
    ok(hook('protect-files.mjs', P, { tool_name: 'Write', tool_input: { file_path: path.join(P, 'senzu/design-system/acme/logos/generados/simbolo/A-1.png'), content: 'x' } }).status === 0, 'protect-files: los bocetos (generados/) no están protegidos');
}
// ---------------------------------------------------------------- registro (el caso Codex: lo hizo y nadie lo apuntó)
{
    const N = proyecto({ registrado: false });
    const s = hook('session-start.mjs', N, {});
    ok(/logo final sin registrar/.test(s.stdout), 'session-start: avisa si el logo final no está en gustos ni en la memoria', s.stdout.slice(0, 200));
    const sid = 'lg-stop-' + Date.now();
    const r1 = hook('stop-guard.mjs', N, { session_id: sid });
    ok(/"decision":"block"/.test(r1.stdout) && /sin registrar/.test(r1.stdout), 'stop-guard: no deja cerrar sin registrar el logo (una vez)', r1.stdout.slice(0, 200));
    const r2 = hook('stop-guard.mjs', N, { session_id: sid });
    ok(!/"decision":"block"/.test(r2.stdout), 'stop-guard: solo bloquea una vez por sesión');
    const r3 = hook('stop-guard.mjs', P, { session_id: sid + 'b' });
    ok(!/sin registrar/.test(r3.stdout), 'stop-guard: registrado -> sin aviso', r3.stdout.slice(0, 160));
}

console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
