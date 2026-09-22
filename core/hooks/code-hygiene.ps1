#requires -Version 5.1
<#
.SYNOPSIS
  Hook PreToolUse (Edit|Write|MultiEdit): bloquea BASURA DE DEBUG introducida en codigo fuente y los
  VETOS de design-system/*/gustos.md (terminos entre acentos graves en la seccion "## No").
.DESCRIPTION
  Bloquea solo lo que se INTRODUCE (patron en lo nuevo y no en lo viejo). Escape puntual: si la linea
  que contiene el match lleva "dev-standards-allow", se permite (para scripts CLI legitimos).
  Debug: console.log/debug, debugger, dd(), var_dump(), ray(). El resto (any, lint) es del linter.
#>
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
if (-not $p) { exit 0 }
if ($p.tool_name -notin @('Edit', 'Write', 'MultiEdit')) { exit 0 }
$file = [string]$p.tool_input.file_path
if (-not $file) { exit 0 }
if ($file -notmatch '(?i)\.(ts|tsx|js|jsx|mjs|cjs|vue|astro|svelte|php|html|css|blade\.php)$') { exit 0 }
if ($file -match '(?i)(test|spec|\.config\.|vite\.config|astro\.config|tailwind\.config|[\/](scripts?|tools|\.claude|devlog|design-system|node_modules|vendor)[\/])') { exit 0 }

function Test-Introduced { param([string]$Pattern, [string]$New, [string]$Old)
    if (-not $New) { return $null }
    foreach ($m in [regex]::Matches($New, $Pattern)) {
        # linea que contiene el match
        $start = $New.LastIndexOf("`n", [Math]::Max($m.Index - 1, 0)); if ($start -lt 0) { $start = 0 }
        $end = $New.IndexOf("`n", $m.Index); if ($end -lt 0) { $end = $New.Length }
        $line = $New.Substring($start, $end - $start)
        if ($line -match 'dev-standards-allow') { continue }
        if ($Old -and $Old -match $Pattern) { continue }   # ya estaba: no lo introduces tu
        return $line.Trim()
    }
    return $null
}

# pares (nuevo, viejo) segun la herramienta
$pairs = @()
if ($p.tool_name -eq 'Edit')      { $pairs += ,@([string]$p.tool_input.new_string, [string]$p.tool_input.old_string) }
elseif ($p.tool_name -eq 'Write') { $pairs += ,@([string]$p.tool_input.content, '') }
elseif ($p.tool_name -eq 'MultiEdit') {
    foreach ($e in @($p.tool_input.edits)) { $pairs += ,@([string]$e.new_string, [string]$e.old_string) }
}

# --- 1. Debug introducido ---
$debugPatterns = @(
    @{ p = 'console\.(log|debug)\s*\('; m = 'console.log/debug en codigo fuente' },
    @{ p = '(?m)^\s*debugger\b';        m = 'sentencia debugger' },
    @{ p = '(?<![\w$])dd\s*\(';         m = 'dd() de depuracion' },
    @{ p = '\bvar_dump\s*\(';           m = 'var_dump()' },
    @{ p = '(?<![\w$])ray\s*\(';        m = 'ray() de depuracion' }
)
foreach ($pair in $pairs) {
    foreach ($dp in $debugPatterns) {
        $hit = Test-Introduced -Pattern $dp.p -New $pair[0] -Old $pair[1]
        if ($hit) {
            [Console]::Error.WriteLine("[BLOQUEADO por dev-standards] Estas introduciendo $($dp.m): '$hit'. Usa el logger del proyecto o eliminalo antes de guardar. Si es intencional (script CLI), anade 'dev-standards-allow' como comentario en esa linea.")
            exit 2
        }
    }
}

# --- 2. Vetos de gustos.md (terminos entre acentos graves bajo "## No") ---
$root = Get-ProjectRoot
$gustos = Get-ChildItem (Join-Path $root 'design-system') -Recurse -Filter 'gustos.md' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($gustos) {
    $txt = [System.IO.File]::ReadAllText($gustos.FullName, [Text.Encoding]::UTF8)
    $noSection = ''
    if ($txt -match '(?s)##\s*No\b(.*?)(\n##\s|\z)') { $noSection = $Matches[1] }
    $vetoes = @([regex]::Matches($noSection, '`([^`]{3,40})`') | ForEach-Object { $_.Groups[1].Value })
    foreach ($pair in $pairs) {
        foreach ($v in $vetoes) {
            $pat = [regex]::Escape($v)
            $hit = Test-Introduced -Pattern "(?i)$pat" -New $pair[0] -Old $pair[1]
            if ($hit) {
                [Console]::Error.WriteLine("[BLOQUEADO por dev-standards] '$v' esta VETADO por el cliente en $($gustos.FullName.Substring($root.Length+1)) (seccion No): '$hit'. No se re-propone un veto sin preguntar explicitamente al usuario.")
                exit 2
            }
        }
    }
}
exit 0
