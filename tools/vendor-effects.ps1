#requires -Version 5.1
<#
.SYNOPSIS
  Vendoriza repos de efectos (GitHub, licencia permisiva) en core\effects-vendor\ segun manifest.json.
.DESCRIPTION
  Para cada repo del manifiesto: clona depth-1, verifica que el LICENSE contiene la licencia declarada
  (si no coincide, lo manda a _local\ que esta gitignorado), elimina .git, recorta archivos mayores de
  maxFileMB (videos/media; el codigo se conserva) y escribe ATTRIBUTION.md (URL + licencia + fecha).
  Re-ejecutar actualiza (borra y re-clona). Anadir repos: editar core\effects-vendor\manifest.json.
.EXAMPLE
  tools\vendor-effects.ps1              # todos los del manifiesto
  tools\vendor-effects.ps1 -Only vanta  # solo uno
#>
param([string]$Only)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$base = Join-Path $root 'core\effects-vendor'
$man  = Get-Content (Join-Path $base 'manifest.json') -Raw | ConvertFrom-Json
$maxBytes = [long]($man.maxFileMB * 1MB)

function Remove-Tree([string]$Path) {
    if (-not (Test-Path $Path)) { return }
    Get-ChildItem $Path -Recurse -Force -File | ForEach-Object { $_.Attributes = 'Normal' }  # packfiles de git vienen read-only
    [System.IO.Directory]::Delete($Path, $true)
}

foreach ($r in $man.repos) {
    if ($Only -and $r.name -ne $Only) { continue }
    $destRoot = if ($r.commit) { $base } else { Join-Path $base '_local' }
    $dest = Join-Path $destRoot $r.name
    Write-Host ("[{0}] {1} ..." -f $r.name, $r.repo)
    Remove-Tree $dest
    $null = New-Item -ItemType Directory -Force $destRoot
    git clone --quiet --depth 1 ("https://github.com/" + $r.repo) $dest
    if ($LASTEXITCODE -ne 0) { Write-Warning ("  clone FALLO: " + $r.repo); continue }

    # verificar licencia declarada
    $licFile = Get-ChildItem $dest -Filter 'LICENSE*' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $licOk = $licFile -and ((Get-Content $licFile.FullName -Raw) -match [regex]::Escape($r.license))
    if (-not $licOk -and $r.commit) {
        Write-Warning ("  LICENSE no confirma '{0}': movido a _local (no se versiona)" -f $r.license)
        $localRoot = Join-Path $base '_local'; $null = New-Item -ItemType Directory -Force $localRoot
        $new = Join-Path $localRoot $r.name
        Remove-Tree $new
        Move-Item $dest $new; $dest = $new
    }

    Remove-Tree (Join-Path $dest '.git')
    $fat = Get-ChildItem $dest -Recurse -File | Where-Object { $_.Length -gt $maxBytes }
    foreach ($f in $fat) { $f.Delete() }

    $att = "# Attribution`n`nFuente: https://github.com/$($r.repo)`nLicencia: $($r.license) (LICENSE incluido)`nUso en dev-standards: $($r.for)`nVendorizado: $(Get-Date -Format yyyy-MM-dd) por tools/vendor-effects.ps1"
    if ($fat.Count) { $att += "`nNota: $($fat.Count) archivo(s) > $($man.maxFileMB) MB eliminados (media pesada); el codigo esta completo." }
    Set-Content -Path (Join-Path $dest 'ATTRIBUTION.md') -Value $att -Encoding UTF8
    $n = (Get-ChildItem $dest -Recurse -File).Count
    Write-Host ("  ok: {0} archivos (quitados {1} pesados)" -f $n, $fat.Count)
}
Write-Host "Listo. Los repos viven en core\effects-vendor\ (los _local no se versionan)."
