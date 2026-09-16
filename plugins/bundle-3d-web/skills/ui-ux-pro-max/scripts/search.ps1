#requires -Version 5.1
# Wrapper Windows de search.py (UI UX Pro Max): localiza py / python / python3 y reenvía los argumentos.
#   .\<skills-dir>\ui-ux-pro-max\scripts\search.ps1 "fintech dashboard" --design-system -p "Mi App" --persist -o .
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)

$script = Join-Path $PSScriptRoot 'search.py'
foreach ($c in @(@{ exe = 'py'; pre = @('-3') }, @{ exe = 'python'; pre = @() }, @{ exe = 'python3'; pre = @() })) {
    if (Get-Command $c.exe -ErrorAction SilentlyContinue) {
        try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
        & $c.exe @($c.pre + $script + $Args)
        exit $LASTEXITCODE
    }
}
Write-Error "No se encontro Python (py/python/python3). Instalalo o consulta los CSV de data/ directamente."
exit 1
