# LINE Messaging API 設定（截止日通知）

截止日通知已支援 **LINE Messaging API**（Push Message），與 LINE Notify 並存；有設定時優先使用 Messaging API。

**完整設定請依 [LINE Messaging 設定完成清單](line-messaging-checklist.md) 依序完成。** 以下為各項細部說明。

## 1. 取得並設定 Channel Access Token（Long-lived）

發送 Push 訊息需要 **Channel access token (long-lived)**：

1. 開啟 [LINE Developers](https://developers.line.biz/) → 你的 Provider → 該 Messaging API 頻道。
2. 切到 **Messaging API** 分頁，找到 **Channel access token (long-lived)** 區塊。
3. 若尚未發行：點 **Issue** 發行長期 token；若已有 token，可直接點右側圖示複製整段權杖。
4. 將 token 設定到 Supabase，任選一種方式：

   **方式 A：Supabase Dashboard（建議）**

   - 開啟 [Supabase Dashboard](https://supabase.com/dashboard) → 選擇專案。
   - 左側 **Edge Functions** → 點選 `check-deadlines-notify` → **Settings**（或 **Secrets**）。
   - 新增 Secret／環境變數：
     - 名稱：`LINE_CHANNEL_ACCESS_TOKEN`
     - 值：貼上剛複製的 **Channel access token (long-lived)**（整段，含兩行合併為一行亦可）。
   - 儲存後，之後觸發排程或手動呼叫 `check-deadlines-notify` 即會使用此 token。

   **方式 B：Supabase CLI**

   - 在專案根目錄、且已 `supabase link` 該專案後執行：
   ```powershell
   supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="這裡貼上你的 Channel access token"
   ```
   - 注意：token 含特殊字元時請用雙引號包住。

## 2. 下一步：確保欄位並填入 userId（直接執行）

Token 設定完成後請執行：

1. **Supabase Dashboard → SQL Editor**，貼上並執行專案內腳本：
   - **`scripts/ensure-line-user-id-column.sql`**（確保 `profiles.line_user_id` 欄位存在，並列出目前 profiles 供對照）。
2. 取得要收通知之使用者的 **LINE userId**（見下方「取得使用者的 LINE userId」），在 SQL Editor 執行：
   ```sql
   UPDATE public.profiles
   SET line_user_id = '這裡填該使用者的 LINE userId'
   WHERE id = '對應的 profile id（UUID）';
   ```
3. 之後排程或手動觸發 `check-deadlines-notify` 時，有 `line_user_id` 的負責人即會收到 LINE Messaging API 推播。

## 3. 啟用檢查

- 已設定 `LINE_CHANNEL_ACCESS_TOKEN` 後，**LINE Messaging API 即已啟用**。
- 實際發送條件：負責人的 profile 必須有 `line_user_id`（見下方）。若尚無 `line_user_id`，該負責人不會收到 LINE 通知（會改走 LINE Notify 或僅 Email）。

## 4. 取得使用者的 LINE userId

Push 訊息要指定 **to**（使用者 LINE userId）。以下兩種方式擇一使用。

---

### 方式一：Webhook（建議，專案已提供）

使用者「加 Bot 為好友」或「對 Bot 傳一則訊息」時，LINE 會把事件送到你的 Webhook，我們從事件裡取出 `userId`。

**步驟：**

1. **取得 Channel Secret**  
   [LINE Developers](https://developers.line.biz/) → 你的 Messaging API 頻道 → **Basic settings** 分頁 → 複製 **Channel secret**。

2. **在 Supabase 設定 Channel Secret**  
   Dashboard → **Edge Functions** → **Secrets**（或各 function 的 Settings）→ 新增：
   - 名稱：`LINE_CHANNEL_SECRET`
   - 值：貼上 Channel secret

3. **部署 Webhook 函式**  
   專案內已有一支 `line-webhook` Edge Function（`supabase/functions/line-webhook/index.ts`）。部署方式：
   - **Supabase Dashboard**：Edge Functions → Create function → 名稱 `line-webhook`，貼上該檔內容後 Deploy。部署後到該函式的 **Settings** 將 **Verify JWT** 關閉（LINE 不會帶 JWT，改以簽章驗證）。
   - **CLI**：專案已於 `supabase/config.toml` 設定 `line-webhook` 的 `verify_jwt = false`，直接執行 `supabase functions deploy line-webhook` 即可。

4. **在 LINE 後台設定 Webhook URL**  
   LINE Developers → 該頻道 → **Messaging API** 分頁 → **Webhook URL** 設為：
   ```text
   https://你的專案-ref.supabase.co/functions/v1/line-webhook
   ```
   例如：`https://aqhmnrwxglfmewsgvtzs.supabase.co/functions/v1/line-webhook`  
   儲存後可點 **Verify** 測試（需已部署且 `LINE_CHANNEL_SECRET` 已設）。

5. **觸發事件以取得 userId**  
   - 用手機 LINE 搜尋你的 Bot（或掃 Bot 的 QR Code），加為好友。  
   - 或加好友後傳任意一則訊息給 Bot。

6. **從 Log 複製 userId**  
   Supabase Dashboard → **Edge Functions** → 選 `line-webhook` → **Logs**。  
   找最近一筆 log，內容會有一行 JSON，例如：
   ```json
   {"line_user_id":"U1234567890abcdef...","event_type":"message","source_type":"user","hint":"將此 line_user_id 填入 public.profiles.line_user_id"}
   ```
   複製 `line_user_id` 的值（即 LINE userId），寫入該使用者的 profile：
   ```sql
   UPDATE public.profiles
   SET line_user_id = 'U1234567890abcdef...'
   WHERE id = '對應的 profile id（UUID）';
   ```

---

### 方式二：LINE Login（若專案有整合）

若你的 App 有使用 **LINE Login**，使用者登入後可從 ID Token 的 `sub` 或 LINE 回傳的 profile 取得 userId（與 Messaging API 的 userId 相同）。將該值寫入 `public.profiles.line_user_id` 對應欄位即可。

## 5. 行為說明

- 若設了 `LINE_CHANNEL_ACCESS_TOKEN` 且該負責人 profile 有 `line_user_id`：用 **LINE Messaging API** 發送。
- 若無 `line_user_id` 但有 `line_notify_token`：改用 **LINE Notify**。
- 兩者皆無則不發 LINE，僅依 `email` + Resend 發 Email（若有設）。

## 6. 資料庫

已新增欄位（migration `20250210000001_add_profiles_line_user_id.sql`）：

- `public.profiles.line_user_id`（text, 可為 null）：LINE Messaging API 用的使用者 userId。

若尚未執行 migration，可在 SQL Editor 執行：

```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id text;
```
