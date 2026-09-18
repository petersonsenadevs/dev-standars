#requires -Version 5.1
# Funciones compartidas por los hooks de dev-standards (dot-source: . "$PSScriptRoot\_common.ps1")

function Read-HookInput {
    # PowerShell decodifica el stdin del hook con la codepage OEM y corrompe los acentos (los prompts llegan en UTF-8).
    # No se puede leer el handle crudo (PS ya consumio el pipe con -File), asi que se repara la decodificacion:
    # re-codificar con la encoding con la que se leyo (roundtrip exacto en codepages single-byte) y decodificar UTF-8.
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    try {
        $bytes = [Console]::InputEncoding.GetBytes($raw)
        $utf8 = [System.Text.Encoding]::UTF8.GetString($bytes)
        if ($utf8 -and $utf8 -notmatch [char]0xFFFD) { $raw = $utf8 }
    } catch {}
    try { return ($raw | ConvertFrom-Json) } catch { return $null }
}

function Get-ProjectRoot { if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { $PWD.Path } }

function Get-SessionFlag { param([string]$Sid, [string]$Name)
    $s = ($Sid -replace '[^a-zA-Z0-9_-]', ''); if (-not $s) { $s = 'default' }
    Join-Path $env:TEMP "dev-standards-$Name-$s.flag"
}
function Get-ProjectFlag { param([string]$Root, [string]$Name)
    # Flag keyed por proyecto (no por sesion): builds/tests son estado del proyecto.
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $hash = -join ($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($Root.ToLower())) | ForEach-Object { $_.ToString('x2') })
    Join-Path $env:TEMP "dev-standards-$Name-$($hash.Substring(0,12)).flag"
}
function Test-Once { param([string]$Sid, [string]$Name)   # true la PRIMERA vez por sesion; crea el marcador
    $f = Get-SessionFlag $Sid $Name
    if (Test-Path $f) { return $false }
    New-Item -ItemType File -Path $f -Force | Out-Null
    return $true
}

