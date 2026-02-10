# 使用 Supabase CLI 操作資料庫（不需 MCP）

本專案已將 **Supabase CLI** 安裝為 dev 依賴，可直接在專案目錄用 `npx supabase` 或 npm 腳本操作雲端資料庫與 Edge Functions。

## 前置：登入與連結專案

在專案根目錄（`c:\Users\JoJo\Documents\Project\ToDo`）執行：

```powershell
cd c:\Users\JoJo\Documents\Project\ToDo
npx supabase login
npx supabase link --project-ref aqhmnrwxglfmewsgvtzs
```

- `supabase login` 會開瀏覽器完成登入。
- `link` 的 `aqhmnrwxglfmewsgvtzs` 為您的專案 ref（與連線 URL 一致）；若不同請改為自己的 ref。

連結時會要求輸入 **Database password**（即連線 URL 裡的 `[YOUR-PASSWORD]`），輸入後會寫入本機連結設定，之後不需再輸入。

## 常用指令（一律在專案根目錄執行）

| 目的 | 指令 |
|------|------|
| 將本機 migrations 推到雲端 | `npm run db:push` 或 `npx supabase db push` |
| 連結／重新連結雲端專案 | `npm run db:link` 或 `npx supabase link --project-ref <ref>` |
| 產生與雲端差異的 migration | `npm run db:diff` 或 `npx supabase db diff -f <檔名>` |
| 部署 Edge Functions | `npm run functions:deploy` 或 `npx supabase functions deploy` |
| 呼叫任意 Supabase CLI 子指令 | `npx supabase <子指令>` |

## 建立資料表／欄位（推薦流程）

1. **撰寫 migration 檔**  
   在 `supabase/migrations/` 新增一個檔案，例如：  
   `supabase/migrations/20250210120000_add_xxx_table.sql`  
   內容為標準 PostgreSQL DDL（`CREATE TABLE`、`ALTER TABLE` 等）。

2. **推到雲端**  
   ```powershell
   cd c:\Users\JoJo\Documents\Project\ToDo
   npm run db:push
   ```

3. **若已先在 Dashboard 手動改過 schema**  
   可先連結專案，再產生「目前雲端與本機 schema 的差異」成 migration：  
   ```powershell
   npx supabase db diff -f name_of_change
   ```  
   會在本機產生一個新的 migration 檔，再依需要編輯後執行 `npm run db:push`。

## LINE Messaging 相關

- **部署 Webhook**：`npx supabase functions deploy line-webhook`（或 `npm run functions:deploy` 僅部署所有 functions；單獨部署 webhook 請用上述指令）。
- **設定 LINE Secrets**：`npx supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="..."`、`LINE_CHANNEL_SECRET="..."`；或使用 `scripts/set-line-secrets.ps1`（需先編輯腳本填入 token／secret）。完整步驟見 **docs/line-messaging-checklist.md**。

## 注意事項

- 所有資料庫操作皆透過 **Supabase CLI** 與您本機的 `supabase link` 設定連線，**不需使用 Cursor MCP**。
- Database password 僅在 `supabase link` 時輸入，會存在本機；請勿將密碼提交到版控。
- 若從未在雲端執行過 migrations，請先完成 `supabase link` 再執行第一次 `npm run db:push`。
