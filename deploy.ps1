$datetime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$dateVersion = Get-Date -Format "yyyyMMdd-HHmmss"

# Prompt user for commit description
$customDescription = Read-Host "Enter a short commit description"

# Function to update service worker cache version with date
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

# Update service worker version
$newVersion = Update-ServiceWorkerVersion

# Git status summary
$gitStatus = git status --short | Out-String
$gitSummary = if ($gitStatus) { $gitStatus.Trim() } else { "No changes detected" }

# Commit message
$commitMessage = if ($newVersion) {
    "$customDescription - Auto deploy at $datetime (SW cache $newVersion)`nChanges:`n$gitSummary"
} else {
    "$customDescription - Auto deploy at $datetime`nChanges:`n$gitSummary"
}

# Git operations
Write-Host ""
Write-Host "Adding files to git..." -ForegroundColor Cyan
git add .

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m $commitMessage

Write-Host "Pushing to origin main..." -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "Deploy completed successfully!" -ForegroundColor Green
