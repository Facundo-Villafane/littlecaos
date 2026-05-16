# sync-docs.ps1
# Copia los GDDs del proyecto al sitio Docusaurus (website/)
# Ejecutar desde E:\GameDev\Caosenmano\

param(
    [switch]$Push,
    [string]$Message = "docs: sync GDDs $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

$ErrorActionPreference = "Stop"
$source = ".\design\gdd"
$dest = ".\website\docs\gdd"

Write-Host "Sincronizando GDDs a Docusaurus..." -ForegroundColor Cyan

if (-not (Test-Path $source)) {
    Write-Error "No se encontro la carpeta $source"
    exit 1
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$copied = 0
Get-ChildItem -Path $source -Filter "*.md" | ForEach-Object {
    $destFile = Join-Path $dest $_.Name
    Copy-Item -Path $_.FullName -Destination $destFile -Force
    Write-Host "  Copiado: $($_.Name)" -ForegroundColor Green
    $copied++
}

Write-Host ""
Write-Host "$copied archivo(s) sincronizados." -ForegroundColor Green

if ($Push) {
    Write-Host ""
    Write-Host "Subiendo a GitHub..." -ForegroundColor Cyan
    Push-Location ".\website"
    try {
        git add .
        git commit -m $Message
        git push
        Write-Host "Publicado. El sitio se actualiza en ~2 minutos." -ForegroundColor Green
        Write-Host "URL: https://facundo-villafane.github.io/littlecaos/" -ForegroundColor Yellow
    } catch {
        Write-Host "Error al hacer push: $_" -ForegroundColor Red
    }
    Pop-Location
} else {
    Write-Host ""
    Write-Host "Para publicar:" -ForegroundColor Yellow
    Write-Host "  .\sync-docs.ps1 -Push" -ForegroundColor White
    Write-Host "  # o manualmente:" -ForegroundColor Gray
    Write-Host "  cd website" -ForegroundColor White
    Write-Host "  git add ." -ForegroundColor White
    Write-Host "  git commit -m 'docs: update'" -ForegroundColor White
    Write-Host "  git push" -ForegroundColor White
}
