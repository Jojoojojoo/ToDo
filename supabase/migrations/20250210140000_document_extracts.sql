-- Phase 3: 文件擷取紀錄表，供 AI 擷取結果寫入或建議寫入截止日時關聯
-- document_extracts：單次擷取批次；deadlines.document_extract_id 指向此表

create table if not exists public.document_extracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  file_name text,
  extract_result jsonb not null,
  extracted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.document_extracts is 'AI 從文件擷取之截止日批次紀錄；extract_result 存建議清單';

-- deadlines 的 document_extract_id 關聯至 document_extracts
alter table public.deadlines
  add constraint deadlines_document_extract_id_fkey
  foreign key (document_extract_id) references public.document_extracts (id) on delete set null;

-- RLS：專案可存取者即可讀寫 document_extracts
alter table public.document_extracts enable row level security;

create policy "document_extracts_select" on public.document_extracts
  for select using (public.is_project_accessible(project_id));
create policy "document_extracts_insert" on public.document_extracts
  for insert with check (public.is_project_accessible(project_id));
