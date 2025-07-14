
$datetime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

git add .
git commit -m "Auto deploy commit at $datetime"
git push origin main
