-- Latest successful feature use per account, for the owner dashboard.
-- Adds a read-only, service-role-only function. No account/activity/payment writes.
-- Run after 20261005_activity_dashboard.sql; keeps existing reports unchanged.
begin;

create or replace function public.ration_recent_usage(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  search_term text := coalesce(p_data->>'search', '');
  page_offset integer := coalesce((p_data->>'offset')::integer, 0);
  result jsonb;
begin
  if p_action is distinct from 'recent_usage' or page_offset < 0 then
    raise exception 'Unsupported recent usage operation';
  end if;

  with usage as (
    select a.id, a.fps_id,
      max(d.last_used_at) as last_used_at,
      (array_agg(d.feature order by d.last_used_at desc, d.feature))[1] as last_feature
    from ration_private.accounts a
    join ration_private.activity_daily d on d.account_id = a.id
    where search_term = '' or position(search_term in a.fps_id) > 0
      or position(search_term in a.mobile) > 0
    group by a.id, a.fps_id
  ), page_rows as (
    select * from usage
    order by last_used_at desc, id
    limit 50 offset page_offset
  )
  select jsonb_build_object(
    'timezone', 'Asia/Kolkata',
    'matching_accounts', (select count(*) from usage),
    'page_size', 50,
    'accounts', (select coalesce(jsonb_agg(u order by u.last_used_at desc, u.id), '[]'::jsonb) from page_rows u)
  ) into result;
  return result;
end;
$$;

revoke all on function public.ration_recent_usage(text, jsonb) from public, anon, authenticated;
grant execute on function public.ration_recent_usage(text, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
