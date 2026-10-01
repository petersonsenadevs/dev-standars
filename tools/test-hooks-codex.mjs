#!/usr/bin/env node
// Suite de compatibilidad con Codex y del formateo seguro.
// Codex manda las ediciones como tool_name "apply_patch" con el parche en tool_input.command y la raíz del
// proyecto en "cwd" (sin CLAUDE_PROJECT_DIR); el Stop tiene que responder siempre en JSON. Aquí se comprueba
// que los muros funcionan igual que en Claude con esa forma de entrada, y que format-on-save no impone estilos.
//   node tools/test-hooks-codex.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = path.join(ROOT, 'core', 'hooks');
let casos = 0, fallos = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };
// Clave de prueba montada por partes: escrita entera, el propio muro de secretos bloquea este archivo
const CLAVE = ['sk', 'live', '51Hx9aZbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd'].join('_');

const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-codex-'));
const w = (rel, txt) => { const f = path.join(proj, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); return f; };
w('CLAUDE.md', '<!-- GENERADO por dev-standards -->\n# reglas\n');
w('src/app.js', "const a = 1\nexport default a\n");
w('database/migrations/2026_01_01_000000_create_pedidos.php', [
    '<?php', 'return new class extends Migration {', '    public function up(): void', '    {',
    "        Schema::table('pedidos', function (Blueprint $t) {", "            $t->string('nota')->nullable();", '        });', '    }',
    '    public function down(): void', '    {', "        Schema::table('pedidos', function (Blueprint $t) {", "            $t->dropColumn('nota');", '        });', '    }', '};', ''].join('\n'));
w('devlog/MEMORIA.md', '# Memoria\n\n## Decisiones vigentes\n- D-001 · Pagos con Checkout · ver 001\n');
w('devlog/2026-01-01/001-inicio.md', '# 001 — Inicio\n\n## Próximos pasos\n- Revisar pagos.\n');

// Codex: sin CLAUDE_PROJECT_DIR, raíz en "cwd"
const envCodex = { ...process.env }; delete envCodex.CLAUDE_PROJECT_DIR;
const hook = (nombre, input, { env = envCodex, cwd = os.tmpdir() } = {}) =>
    spawnSync(process.execPath, [path.join(HOOKS, nombre)], { input: JSON.stringify(input), encoding: 'utf8', env, cwd, timeout: 60000 });
const parche = (cuerpo) => ({ session_id: 'cx-' + Math.random().toString(36).slice(2, 8), cwd: proj, hook_event_name: 'PreToolUse',
    tool_name: 'apply_patch', tool_input: { command: `*** Begin Patch\n${cuerpo}\n*** End Patch` } });

