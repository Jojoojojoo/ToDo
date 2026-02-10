-- 依 email 查詢使用者 id，供「新增專案成員」使用（前端無法直接查他人 profile）
create or replace function public.get_user_id_by_email(user_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles where lower(email) = lower(trim(user_email)) limit 1;
$$;

comment on function public.get_user_id_by_email(text) is '依 email 回傳使用者 id，僅供已登入使用者呼叫以新增專案成員';
