-- Phase 1: 專案、截止日、成員與 RLS
-- 執行於 Supabase SQL Editor 或 supabase db push

-- 1. profiles：擴充 auth.users，存放 display_name、line_notify_token
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  line_notify_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '使用者擴充資料，與 Auth 整合';

-- 2. projects：專案
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is '專案主表';

-- 3. project_members：專案成員（多對多）
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

comment on table public.project_members is '專案成員，決定誰可存取專案';

-- 4. deadlines：截止日／里程碑
create type public.deadline_source as enum ('manual', 'document_extract');

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  due_date date not null,
  description text,
  source public.deadline_source not null default 'manual',
  document_extract_id uuid,
  assignee_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.deadlines is '專案截止日／里程碑';

-- 5. 觸發器：更新 updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();
create trigger deadlines_updated_at
  before update on public.deadlines
  for each row execute function public.set_updated_at();

-- 6. 新用戶自動建立 profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'display_name',
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. RLS 啟用
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.deadlines enable row level security;

-- 8. RLS 政策：profiles（僅能讀寫自己的）
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- 9. 輔助：是否為專案可存取者（owner 或 member）
create or replace function public.is_project_accessible(project_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.projects p
    where p.id = project_uuid and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.project_members pm
    where pm.project_id = project_uuid and pm.user_id = auth.uid()
  );
$$ language sql security definer stable;

-- 10. RLS：projects（建立者或成員可讀；僅建立者可寫；建立者可刪除）
create policy "projects_select" on public.projects
  for select using (public.is_project_accessible(id));
create policy "projects_insert" on public.projects
  for insert with check (auth.uid() = owner_id);
create policy "projects_update" on public.projects
  for update using (auth.uid() = owner_id);
create policy "projects_delete" on public.projects
  for delete using (auth.uid() = owner_id);

-- 11. RLS：project_members（專案內可見；僅 owner 可增刪成員）
create policy "project_members_select" on public.project_members
  for select using (public.is_project_accessible(project_id));
create policy "project_members_insert" on public.project_members
  for insert with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );
create policy "project_members_delete" on public.project_members
  for delete using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- 12. RLS：deadlines（專案可存取即可 CRUD）
create policy "deadlines_select" on public.deadlines
  for select using (public.is_project_accessible(project_id));
create policy "deadlines_insert" on public.deadlines
  for insert with check (public.is_project_accessible(project_id));
create policy "deadlines_update" on public.deadlines
  for update using (public.is_project_accessible(project_id));
create policy "deadlines_delete" on public.deadlines
  for delete using (public.is_project_accessible(project_id));
