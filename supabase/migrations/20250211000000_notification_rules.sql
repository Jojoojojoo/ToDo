-- Phase 4: 依專案設定通知規則（幾天前提醒、是否發送 LINE/Email）
create table if not exists public.notification_rules (
  project_id uuid primary key references public.projects (id) on delete cascade,
  days_before int not null default 3 check (days_before >= 0 and days_before <= 365),
  notify_line boolean not null default true,
  notify_email boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_rules is '專案通知規則：幾天內到期提醒、是否發送 LINE/Email';

create trigger notification_rules_updated_at
  before update on public.notification_rules
  for each row execute function public.set_updated_at();

alter table public.notification_rules enable row level security;

-- 專案可存取者能讀取
create policy "notification_rules_select" on public.notification_rules
  for select using (public.is_project_accessible(project_id));

-- 僅專案 owner 可新增/更新/刪除
create policy "notification_rules_insert" on public.notification_rules
  for insert with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );
create policy "notification_rules_update" on public.notification_rules
  for update using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );
create policy "notification_rules_delete" on public.notification_rules
  for delete using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );
