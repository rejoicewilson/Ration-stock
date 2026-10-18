-- Owner report: distinct recorded feature-use days since registration.
-- Read-only function; does not change accounts, activity, subscriptions or payments.
-- Run after 20261005_activity_dashboard.sql in Supabase SQL Editor.
begin;

create or replace function public.ration_usage_days(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  search_term text := coalesce(p_data->>'search', '');
  page_offset integer := coalesce((p_data->>'offset')::integer, 0);
  result jsonb;
begin
  if p_action is distinct from 'usage_days' or page_offset < 0 then
    raise exception 'Unsupported usage report operation';
  end if;

  with usage as (
    select a.id, a.fps_id,
      (a.created_at at time zone 'Asia/Kolkata')::date as joined_on,
      count(distinct d.activity_date) as days_used,
      max(d.activity_date) as last_used
    from ration_private.accounts a
    left join ration_private.activity_daily d on d.account_id = a.id
    where search_term = '' or position(search_term in a.fps_id) > 0
      or position(search_term in a.mobile) > 0
    group by a.id, a.fps_id, a.created_at
  ), page_rows as (
    select * from usage
    order by days_used desc, joined_on desc, id
    limit 50 offset page_offset
  )
  select jsonb_build_object(
    'timezone', 'Asia/Kolkata',
    'matching_accounts', (select count(*) from usage),
    'page_size', 50,
    'accounts', (select coalesce(jsonb_agg(u order by u.days_used desc, u.joined_on desc, u.id), '[]'::jsonb) from page_rows u)
  ) into result;
  return result;
end;
$$;

revoke all on function public.ration_usage_days(text, jsonb) from public, anon, authenticated;
grant execute on function public.ration_usage_days(text, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
