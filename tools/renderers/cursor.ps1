#requires -Version 5.1
# Renderer: Cursor  ->  .cursor/rules/dev-standards.mdc (regla siempre activa) + .cursor/skills/

function Render-Cursor {
    param([Parameter(Mandatory)]$Stack, [Parameter(Mandatory)][string]$ProjectPath, [string[]]$ExtraSkills = @(), [string[]]$Bundles = @())

    $rules = Get-CombinedRules -Stack $Stack -ExtraSkills $ExtraSkills -Bundles $Bundles -SkillsRelPath '.cursor/skills'
    $frontmatter = @"
---
description: dev-standards ($($Stack.Name)) - reglas de trabajo, devlog y acciones prohibidas
globs:
alwaysApply: true
---

"@
    Write-Utf8 (Join-Path $ProjectPath '.cursor\rules\dev-standards.mdc') ($frontmatter + $rules)
    $installed = Copy-Skills -Stack $Stack -Dst (Join-Path $ProjectPath '.cursor\skills') -Extra $ExtraSkills -Bundles $Bundles
    Write-Host "  [cursor]     .cursor/rules/dev-standards.mdc + .cursor/skills/ ($($installed -join ', '))"
}
