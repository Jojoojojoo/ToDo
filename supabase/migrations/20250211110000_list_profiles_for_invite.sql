-- 方案 B：成員選擇器用 RPC，供專案 owner 取得「可邀請名單」（排除已在專案內者）
-- 僅專案 owner 可呼叫；回傳 id, display_name, email, has_line

create or replace function public.list_profiles_for_invite(p_project_id uuid)
returns table (
  id uuid,
  display_name text,
  email text,
  has_line boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    pr.id,
    pr.display_name,
    pr.email,
    (pr.line_user_id is not null and pr.line_user_id <> '') as has_line
  from public.profiles pr
  inner join public.projects p on p.id = p_project_id and p.owner_id = auth.uid()
  where pr.id <> p.owner_id
    and not exists (
      select 1 from public.project_members pm
      where pm.project_id = p_project_id and pm.user_id = pr.id
    )
  order by pr.display_name nulls last, pr.email nulls last;
$$;

comment on function public.list_profiles_for_invite(uuid) is '專案 owner 取得可邀請成員名單（排除已在專案內者），供成員選擇器使用';
