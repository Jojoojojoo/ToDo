# 專案截止日管理系統（Phase 1）

React 前端 + Supabase 後端，支援多專案／多使用者、專案與截止日 CRUD、專案成員管理。

## 環境需求

- Node.js 18+
- Supabase 專案

## 設定

1. 在 [Supabase](https://supabase.com) 建立專案。
2. 在專案 SQL Editor 依序執行：
   - `supabase/migrations/20250209000001_initial_schema.sql`
   - `supabase/migrations/20250209000002_rpc_get_user_id_by_email.sql`
3. 複製 `.env.example` 為 `.env`，填入：
   - `VITE_SUPABASE_URL`：Supabase 專案 URL
   - `VITE_SUPABASE_ANON_KEY`：Supabase anon (public) key

## 安裝與執行

```bash
cd c:\Users\JoJo\Documents\Project\ToDo
npm install
npm run build
npm run dev
```

瀏覽 `http://localhost:5173`。可先註冊帳號，再建立專案與截止日。

## 專案結構

- `src/pages/`：登入、專案列表、專案詳情（含截止日與成員）
- `src/hooks/`：Supabase 查詢與異動（React Query）
- `src/contexts/AuthContext.tsx`：登入狀態與 Supabase Auth
- `supabase/migrations/`：資料表與 RLS、RPC
