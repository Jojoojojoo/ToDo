# Supabase 資料庫操作：所需資訊說明

## 您提供的連線 URL

```
postgresql://postgres.aqhmnrwxglfmewsgvtzs:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
```

這是 **PostgreSQL 資料庫連線字串**（Direct / Pooler），用於以 SQL 客戶端或程式直接連到資料庫。  
**請勿在聊天或程式碼中貼上真實密碼**，應透過環境變數或 Cursor MCP 設定使用。

---

## 若要「由 AI / 工具代為建立資料表、欄位」的兩種方式

### 方式一：透過 Cursor 的 Supabase MCP（建議）

讓 Cursor 內建的 Supabase MCP 連到您的專案，即可由 AI 代為執行 `apply_migration`、`execute_sql` 等操作。

**需要提供的資訊（在 Cursor 設定中，不要貼在聊天）：**

| 項目 | 取得位置 | 說明 |
|------|----------|------|
| **Project Ref** | Dashboard → Project Settings → General → Reference ID | 即連線 URL 中的 `aqhmnrwxglfmewsgvtzs` |
| **Service Role Key** | Dashboard → Project Settings → API → `service_role`（secret） | 用於後端/遷移，**勿暴露在前端** |

**設定步驟：**

1. 開啟 Cursor → **Settings** → **MCP**（或 Cursor 設定中的 Supabase 整合）。
2. 新增/編輯 Supabase 專案設定，填入：
   - **Project ID / Ref**：`aqhmnrwxglfmewsgvtzs`
   - **Service Role Key**：從 Dashboard → API 複製的 `service_role` key
3. 儲存後，AI 即可透過 MCP 對該專案執行遷移與查詢。

若 MCP 已設定仍連線逾時，請檢查網路、防火牆或 Supabase 專案區域是否允許連線。

---

### 方式二：由您本機執行 SQL / Migrations（不需提供密碼給 AI）

不需要把資料庫密碼或 Service Role Key 貼給 AI。只需告訴 AI「要建立哪些資料表、欄位、關聯」，由 AI 產出 SQL 或 migration 檔，您在下列任一處執行即可：

- **Supabase Dashboard** → SQL Editor：貼上 SQL 執行。
- **本機**：`supabase link --project-ref aqhmnrwxglfmewsgvtzs` 後執行 `supabase db push`。

**AI 需要您提供的資訊：**

| 項目 | 說明 |
|------|------|
| **需求描述** | 例如：要新增的資料表名稱、欄位（名稱、型別、是否必填）、主鍵、外鍵、索引等。 |
| **既有結構（若有關聯）** | 若新表要與現有 `profiles`、`projects`、`deadlines` 等關聯，可說明關聯方式。 |

**本專案已有結構（可參考）：**

- `profiles`：使用者擴充（含 `line_user_id`、`line_notify_token`）
- `projects`、`project_members`、`deadlines`
- `notification_logs`（通知紀錄）

若要新增表或欄位，只要說明「表名 + 欄位與型別 + 與誰關聯」，即可產出對應的 migration SQL。

---

## 總結

| 目標 | 您需要提供 |
|------|-------------|
| **由 AI 透過 MCP 直接建表/改欄位** | 在 Cursor MCP 設定中填入 **Project Ref** + **Service Role Key**（不貼在聊天） |
| **由 AI 產出 SQL，您自己執行** | 只需**需求描述**（表名、欄位、型別、關聯），不需提供密碼或 URL |

**安全提醒：** 請勿在對話中貼上 `[YOUR-PASSWORD]` 的真實值或 Service Role Key；密碼僅放在本機 `.env` 或 Cursor/MCP 設定中使用。
