# 專案列表載入效能優化

## 問題診斷

### 症狀
- 專案列表頁面顯示「載入專案中...」時間過長（數秒）
- 使用者體驗不佳

### 根本原因

#### 1. RLS 政策效能問題 ⚠️
**原因**：`is_project_accessible` 函數在 RLS 政策中被呼叫，對每一列都執行兩個子查詢：
- 檢查是否為專案擁有者
- 檢查是否為專案成員

**影響**：造成 N+1 查詢問題，當專案數量增加時載入時間呈線性增長。

```sql
-- 原始的 RLS 政策（效能差）
create policy "projects_select" on public.projects
  for select using (public.is_project_accessible(id));
```

#### 2. 缺少資料庫索引 ⚠️
缺少以下關鍵索引：
- `projects.owner_id` - 用於擁有者權限檢查
- `project_members.user_id` - 用於成員權限檢查
- `project_members.project_id` - 用於專案成員查詢
- `projects.updated_at` - 用於排序

#### 3. 前端查詢策略未優化 ⚠️
- 使用 `SELECT *` 選取所有欄位，傳輸資料量較大
- 沒有使用 React Query 的快取機制
- 每次進入頁面都重新請求資料

---

## 解決方案

### 1. 資料庫層面優化

#### 新增索引
```sql
-- 加速 owner_id 的 RLS 檢查
create index idx_projects_owner_id on public.projects (owner_id);

-- 加速成員權限檢查
create index idx_project_members_user_id on public.project_members (user_id);

-- 加速專案成員查詢
create index idx_project_members_project_id on public.project_members (project_id);

-- 加速專案列表排序（按更新時間降序）
create index idx_projects_updated_at_desc on public.projects (updated_at desc);
```

#### 重寫 RLS 政策
```sql
-- 新的 RLS 政策（效能優化）
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

**優化原理**：
- 直接在政策中使用 OR 條件，讓 PostgreSQL 自動優化查詢計畫
- 避免函數呼叫的額外開銷
- 利用索引加速子查詢

### 2. 前端層面優化

#### 優化查詢欄位
```typescript
// 原始查詢（效能較差）
.select('*')

// 優化後查詢（只選取需要的欄位）
.select('id, name, description, owner_id, created_at, updated_at')
```

#### 啟用 React Query 快取
```typescript
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => { /* ... */ },
    // 啟用快取：資料在 30 秒內不會重新請求
    staleTime: 30 * 1000,
    // 快取保留 5 分鐘
    gcTime: 5 * 60 * 1000,
  });
}
```

**優化效果**：
- 減少網路請求次數
- 使用者在短時間內切換頁面時無需重新載入
- 降低 Supabase API 使用量

---

## 部署步驟

### 步驟 1：套用資料庫遷移

```powershell
cd "C:\Users\JoJo\Documents\Project\ToDo"
npm run db:push
```

### 步驟 2：驗證優化效果

1. 開啟開發伺服器：
```powershell
npm run dev
```

2. 開啟瀏覽器開發者工具（F12）
3. 切換到 Network 標籤
4. 重新整理專案列表頁面
5. 觀察載入時間

### 步驟 3：監控查詢效能（選用）

使用 Supabase Dashboard 的 Performance Insights：
1. 登入 Supabase Dashboard
2. 選擇專案
3. 進入 Database → Performance
4. 檢查慢查詢（Slow Queries）

---

## 預期效果

### 效能提升
- **查詢時間**：從 2-5 秒降至 200-500 毫秒
- **網路請求**：啟用快取後減少 70% 的重複請求
- **資料傳輸量**：減少約 30%（選取特定欄位）

### 可擴展性
- 支援更多專案數量（100+ 個專案）
- 支援更多使用者同時使用

---

## 後續監控

### 關鍵指標
1. **頁面載入時間**：目標 < 500ms
2. **API 請求時間**：目標 < 300ms
3. **快取命中率**：目標 > 60%

### 監控工具
- 瀏覽器開發者工具 Network 標籤
- React Query DevTools
- Supabase Performance Insights

---

## 額外建議

### 未來優化方向
1. **實作虛擬滾動**：當專案數量 > 50 時
2. **分頁載入**：每頁顯示 20 個專案
3. **伺服器端渲染 (SSR)**：使用 Next.js
4. **Realtime 訂閱優化**：只訂閱必要的事件

### 監控與告警
1. 設定 Supabase 效能告警（當查詢時間 > 1 秒）
2. 定期檢查資料庫查詢計畫（EXPLAIN ANALYZE）
3. 監控資料庫連線池使用率

---

## 變更記錄

| 日期 | 變更項目 | 負責人 |
|------|---------|--------|
| 2026-02-12 | 初次優化：新增索引、重寫 RLS 政策、前端快取 | - |
