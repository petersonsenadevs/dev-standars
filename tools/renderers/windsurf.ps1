#requires -Version 5.1
# Renderer: Windsurf  ->  .windsurf/rules/dev-standards.md (activation: always on) + .windsurf/skills/

function Render-Windsurf {
    param([Parameter(Mandatory)]$Stack, [Parameter(Mandatory)][string]$ProjectPath, [string[]]$ExtraSkills = @(), [string[]]$Bundles = @())

    $rules = Get-CombinedRules -Stack $Stack -ExtraSkills $ExtraSkills -Bundles $Bundles -SkillsRelPath '.windsurf/skills'
    # Windsurf soporta metadatos de activación al inicio del archivo de reglas.
    $header = @"
---
trigger: always_on
description: dev-standards ($($Stack.Name))
---

"@
    Write-Utf8 (Join-Path $ProjectPath '.windsurf\rules\dev-standards.md') ($header + $rules)
    $installed = Copy-Skills -Stack $Stack -Dst (Join-Path $ProjectPath '.windsurf\skills') -Extra $ExtraSkills -Bundles $Bundles
    Write-Host "  [windsurf]   .windsurf/rules/dev-standards.md + .windsurf/skills/ ($($installed -join ', '))"
}
