#requires -Version 5.1
<#
.SYNOPSIS
  Hook PostToolUse (Edit|Write|MultiEdit): formatea el archivo recien escrito con la herramienta del stack.
.DESCRIPTION
  Lee .claude/hooks/config.json -> formatters { "<ext>": "<comando con {file}>" } (generado por dev-standards
  a partir de stack.json) y ejecuta el formateador solo si su binario existe en el proyecto. No bloquea nunca;
  si formatea, informa por STDOUT (visible en el transcript). Timeout corto para no frenar al agente.
  Ejemplos por defecto si no hay config:
    .php  -> php vendor/bin/pint {file}
    .ts .tsx .js .jsx .vue .astro .css .json .md -> npx prettier --write {file}   (solo si existe node_modules/.bin/prettier)
    .py   -> ruff format {file}  (solo si ruff esta en PATH)
#>
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
if (-not $p -or $p.tool_name -notin @('Edit', 'Write', 'MultiEdit')) { exit 0 }
$file = [string]$p.tool_input.file_path
if (-not $file -or -not (Test-Path $file)) { exit 0 }

$root = Get-ProjectRoot
$ext = [System.IO.Path]::GetExtension($file).ToLower()
if ($file -match '(?i)[\\/](vendor|node_modules|\.git|dist|build)[\\/]') { exit 0 }

$formatters = @{}
$cfg = Get-HookConfig $root
if ($cfg -and $cfg.formatters) { foreach ($prop in $cfg.formatters.PSObject.Properties) { $formatters[$prop.Name] = [string]$prop.Value } }
if (-not $formatters.Count) {
    if (Test-Path (Join-Path $root 'vendor\bin\pint.bat')) { $formatters['.php'] = 'vendor\bin\pint {file}' }
    if (Test-Path (Join-Path $root 'node_modules\.bin\prettier.cmd')) {
        foreach ($e in '.ts', '.tsx', '.js', '.jsx', '.vue', '.astro', '.css', '.scss', '.json', '.md') { $formatters[$e] = 'npx prettier --write {file}' }
    }
    if (Get-Command ruff -ErrorAction SilentlyContinue) { $formatters['.py'] = 'ruff format {file}' }
}
if (-not $formatters.ContainsKey($ext)) { exit 0 }

$cmd = $formatters[$ext].Replace('{file}', '"' + $file + '"')
Push-Location $root
try {
    $out = cmd /c "$cmd 2>&1"
    if ($LASTEXITCODE -eq 0) { Write-Output "[format-on-save] $([System.IO.Path]::GetFileName($file)) formateado con: $($formatters[$ext].Split(' ')[0])" }
    else { Write-Output "[format-on-save] fallo al formatear $([System.IO.Path]::GetFileName($file)): $(($out | Select-Object -First 3) -join ' | ')" }
} finally { Pop-Location }
exit 0
