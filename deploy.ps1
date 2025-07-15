$datetime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$gitStatus = git status --short | Out-String
$gitSummary = if ($gitStatus) { $gitStatus.Trim() } else { "No changes detected" }

$commitMessage = "Auto deploy commit at $datetime`nChanges:`n$gitSummary"

git add .
git commit -m $commitMessage
git push origin main
