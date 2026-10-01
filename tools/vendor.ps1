#requires -Version 5.1
<#
.SYNOPSIS
  Descarga (o actualiza) las skills upstream de terceros a core\skills-vendor\.
.DESCRIPTION
  Clona con --depth 1 los repos definidos en $Sources, copia cada .claude\skills\<skill>\ (solo carpetas;
  sin .zip, sin __pycache__, sin skill-creator) a core\skills-vendor\<skill>\, guarda la LICENSE de cada repo
  como LICENSE.upstream dentro de cada skill, parchea las rutas ${CLAUDE_PLUGIN_ROOT} de ui-ux-pro-max
  y escribe core\skills-vendor\VENDOR.json (repo, commit, fecha, skills, parches).
  NO edites core\skills-vendor\ a mano: la capa propia va en core\skills-overlay\<skill>\.
.PARAMETER Source
  (Opcional) Carpeta que ya contiene los clones (subcarpetas con el nombre del repo). Si se omite, clona en %TEMP%.
.PARAMETER KeepClones
  No borrar los clones temporales al terminar.
.EXAMPLE
  D:\dev-standards\tools\vendor.ps1            # primera vez o actualizar
#>
param(
    [string]$Source,
    [switch]$KeepClones
)

. (Join-Path $PSScriptRoot '_lib.ps1')

$root      = Get-StandardsRoot
$vendorDir = Join-Path $root 'core\skills-vendor'

$Sources = @(
    @{ name = 'ui-ux-pro-max-skill'; url = 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git'; skillsPath = '.claude\skills' },
    @{ name = 'claudedesignskills';  url = 'https://github.com/freshtechbro/claudedesignskills.git';       skillsPath = '.claude\skills' }
)
$SkipSkills = @('skill-creator')
$RenameMap  = @{ 'design' = 'graphic-design' }   # evita colision con la skill first-party 'design' de Claude Code

$tmp = $Source
if (-not $tmp) {
    $tmp = Join-Path $env:TEMP ('dev-standards-vendor-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    Ensure-Dir $tmp
    foreach ($s in $Sources) {
        Write-Host "Clonando $($s.url) ..."
        git clone --depth 1 --quiet $s.url (Join-Path $tmp $s.name)
        if ($LASTEXITCODE -ne 0) { throw "git clone fallo para $($s.url)" }
    }
}

Ensure-Dir $vendorDir
$manifest = [ordered]@{ generatedAt = (Get-Date -Format 'yyyy-MM-dd'); repos = @(); skills = [ordered]@{}; patches = @() }

foreach ($s in $Sources) {
    $repoDir = Join-Path $tmp $s.name
    if (-not (Test-Path $repoDir)) { throw "No existe el clon $repoDir" }
    $commit  = (git -C $repoDir rev-parse HEAD).Trim()
    $license = Join-Path $repoDir 'LICENSE'
    $manifest.repos += [ordered]@{ name = $s.name; url = $s.url; commit = $commit }

    $skillsSrc = Join-Path $repoDir $s.skillsPath
    Get-ChildItem $skillsSrc -Directory | Where-Object { $SkipSkills -notcontains $_.Name } | ForEach-Object {
        $srcName = $_.Name
        if (-not (Test-Path (Join-Path $_.FullName 'SKILL.md'))) { return }
        $name = if ($RenameMap.ContainsKey($srcName)) { $RenameMap[$srcName] } else { $srcName }
        $dst = Join-Path $vendorDir $name
        if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
        Ensure-Dir $dst
        # Copia excluyendo __pycache__ y .zip
        Get-ChildItem $_.FullName -Recurse -Force | Where-Object {
            $_.FullName -notmatch '\\__pycache__(\\|$)' -and $_.Extension -ne '.zip' -and $_.Extension -ne '.pyc'
        } | ForEach-Object {
            $rel = $_.FullName.Substring($skillsSrc.Length + 1 + $srcName.Length).TrimStart('\')
            $target = Join-Path $dst $rel
            if ($_.PSIsContainer) { Ensure-Dir $target } else { Ensure-Dir (Split-Path $target -Parent); Copy-Item $_.FullName $target -Force }
        }
        if (Test-Path $license) { Copy-Item $license (Join-Path $dst 'LICENSE.upstream') -Force }
        $manifest.skills[$name] = [ordered]@{ repo = $s.name; commit = $commit; source = "$($s.skillsPath)\$srcName" }
        Write-Host "  [vendor] $name  <- $($s.name)@$($commit.Substring(0,7))"
    }
}

# --- Parche: rutas ${CLAUDE_PLUGIN_ROOT} de ui-ux-pro-max -> <skills-dir> (neutral entre herramientas) ---
$uxSkill = Join-Path $vendorDir 'ui-ux-pro-max'
if (Test-Path $uxSkill) {
    $note = @(
        '> [senzu] Paths patched by tools/vendor.ps1: `<skills-dir>` is the folder where this skill was installed',
        '> (`.claude/skills` for Claude Code, `.agents/skills` for Codex/Antigravity/Cursor, `.cursor/skills`, `.windsurf/skills`).',
        '> Run scripts with `python3` (Linux/macOS/WSL) or `py -3` (Windows).',
        ''
    ) -join "`n"
    Get-ChildItem $uxSkill -Recurse -Include *.md | ForEach-Object {
        $txt = Read-Utf8 $_.FullName
        if ($txt -match 'CLAUDE_PLUGIN_ROOT') {
            $new = $txt -replace '\$\{CLAUDE_PLUGIN_ROOT\}/\.claude/skills/ui-ux-pro-max', '<skills-dir>/ui-ux-pro-max'
            $new = $new -replace '\$\{CLAUDE_PLUGIN_ROOT\}', '<skills-dir>/ui-ux-pro-max'
            # Insertar la nota tras el frontmatter (si lo hay) o al principio
            if ($new -match '^(?s)(---.*?---\r?\n)') { $new = $Matches[1] + "`n" + $note + $new.Substring($Matches[1].Length) }
            else { $new = $note + $new }
            Write-Utf8 $_.FullName $new
            $rel = $_.FullName.Substring($vendorDir.Length + 1)
            $manifest.patches += "$rel : `${CLAUDE_PLUGIN_ROOT} -> <skills-dir>"
            Write-Host "  [patch]  $rel"
        }
    }
}

Write-Utf8 (Join-Path $vendorDir 'VENDOR.json') ($manifest | ConvertTo-Json -Depth 6)
Write-Utf8 (Join-Path $vendorDir 'README.md') @"
# core/skills-vendor

Skills de terceros copiadas tal cual por ``tools/vendor.ps1`` (ver ``VENDOR.json`` para repo/commit/fecha).

- **NO editar a mano**: se sobrescribe en cada actualizacion. La capa propia (espanol, perfiles de stack, plantillas)
  vive en ``core/skills-overlay/<skill>/`` y se copia encima al renderizar un proyecto.
- Si el overlay trae ``SKILL.md``, el original se instala como ``SKILL.upstream.md``.
- ``data/stacks/<stack>.extra.csv`` del overlay se anexa al ``<stack>.csv`` upstream al renderizar.
- Licencias: cada skill incluye ``LICENSE.upstream`` (MIT en ambos repos).
"@

if (-not $Source -and -not $KeepClones) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
Write-Host "Listo: $($manifest.skills.Count) skills en $vendorDir"
