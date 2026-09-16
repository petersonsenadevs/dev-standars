#requires -Version 5.1
# Hook SessionEnd: limpia los marcadores de sesion de dev-standards en %TEMP% (rapido: presupuesto de 1,5 s).
$ErrorActionPreference = 'SilentlyContinue'
. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
$sid = if ($p -and $p.session_id) { ([string]$p.session_id -replace '[^a-zA-Z0-9_-]', '') } else { 'default' }
if ($sid) { Get-ChildItem $env:TEMP -Filter "dev-standards-*-$sid.flag" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue }
# Limpieza de marcadores antiguos (> 2 dias)
Get-ChildItem $env:TEMP -Filter 'dev-standards-*.flag' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-2) } | Remove-Item -Force -ErrorAction SilentlyContinue
exit 0
