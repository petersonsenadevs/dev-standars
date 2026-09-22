// Hook PreToolUse (Edit|Write|MultiEdit): bloquea escribir secretos en el código.
// Analiza el contenido que se va a escribir (content / new_string / edits[].new_string) y deniega (exit 2)
// si encuentra patrones de credenciales reales: claves AWS, tokens GitHub/GitLab/Slack/Stripe/OpenAI/Anthropic,
// claves privadas PEM, JWT largos, cadenas de conexión con password, Google API keys.
// Ignora placeholders obvios (xxx, your-, example, changeme, <...>, ${...}, env('...'), process.env, os.environ).

import { readHookInput } from './lib.mjs';

const p = readHookInput();
if (!p || !['Edit', 'Write', 'MultiEdit'].includes(p.tool_name)) process.exit(0);

const texts = [];
const ti = p.tool_input || {};
if (ti.content) texts.push(String(ti.content));
if (ti.new_string) texts.push(String(ti.new_string));
if (ti.edits) for (const e of ti.edits) if (e && e.new_string) texts.push(String(e.new_string));
if (!texts.length) process.exit(0);
const text = texts.join('\n');

// Archivos de ejemplo/plantilla no se analizan
const file = ti.file_path ? String(ti.file_path) : '';
if (/\.(example|sample|template|dist)$|(^|[\\/])\.env\.example$/i.test(file)) process.exit(0);

// Patrones case-sensitive salvo los marcados (paridad con [regex]::Matches de PowerShell)
const patterns = [
    { n: 'AWS Access Key',        p: /\bAKIA[0-9A-Z]{16}\b/g },
    { n: 'GitHub token',          p: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/g },
    { n: 'GitLab token',          p: /\bglpat-[A-Za-z0-9\-_]{20,}\b/g },
    { n: 'Slack token',           p: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g },
    { n: 'Stripe key',            p: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}\b/g },
    { n: 'Anthropic key',         p: /\bsk-ant-[A-Za-z0-9_\-]{32,}\b/g },
    { n: 'OpenAI key',            p: /\bsk-(proj-)?[A-Za-z0-9_\-]{32,}\b/g },
    { n: 'Google API key',        p: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
    { n: 'Clave privada PEM',     p: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
    { n: 'Cadena de conexion con password', p: /\b(mysql|postgres(ql)?|mongodb(\+srv)?|redis|amqp):\/\/[^:\s/]+:[^@\s]{6,}@/gi },
    { n: 'JWT',                   p: /\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\b/g },
    { n: 'Asignacion de secreto literal', p: /\b(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["'][A-Za-z0-9/+_\-.=]{20,}["']/gi },
];
const placeholder = /(xxx|your[-_]|example|changeme|placeholder|<[^>]+>|\$\{[^}]+\}|env\(|process\.env|os\.environ|getenv|import\.meta\.env|\bdummy\b|\bfake\b|\btest[-_]?key\b|\*{4,}|0{8,}|1{8,})/i;

for (const pt of patterns) {
    for (const m of text.matchAll(pt.p)) {
        const start = Math.max(0, m.index - 40);
        const ctx = text.substring(start, start + Math.min(120, text.length - start));
        if (placeholder.test(ctx)) continue;
        process.stderr.write(`[BLOQUEADO por dev-standards] Parece que vas a escribir un secreto real (${pt.n}) en el codigo.\n`);
        process.stderr.write('Usa variables de entorno (.env, config) y nunca commitees credenciales. Si es un valor de ejemplo, usa un placeholder claro (xxx, your-key, <API_KEY>).\n');
        process.exit(2);
    }
}
process.exit(0);
