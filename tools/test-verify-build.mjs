#!/usr/bin/env node
// Suite de code-quality/scripts/verify-build.mjs: proyectos simples y monorepos (sin package.json en la raíz,
// varios lenguajes, workspaces de pnpm/npm), selección por cambios de git, nombres de script alternativos,
// herramientas no instaladas (SKIP, no FAIL) y fallos reales (FAIL).
//   node tools/test-verify-build.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VB = path.join(ROOT, 'core', 'skills', 'code-quality', 'scripts', 'verify-build.mjs');
let casos = 0, fallos = 0;
const ok = (c, n, d = '') => { casos++; if (!c) { fallos++; console.log(`FAIL ${n}${d ? ' -> ' + d : ''}`); } };
const nuevo = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ds-vb-'));
const w = (base, rel, txt) => { const f = path.join(base, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof txt === 'string' ? txt : JSON.stringify(txt, null, 2)); };
const run = (cwd, ...a) => { const r = spawnSync(process.execPath, [VB, ...a], { cwd, encoding: 'utf8', timeout: 120000 }); return { code: r.status, out: r.stdout + r.stderr }; };
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
const OK = 'node -e "process.exit(0)"', MAL = 'node -e "console.error(\'error de tipos en x.ts\');process.exit(2)"';

// ---------------------------------------------------------------- monorepo políglota (Next + Python con uv + Go)
const m = nuevo();
w(m, 'pnpm-workspace.yaml', 'packages:\r\n  - "apps/web"\r\n  - "packages/*" # comentario\r\n');
w(m, 'pnpm-lock.yaml', '');
w(m, 'apps/web/package.json', { name: 'web', scripts: { lint: OK, 'type-check': OK, build: OK } });
w(m, 'packages/ui/package.json', { name: 'ui', scripts: { lint: OK, test: 'echo "Error: no test specified" && exit 1' } });
w(m, 'apps/api/pyproject.toml', '[project]\nname = "api"\n\n[tool.ruff]\nline-length = 100\n\n[tool.mypy]\nstrict = true\n\n[tool.pytest.ini_options]\ntestpaths = ["tests"]\n');
w(m, 'apps/api/uv.lock', '');
fs.mkdirSync(path.join(m, 'apps/api/src'), { recursive: true });
w(m, 'apps/rules/pyproject.toml', '[project]\nname = "rules"\n\n[tool.mypy]\nstrict = true\npackages = ["rules"]\n');
w(m, 'apps/cli/go.mod', 'module example.com/cli\n\ngo 1.22\n');
w(m, 'docs/notas.md', '# notas\n');
{
    const r = run(m, '--todos', '--plan');
    ok(/Monorepo: apps\/api, apps\/cli, apps\/rules, apps\/web, packages\/ui/.test(r.out), 'detecta los 5 paquetes sin package.json en la raíz', r.out.slice(0, 300));
    ok(/apps\/web · lint: pnpm run lint/.test(r.out), 'web con pnpm (por el lockfile de la raíz)', r.out);
    ok(/apps\/web · types: pnpm run type-check/.test(r.out), 'script "type-check" (con guion) cuenta como types', r.out);
    ok(/apps\/api · lint: uv run ruff check \./.test(r.out) && /apps\/api · test: uv run pytest -q/.test(r.out), 'Python con uv: ruff y pytest según su pyproject', r.out);
    ok(/apps\/api · types: uv run mypy src/.test(r.out), 'mypy sobre src/ si la config no dice qué revisar', r.out);
    ok(/apps\/rules · types: mypy$/m.test(r.out), 'mypy sin rutas si la config declara packages (no la pisa con ".")', r.out);
    ok(/apps\/cli · lint: go vet \.\/\.\.\./.test(r.out) && /apps\/cli · test: go test/.test(r.out), 'Go: go vet y go test', r.out);
    ok(!/packages\/ui · test/.test(r.out), 'el test de relleno de npm ("no test specified") no se ejecuta', r.out);
    ok(/packages\/ui · lint/.test(r.out), 'paquete del glob packages/* incluido', r.out);
}
{
    const r = run(m, '--todos', '--sin-build', '--plan');
    ok(!/· build:/.test(r.out), '--sin-build quita el build', r.out);
}
{
    const r = run(m, '--paquete', 'apps/web');
    ok(r.code === 0 && /PASS  apps\/web · lint/.test(r.out) && /PASS  apps\/web · types/.test(r.out) && !/apps\/api/.test(r.out.split('Resumen')[1] || ''), '--paquete ejecuta solo ese paquete', r.out.slice(-400));
}
{
    const r = run(m, '--paquete', 'apps/noexiste');
    ok(r.code === 2 && /No encuentro el paquete/.test(r.out) && /apps\/web/.test(r.out), '--paquete inexistente: aviso con la lista de paquetes', r.out.slice(0, 200));
}
// selección por cambios de git
git(m, 'init', '-q'); git(m, 'config', 'user.email', 't@t'); git(m, 'config', 'user.name', 't'); git(m, 'add', '.'); git(m, 'commit', '-qm', 'chore: base');
{
    w(m, 'apps/web/src/page.tsx', 'export default 1\n');
    const r = run(m, '--plan');
    ok(/Monorepo: apps\/web \(los paquetes con cambios/.test(r.out), 'con cambios solo en la web, verifica solo la web', r.out.slice(0, 200));
    fs.rmSync(path.join(m, 'apps/web/src'), { recursive: true });
}
{
    w(m, 'docs/notas.md', '# notas cambiadas\n'); w(m, 'devlog/2026-10-01/015-x.md', '# 015\n');
    const r = run(m);
    ok(r.code === 0 && /no tocan ningún paquete ni código/.test(r.out), 'solo docs y devlog cambiados: nada que verificar, en verde (caso real en un monorepo)', r.out.slice(0, 200));
    git(m, 'checkout', '-q', '--', 'docs/notas.md'); fs.rmSync(path.join(m, 'devlog'), { recursive: true });
}
{   // lo que reescribe el instalador (.claude/hooks/*.mjs, .agents/skills/...) no es código del proyecto
    w(m, '.claude/hooks/stop-guard.mjs', 'export {}\n'); w(m, '.agents/skills/code-quality/scripts/verify-build.mjs', 'export {}\n');
    const r = run(m);
    ok(r.code === 0 && /no tocan ningún paquete ni código/.test(r.out), 'cambios solo en .claude/ y .agents/: no lanza todo el monorepo (caso real en un monorepo)', r.out.slice(0, 200));
    fs.rmSync(path.join(m, '.claude'), { recursive: true }); fs.rmSync(path.join(m, '.agents'), { recursive: true });
}
{
    w(m, 'tsconfig.base.json', '{}');
    const r = run(m, '--plan');
    ok(/Monorepo: apps\/api, apps\/cli, apps\/rules, apps\/web, packages\/ui/.test(r.out), 'cambio en configuración compartida de la raíz: verifica todos', r.out.slice(0, 200));
    fs.rmSync(path.join(m, 'tsconfig.base.json'));
}
{   // fallo real en un paquete con npm (ejecutable en cualquier máquina)
    const n = nuevo();
    w(n, 'package.json', { name: 'raiz', private: true, workspaces: ['apps/*'] });
    w(n, 'package-lock.json', '{}');
    w(n, 'apps/web/package.json', { name: 'web', scripts: { lint: OK, typecheck: MAL } });
    w(n, 'apps/admin/package.json', { name: 'admin', scripts: { lint: OK } });
    const r = run(n, '--todos');
    ok(r.code === 1 && /FAIL  apps\/web · types/.test(r.out) && /error de tipos en x\.ts/.test(r.out), 'fallo real en un paquete: FAIL con su salida y exit 1', r.out.slice(-500));
    ok(/PASS  apps\/admin · lint/.test(r.out), 'los demás paquetes se verifican igualmente', r.out.slice(-500));
    ok(/apps\/web · lint: npm run lint/.test(run(n, '--todos', '--plan').out), 'workspaces de npm en package.json + package-lock: npm run', '');
}
{   // herramienta que no existe: SKIP con motivo, no FAIL
    const n = nuevo();
    w(n, 'apps/svc/pyproject.toml', '[project]\nname="svc"\n\n[tool.ruff]\n');
    w(n, 'apps/svc/package.json', { name: 'svc', scripts: { lint: 'herramienta-que-no-existe-xyz --check' } });
    const r = run(n, '--todos');
    ok(r.code === 0 && /SKIP  apps\/svc · lint/.test(r.out), 'comando inexistente: SKIP (no configurado), no FAIL', r.out.slice(-400));
}
{   // proyecto simple: sigue mandando config.json
    const s = nuevo();
    w(s, 'package.json', { name: 's', scripts: { lint: MAL } });
    w(s, '.claude/hooks/config.json', { commands: { lint: OK } });
    const r = run(s);
    ok(r.code === 0 && /PASS  lint/.test(r.out) && !/Monorepo/.test(r.out), 'proyecto simple: usa los comandos de config.json', r.out.slice(-300));
}
{   // sin nada que verificar
    const v = nuevo();
    const r = run(v);
    ok(r.code === 2 && /No hay comandos que ejecutar/.test(r.out), 'carpeta sin manifiestos: aviso y código 2', r.out);
}

console.log(`Casos: ${casos}  Fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
