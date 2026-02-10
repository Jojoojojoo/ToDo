-- 以 RPC 建立專案，在函式內用 auth.uid() 寫入，避免直接 INSERT 時 JWT/RLS 邊界問題
create or replace function public.create_project(p_name text, p_description text default null)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_row public.projects;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception '未登入' using errcode = 'P0001';
  end if;
  insert into public.projects (name, description, owner_id)
  values (p_name, p_description, v_uid)
  returning * into v_row;
  return v_row;
end;
$$;

comment on function public.create_project(text, text) is '建立專案，owner_id 固定為目前登入者 auth.uid()，供前端呼叫以繞過 RLS insert 邊界問題';

-- 允許已登入使用者（透過 JWT 的 anon/authenticated）呼叫
grant execute on function public.create_project(text, text) to anon;
grant execute on function public.create_project(text, text) to authenticated;