function Get-HookConfig { param([string]$Root)
    # Proyecto primero; en modo plugin, config.json neutro del plugin
    foreach ($c in @((Join-Path $Root '.claude\hooks\config.json'), $(if ($env:CLAUDE_PLUGIN_ROOT) { Join-Path $env:CLAUDE_PLUGIN_ROOT 'hooks\config.json' } else { $null }))) {
        if ($c -and (Test-Path $c)) { try { return (Get-Content $c -Raw -Encoding UTF8 | ConvertFrom-Json) } catch {} }
    }
    return $null
}
function Get-Marker { param([string]$Root)
    # .dev-standards.json del proyecto; si no existe (modo plugin), se reconstruye desde config.json
    $m = Join-Path $Root '.dev-standards.json'
    if (Test-Path $m) { try { return (Get-Content $m -Raw -Encoding UTF8 | ConvertFrom-Json) } catch {} }
    $cfg = Get-HookConfig $Root
    if ($cfg -and $cfg.stack) { return [pscustomobject]@{ stack = $cfg.stack; frontProfile = $cfg.frontProfile; extraSkills = @(); bundles = @(); fromConfig = $true } }
    return $null
}
function Get-AvailableSkills { param([string]$Root, $Cfg)
    # Modo hermetico (suite test-router): solo skills del proyecto + config, ignorando ~/.claude global
    if ($env:DEV_STANDARDS_TEST_ISOLATED -eq '1') {
        $a = @()
        $d = Join-Path $Root '.claude\skills'
        if (Test-Path $d) { $a += (Get-ChildItem $d -Directory | ForEach-Object Name) }
        if ($Cfg -and $Cfg.skills) { $a += @($Cfg.skills) }
        return @($a | Select-Object -Unique)
    }
    $a = @()
    foreach ($d in @((Join-Path $Root '.claude\skills'), (Join-Path $HOME '.claude\skills'))) {
        if (Test-Path $d) { $a += (Get-ChildItem $d -Directory | ForEach-Object Name) }
    }
    if ($Cfg -and $Cfg.skills) { $a += @($Cfg.skills) }
    # skills de TODOS los plugins instalados (no solo el que ejecuta el hook)
    $plugRoot = Join-Path $HOME '.claude\plugins'
    if (Test-Path $plugRoot) {
        Get-ChildItem $plugRoot -Recurse -Directory -Filter 'skills' -Depth 6 -ErrorAction SilentlyContinue | ForEach-Object {
            Get-ChildItem $_.FullName -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') } | ForEach-Object { $a += $_.Name }
        }
    }
    if ($env:CLAUDE_PLUGIN_ROOT -and (Test-Path (Join-Path $env:CLAUDE_PLUGIN_ROOT 'skills'))) { $a += (Get-ChildItem (Join-Path $env:CLAUDE_PLUGIN_ROOT 'skills') -Directory | ForEach-Object Name) }
    return @($a | Select-Object -Unique)
}
function Get-GitBranch { param([string]$Root)
    try { return ((git -C $Root rev-parse --abbrev-ref HEAD 2>$null) | Out-String).Trim() } catch { return '' }
}
function Get-GitDirty { param([string]$Root)   # numero de archivos con cambios (tracked + untracked, sin ignorados)
    try { $o = git -C $Root status --porcelain 2>$null; return @($o | Where-Object { $_ }).Count } catch { return 0 }
}
function Get-DesignSystemMaster { param([string]$Root)
    $d = Join-Path $Root 'design-system'
    if (-not (Test-Path $d)) { return $null }
    $f = Get-ChildItem $d -Recurse -Filter 'MASTER.md' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($f) { return $f.FullName.Substring($Root.Length + 1) -replace '\\', '/' }
    return $null
}
function Get-TodayDevlog { param([string]$Root)
    $d = Join-Path $Root ("devlog\" + (Get-Date -Format 'yyyy-MM-dd'))
    if (-not (Test-Path $d)) { return @() }
    return @(Get-ChildItem $d -Filter '*.md' -File | Where-Object { $_.Name -ne 'DECISIONES.md' } | ForEach-Object Name)
}
function Get-DevlogNextNumber { param([string]$Root)   # mayor NNN global + 1 (numeracion correlativa de toda la vida del proyecto)
    $d = Join-Path $Root 'devlog'
    if (-not (Test-Path $d)) { return 1 }
    $max = 0
    Get-ChildItem $d -Recurse -Filter '*.md' -File -ErrorAction SilentlyContinue | ForEach-Object { if ($_.Name -match '^(\d{3})-') { $n = [int]$Matches[1]; if ($n -gt $max) { $max = $n } } }
    return $max + 1
}
function Test-DevlogIndexed { param([string]$Root, [string]$Name)   # ¿aparece el NNN de la entrada en devlog/INDEX.md?
    $idx = Join-Path $Root 'devlog\INDEX.md'
    if (-not (Test-Path $idx) -or $Name -notmatch '^(\d{3})-') { return $true }
    return ((Get-Content $idx -Raw -Encoding UTF8) -match ('\|\s*' + $Matches[1] + '\s*\|'))
}
function Out-HookJson { param([string]$Event, [hashtable]$Extra)
    $h = [ordered]@{ hookEventName = $Event }
    foreach ($k in $Extra.Keys) { $h[$k] = $Extra[$k] }
    Write-Output ((@{ hookSpecificOutput = $h }) | ConvertTo-Json -Compress -Depth 5)
}

function Get-PlanStatus { param([string]$Root)
    # Devuelve @{ exists; doing = @(); next = @(); done; total } leyendo plan/PLAN.md (tarjetas "### ID · Titulo [S] [estado]")
    $f = Join-Path $Root 'plan\PLAN.md'
    $r = @{ exists = $false; doing = @(); next = @(); done = 0; total = 0 }
    if (-not (Test-Path $f)) { return $r }
    $r.exists = $true
    foreach ($line in (Get-Content $f -Encoding UTF8)) {
        if ($line -match '^###\s+([A-Z]+\d*-T\d+[a-z]?)\s*[·\-]\s*(.+?)\s*\[(S|M|L)\]\s*\[(todo|doing|blocked|done)\]') {
            $r.total++
            $id = $Matches[1]; $title = $Matches[2]; $st = $Matches[4]
            if ($st -eq 'done') { $r.done++ }
            elseif ($st -eq 'doing') { $r.doing += "$id $title" }
            elseif ($st -eq 'todo' -and $r.next.Count -lt 2) { $r.next += "$id $title" }
        }
    }
    return $r
}
