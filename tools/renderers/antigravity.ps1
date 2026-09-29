#requires -Version 5.1
# Renderer: Google Antigravity  ->  AGENTS.md (mismo estándar que Codex) + .agents/skills/
# Antigravity lee AGENTS.md en la raíz del proyecto. Contenido idéntico al de Codex,
# por lo que si ambos están seleccionados el archivo simplemente se reescribe igual.

function Render-Antigravity {
    param([Parameter(Mandatory)]$Stack, [Parameter(Mandatory)][string]$ProjectPath, [string[]]$ExtraSkills = @(), [string[]]$Bundles = @())
    $rules = Get-CombinedRules -Stack $Stack -ExtraSkills $ExtraSkills -Bundles $Bundles -SkillsRelPath '.agents/skills'
    # AGENTS.md propio del proyecto: mismo trato que en codex (si ambos corren, el segundo respeta la decision)
    $guide = Resolve-GuideTarget -ProjectPath $ProjectPath -FileName 'AGENTS.md' -Rules $rules
    Write-Utf8 $guide.Target $guide.Rules
    $installed = Copy-Skills -Stack $Stack -Dst (Join-Path $ProjectPath '.agents\skills') -Extra $ExtraSkills -Bundles $Bundles
    Write-Host "  [antigravity] $(Split-Path $guide.Target -Leaf) + .agents/skills/ ($($installed -join ', '))"
}