// ---------------------------------------------------------------- muros con apply_patch
{
    const r = hook('secrets-guard.mjs', parche(`*** Add File: src/config.js\n+export const KEY = "${CLAVE}"`));
    ok(r.status === 2, 'secrets-guard bloquea un secreto en un archivo nuevo (Add File)', `exit ${r.status} ${r.stderr.slice(0, 120)}`);
}
{
    const r = hook('protect-files.mjs', parche('*** Update File: CLAUDE.md\n@@\n # reglas\n+- nueva regla'));
    ok(r.status === 2, 'protect-files bloquea editar CLAUDE.md generado', `exit ${r.status} ${r.stderr.slice(0, 120)}`);
}
{
    const r = hook('protect-files.mjs', parche('*** Delete File: CLAUDE.md'));
    ok(r.status === 2, 'protect-files bloquea BORRAR un archivo generado (Delete File)', `exit ${r.status}`);
}
{   // varios archivos: el primero limpio, el segundo con basura de depuración
    const r = hook('code-hygiene.mjs', parche('*** Update File: src/app.js\n@@\n const a = 1\n+const b = 2\n export default a\n*** Add File: src/util.js\n+export function f(x) {\n+    console.log(x)\n+    return x\n+}'));
    ok(r.status === 2 && /console/.test(r.stderr), 'code-hygiene revisa TODOS los archivos de un parche (el 2º trae console.log)', `exit ${r.status} ${r.stderr.slice(0, 120)}`);
}
{
    const r = hook('code-hygiene.mjs', parche('*** Update File: src/app.js\n@@\n const a = 1\n+const b = a + 1\n export default a'));
    ok(r.status === 0, 'parche limpio pasa sin ruido', `exit ${r.status} ${r.stderr.slice(0, 120)}`);
}
{   // backend-guard reconstruye el archivo real a partir del parche
    const r = hook('backend-guard.mjs', parche("*** Update File: database/migrations/2026_01_01_000000_create_pedidos.php\n@@\n         Schema::table('pedidos', function (Blueprint $t) {\n             $t->string('nota')->nullable();\n+            $t->dropColumn('telefono');\n         });"));
    ok(r.status === 2, 'backend-guard bloquea dropColumn introducido en up() vía parche', `exit ${r.status} ${r.stderr.slice(0, 150)}`);
}
{   // diff unificado con una línea borrada que empieza por "--" (comentario SQL): no es una cabecera
    const input = { session_id: 'cx-u', cwd: proj, tool_name: 'apply_patch', tool_input: { command:
        '--- a/db/seed.sql\n+++ b/db/seed.sql\n@@ -1,2 +1,2 @@\n--- comentario viejo\n+-- comentario nuevo\n INSERT INTO t VALUES (1);\n' } };
    w('db/seed.sql', '-- comentario viejo\nINSERT INTO t VALUES (1);\n');
    const r = hook('protect-files.mjs', input);
    ok(r.status === 0, 'diff unificado: "--- comentario" borrado no se toma por cabecera de archivo', `exit ${r.status} ${r.stderr.slice(0, 120)}`);
    const r2 = hook('secrets-guard.mjs', { ...input, tool_input: { command: `--- a/src/pagos.js\n+++ b/src/pagos.js\n@@ -1 +1,2 @@\n const x = 1\n+const STRIPE_SECRET = "${CLAVE}"\n` } });
    ok(r2.status === 2, 'diff unificado: secreto añadido se detecta', `exit ${r2.status}`);
}
{   // Bash en Codex: misma forma que Claude
    const r = hook('guard.mjs', { session_id: 'cx-b', cwd: proj, tool_name: 'Bash', tool_input: { command: 'git push origin main' } });
    ok(r.status === 2, 'guard bloquea git push desde Codex', `exit ${r.status}`);
}

// ---------------------------------------------------------------- contexto con "cwd" (sin CLAUDE_PROJECT_DIR)
{
    const r = hook('session-start.mjs', { session_id: 'cx-ss', cwd: proj, hook_event_name: 'SessionStart' });
    let j = null; try { j = JSON.parse(r.stdout); } catch {}
    ok(j && /D-001/.test(j.hookSpecificOutput.additionalContext), 'session-start usa el cwd de Codex (memoria del proyecto correcto)', r.stdout.slice(0, 200));
}

// ---------------------------------------------------------------- Stop: SIEMPRE JSON (Codex rechaza texto plano)
{
    const salidas = [
        hook('stop-guard.mjs', { session_id: 'cx-st1-' + Date.now(), cwd: proj, hook_event_name: 'Stop' }),
        hook('stop-guard.mjs', { session_id: 'cx-st2-' + Date.now(), cwd: proj, hook_event_name: 'Stop', stop_hook_active: true }),
    ];
    const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-codex-vacio-'));
    salidas.push(hook('stop-guard.mjs', { session_id: 'cx-st3-' + Date.now(), cwd: vacio, hook_event_name: 'Stop' }));
    salidas.forEach((r, i) => {
        const out = r.stdout.trim();
        let valido = !out; if (out) { try { JSON.parse(out); valido = true; } catch {} }
        ok(r.status === 0 && valido, `stop-guard responde JSON válido (caso ${i + 1})`, out.slice(0, 120));
    });
}

