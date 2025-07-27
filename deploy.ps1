$datetime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$dateVersion = Get-Date -Format "yyyyMMdd-HHmmss"

$customDescription = Read-Host "Enter a short commit description"

function Update-ServiceWorkerVersion {
    $swPath = "sw.js"
    
    if (Test-Path $swPath) {
        $swContent = Get-Content $swPath -Raw
        $updated = $false

        # Check for old single cache name pattern (backwards compatibility)
        if ($swContent -match "const CACHE_NAME = '[^']*'") {
            $swContent = $swContent -replace "const CACHE_NAME = '[^']*'", "const CACHE_NAME = 'astraea-cache-$dateVersion'"
            $updated = $true
            Write-Host "Updated main cache version to: astraea-cache-$dateVersion" -ForegroundColor Green
        }
        
        # Check for new multi-cache pattern
        if ($swContent -match "const STATIC_CACHE = '[^']*'") {
            $swContent = $swContent -replace "const STATIC_CACHE = '[^']*'", "const STATIC_CACHE = 'astraea-static-v$dateVersion'"
            $updated = $true
            Write-Host "Updated static cache version to: astraea-static-v$dateVersion" -ForegroundColor Green
        }
        
        if ($swContent -match "const DYNAMIC_CACHE = '[^']*'") {
            $swContent = $swContent -replace "const DYNAMIC_CACHE = '[^']*'", "const DYNAMIC_CACHE = 'astraea-dynamic-v$dateVersion'"
            $updated = $true
            Write-Host "Updated dynamic cache version to: astraea-dynamic-v$dateVersion" -ForegroundColor Green
        }
        
        if ($updated) {
            Set-Content -Path $swPath -Value $swContent -NoNewline
            return $dateVersion
        } else {
            Write-Host "No cache name patterns found in sw.js" -ForegroundColor Yellow
            return $null
        }
    } else {
        Write-Host "sw.js not found" -ForegroundColor Red
        return $null
    }
}

function Show-ServiceWorkerCacheInfo {
    $swPath = "sw.js"
    
    if (Test-Path $swPath) {
        $swContent = Get-Content $swPath -Raw
        
        # Count static assets if present
        if ($swContent -match "const STATIC_ASSETS = \[(.*?)\];") {
            $staticAssetsSection = $matches[1]
            $staticAssetCount = ($staticAssetsSection -split "'" | Where-Object { $_ -match "^/" }).Count
            Write-Host "Static assets cached: $staticAssetCount files" -ForegroundColor Cyan
        } elseif ($swContent -match "FILES_TO_CACHE = \[(.*?)\];") {
            # Fallback for older pattern
            $filesSection = $matches[1]
            $fileCount = ($filesSection -split "'" | Where-Object { $_ -match "^/" }).Count
            Write-Host "Files cached: $fileCount files" -ForegroundColor Cyan
        }
        
        # Count offline-capable APIs if present
        if ($swContent -match "const OFFLINE_CAPABLE_APIS = \[(.*?)\];") {
            $apisSection = $matches[1]
            $apiCount = ($apisSection -split "'" | Where-Object { $_ -match "^/" }).Count
            Write-Host "Offline-capable APIs: $apiCount endpoints" -ForegroundColor Cyan
        }
        
        # Check for background sync
        if ($swContent -match "addEventListener\('sync'") {
            Write-Host "Background sync: Enabled" -ForegroundColor Green
        } else {
            Write-Host "Background sync: Not configured" -ForegroundColor Yellow
        }
        
        # Check for offline page generation
        if ($swContent -match "createOfflineResponse") {
            Write-Host "Offline fallback pages: Enabled" -ForegroundColor Green
        } else {
            Write-Host "Offline fallback pages: Basic" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Service worker not found" -ForegroundColor Gray
    }
}

Write-Host "=== App Deployment Script ===" -ForegroundColor Magenta
Write-Host ""

# Show current service worker info if it exists
if (Test-Path "sw.js") {
    Write-Host "Service Worker Configuration:" -ForegroundColor Yellow
    Show-ServiceWorkerCacheInfo
    Write-Host ""
}

# Update service worker versions
$newVersion = Update-ServiceWorkerVersion
Write-Host ""

# Check git status
$gitStatus = git status --short | Out-String
$gitSummary = if ($gitStatus) { $gitStatus.Trim() } else { "No changes detected" }

# Show what will be deployed
Write-Host "Files to be deployed:" -ForegroundColor Yellow
if ($gitStatus) {
    $gitStatus.Split("`n") | ForEach-Object {
        if ($_.Trim()) {
            $status = $_.Substring(0,2)
            $file = $_.Substring(3)
            $color = switch ($status.Trim()) {
                "M" { "Yellow" }    # Modified
                "A" { "Green" }     # Added
                "D" { "Red" }       # Deleted
                "R" { "Cyan" }      # Renamed
                "??" { "Magenta" }  # Untracked
                default { "White" }
            }
            Write-Host "  $status $file" -ForegroundColor $color
        }
    }
} else {
    Write-Host "  No changes detected" -ForegroundColor Gray
}
Write-Host ""

# Create detailed commit message
$commitMessage = if ($newVersion) {
    @"
$customDescription - Deploy $datetime

Service Worker Cache Updated: v$newVersion

Changes:
$gitSummary
"@
} else {
    @"
$customDescription - Deploy $datetime

Changes:
$gitSummary
"@
}

# Show commit message preview
Write-Host "Commit message:" -ForegroundColor Cyan
Write-Host $commitMessage -ForegroundColor Gray
Write-Host ""
Write-Host "Starting deployment..." -ForegroundColor Cyan

try {
    Write-Host "Adding files to git..." -ForegroundColor Cyan
    git add .
    
    if ($LASTEXITCODE -ne 0) {
        throw "Git add failed"
    }

    Write-Host "Committing changes..." -ForegroundColor Cyan
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -ne 0) {
        throw "Git commit failed"  
    }

    Write-Host "Pushing to origin main..." -ForegroundColor Cyan
    git push origin main
    
    if ($LASTEXITCODE -ne 0) {
        throw "Git push failed"
    }

    Write-Host ""
    Write-Host "Deploy completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Deployment Summary:" -ForegroundColor Cyan
    Write-Host "  - Time: $datetime" -ForegroundColor White
    Write-Host "  - Description: $customDescription" -ForegroundColor White
    if ($newVersion) {
        Write-Host "  - Cache Version: v$newVersion" -ForegroundColor White
    }
    Write-Host "  - Repository: Updated" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check the error above and try again." -ForegroundColor Yellow
    exit 1
}