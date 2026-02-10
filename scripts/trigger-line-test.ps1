# Trigger check-deadlines-notify for LINE test. Run line-test-notification.sql first.
$ErrorActionPreference = "Stop"

# Resolve project root: script is in scripts\, so parent is root. Fallback to current dir.
$root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
if (-not (Test-Path (Join-Path $root "package.json"))) {
  $root = (Get-Location).Path
}
Set-Location $root

$envPath = Join-Path $root ".env"
$url = "https://aqhmnrwxglfmewsgvtzs.supabase.co/functions/v1/check-deadlines-notify"

# Read CRON_SECRET: env var first, then .env file
$cronSecret = $env:CRON_SECRET
if (-not $cronSecret -and (Test-Path -LiteralPath $envPath)) {
  $lines = $null
  try {
    $lines = Get-Content -LiteralPath $envPath -Encoding UTF8
  } catch {
    try { $lines = Get-Content -LiteralPath $envPath -Encoding Default } catch { }
  }
  if ($lines) {
    foreach ($line in $lines) {
      $t = $line.Trim().Trim([char]0xFEFF)
      if ($t -and $t -notmatch '^\s*#' -and $t -match '^\s*CRON_SECRET\s*=\s*(.+)$') {
        $cronSecret = $matches[1].Trim().Trim('"').Trim("'")
        break
      }
    }
  }
}

if (-not $cronSecret) {
  Write-Host "CRON_SECRET not found. Add to .env: CRON_SECRET=YourSecret" -ForegroundColor Yellow
  Write-Host "  Expected .env: $envPath" -ForegroundColor Gray
  exit 1
}

$body = '{"secret":"' + $cronSecret + '"}'
Write-Host "Calling check-deadlines-notify..." -ForegroundColor Cyan
$headers = @{ "Content-Type" = "application/json" }
try {
  $r = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
  Write-Host "Response: $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
  if ($r.ok) {
    Write-Host "sent: $($r.sent), sent_line: $($r.sent_line), sent_email: $($r.sent_email)" -ForegroundColor Green
    Write-Host "Check LINE app for the reminder." -ForegroundColor Cyan
  }
} catch {
  Write-Host "Request failed: $_" -ForegroundColor Red
  if ($_.Exception.Response) {
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $reader.BaseStream.Position = 0
      $errBody = $reader.ReadToEnd()
      if ($errBody) { Write-Host "Response body: $errBody" -ForegroundColor Gray }
    } catch { }
  }
  exit 1
}
