$datetime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$dateVersion = Get-Date -Format "yyyyMMdd-HHmmss"

# Function to update service worker cache version with date
function Update-ServiceWorkerVersion {
    $swPath = "sw.js"
    
    if (Test-Path $swPath) {
        $swContent = Get-Content $swPath -Raw
        
        # Replace any existing cache name with date-based version
        if ($swContent -match "const CACHE_NAME = '[^']*'") {
            $updatedContent = $swContent -replace "const CACHE_NAME = '[^']*'", "const CACHE_NAME = 'astraea-cache-$dateVersion'"
            
            # Write back to file
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

# Check git status
$gitStatus = git status --short | Out-String
$gitSummary = if ($gitStatus) { $gitStatus.Trim() } else { "No changes detected" }

# Create commit message with version info
$commitMessage = if ($newVersion) {
    "Auto deploy commit at $datetime (SW cache $newVersion)`nChanges:`n$gitSummary"
} else {
    "Auto deploy commit at $datetime`nChanges:`n$gitSummary"
}

# Git operations
Write-Host "Adding files to git..." -ForegroundColor Cyan
git add .

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m $commitMessage

Write-Host "Pushing to origin main..." -ForegroundColor Cyan
git push origin main

Write-Host "Deploy completed successfully!" -ForegroundColor Green