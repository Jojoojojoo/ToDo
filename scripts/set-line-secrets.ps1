# 使用 Supabase CLI 設定 LINE Messaging 相關 Secrets
# 使用前請先：npx supabase login ; npx supabase link --project-ref aqhmnrwxglfmewsgvtzs
# 並將下方 YOUR_CHANNEL_ACCESS_TOKEN、YOUR_CHANNEL_SECRET 替換為實際值後執行

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$token = "YOUR_CHANNEL_ACCESS_TOKEN"
$secret = "YOUR_CHANNEL_SECRET"

if ($token -eq "YOUR_CHANNEL_ACCESS_TOKEN" -or $secret -eq "YOUR_CHANNEL_SECRET") {
    Write-Host "請先編輯本腳本，將 YOUR_CHANNEL_ACCESS_TOKEN 與 YOUR_CHANNEL_SECRET 替換為從 LINE Developers 取得的實際值。" -ForegroundColor Yellow
    Write-Host "取得位置：LINE Developers → 你的 Messaging API 頻道 → Channel access token (long-lived) / Basic settings → Channel secret" -ForegroundColor Gray
    exit 1
}

npx supabase secrets set "LINE_CHANNEL_ACCESS_TOKEN=$token"
npx supabase secrets set "LINE_CHANNEL_SECRET=$secret"
Write-Host "Secrets 已設定完成。" -ForegroundColor Green
