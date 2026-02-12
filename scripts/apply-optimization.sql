-- 手動套用優化腳本
-- 請在 Supabase Dashboard → SQL Editor 執行此腳本
-- 或使用指令：supabase db execute --file scripts/apply-optimization.sql

-- 優化專案查詢效能：添加索引並重寫 RLS 政策
-- 解決載入時間過長問題

-- 1. 添加關鍵索引，加速 RLS 政策檢查
create index if not exists idx_projects_owner_id 
  on public.projects (owner_id);

create index if not exists idx_project_members_user_id 
  on public.project_members (user_id);

create index if not exists idx_project_members_project_id 
  on public.project_members (project_id);

-- 2. 優化 projects_select RLS 政策
-- 原本的政策對每一列都呼叫 is_project_accessible 函數，造成 N+1 查詢問題
-- 新的政策直接使用 OR 條件，讓 PostgreSQL 自動優化查詢計畫

drop policy if exists "projects_select" on public.projects;

create policy "projects_select" on public.projects
  for select using (
    -- 情況 1: 使用者是專案擁有者
    auth.uid() = owner_id
    or
    -- 情況 2: 使用者是專案成員
    exists (
      select 1 
      from public.project_members pm
      where pm.project_id = projects.id 
        and pm.user_id = auth.uid()
    )
  );

-- 3. 為常用查詢欄位添加複合索引
create index if not exists idx_projects_updated_at_desc 
  on public.projects (updated_at desc);

comment on index idx_projects_owner_id is '加速 owner_id 的 RLS 檢查';
comment on index idx_project_members_user_id is '加速成員權限檢查';
comment on index idx_project_members_project_id is '加速專案成員查詢';
comment on index idx_projects_updated_at_desc is '加速專案列表排序（按更新時間降序）';

-- 驗證索引已建立
select 
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('projects', 'project_members')
order by tablename, indexname;
