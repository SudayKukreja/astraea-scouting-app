Set-Location (Split-Path $PSScriptRoot -Parent)

$datetime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$version = Get-Date -Format "yyyyMMdd-HHmmss"
$swPath = "astraea/static/js/sw.js"

$description = Read-Host "Enter a short commit description"

Write-Host "=== App Deployment Script ===" -ForegroundColor Magenta

if (Test-Path $swPath) {
    $sw = Get-Content $swPath -Raw
    $sw = $sw -replace "const STATIC_CACHE = '[^']*'", "const STATIC_CACHE = 'astraea-static-v$version'"
    $sw = $sw -replace "const DYNAMIC_CACHE = '[^']*'", "const DYNAMIC_CACHE = 'astraea-dynamic-v$version'"
    Set-Content -Path $swPath -Value $sw -NoNewline
    Write-Host "Service worker cache version: v$version" -ForegroundColor Green
} else {
    Write-Host "$swPath not found; cache version not updated" -ForegroundColor Yellow
    $version = $null
}

$gitStatus = (git status --short | Out-String).Trim()
if (-not $gitStatus) { $gitStatus = "No changes detected" }

Write-Host "`nFiles to be deployed:" -ForegroundColor Yellow
Write-Host $gitStatus

$commitMessage = "$description - Deploy $datetime`n`n"
if ($version) { $commitMessage += "Service Worker Cache Updated: v$version`n`n" }
$commitMessage += "Changes:`n$gitStatus"

try {
    git add .
    if ($LASTEXITCODE -ne 0) { throw "Git add failed" }

    git commit -m $commitMessage
    if ($LASTEXITCODE -ne 0) { throw "Git commit failed" }

    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "Git push failed" }

    Write-Host "`nDeploy completed successfully at $datetime" -ForegroundColor Green
} catch {
    Write-Host "`nDeployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
