# 執行資料庫優化腳本
# 使用方式：在 PowerShell 執行此檔案

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "專案列表載入優化 - 自動執行腳本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "C:\Users\JoJo\Documents\Project\ToDo"
$sqlFile = "$projectRoot\scripts\apply-optimization.sql"

Write-Host "檢查 SQL 檔案..." -ForegroundColor Yellow
if (-not (Test-Path $sqlFile)) {
    Write-Host "錯誤：找不到 SQL 檔案：$sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "✓ SQL 檔案已找到" -ForegroundColor Green
Write-Host ""

Write-Host "嘗試執行資料庫優化..." -ForegroundColor Yellow
Write-Host ""

# 方法 1：嘗試使用 Supabase CLI
Write-Host "方法 1：使用 Supabase CLI (如果已連結專案)" -ForegroundColor Cyan
Write-Host "執行指令：supabase db execute --file scripts/apply-optimization.sql --linked" -ForegroundColor Gray
Write-Host ""

cd $projectRoot
$result = & npx supabase db execute --file scripts/apply-optimization.sql --linked 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 資料庫優化執行成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "請繼續執行以下步驟：" -ForegroundColor Cyan
    Write-Host "1. 重新啟動開發伺服器：npm run dev" -ForegroundColor White
    Write-Host "2. 開啟瀏覽器：http://localhost:5173" -ForegroundColor White
    Write-Host "3. 測試載入速度是否改善" -ForegroundColor White
} else {
    Write-Host "✗ Supabase CLI 執行失敗" -ForegroundColor Red
    Write-Host ""
    Write-Host "請改用方法 2：手動在 Supabase Dashboard 執行" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "步驟：" -ForegroundColor Cyan
    Write-Host "1. 開啟以下網址：" -ForegroundColor White
    Write-Host "   https://supabase.com/dashboard/project/aqhmnrwxglfmewsgvtzs/sql/new" -ForegroundColor Blue
    Write-Host ""
    Write-Host "2. 複製 SQL 腳本內容（已自動複製到剪貼簿）" -ForegroundColor White
    
    # 讀取 SQL 檔案並複製到剪貼簿
    $sqlContent = Get-Content $sqlFile -Raw
    Set-Clipboard -Value $sqlContent
    Write-Host "   ✓ SQL 已複製到剪貼簿" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "3. 在 Supabase Dashboard 貼上並執行（點擊 Run 按鈕）" -ForegroundColor White
    Write-Host ""
    
    # 自動開啟瀏覽器
    Write-Host "正在開啟 Supabase Dashboard..." -ForegroundColor Yellow
    Start-Process "https://supabase.com/dashboard/project/aqhmnrwxglfmewsgvtzs/sql/new"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "需要協助？請參考：docs/quick-fix-loading-slow.md" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
