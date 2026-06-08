$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"

Set-Location $root

$env:APP_CORS_ALLOWED_ORIGIN_PATTERNS = "http://localhost:5173,http://localhost:3000,http://192.168.0.86:5173,https://*.trycloudflare.com"

docker start dashboard-postgres dashboard-redis | Out-Null

$backend = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if (-not $backend) {
    Start-Process `
        -FilePath ".\gradlew.bat" `
        -ArgumentList "bootRun", "--args=--server.address=0.0.0.0" `
        -WorkingDirectory $root `
        -RedirectStandardOutput (Join-Path $root "bootRun.out.log") `
        -RedirectStandardError (Join-Path $root "bootRun.err.log") `
        -WindowStyle Hidden
}

$vite = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if (-not $vite) {
    Start-Process `
        -FilePath "npm.cmd" `
        -ArgumentList "run", "dev", "--", "--host", "0.0.0.0" `
        -WorkingDirectory $frontend `
        -RedirectStandardOutput (Join-Path $root "vite.out.log") `
        -RedirectStandardError (Join-Path $root "vite.err.log") `
        -WindowStyle Hidden
}

"Naeil Dashboard local server started."
"Frontend: http://localhost:5173"
