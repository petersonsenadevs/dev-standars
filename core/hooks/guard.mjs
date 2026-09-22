// Hook PreToolUse para Claude Code. Bloquea acciones prohibidas:
// git push, borrados/alteraciones destructivas de BD, resets destructivos, rm -rf peligrosos,
// comandos devops/linux peligrosos (curl|bash, chmod 777, dd a discos, mkfs, prune forzado...).
//
// Claude Code invoca este script pasando por STDIN un JSON con { tool_name, tool_input }.
// Si el comando coincide con un patrón prohibido, el hook lo DENIEGA:
//   - Escribe el motivo en STDERR
//   - Sale con código 2  (=> Claude Code bloquea la ejecución y muestra el motivo)
// Si no coincide, sale con 0 (permite continuar el flujo de permisos normal).
// Se usa como capa "inteligente" además de permissions.deny (capa simple) en settings.json.

import { execFileSync } from 'node:child_process';
import { readHookInput } from './lib.mjs';

const p = readHookInput();
if (!p) process.exit(0);
if (!['Bash', 'PowerShell'].includes(p.tool_name)) process.exit(0);

const cmd = p.tool_input && p.tool_input.command ? String(p.tool_input.command) : '';
if (!cmd.trim()) process.exit(0);
const c = cmd;

// --- Patrones prohibidos: { p: patrón; m: motivo } ---
const rules = [
    { p: /\bgit\s+push\b/i,                                   m: 'git push está prohibido sin aprobación explícita.' },
    { p: /\bgit\s+push\s+.*--force/i,                         m: 'git push --force está terminantemente prohibido.' },
    { p: /--force-with-lease/i,                               m: 'push forzado (--force-with-lease) prohibido.' },
    { p: /\bdrop\s+(database|table|schema)\b/i,               m: 'DROP DATABASE/TABLE/SCHEMA en BD requiere aprobación explícita.' },
    { p: /\btruncate\s+table\b|\btruncate\s+\w/i,             m: 'TRUNCATE en BD requiere aprobación explícita.' },
    { p: /\bdelete\s+from\s+\w+\s*(;|$)/i,                    m: 'DELETE sin WHERE requiere aprobación explícita.' },
    { p: /\bupdate\s+\w+\s+set\b(?!.*\bwhere\b)/i,            m: 'UPDATE sin WHERE requiere aprobación explícita.' },
    { p: /migrate:(fresh|refresh)/i,                          m: 'migrate:fresh/refresh es destructivo: requiere aprobación.' },
    { p: /\bdb:wipe\b/i,                                      m: 'db:wipe es destructivo: requiere aprobación.' },
    { p: /prisma\s+migrate\s+reset/i,                         m: 'prisma migrate reset es destructivo: requiere aprobación.' },
    { p: /drop_all\b|metadata\.drop_all/i,                    m: 'drop_all (SQLAlchemy) es destructivo: requiere aprobación.' },
    { p: /\bgit\s+reset\s+--hard\b/i,                         m: 'git reset --hard descarta trabajo: requiere aprobación.' },
    { p: /\bgit\s+clean\s+-\w*f/i,                            m: 'git clean -f elimina archivos no versionados: requiere aprobación.' },
    { p: /rm\s+-\w*r\w*f|rm\s+-\w*f\w*r/i,                    m: 'rm -rf requiere revisión: puede borrar de más.' },
    { p: /remove-item\s+.*-recurse.*-force|remove-item\s+.*-force.*-recurse/i, m: 'Remove-Item -Recurse -Force requiere revisión.' },
    { p: /\bnpm\s+publish\b|\bcomposer\s+.*publish\b/i,       m: 'Publicar paquetes requiere aprobación explícita.' },
    // --- devops / linux peligrosos ---
    { p: /\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/i, m: 'curl|bash ejecuta código remoto sin revisarlo: descarga el script, revísalo y ejecútalo en dos pasos.' },
    { p: /\bchmod\s+(-[a-z]+\s+)*0?777\b/i,                   m: 'chmod 777 abre el archivo a todo el mundo: usa permisos mínimos (644/755) o pide aprobación.' },
    { p: /\bdd\b[^|;&]*\bof=\/dev\//i,                        m: 'dd sobre /dev/* puede destruir un disco entero: requiere aprobación explícita.' },
    { p: /\bmkfs(\.\w+)?\b/i,                                 m: 'mkfs formatea un dispositivo (borra TODO): requiere aprobación explícita.' },
    { p: /\bdocker\s+(system|volume|image|container)\s+prune\b/i, m: 'docker prune borra recursos compartidos de la máquina (volúmenes = datos): requiere aprobación.' },
    { p: /\bsystemctl\s+(stop|disable|mask)\b/i,              m: 'Parar/deshabilitar servicios del sistema puede tumbar producción: requiere aprobación explícita.' },
    { p: /\biptables\s+(-F\b|--flush)|\bnft\s+flush\s+ruleset\b/i, m: 'Vaciar el firewall deja el servidor expuesto: requiere aprobación explícita.' },
    { p: /\bcrontab\s+-\w*r\b/i,                              m: 'crontab -r borra TODOS los cron del usuario (sin deshacer): requiere aprobación.' },
];

function deny(lines) {
    for (const l of lines) process.stderr.write(l + '\n');
    process.exit(2);
}

// --- Reglas de git commit: rama protegida, Conventional Commits, sin co-autores ---
if (/\bgit\s+commit\b/i.test(c)) {
    let branch = '';
    try { branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim(); } catch {}
    if (['main', 'master', 'develop'].includes(branch)) {
        deny([`[BLOQUEADO por dev-standards] No se commitea en '${branch}'. Crea una rama (git switch -c feat/...) y commitea ahi.`]);
    }
    if (/co-authored-by/i.test(c)) {
        deny(['[BLOQUEADO por dev-standards] Los commits no llevan Co-Authored-By (regla del equipo).']);
    }
    // Mensaje: -m "..." o -m '...'  (se valida solo el primer -m)
    let msg = null;
    let m = /-m\s+"([^"]*)"/is.exec(c);
    if (m) msg = m[1];
    else { m = /-m\s+'([^']*)'/is.exec(c); if (m) msg = m[1]; }
    if (msg) {
        const first = msg.split(/\r?\n/)[0].trim();
        if (!/^(feat|fix|refactor|docs|test|chore|perf|build|ci|style|revert)(\([\w\-\./ ]+\))?!?:\s\S/.test(first)) {
            deny([`[BLOQUEADO por dev-standards] El mensaje no sigue Conventional Commits: '${first}'. Formato: tipo(scope): descripcion  (feat|fix|refactor|docs|test|chore|perf|build|ci|style|revert).`]);
        }
        if (first.length > 72) {
            deny([`[BLOQUEADO por dev-standards] Primera linea del commit > 72 caracteres (${first.length}). Acortala y pasa el detalle al cuerpo.`]);
        }
    }
}

