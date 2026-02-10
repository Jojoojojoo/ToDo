# LINE Messaging API 測試流程

依序執行以下步驟，確認截止日會以 **LINE 推播** 送達。

---

## 步驟 1：準備測試資料（SQL）

在 **Supabase Dashboard → SQL Editor**：

1. 新增查詢（+ New query）。
2. 開啟專案內 **`scripts/line-test-notification.sql`**，全選複製貼上。
3. 點 **Run**。

會完成：

- 確保 `profiles.line_user_id` 欄位存在。
- 將 LINE userId `U0dffbf23149e40170c8c376c387d65d0` 寫入 profile（若尚未寫入則寫入「最新一筆」）。
- 建立測試專案「LINE測試專案-截止日通知」與一筆「今天+2 天」到期的截止日，負責人為該 profile。
- 查詢結果會列出該 profile 與 3 天內的截止日，可確認資料正確。

---

## 步驟 2：觸發通知（PowerShell）

在專案根目錄執行：

```powershell
cd c:\Users\JoJo\Documents\Project\ToDo
.\scripts\trigger-line-test.ps1
```

腳本會讀取 `.env` 的 `VITE_SUPABASE_ANON_KEY`，對 `check-deadlines-notify` 發送 POST。成功時會印出 `ok: true`、`sent_line: 1` 等。

**驗證方式**：腳本會先讀取 `.env` 的 `VITE_SUPABASE_ANON_KEY`；若另有 `CRON_SECRET`，會改用 CRON_SECRET 做驗證（Header Bearer 或 Body `secret`），可避免 401。若觸發時出現 401，請在 `.env` 加上一行 `CRON_SECRET=你的密碼`（與 Edge Function 設定的 CRON_SECRET 一致）後再執行。

---

## 步驟 3：確認結果

1. **LINE**：綁定該 Bot 的 LINE 帳號應收到一則「【截止日提醒】…」訊息。
2. **Log**：在 **SQL Editor** 執行：
   ```sql
   SELECT id, deadline_id, recipient, channel, sent_at
   FROM public.notification_logs
   ORDER BY sent_at DESC
   LIMIT 10;
   ```
   應有一筆 `channel = 'line'`、`recipient` 為該 LINE userId 的紀錄。

---

## 常見狀況

| 狀況 | 可能原因 |
|------|----------|
| `sent_line: 0` | 該 profile 沒有 `line_user_id`；或 `LINE_CHANNEL_ACCESS_TOKEN` 未設；或今日同 deadline 已發過 LINE（防重複） |
| 401 Unauthorized | 未設 CRON_SECRET 時請用 anon key；有設則需在 Body 或 Header 帶正確 CRON_SECRET |
| 有 notification_logs 但沒收到 LINE | 檢查 LINE 後台 Bot 狀態、或該 userId 是否已封鎖/刪除 Bot |
