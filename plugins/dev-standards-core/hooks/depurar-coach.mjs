// Hook PostToolUse (Bash|PowerShell): cuando un comando de tests, build o verificación FALLA mientras se
// construye algo, le recuerda al agente el método de la skill depurar (reproducir → test que falla →
// hipótesis → acotar → arreglar la causa) antes de que empiece a cambiar cosas al azar.
// Informa, no bloquea. Máximo una vez cada 20 minutos por sesión (no molesta en cada fallo del ciclo).

import fs from 'node:fs';
import { readHookInput, sessionFlag, outHookJson } from './lib.mjs';

const p = readHookInput();
if (!p || !['Bash', 'PowerShell'].includes(p.tool_name)) process.exit(0);
const cmd = String((p.tool_input && p.tool_input.command) || '');
const esVerificacion = /\b(test|tests|pest|phpunit|vitest|jest|pytest|go\s+test|dotnet\s+test|mvn|gradle|artisan\s+test|tsc|build|lint|verify-build|phpstan|mypy|ruff)\b/i.test(cmd);
if (!esVerificacion) process.exit(0);

const r = p.tool_response || {};
const salida = typeof r === 'string' ? r : [r.stdout, r.stderr, r.output, r.error].filter(Boolean).join('\n');
const fallo = /(\bFAIL(ED|URES?)?\b|\b\d+\s+(failed|failing|errors?)\b|Tests?:\s+\d+\s+failed|AssertionError|Traceback \(most recent call last\)|\bError:\s|\bException\b|✗|×\s|exit code [1-9]|Build failed|ERR!)/i.test(salida);
if (!fallo) process.exit(0);

const flag = sessionFlag(p.session_id || 'default', 'depurar-coach');
try {
    const ultimo = fs.statSync(flag).mtimeMs;
    if (Date.now() - ultimo < 20 * 60 * 1000) process.exit(0);
} catch {}
try { fs.writeFileSync(flag, ''); } catch {}

outHookJson('PostToolUse', {
    additionalContext: '[dev-standards] Ha fallado una verificación. Antes del siguiente cambio aplica la skill depurar: '
        + '(1) lee el error completo desde la primera línea de código propio, (2) reprodúcelo con el test más pequeño que falle, '
        + '(3) escribe UNA hipótesis, (4) acota hasta aislar dónde nace, (5) arregla la causa con el cambio mínimo. '
        + 'Un cambio cada vez, test después de cada uno; tras tres intentos fallidos, para y replantea la hipótesis. '
        + 'No toques el test para que pase ni silencies el error.',
});
process.exit(0);
