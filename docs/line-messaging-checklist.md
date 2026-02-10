# LINE Messaging API 設定完成清單

依序完成以下步驟即可啟用截止日 LINE 推播（Push Message）與 Webhook 取得使用者 userId。

**本專案專案 ref**：`aqhmnrwxglfmewsgvtzs`  
**Webhook URL**：`https://aqhmnrwxglfmewsgvtzs.supabase.co/functions/v1/line-webhook`

---

## 步驟 1：LINE Developers 取得憑證

1. 開啟 [LINE Developers](https://developers.line.biz/) 並登入。
2. 選擇你的 **Provider** → 選擇或建立 **Messaging API** 頻道。
3. 在該頻道取得兩項值（待會會用到）：

   | 項目 | 位置 | 用途 |
   |------|------|------|
   | **Channel access token (long-lived)** | **Messaging API** 分頁 → Channel access token 區塊 → Issue / 複製 | 發送 Push 訊息（`check-deadlines-notify`） |
   | **Channel secret** | **Basic settings** 分頁 → Channel secret | Webhook 簽章驗證（`line-webhook`） |

4. 若尚未發行 long-lived token：在 Messaging API 分頁點 **Issue** 發行後複製。

---

## 步驟 2：資料庫確保有 line_user_id 欄位

在 **Supabase Dashboard → SQL Editor** 執行下列其中一種方式：

**方式 A：執行專案內腳本（建議）**

- 開啟 `scripts/ensure-line-user-id-column.sql`，複製全部內容貼到 SQL Editor → **Run**。
- 會新增 `profiles.line_user_id`（若尚未存在）並列出目前 profiles。

**方式 B：若已用 CLI 推送過 migrations**

```powershell
cd c:\Users\JoJo\Documents\Project\ToDo
npm run db:link
npm run db:push
```

- 會套用 `supabase/migrations/20250210000001_add_profiles_line_user_id.sql`。

---

## 步驟 3：Supabase 設定 Secrets

在 Supabase 專案中設定兩個 Secret（Edge Functions 會讀取）：

| Secret 名稱 | 值 | 使用處 |
|-------------|-----|--------|
| `LINE_CHANNEL_ACCESS_TOKEN` | 步驟 1 的 **Channel access token (long-lived)** | 發送截止日 Push 訊息 |
| `LINE_CHANNEL_SECRET` | 步驟 1 的 **Channel secret** | Webhook 簽章驗證 |

**設定方式擇一：**

- **Dashboard**：Supabase Dashboard → **Edge Functions** → **Secrets**（或各函式 Settings）→ 新增上述名稱與值。
- **CLI**：專案根目錄、且已 `supabase link` 後執行（請替換為你的實際 token / secret）：
  ```powershell
  cd c:\Users\JoJo\Documents\Project\ToDo
  npx supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="你的Channel access token"
  npx supabase secrets set LINE_CHANNEL_SECRET="你的Channel secret"
  ```
- **腳本**：編輯 `scripts/set-line-secrets.ps1`，將 `YOUR_CHANNEL_ACCESS_TOKEN`、`YOUR_CHANNEL_SECRET` 替換為實際值後，在專案根目錄執行：
  ```powershell
  cd c:\Users\JoJo\Documents\Project\ToDo
  .\scripts\set-line-secrets.ps1
  ```
  （需已先執行 `npx supabase login` 與 `npx supabase link --project-ref aqhmnrwxglfmewsgvtzs`。）

---

## 步驟 4：部署 line-webhook Edge Function

LINE 會把「加好友／傳訊息」事件 POST 到 Webhook，需先部署 `line-webhook` 並關閉 JWT 驗證（專案已設定）。

在專案根目錄執行：

```powershell
cd c:\Users\JoJo\Documents\Project\ToDo
npx supabase functions deploy line-webhook
```

- 專案 `supabase/config.toml` 已設定 `line-webhook` 的 `verify_jwt = false`，部署後不需再改。

（若尚未連結專案：先執行 `npx supabase login` 與 `npx supabase link --project-ref aqhmnrwxglfmewsgvtzs`。）

---

## 步驟 5：在 LINE 後台設定 Webhook URL

1. 回到 [LINE Developers](https://developers.line.biz/) → 同一 Messaging API 頻道。
2. 切到 **Messaging API** 分頁。
3. 找到 **Webhook URL**，設為：
   ```text
   https://aqhmnrwxglfmewsgvtzs.supabase.co/functions/v1/line-webhook
   ```
4. 儲存後可點 **Verify**；若成功表示 Webhook 與 `LINE_CHANNEL_SECRET` 正常。

---

## 步驟 6：取得使用者 LINE userId 並寫入 profiles

1. **觸發事件**：用手機 LINE 搜尋你的 Bot（或掃 Bot 的 QR Code），加為好友，並傳任意一則訊息給 Bot。
2. **從 Log 取得 userId**：  
   Supabase Dashboard → **Edge Functions** → 選 `line-webhook` → **Logs**。  
   找最近一筆，會看到類似：
   ```json
   {"line_user_id":"U1234567890abcdef...","event_type":"message","source_type":"user","hint":"將此 line_user_id 填入 public.profiles.line_user_id"}
   ```
3. **寫入資料庫**：複製 `line_user_id` 的值，在 **SQL Editor** 執行（替換為實際的 userId 與 profile id）：
   ```sql
   UPDATE public.profiles
   SET line_user_id = 'U1234567890abcdef...'
   WHERE id = '對應的 profile id（UUID）';
   ```
   - 若不知道 profile id：可先執行 `scripts/ensure-line-user-id-column.sql` 查詢 `profiles` 的 `id`、`display_name`、`email`。

---

## 步驟 7：（可選）部署 check-deadlines-notify

若排程或手動觸發截止日通知的 Edge Function 尚未部署，可執行：

```powershell
cd c:\Users\JoJo\Documents\Project\ToDo
npx supabase functions deploy check-deadlines-notify
```

- 該函式會讀取 `LINE_CHANNEL_ACCESS_TOKEN`；若負責人 profile 有 `line_user_id`，即會用 LINE Messaging API 發送 Push，否則會依序嘗試 LINE Notify、Email。

---

## 設定完成檢查

| 項目 | 檢查方式 |
|------|----------|
| 資料庫有 `line_user_id` | Table Editor → `profiles` 表有 `line_user_id` 欄位 |
| Secrets 已設定 | Edge Functions → Secrets 有 `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET` |
| line-webhook 已部署 | Edge Functions 列表有 `line-webhook`，Logs 可看到請求 |
| Webhook URL 驗證成功 | LINE Developers → Messaging API → Webhook URL 點 Verify 成功 |
| 至少一筆 profile 有 line_user_id | SQL: `SELECT id, display_name, line_user_id FROM public.profiles WHERE line_user_id IS NOT NULL;` |

完成上述清單後，LINE Messaging API 即已啟用；排程或手動呼叫 `check-deadlines-notify` 時，有 `line_user_id` 的負責人會收到 LINE 推播。
