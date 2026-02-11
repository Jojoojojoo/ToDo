-- LINE 綁定：驗證碼暫存表，供 Webhook 依 code 寫入 profiles.line_user_id
create table if not exists public.line_binding_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  line_user_id text,
  created_at timestamptz not null default now()
);

comment on table public.line_binding_requests is 'LINE 綁定驗證碼：使用者取得 code 後在 LINE 傳送，Webhook 依 code 寫入 profiles.line_user_id';

create index if not exists idx_line_binding_requests_code_pending
  on public.line_binding_requests (code, expires_at)
  where line_user_id is null;

alter table public.line_binding_requests enable row level security;

create policy "line_binding_requests_insert_own" on public.line_binding_requests
  for insert with check (auth.uid() = user_id);

create policy "line_binding_requests_select_own" on public.line_binding_requests
  for select using (auth.uid() = user_id);

-- RPC：建立綁定請求，回傳 6 位數驗證碼與過期時間（5 分鐘）
create or replace function public.create_line_binding_request()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception '未登入';
  end if;
  v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
  v_expires_at := now() + interval '5 minutes';
  insert into public.line_binding_requests (user_id, code, expires_at)
  values (v_user_id, v_code, v_expires_at);
  return jsonb_build_object('code', v_code, 'expires_at', v_expires_at);
end;
$$;

comment on function public.create_line_binding_request() is '取得 LINE 綁定用驗證碼（5 分鐘有效），供個人設定頁呼叫';
