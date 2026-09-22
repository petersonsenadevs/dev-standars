#requires -Version 5.1
<#
.SYNOPSIS
  Regenera las tablas de activacion GENERADAS de core\skills-plugin\skill-router\SKILL.md y
  core\skills-plugin\front-activation\SKILL.md a partir de core\skills-registry.json.
.DESCRIPTION
  Sustituye el contenido entre <!-- BEGIN GENERATED --> y <!-- END GENERATED --> en ambos archivos.
  Edita el registro, no las tablas. check-skills.ps1 comprueba que esten al dia.
#>
. (Join-Path $PSScriptRoot '_lib.ps1')
$root = Get-StandardsRoot
$reg = $script:Registry

function Get-Table {
    param([string[]]$Groups, [bool]$WithGroup = $true)
    $L = @('| Si la tarea implica… | Skill | Grupo |', '|---|---|---|')
    foreach ($g in $Groups) {
        $rows = $reg.skills | Where-Object { $_.group -eq $g } |
            Sort-Object -Property @{Expression={[bool]$_.entrypoint}; Descending=$true}, @{Expression={$_.priority}; Descending=$true}
        foreach ($sk in $rows) {
            $note = if ($sk.entrypoint) { ' **(por defecto: empieza aquí)**' } elseif ($sk.installedBy -eq 'bundle') { ' (si está instalada)' } else { '' }
            $L += ('| {0} | `{1}`{2} | {3} |' -f $sk.when, $sk.name, $note, $reg.groups.($sk.group))
        }
    }
    return $L -join "`n"
}

function Replace-Generated {
    param([string]$File, [string]$Content)
    $txt = Read-Utf8 $File
    $rx = '(?s)(<!-- BEGIN GENERATED[^>]*-->).*?(<!-- END GENERATED -->)'
    if ($txt -notmatch $rx) { throw "Sin marcadores GENERATED en $File" }
    $new = [regex]::Replace($txt, $rx, { param($m) $m.Groups[1].Value + "`n" + $Content + "`n" + $m.Groups[2].Value })
    Write-Utf8 $File $new
    Write-Host "  [routers] $File"
}

Replace-Generated (Join-Path $root 'core\skills-plugin\skill-router\SKILL.md') (Get-Table -Groups @('routing','planning','front','motion','3d','design','quality','architecture','growth','ops','docs'))
Replace-Generated (Join-Path $root 'core\skills-plugin\front-activation\SKILL.md') (Get-Table -Groups @('front','motion','3d','design'))
Write-Host 'Routers regenerados desde core\skills-registry.json'
