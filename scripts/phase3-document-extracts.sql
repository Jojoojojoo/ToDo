-- Phase 3: 僅貼上此檔內容到 Supabase SQL Editor 執行（勿含 Markdown 或標題）
-- 建立 document_extracts 表與 RLS

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

-- FK：若已存在會略過
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deadlines_document_extract_id_fkey'
  ) then
    alter table public.deadlines
      add constraint deadlines_document_extract_id_fkey
      foreign key (document_extract_id) references public.document_extracts (id) on delete set null;
  end if;
end $$;

alter table public.document_extracts enable row level security;

drop policy if exists "document_extracts_select" on public.document_extracts;
create policy "document_extracts_select" on public.document_extracts
  for select using (public.is_project_accessible(project_id));

drop policy if exists "document_extracts_insert" on public.document_extracts;
create policy "document_extracts_insert" on public.document_extracts
  for insert with check (public.is_project_accessible(project_id));
