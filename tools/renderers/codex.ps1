#requires -Version 5.1
# Renderer: OpenAI Codex  ->  AGENTS.md (estándar compartido) + .agents/skills/ (Agent Skills)

function Render-Codex {
    param([Parameter(Mandatory)]$Stack, [Parameter(Mandatory)][string]$ProjectPath, [string[]]$ExtraSkills = @(), [string[]]$Bundles = @())
    $rules = Get-CombinedRules -Stack $Stack -ExtraSkills $ExtraSkills -Bundles $Bundles -SkillsRelPath '.agents/skills'
    # AGENTS.md propio del proyecto: respaldo + referencia (o intacto con reglas en AGENTS.dev-standards.md)
    $guide = Resolve-GuideTarget -ProjectPath $ProjectPath -FileName 'AGENTS.md' -Rules $rules
    Write-Utf8 $guide.Target $guide.Rules
    $installed = Copy-Skills -Stack $Stack -Dst (Join-Path $ProjectPath '.agents\skills') -Extra $ExtraSkills -Bundles $Bundles
    Write-Host "  [codex]      $(Split-Path $guide.Target -Leaf) + .agents/skills/ ($($installed -join ', '))"
}
