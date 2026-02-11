# LINE 綁定與個人設定

使用者可在**個人設定**頁自行綁定 LINE，無需手動寫入 `profiles.line_user_id`。

## 流程

1. 登入後進入 **設定**（或 `/settings`）。
2. 點擊「綁定 LINE」→ 系統產生一組 **6 位數驗證碼**（5 分鐘有效）。
3. 使用 LINE 加 Bot 為好友，並在對話中**傳送該驗證碼**。
4. Webhook 辨識驗證碼後，自動將 LINE userId 寫入該使用者的 `profiles.line_user_id`，並在 LINE 回覆「綁定成功」。
5. 回到設定頁點「檢查綁定狀態」或重新整理，即可看到「已綁定 LINE」。

## 資料庫

- **Migration**：`supabase/migrations/20250211100000_line_binding_requests.sql`
  - 新增表 `line_binding_requests`（user_id、code、expires_at、line_user_id）。
  - 新增 RPC `create_line_binding_request()`，回傳 `{ code, expires_at }`。
- 套用方式：Supabase Dashboard → SQL Editor 執行該檔內容，或 `npx supabase db push`。

## Edge Function：line-webhook

- 已擴充：收到**文字訊息**時，以訊息內容為驗證碼查詢 `line_binding_requests`；若找到未過期且未使用的請求，則更新 `profiles.line_user_id` 並在 LINE 回覆。
- **Secrets**：
  - `LINE_CHANNEL_SECRET`（必填）：Webhook 簽章驗證。
  - `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`：通常由 Supabase 自動注入。
  - `LINE_CHANNEL_ACCESS_TOKEN`（選填）：若設定，綁定成功／失敗時會回覆訊息給使用者；未設則僅寫入 DB 不回覆。
- 部署：`npx supabase functions deploy line-webhook`

## 個人設定頁

- **基本資料**：顯示 Email（唯讀）、可編輯顯示名稱並儲存。
- **LINE 綁定**：綁定／已綁定／檢查綁定狀態／解除綁定。
