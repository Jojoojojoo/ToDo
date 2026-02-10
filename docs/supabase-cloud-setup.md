# 改用雲端 Supabase

本專案透過環境變數連接 Supabase，只要將 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY` 改為雲端專案的值即可改用雲端 Supabase。

## 流程概覽

```mermaid
flowchart LR
  A[建立/選擇雲端專案] --> B[取得 URL 與 Anon Key]
  B --> C[在雲端執行 Migrations]
  C --> D[設定 .env]
  D --> E[啟動前端]
```

## 步驟一：取得雲端專案 URL 與 Key

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard) 並登入。
2. 選擇既有專案或 **New project** 建立新專案（Region 可選離自己較近的）。
3. 進入專案後，左側 **Project Settings** → **API**。
4. 複製：
   - **Project URL** → 作為 `VITE_SUPABASE_URL`
   - **Project API keys** 中的 **anon public**（或 **Publishable**）→ 作為 `VITE_SUPABASE_ANON_KEY`

> 請使用 **anon / publishable** 這類可暴露在前端的 key，勿使用 service_role key。

## 步驟二：在雲端資料庫執行 Migrations

雲端專案需要與本專案相同的 schema 與 RLS，請擇一方式執行。

### 方式 A：Supabase SQL Editor（建議第一次手動執行）

1. 開啟 [Supabase Dashboard](https://supabase.com/dashboard) → 選擇你的雲端專案。
2. 左側選單點 **SQL Editor** → 點 **+ New query** 新增查詢。
3. **第一段 SQL**：開啟專案裡的 `supabase/migrations/20250209000001_initial_schema.sql`，全選複製（Ctrl+A → Ctrl+C），貼到 SQL Editor 欄位，再點右下角 **Run**（或 Ctrl+Enter）。確認沒有錯誤訊息。
4. **第二段 SQL**：再點 **+ New query** 開一個新查詢，開啟 `supabase/migrations/20250209000002_rpc_get_user_id_by_email.sql`，全選複製貼上，再點 **Run**。
5. **第三段 SQL**：再點 **+ New query** 開一個新查詢，開啟 `supabase/migrations/20250209000003_create_project_rpc.sql`，全選複製貼上，再點 **Run**。（此 RPC 用於新增專案，避免 RLS 擋下）
6. **Phase 2 通知**：再開新查詢，執行 `supabase/migrations/20250209000004_notification_logs.sql`，建立 `notification_logs` 表。排程（pg_cron）設定見 `docs/phase2-notifications.md`。
7. 完成後可到 **Table Editor** 檢查是否出現 `profiles`、`projects`、`project_members`、`deadlines`、`notification_logs` 等表。

### 方式 B：Supabase CLI 連結雲端並 push

1. 安裝 [Supabase CLI](https://supabase.com/docs/guides/cli)（若尚未安裝）。
2. 在專案根目錄登入並連結雲端專案：
   ```bash
   supabase login
   supabase link --project-ref <你的專案 ref>
   ```
   `<你的專案 ref>` 為 Project URL 中的子網域，例如 `https://xxxxx.supabase.co` 的 `xxxxx`。
3. 推送 migrations：
   ```bash
   supabase db push
   ```

## 步驟三：設定 .env

### 3.1 確認 .env 檔案位置

- 檔案路徑：專案**根目錄**下的 `.env`
- 也就是與 `package.json` 同一層，路徑例如：`c:\Users\JoJo\Documents\Project\ToDo\.env`
- 若沒有這個檔案：在根目錄複製 `.env.example` 並重新命名為 `.env`，再編輯內容。

### 3.2 從 Supabase Dashboard 取得兩個值

1. 開啟 [Supabase Dashboard](https://supabase.com/dashboard)，選擇你的**雲端專案**。
2. 左側最下方點 **Project Settings**（齒輪圖示）。
3. 左側選 **API**。
4. 在頁面上找到並複製：
   - **Project URL**  
     例：`https://aqhmnrwxglfmewsgvtzs.supabase.co`  
     → 這就是 `VITE_SUPABASE_URL` 要填的值。
   - **Project API keys** 區塊裡的 **anon public** 或 **Publishable**（不要用 `service_role`）  
     → 這就是 `VITE_SUPABASE_ANON_KEY` 要填的值。

### 3.3 寫入 .env 的格式

用記事本或 VS Code 開啟 `.env`，內容保持兩行變數，把上面複製的值貼上：

```env
VITE_SUPABASE_URL=https://你的專案-ref.supabase.co
VITE_SUPABASE_ANON_KEY=貼上_anon_或_publishable_的整串_key
```

注意：

- `VITE_SUPABASE_URL` 結尾**不要**加 `/`（不要寫成 `https://xxx.supabase.co/`）。
- `VITE_SUPABASE_ANON_KEY` 要整串貼上，前後不要多空格或換行。
- 等號兩邊不要加引號，直接貼網址與 key 即可。

### 3.4 存檔並讓變數生效

1. 儲存 `.env`（Ctrl+S）。
2. 若專案已經在跑（例如 `npm run dev`），請**關掉**終端機裡的執行（Ctrl+C），再重新執行一次 `npm run dev`（或 `pnpm dev`）。  
   Vite 只會在啟動時讀取 `.env`，所以一定要重開一次 dev server 才會用到新設定。

## 步驟四：驗證

1. 執行 `npm run dev`（或 `pnpm dev`）啟動前端。
2. 使用註冊／登入功能，確認能連到雲端 Auth。
3. 建立專案、截止日等，確認資料寫入雲端資料庫。

## 注意事項

- **Auth 設定**：若需 Email 登入，請在 Dashboard → **Authentication** → **Providers** 確認 Email 已啟用；若用第三方登入再於 Providers 中設定。
- **RLS**：migrations 已包含 RLS 政策，僅在雲端正確執行過上述 migrations 即可。
- **本機與雲端並存**：若要同時保留本機 Supabase，可另建 `.env.local` 或不同 env 檔，並在啟動時指定（例如 `dotenv -e .env.cloud -- npm run dev`），或切換 `.env` 內容即可。
