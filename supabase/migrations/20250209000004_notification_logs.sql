-- Phase 2: 通知紀錄表，供排查與報表
create type public.notification_channel as enum ('line', 'email');

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  deadline_id uuid not null references public.deadlines (id) on delete cascade,
  recipient text not null,
  channel public.notification_channel not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.notification_logs is '通知發送紀錄：LINE/Email';
create index if not exists idx_notification_logs_deadline_id on public.notification_logs (deadline_id);
create index if not exists idx_notification_logs_sent_at on public.notification_logs (sent_at);

-- RLS：僅專案可存取者能讀取（透過 deadline -> project）
alter table public.notification_logs enable row level security;

create policy "notification_logs_select" on public.notification_logs
  for select using (
    exists (
      select 1 from public.deadlines d
      where d.id = notification_logs.deadline_id
      and public.is_project_accessible(d.project_id)
    )
  );

-- 寫入由 service role / Edge Function 執行，不開放給一般 client 透過 anon 寫入
-- 若需由後端寫入，使用 service_role key 或新增 RPC
