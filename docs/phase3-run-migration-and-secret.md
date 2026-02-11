# Phase 3：手動套用 Migration 與設定 GEMINI_API_KEY

## 1. 套用 document_extracts Migration（二擇一）

### 方式 A：Supabase Dashboard（建議）

1. 開啟 [Supabase Dashboard](https://supabase.com/dashboard) → 選擇你的專案。
2. 左側 **SQL Editor** → **New query**。
3. 貼上以下 SQL 後按 **Run**：

```sql
-- Phase 3: 文件擷取紀錄表
create table if not exists public.document_extracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  file_name text,
  extract_result jsonb not null,
  extracted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
comment on table public.document_extracts is 'AI 從文件擷取之截止日批次紀錄';

alter table public.deadlines
  add constraint deadlines_document_extract_id_fkey
  foreign key (document_extract_id) references public.document_extracts (id) on delete set null;

alter table public.document_extracts enable row level security;
create policy "document_extracts_select" on public.document_extracts
  for select using (public.is_project_accessible(project_id));
create policy "document_extracts_insert" on public.document_extracts
  for insert with check (public.is_project_accessible(project_id));
```

若出現「constraint already exists」，表示 FK 已存在，可略過該行或改為只執行 `create table` 與 `create policy` 兩段。

### 方式 B：本機 Supabase CLI（需先安裝 CLI）

若已安裝 Supabase CLI 並 `supabase link` 過專案，可用：

```powershell
cd c:\Users\JoJo\Documents\Project\ToDo
npx supabase db push
```

若遠端已套用過舊 migration，push 可能從頭執行而衝突，建議改用方式 A 只跑上面那段 SQL。

---

## 2. 設定 Azure OpenAI（Edge Function Secrets，勿寫入程式碼）

「從文件擷取截止日」改為使用 **Azure OpenAI (GPT-4.1)**。請在 Dashboard 為 **extract-deadlines** 設定以下 Secrets：

1. Dashboard → **Edge Functions** → **extract-deadlines** → **Settings** → **Secrets**。
2. 新增以下四個 Secret（Name / Value）：

| Name | Value |
|------|--------|
| `AZURE_OPENAI_ENDPOINT` | 例如 `https://ocrgpt4.openai.azure.com`（勿加尾端 `/`） |
| `AZURE_OPENAI_KEY` | 你的 Azure OpenAI API Key |
| `AZURE_OPENAI_DEPLOYMENT` | 部署名稱，例如 `gpt-4.1`（可省略，預設即為 gpt-4.1） |
| `AZURE_OPENAI_API_VERSION` | 例如 `2025-01-01-preview`（可省略） |

請勿將 API Key 寫入 `.env` 或程式碼，僅在 Dashboard 的 Edge Function Secrets 設定。

---

## 3. 部署 Edge Function

在專案目錄用 **npx** 執行（不需全域安裝 supabase）：

```powershell
cd c:\Users\JoJo\Documents\Project\ToDo
npx supabase functions deploy extract-deadlines
```

部署完成後，在專案詳情頁使用「從文件擷取截止日」即可。

---

## 4. 若出現「Failed to send a request to the Edge Function」

表示前端打不到 Edge Function，常見原因：

- **.env 指向本機**：`VITE_SUPABASE_URL` 若是 `http://127.0.0.1:54321`，Edge Function 只會存在於本機（且需執行 `supabase functions serve`）。  
  **處理**：改為使用**雲端專案**的 URL，與部署 function 的專案一致：
  - 到 [Supabase Dashboard](https://supabase.com/dashboard) → 你的專案 → **Project Settings** → **API**
  - 將 **Project URL**（例如 `https://aqhmnrwxglfmewsgvtzs.supabase.co`）設為 `VITE_SUPABASE_URL`
  - 將 **anon / publishable key** 設為 `VITE_SUPABASE_ANON_KEY`
  - 儲存 `.env` 後重新啟動 `npm run dev`，再試一次「開始擷取」
