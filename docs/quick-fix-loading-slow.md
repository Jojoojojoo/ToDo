# 🚀 快速修復：專案列表載入緩慢

## 問題
專案列表頁面顯示「載入專案中...」時間過長（2-5 秒）

## 根本原因
1. 資料庫 RLS 政策效能不佳（N+1 查詢問題）
2. 缺少關鍵索引
3. 前端未啟用快取

## 修復步驟

### 步驟 1：套用資料庫優化（2 分鐘）

**方法 A：使用 Supabase Dashboard（推薦）**

1. 開啟 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇專案：`aqhmnrwxglfmewsgvtzs`
3. 點擊左側選單：**SQL Editor**
4. 點擊 **New Query**
5. 複製貼上以下內容：

```sql
-- 1. 添加索引
create index if not exists idx_projects_owner_id 
  on public.projects (owner_id);

create index if not exists idx_project_members_user_id 
  on public.project_members (user_id);

create index if not exists idx_project_members_project_id 
  on public.project_members (project_id);

create index if not exists idx_projects_updated_at_desc 
  on public.projects (updated_at desc);

-- 2. 優化 RLS 政策
drop policy if exists "projects_select" on public.projects;

create policy "projects_select" on public.projects
  for select using (
    auth.uid() = owner_id
    or
    exists (
      select 1 
      from public.project_members pm
      where pm.project_id = projects.id 
        and pm.user_id = auth.uid()
    )
  );
```

6. 點擊右下角 **Run** 按鈕
7. 看到 "Success. No rows returned" 即表示完成

**方法 B：使用本地腳本**

```powershell
cd "C:\Users\JoJo\Documents\Project\ToDo"
supabase db execute --file scripts/apply-optimization.sql --linked
```

### 步驟 2：驗證優化（1 分鐘）

**驗證索引已建立：**

在 Supabase SQL Editor 執行：

```sql
select 
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('projects', 'project_members')
order by tablename, indexname;
```

應該看到：
- `idx_projects_owner_id`
- `idx_projects_updated_at_desc`
- `idx_project_members_project_id`
- `idx_project_members_user_id`

### 步驟 3：測試載入速度（1 分鐘）

1. 開啟開發伺服器（如果尚未執行）：
```powershell
cd "C:\Users\JoJo\Documents\Project\ToDo"
npm run dev
```

2. 開啟瀏覽器：`http://localhost:5173`

3. 開啟開發者工具（F12）→ Network 標籤

4. 重新整理頁面，觀察：
   - **projects** API 請求時間應該 < 300ms
   - 頁面載入應該 < 1 秒

5. 切換到其他頁面再回來，應該**幾乎瞬間**載入（快取生效）

---

## 預期效果

### 效能提升對照表

| 指標 | 優化前 | 優化後 | 改善幅度 |
|------|--------|--------|----------|
| 專案列表 API 請求 | 2-5 秒 | 200-500 毫秒 | **90%** ↓ |
| 頁面首次載入 | 3-6 秒 | < 1 秒 | **83%** ↓ |
| 重複訪問（快取） | 3-6 秒 | < 100 毫秒 | **98%** ↓ |

---

## 故障排除

### Q1: 執行 SQL 出現權限錯誤
**A:** 確認已在 Supabase Dashboard 登入正確的帳號，且有該專案的 Owner 或 Admin 權限。

### Q2: 索引建立失敗
**A:** 檢查是否已存在同名索引。可先執行：
```sql
drop index if exists idx_projects_owner_id;
drop index if exists idx_project_members_user_id;
drop index if exists idx_project_members_project_id;
drop index if exists idx_projects_updated_at_desc;
```
然後重新建立。

### Q3: 載入速度沒有明顯改善
**A:** 
1. 清除瀏覽器快取（Ctrl+Shift+Delete）
2. 硬重新整理（Ctrl+F5）
3. 檢查 Network 標籤中 projects API 的實際回應時間
4. 確認索引已正確建立（執行步驟 2 的驗證查詢）

### Q4: 專案數量很少（<5 個），但還是慢
**A:** 
1. 檢查網路連線速度
2. 檢查 Supabase 專案地區（若太遠會增加延遲）
3. 可能是 AuthContext 初始化慢，檢查瀏覽器 Console 是否有錯誤

---

## 進階監控

### 查看查詢執行計畫（進階）

```sql
explain analyze
select *
from public.projects
order by updated_at desc;
```

**優化前**：會看到許多 "Function Scan" 和 "SubPlan"

**優化後**：應該看到 "Index Scan" 和更低的執行時間

---

## 回滾方案（如有問題）

如果優化後出現問題，可執行：

```sql
-- 移除索引
drop index if exists idx_projects_owner_id;
drop index if exists idx_project_members_user_id;
drop index if exists idx_project_members_project_id;
drop index if exists idx_projects_updated_at_desc;

-- 恢復原始 RLS 政策
drop policy if exists "projects_select" on public.projects;

create policy "projects_select" on public.projects
  for select using (public.is_project_accessible(id));
```

---

## 更多資訊

詳細的技術說明請參考：[performance-optimization.md](./performance-optimization.md)
