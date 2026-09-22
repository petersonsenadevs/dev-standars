// Hook PostToolUse (Edit|Write|MultiEdit): marca que la sesión ha editado CÓDIGO fuente.
// Toca el flag por-proyecto "codeedit". stop-guard lo compara con el flag "verified" que escribe
// code-quality/scripts/verify-build.mjs: si hay ediciones posteriores a la última verificación,
// bloquea el cierre pidiendo ejecutar la verificación (build/lint/types/tests del stack).

import fs from 'node:fs';
import { readHookInput, projectRoot, projectFlag } from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);
const file = p.tool_input && p.tool_input.file_path ? String(p.tool_input.file_path) : '';
if (!file) process.exit(0);
if (!/\.(php|ts|tsx|js|jsx|mjs|cjs|py|vue|astro|svelte|css|scss|html|blade\.php|json)$/i.test(file)) process.exit(0);
if (/(devlog|plan|design-system)[\\/]|package-lock\.json|\.dev-standards\.json/i.test(file)) process.exit(0);
try { fs.writeFileSync(projectFlag(projectRoot(), 'codeedit'), ''); } catch {}
process.exit(0);
