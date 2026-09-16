#requires -Version 5.1
<#
.SYNOPSIS
  Hook PreToolUse (Edit|Write|MultiEdit): bloquea escribir secretos en el codigo.
.DESCRIPTION
  Analiza el contenido que se va a escribir (content / new_string / edits[].new_string) y deniega (exit 2)
  si encuentra patrones de credenciales reales: claves AWS, tokens GitHub/GitLab/Slack/Stripe/OpenAI/Anthropic,
  claves privadas PEM, JWT largos, cadenas de conexion con password, Google API keys.
  Ignora placeholders obvios (xxx, your-, example, changeme, <...>, ${...}, env('...'), process.env, os.environ).
#>
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
if (-not $p -or $p.tool_name -notin @('Edit', 'Write', 'MultiEdit')) { exit 0 }

$texts = @()
if ($p.tool_input.content)    { $texts += [string]$p.tool_input.content }
if ($p.tool_input.new_string) { $texts += [string]$p.tool_input.new_string }
if ($p.tool_input.edits)      { foreach ($e in $p.tool_input.edits) { if ($e.new_string) { $texts += [string]$e.new_string } } }
if (-not $texts.Count) { exit 0 }
$text = $texts -join "`n"

# Archivos de ejemplo/plantilla no se analizan
$file = [string]$p.tool_input.file_path
if ($file -match '(?i)\.(example|sample|template|dist)$|(^|[\\/])\.env\.example$') { exit 0 }

$patterns = @(
    @{ n = 'AWS Access Key';        p = '\bAKIA[0-9A-Z]{16}\b' },
    @{ n = 'GitHub token';          p = '\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b' },
    @{ n = 'GitLab token';          p = '\bglpat-[A-Za-z0-9\-_]{20,}\b' },
    @{ n = 'Slack token';           p = '\bxox[baprs]-[A-Za-z0-9\-]{10,}\b' },
    @{ n = 'Stripe key';            p = '\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}\b' },
    @{ n = 'Anthropic key';         p = '\bsk-ant-[A-Za-z0-9_\-]{32,}\b' },
    @{ n = 'OpenAI key';            p = '\bsk-(proj-)?[A-Za-z0-9_\-]{32,}\b' },
    @{ n = 'Google API key';        p = '\bAIza[0-9A-Za-z\-_]{35}\b' },
    @{ n = 'Clave privada PEM';     p = '-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----' },
    @{ n = 'Cadena de conexion con password'; p = '(?i)\b(mysql|postgres(ql)?|mongodb(\+srv)?|redis|amqp)://[^:\s/]+:[^@\s]{6,}@' },
    @{ n = 'JWT';                   p = '\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\b' },
    @{ n = 'Asignacion de secreto literal'; p = '(?i)\b(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["''][A-Za-z0-9/+_\-\.=]{20,}["'']' }
)
$placeholder = '(?i)(xxx|your[-_]|example|changeme|placeholder|<[^>]+>|\$\{[^}]+\}|env\(|process\.env|os\.environ|getenv|import\.meta\.env|\bdummy\b|\bfake\b|\btest[-_]?key\b|\*{4,}|0{8,}|1{8,})'

foreach ($pt in $patterns) {
    foreach ($m in [regex]::Matches($text, $pt.p)) {
        $ctx = $text.Substring([Math]::Max(0, $m.Index - 40), [Math]::Min(120, $text.Length - [Math]::Max(0, $m.Index - 40)))
        if ($ctx -match $placeholder) { continue }
        [Console]::Error.WriteLine("[BLOQUEADO por dev-standards] Parece que vas a escribir un secreto real ($($pt.n)) en el codigo.")
        [Console]::Error.WriteLine("Usa variables de entorno (.env, config) y nunca commitees credenciales. Si es un valor de ejemplo, usa un placeholder claro (xxx, your-key, <API_KEY>).")
        exit 2
    }
}
exit 0
