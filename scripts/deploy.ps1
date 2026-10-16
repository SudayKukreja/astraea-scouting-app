Set-Location (Split-Path $PSScriptRoot -Parent)

$renderServiceId = if ($env:RENDER_SERVICE_ID) { $env:RENDER_SERVICE_ID } else { "srv-d183m8gdl3ps738p59o0" }
$siteUrl = "https://astraea-scouting-app.onrender.com"

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

    if (-not (Get-Command render -ErrorAction SilentlyContinue)) {
        Write-Host "`nPushed. Render CLI not found; trigger the deploy from the Render dashboard." -ForegroundColor Yellow
        Write-Host "Install it with: winget install Render.CLI" -ForegroundColor Yellow
        exit 0
    }

    $commit = git rev-parse HEAD
    Write-Host "`nDeploying $($commit.Substring(0, 7)) to Render (waiting until live)..." -ForegroundColor Cyan
    render deploys create $renderServiceId --commit $commit --wait --output text --confirm
    if ($LASTEXITCODE -ne 0) {
        throw "Render deploy failed. Check logs with: render logs --resources $renderServiceId"
    }

    Write-Host "`nDeploy is live at $siteUrl" -ForegroundColor Green
} catch {
    Write-Host "`nDeployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
