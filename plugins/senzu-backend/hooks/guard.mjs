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
import { readHookInput, projectRoot, permisosProyecto, envSenzu, textoLogos } from './lib.mjs';

const p = readHookInput();
if (!p) process.exit(0);
if (!['Bash', 'PowerShell'].includes(p.tool_name)) process.exit(0);

const cmd = p.tool_input && p.tool_input.command ? String(p.tool_input.command) : '';
if (!cmd.trim()) process.exit(0);
const c = cmd;
const root = projectRoot();
const permisos = permisosProyecto(root);
const RAMAS_PROTEGIDAS = ['main', 'master', 'develop'];
function ramaActual() {
    try { return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim(); } catch { return ''; }
}

// ¿Este git push lo permite el proyecto? (permisos en senzu/senzu.json; el forzado nunca)
// Mira CADA "git push" de la línea: destino explícito (main, HEAD:main, origin main) o, si no hay, la rama actual.
function pushPermitido() {
    if (!permisos.push) return false;
    const pushes = c.split(/&&|\|\||;|\n/).map(s => s.trim()).filter(s => /\bgit\s+push\b/i.test(s));
    for (const s of pushes) {
        const args = s.replace(/^.*?\bgit\s+push\b/i, '').trim().split(/\s+/).filter(Boolean);
        if (args.some(a => /^(-f|--force|--force-with-lease|--force-if-includes|--mirror|--delete|-d)(=|$)/i.test(a))) return false;
        const posicionales = args.filter(a => !a.startsWith('-'));
        const refspecs = posicionales.slice(1);   // el primero es el remoto
        if (refspecs.some(r => r.startsWith('+') || r.startsWith(':'))) return false;   // +rama = forzado; :rama = borrar en remoto
        const destinos = refspecs.length ? refspecs.map(r => r.split(':').pop().replace(/^refs\/heads\//, '')) : [ramaActual()];
        if (destinos.some(d => !d || RAMAS_PROTEGIDAS.includes(d)) && !permisos.pushMain) return false;
    }
    return pushes.length > 0;
}

// --- Patrones prohibidos: { p: patrón; m: motivo } ---
const rules = [
    { p: /\bgit\s+push\b/i,                                   m: 'git push está prohibido sin aprobación explícita. (Si el usuario quiere permitirlo en este proyecto: "permisos": { "push": true } en senzu/senzu.json; a main, además "pushMain": true. Lo decide el usuario, no el agente.)' },
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

// --- Los permisos y los hooks apagados los decide SOLO el usuario ---
// El agente no puede escribir el marcador (senzu/senzu.json o el antiguo .dev-standards.json) desde la terminal (redirecciones, tee, sed -i, Set-Content, cp/mv…)
// ni lanzar el instalador con los flags que dan permisos o apagan hooks: eso lo ejecuta el usuario (menú o "!").
if (/\.dev-standards\.json|\bsenzu\.json\b/i.test(c)) {
    const escribe = /(>>?|\|\s*tee\b|\btee\s|\bsed\s+(-\w*\s+)*-i|\bperl\s+(-\w*\s+)*-i|\b(set|add)-content\b|\bout-file\b|\b(cp|mv|copy-item|move-item|rm|del|remove-item|ren|rename-item)\b|writeFile|\.write\(|open\([^)]*['"]w|\bgit\s+(checkout|restore)\b)/i;
    if (escribe.test(c.replace(/2>&1|>\s*\/dev\/null|>\s*\$null|2>\s*nul/gi, ''))) {
        deny(['[BLOQUEADO por Senzu] El marcador del proyecto (senzu/senzu.json) guarda los permisos del proyecto y solo lo cambia el usuario (o el instalador lanzado por el usuario). Léelo si lo necesitas, pero no lo escribas.']);
    }
}
// El menú del instalador es para el usuario: el agente no le pasa respuestas por tubería ni redirección
if (/\|\s*(node|npx)\b[^|;&]*\binit\.mjs\b|\binit\.mjs\b[^|;&]*<\s*\S|\binit\.mjs\b[^|;&]*\s(-i|--interactivo)\b/i.test(c)) {
    deny(['[BLOQUEADO por Senzu] El menú del instalador lo responde el usuario (ahí se dan permisos y se apagan hooks). Para instalar sin menú usa los flags de selección (--seleccion, --grupos...); el menú, que lo abra él en su terminal.']);
}
if (/(^|\s)(--permitir|-permitir|--apagar-hooks|-apagarhooks|--sin-permisos|-sinpermisos|--encender-hooks|-encenderhooks)\b/i.test(c)) {
    deny(['[BLOQUEADO por Senzu] Dar permisos o apagar hooks lo decide el usuario: que lo ejecute él (en Claude Code, escribiendo "!" delante del comando) o desde el menú del instalador.']);
}

// --- Reglas de git commit: rama protegida, Conventional Commits, sin co-autores ---
if (/\bgit\s+commit\b/i.test(c)) {
    const branch = ramaActual();
    if (RAMAS_PROTEGIDAS.includes(branch) && !permisos.commitEnMain) {
        deny([`[BLOQUEADO por Senzu] No se commitea en '${branch}'. Crea una rama (git switch -c feat/...) y commitea ahi. (Si el usuario lo quiere permitir en este proyecto: "permisos": { "commitEnMain": true } en senzu/senzu.json.)`]);
    }
    if (/co-authored-by/i.test(c)) {
        deny(['[BLOQUEADO por Senzu] Los commits no llevan Co-Authored-By (regla del equipo).']);
    }
    // Mensaje: -m "..." o -m '...'  (se valida solo el primer -m)
    let msg = null;
    let m = /-m\s+"([^"]*)"/is.exec(c);
    if (m) msg = m[1];
    else { m = /-m\s+'([^']*)'/is.exec(c); if (m) msg = m[1]; }
    if (msg) {
        const first = msg.split(/\r?\n/)[0].trim();
        if (!/^(feat|fix|refactor|docs|test|chore|perf|build|ci|style|revert)(\([\w\-\./ ]+\))?!?:\s\S/.test(first)) {
            deny([`[BLOQUEADO por Senzu] El mensaje no sigue Conventional Commits: '${first}'. Formato: tipo(scope): descripcion  (feat|fix|refactor|docs|test|chore|perf|build|ci|style|revert).`]);
        }
        if (first.length > 72) {
            deny([`[BLOQUEADO por Senzu] Primera linea del commit > 72 caracteres (${first.length}). Acortala y pasa el detalle al cuerpo.`]);
        }
    }
}

// --- Deploy a produccion: NUNCA sin aprobacion explicita del usuario ---
if (envSenzu('ALLOW_DEPLOY') !== '1') {
    const deployPat = /(netlify\s+deploy(?=.*--prod))|(\bvercel\b(?=.*--prod))|(\bfly\s+deploy\b)|(\bwrangler\s+(deploy|publish)\b(?!.*--env[= ](dev|preview)))/i;
    if (deployPat.test(c)) {
        deny([
            '[BLOQUEADO por Senzu] Deploy a PRODUCCION detectado. Requiere aprobacion explicita del usuario en este momento (checklist /desplegar: backup fresco verificado + plan de rollback + smoke posterior).',
            'Con la aprobacion recibida: reintenta con SENZU_ALLOW_DEPLOY=1 y documenta la aprobacion y el resultado en el devlog. Los deploys de preview (sin --prod) pasan sin muro.',
        ]);
    }
}

// --- Logo ya elegido: los generadores de logos e iconos no se lanzan sin que el usuario lo pida ---
// (graphic-design scripts/logo|icon/generate.py, o image-gen con un prompt de logo). Escape tras pedirlo: SENZU_ALLOW_LOGO=1.
if (envSenzu('ALLOW_LOGO') !== '1' && (/scripts[\\/](logo|icon)[\\/]generate\.py/i.test(c) || (/image-gen[\\/]scripts[\\/]generate\.mjs/i.test(c) && /\b(logo|logotipo|isotipo|s[ií]mbolo|favicon)\b/i.test(c)))) {
    const elegido = textoLogos(root);
    if (elegido) deny([
        '[BLOQUEADO por Senzu] ' + elegido,
        'Si el usuario ha pedido EXPLÍCITAMENTE nuevas variantes o sustituir el logo: reintenta con SENZU_ALLOW_LOGO=1 y anótalo en el devlog.',
    ]);
}

// --- Librerias vetadas (regla dura: sin jQuery/Bootstrap ni segunda libreria de componentes sin aprobacion) ---
if (envSenzu('ALLOW_LIB') !== '1' && /\b(npm|pnpm|yarn|bun)\s+(install|add|i)\b/i.test(c)) {
    if (/\b(jquery|bootstrap)\b/i.test(c)) {
        deny([
            '[BLOQUEADO por Senzu] jQuery/Bootstrap estan vetados por defecto (regla dura 12: se reutiliza lo que ya hay; nada de segundas librerias de componentes).',
            'Si el usuario lo aprueba explicitamente: que lo ejecute el, o reintenta con SENZU_ALLOW_LIB=1 en el entorno y documenta la aprobacion en el devlog.',
        ]);
    }
}

const pushOk = pushPermitido();
for (const r of rules) {
    if (pushOk && r === rules[0]) continue;   // push normal permitido por el proyecto (las reglas de forzado siguen)
    if (r.p.test(c)) {
        deny([
            `[BLOQUEADO por Senzu] ${r.m}`,
            `Comando: ${cmd}`,
            'Si de verdad quieres hacerlo, pídeme aprobación explícita y ejecútalo tú, o autorízalo para esta vez.',
        ]);
    }
}

process.exit(0);
