#!/usr/bin/env node
// Suite de permisos por proyecto y hooks apagados (.dev-standards.json -> "permisos", "hooksApagados").
// Repositorio git real en temp (main y una rama de feature) e intentos de colar lo prohibido por otras vías:
// push forzado con +rama, --force-with-lease, :rama (borrar en remoto), HEAD:main, varios comandos encadenados,
// valores "true" como texto, marcador roto, y el agente intentando darse permisos editando el marcador.
//   node tools/test-permisos.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = path.join(ROOT, 'core', 'hooks');
let casos = 0, fallos = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };

const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-permisos-'));
const git = (...a) => execFileSync('git', a, { cwd: proj, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
git('init', '-q', '-b', 'main');
git('config', 'user.email', 't@t.t'); git('config', 'user.name', 't');
fs.writeFileSync(path.join(proj, 'a.txt'), 'a\n'); git('add', '.'); git('commit', '-q', '-m', 'chore: inicio');
const marcador = (extra) => fs.writeFileSync(path.join(proj, '.dev-standards.json'), typeof extra === 'string' ? extra : JSON.stringify({ stack: 'astro', ...extra }, null, 2));
const env = { ...process.env, CLAUDE_PROJECT_DIR: proj };
const hook = (nombre, input) => spawnSync(process.execPath, [path.join(HOOKS, nombre)], { input: JSON.stringify({ session_id: 'perm-' + Date.now(), cwd: proj, ...input }), encoding: 'utf8', env, cwd: proj });
const bash = cmd => hook('guard.mjs', { tool_name: 'Bash', tool_input: { command: cmd } });
const bloquea = (cmd, nombre) => { const r = bash(cmd); ok(r.status === 2, `BLOQUEA: ${nombre}`, `exit ${r.status} :: ${cmd}`); };
const deja = (cmd, nombre) => { const r = bash(cmd); ok(r.status === 0, `DEJA: ${nombre}`, `exit ${r.status} :: ${cmd} :: ${r.stderr.slice(0, 120)}`); };

// ---------------------------------------------------------------- sin permisos (por defecto)
marcador({});
bloquea('git push origin feat/x', 'sin permisos, cualquier push');
bloquea('git commit -m "feat: algo"', 'sin permisos, commit en main');

// ---------------------------------------------------------------- push (ramas no protegidas)
marcador({ permisos: { push: true } });
deja('git push origin feat/login', 'push a una rama de feature');
deja('git push -u origin feat/login', 'push -u a una rama de feature');
bloquea('git push origin main', 'push a main sin pushMain');
bloquea('git push origin HEAD:main', 'push HEAD:main (destino main) sin pushMain');
bloquea('git push origin feat/x:master', 'push feat:master sin pushMain');
bloquea('git push', 'push sin destino estando en main (rama actual)');
bloquea('git push origin feat/x --force', 'push --force');
bloquea('git push -f origin feat/x', 'push -f');
bloquea('git push --force-with-lease origin feat/x', 'push --force-with-lease');
bloquea('git push origin +feat/x', 'push +rama (forzado con otra sintaxis)');
bloquea('git push origin :feat/x', 'push :rama (borra la rama en el remoto)');
bloquea('git push origin --delete feat/x', 'push --delete');
bloquea('git push --mirror origin', 'push --mirror');
bloquea('git push origin feat/x && git push origin main', 'dos push encadenados, el segundo a main');
bloquea('git push origin feat/x && git reset --hard HEAD~1', 'push permitido + reset --hard encadenado');
git('switch', '-q', '-c', 'feat/carrito');
deja('git push', 'push sin destino desde una rama de feature');
deja('git push --follow-tags', 'push --follow-tags desde feature');
git('switch', '-q', 'main');

// ---------------------------------------------------------------- pushMain
marcador({ permisos: { pushMain: true } });
deja('git push origin main', 'push a main con pushMain');
deja('git push --follow-tags', 'push desde main con pushMain');
deja('git push origin feat/x', 'pushMain implica push normal');
bloquea('git push --force origin main', 'push --force a main sigue bloqueado con pushMain');
bloquea('git push origin +main', 'push +main sigue bloqueado con pushMain');

// ---------------------------------------------------------------- commitEnMain
marcador({ permisos: { commitEnMain: true } });
deja('git commit -m "feat: algo en main"', 'commit en main con commitEnMain');
bloquea('git commit -m "algo sin formato"', 'commitEnMain no quita Conventional Commits');
bloquea('git commit -m "feat: x" -m "Co-Authored-By: bot <b@b>"', 'commitEnMain no permite co-autores');
bloquea('git push origin feat/x', 'commitEnMain no da permiso de push');

// ---------------------------------------------------------------- valores raros
marcador({ permisos: { push: 'true', pushMain: 1 } });
bloquea('git push origin feat/x', 'push: "true" (texto) no cuenta como permiso');
marcador('{ esto no es json');
bloquea('git push origin feat/x', 'marcador roto -> sin permisos');
marcador({ permisos: true });
bloquea('git push origin feat/x', 'permisos: true (no es objeto) -> sin permisos');

// ---------------------------------------------------------------- hooks apagados
fs.mkdirSync(path.join(proj, 'src'), { recursive: true });
const editarConsole = () => hook('code-hygiene.mjs', { tool_name: 'Write', tool_input: { file_path: path.join(proj, 'src', 'a.js'), content: 'export const f = x => { console.log(x); return x }\n' } });
marcador({});
ok(editarConsole().status === 2, 'code-hygiene encendido bloquea console.log');
marcador({ hooksApagados: ['code-hygiene'] });
ok(editarConsole().status === 0, 'code-hygiene apagado deja pasar console.log');
marcador({ hooksApagados: ['guard', 'secrets-guard', 'protect-files'] });
bloquea('git push origin feat/x', 'guard NO se puede apagar');
{
    const CLAVE = ['sk', 'live', '51Hx9aZbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd'].join('_');
    const r = hook('secrets-guard.mjs', { tool_name: 'Write', tool_input: { file_path: path.join(proj, 'src', 'k.js'), content: `const k = "${CLAVE}"\n` } });
    ok(r.status === 2, 'secrets-guard NO se puede apagar', `exit ${r.status}`);
}
{   // el agente intenta darse permisos editando el marcador (Claude y Codex)
    const r1 = hook('protect-files.mjs', { tool_name: 'Edit', tool_input: { file_path: path.join(proj, '.dev-standards.json'), old_string: '{', new_string: '{ "permisos": { "pushMain": true },' } });
    ok(r1.status === 2, 'el agente NO puede darse permisos editando .dev-standards.json (Edit)', `exit ${r1.status}`);
    const r2 = hook('protect-files.mjs', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: .dev-standards.json\n@@\n-{\n+{ "permisos": { "pushMain": true },\n*** End Patch' } });
    ok(r2.status === 2, 'ni con un parche de Codex', `exit ${r2.status}`);
    const r3 = bash(`echo '{"permisos":{"pushMain":true}}' > .dev-standards.json`);
    ok(r3.status === 2, 'ni sobrescribiéndolo desde la terminal (echo >)', `exit ${r3.status} ${r3.stderr.slice(0, 100)}`);
    for (const cmd of [
        `sed -i 's/{/{"permisos":{"push":true},/' .dev-standards.json`,
        `Set-Content .dev-standards.json '{"permisos":{"push":true}}'`,
        `cp otro.json .dev-standards.json`,
        `node -e "require('fs').writeFileSync('.dev-standards.json','{}')"`,
        `python -c "open('.dev-standards.json','w').write('{}')"`,
        `git checkout HEAD~3 -- .dev-standards.json`,
        `node tools/init.mjs --path . --permitir push-main`,
        `powershell -File tools/sync.ps1 -Path . -Permitir push-main`,
        `node tools/init.mjs --path . --apagar-hooks stop-guard`,
        `printf '%s\\n' . '' 1 1 n push-main ninguno s | node tools/init.mjs`,
        `echo push | node D:/dev-standards/tools/init.mjs`,
        `node tools/init.mjs < respuestas.txt`,
        `node tools/init.mjs --interactivo`,
    ]) {
        const r = bash(cmd);
        ok(r.status === 2, `el agente no se da permisos: ${cmd.slice(0, 60)}`, `exit ${r.status}`);
    }
    for (const cmd of ['cat .dev-standards.json', 'Get-Content .dev-standards.json 2>$null', 'grep permisos .dev-standards.json 2>&1', 'node tools/init.mjs --path . --ahorro']) {
        const r = bash(cmd);
        ok(r.status === 0, `leer el marcador o reinstalar sin tocar permisos sí: ${cmd}`, `exit ${r.status} ${r.stderr.slice(0, 100)}`);
    }
}
{   // hook apagado en una sesión de Codex (cwd sin CLAUDE_PROJECT_DIR)
    marcador({ hooksApagados: ['session-start'] });
    const e2 = { ...process.env }; delete e2.CLAUDE_PROJECT_DIR;
    const r = spawnSync(process.execPath, [path.join(HOOKS, 'session-start.mjs')], { input: JSON.stringify({ session_id: 'x', cwd: proj }), encoding: 'utf8', env: e2, cwd: os.tmpdir() });
    ok(r.status === 0 && !r.stdout.trim(), 'hook apagado también en Codex (raíz por cwd): salida vacía', r.stdout.slice(0, 100));
}

fs.rmSync(proj, { recursive: true, force: true });
console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