// ---------------------------------------------------------------- format-on-save no impone estilos
const fake = path.join(proj, 'node_modules', '.bin');
fs.mkdirSync(fake, { recursive: true });
// "Prettier" falso: añade punto y coma a TODAS las líneas que no lo tengan (lo que hacía el real sin config)
w('tools-fake/prettier.mjs', "import fs from 'node:fs';\nconst f = process.argv[process.argv.length - 1];\nconst t = fs.readFileSync(f, 'utf8').split('\\n').map(l => l.trim() && !/[;{}]$/.test(l) ? l + ';' : l).join('\\n');\nfs.writeFileSync(f, t);\n");
fs.writeFileSync(path.join(fake, 'prettier.cmd'), `@node "${path.join(proj, 'tools-fake', 'prettier.mjs')}" %*\r\n`);
fs.writeFileSync(path.join(fake, 'prettier'), `#!/bin/sh\nnode "${path.join(proj, 'tools-fake', 'prettier.mjs')}" "$@"\n`, { mode: 0o755 });
w('.claude/hooks/config.json', JSON.stringify({ formatters: { '.js': 'npx prettier --write {file}' } }));
const original = Array.from({ length: 40 }, (_, i) => `const v${i} = ${i}`).join('\n') + '\n';
const editar = (sid, nueva) => {
    const f = w('src/chat.js', original.replace('const v3 = 3', nueva));
    return hook('format-on-save.mjs', { session_id: sid, cwd: proj, hook_event_name: 'PostToolUse', tool_name: 'Edit',
        tool_input: { file_path: f, old_string: 'const v3 = 3', new_string: nueva } }, { env: { ...envCodex, CLAUDE_PROJECT_DIR: proj } });
};
{
    const r = editar('fmt-a', 'const v3 = 33');
    const t = fs.readFileSync(path.join(proj, 'src/chat.js'), 'utf8');
    ok(!t.includes(';'), 'SIN .prettierrc: Prettier no se ejecuta (cero punto y coma añadidos)', `${(t.match(/;/g) || []).length} ; | ${r.stdout.slice(0, 120)}`);
}
w('.prettierrc', '{ "semi": true }\n');
{
    const sid = 'fmt-b-' + Date.now();
    const r = editar(sid, 'const v3 = 33');
    const t = fs.readFileSync(path.join(proj, 'src/chat.js'), 'utf8');
    ok(!t.includes(';') && /DESHECHO/.test(r.stdout), 'CON .prettierrc pero archivo con otro estilo: 40 líneas cambiadas por 1 editada -> se deshace', `${(t.match(/;/g) || []).length} ; | ${r.stdout.slice(0, 160)}`);
    const r2 = editar(sid, 'const v3 = 333');
    ok(!r2.stdout.trim() && !fs.readFileSync(path.join(proj, 'src/chat.js'), 'utf8').includes(';'), 'tras deshacer, el formateador queda apagado para .js en la sesión', r2.stdout.slice(0, 120));
}
{   // archivo que YA sigue el estilo: el formateo solo toca la línea editada -> se aplica
    const conPuntoYComa = original.split('\n').map(l => l ? l + ';' : l).join('\n');
    const f = w('src/ok.js', conPuntoYComa.replace('const v3 = 3;', 'const v3 = 33'));
    const r = hook('format-on-save.mjs', { session_id: 'fmt-c-' + Date.now(), cwd: proj, tool_name: 'Edit',
        tool_input: { file_path: f, old_string: 'const v3 = 3;', new_string: 'const v3 = 33' } }, { env: { ...envCodex, CLAUDE_PROJECT_DIR: proj } });
    const t = fs.readFileSync(f, 'utf8');
    ok(t.includes('const v3 = 33;') && /formateado/.test(r.stdout), 'archivo con el mismo estilo: el formateo se aplica y avisa de releer', r.stdout.slice(0, 160));
}
{   // Ruff sin configuración: no se ejecuta aunque esté en config.json
    w('.claude/hooks/config.json', JSON.stringify({ formatters: { '.py': 'ruff format {file}' } }));
    const f = w('app/main.py', 'x=1\n');
    const r = hook('format-on-save.mjs', { session_id: 'fmt-d', cwd: proj, tool_name: 'Write', tool_input: { file_path: f, content: 'x=1\n' } }, { env: { ...envCodex, CLAUDE_PROJECT_DIR: proj } });
    ok(!r.stdout.trim() && fs.readFileSync(f, 'utf8') === 'x=1\n', 'ruff sin ruff.toml ni [tool.ruff]: no formatea', r.stdout.slice(0, 120));
}

fs.rmSync(proj, { recursive: true, force: true });
console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
