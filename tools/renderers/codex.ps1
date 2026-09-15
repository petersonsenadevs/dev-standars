#requires -Version 5.1
# Renderer: OpenAI Codex  ->  AGENTS.md (estándar compartido) + .agents/skills/ (Agent Skills)

function Render-Codex {
    param([Parameter(Mandatory)]$Stack, [Parameter(Mandatory)][string]$ProjectPath, [string[]]$ExtraSkills = @(), [string[]]$Bundles = @())
    $rules = Get-CombinedRules -Stack $Stack -ExtraSkills $ExtraSkills -Bundles $Bundles -SkillsRelPath '.agents/skills'
    Write-Utf8 (Join-Path $ProjectPath 'AGENTS.md') $rules
    $installed = Copy-Skills -Stack $Stack -Dst (Join-Path $ProjectPath '.agents\skills') -Extra $ExtraSkills -Bundles $Bundles
    Write-Host "  [codex]      AGENTS.md + .agents/skills/ ($($installed -join ', '))"
}
