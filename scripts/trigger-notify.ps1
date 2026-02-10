# 觸發 check-deadlines-notify Edge Function（PowerShell）
# 使用前請設定下方變數，或從環境變數讀取

param(
    [string]$ProjectUrl = $env:SUPABASE_PROJECT_URL,
    [string]$AnonKey = $env:SUPABASE_ANON_KEY,
    [string]$CronSecret = $env:CRON_SECRET,
    [switch]$UseSecretInBody
)

if (-not $ProjectUrl -or -not $AnonKey) {
    Write-Host "請提供 ProjectUrl 與 AnonKey（或設定環境變數 SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY）" -ForegroundColor Red
    Write-Host "例: .\trigger-notify.ps1 -ProjectUrl 'https://xxxxx.supabase.co' -AnonKey 'eyJ...'" -ForegroundColor Gray
    exit 1
}

$url = "$ProjectUrl/functions/v1/check-deadlines-notify"
$headers = @{
    "Content-Type" = "application/json"
}

if ($CronSecret) {
    if ($UseSecretInBody) {
        $headers["Authorization"] = "Bearer $AnonKey"
        $body = @{ secret = $CronSecret } | ConvertTo-Json
    } else {
        $headers["Authorization"] = "Bearer $CronSecret"
        $body = "{}"
    }
} else {
    $headers["Authorization"] = "Bearer $AnonKey"
    $body = "{}"
}

Write-Host "POST $url" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        Write-Host $reader.ReadToEnd()
    }
    exit 1
}
