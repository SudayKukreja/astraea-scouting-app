$datetime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$dateVersion = Get-Date -Format "yyyyMMdd-HHmmss"

$customDescription = Read-Host "Enter a short commit description"

function Update-ServiceWorkerVersion {
    $swPath = "sw.js"
    
    if (Test-Path $swPath) {
        $swContent = Get-Content $swPath -Raw

        if ($swContent -match "const CACHE_NAME = '[^']*'") {
            $updatedContent = $swContent -replace "const CACHE_NAME = '[^']*'", "const CACHE_NAME = 'astraea-cache-$dateVersion'"
            Set-Content -Path $swPath -Value $updatedContent -NoNewline
            Write-Host "Updated service worker cache version to: astraea-cache-$dateVersion" -ForegroundColor Green
            return $dateVersion
        } else {
            Write-Host "Could not find cache name pattern in sw.js" -ForegroundColor Yellow
            return $null
        }
    } else {
        Write-Host "sw.js not found" -ForegroundColor Red
        return $null
    }
}

$newVersion = Update-ServiceWorkerVersion

$gitStatus = git status --short | Out-String
$gitSummary = if ($gitStatus) { $gitStatus.Trim() } else { "No changes detected" }

$commitMessage = if ($newVersion) {
    "$customDescription - Auto deploy at $datetime (SW cache $newVersion)`nChanges:`n$gitSummary"
} else {
    "$customDescription - Auto deploy at $datetime`nChanges:`n$gitSummary"
}

Write-Host ""
Write-Host "Adding files to git..." -ForegroundColor Cyan
git add .

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m $commitMessage

Write-Host "Pushing to origin main..." -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "Deploy completed successfully!" -ForegroundColor Green