// --- Deploy a produccion: NUNCA sin aprobacion explicita del usuario ---
if (process.env.DEV_STANDARDS_ALLOW_DEPLOY !== '1') {
    const deployPat = /(netlify\s+deploy(?=.*--prod))|(\bvercel\b(?=.*--prod))|(\bfly\s+deploy\b)|(\bwrangler\s+(deploy|publish)\b(?!.*--env[= ](dev|preview)))/i;
    if (deployPat.test(c)) {
        deny([
            '[BLOQUEADO por dev-standards] Deploy a PRODUCCION detectado. Requiere aprobacion explicita del usuario en este momento (checklist /desplegar: backup fresco verificado + plan de rollback + smoke posterior).',
            'Con la aprobacion recibida: reintenta con DEV_STANDARDS_ALLOW_DEPLOY=1 y documenta la aprobacion y el resultado en el devlog. Los deploys de preview (sin --prod) pasan sin muro.',
        ]);
    }
}

// --- Librerias vetadas (regla dura: sin jQuery/Bootstrap ni segunda libreria de componentes sin aprobacion) ---
if (process.env.DEV_STANDARDS_ALLOW_LIB !== '1' && /\b(npm|pnpm|yarn|bun)\s+(install|add|i)\b/i.test(c)) {
    if (/\b(jquery|bootstrap)\b/i.test(c)) {
        deny([
            '[BLOQUEADO por dev-standards] jQuery/Bootstrap estan vetados por defecto (regla dura 12: se reutiliza lo que ya hay; nada de segundas librerias de componentes).',
            'Si el usuario lo aprueba explicitamente: que lo ejecute el, o reintenta con DEV_STANDARDS_ALLOW_LIB=1 en el entorno y documenta la aprobacion en el devlog.',
        ]);
    }
}

for (const r of rules) {
    if (r.p.test(c)) {
        deny([
            `[BLOQUEADO por dev-standards] ${r.m}`,
            `Comando: ${cmd}`,
            'Si de verdad quieres hacerlo, pídeme aprobación explícita y ejecútalo tú, o autorízalo para esta vez.',
        ]);
    }
}

process.exit(0);
