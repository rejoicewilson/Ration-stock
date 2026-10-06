-- Run AFTER 20261005_python_accounts.sql. Preserves existing accounts.
begin;
create table if not exists ration_private.activity_daily (
  account_id uuid not null references ration_private.accounts(id) on delete cascade,
  activity_date date not null,
  feature text not null,
  requests bigint not null default 1,
  last_used_at timestamptz not null default now(),
  primary key (account_id, activity_date, feature)
);
create index if not exists activity_daily_date_idx on ration_private.activity_daily(activity_date);
alter table ration_private.activity_daily enable row level security;
revoke all on ration_private.activity_daily from public, anon, authenticated;

create or replace function public.ration_activity(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  month_start date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  result jsonb;
begin
  if p_action = 'record_activity' then
    if not (p_data->>'feature' = any(array['/count','/fps-stock','/transactions',
      '/stock-register','/ro-details','/ro-quantity-details','/ration-card-details',
      'transactions','commission','monthComparison'])) then
      raise exception 'Unsupported feature';
    end if;
    insert into ration_private.activity_daily(account_id, activity_date, feature)
      values ((p_data->>'account_id')::uuid, today, p_data->>'feature')
      on conflict (account_id, activity_date, feature) do update
      set requests = ration_private.activity_daily.requests + 1, last_used_at = now();
    return jsonb_build_object('ok', true);
  elsif p_action = 'dashboard' then
    select jsonb_build_object(
      'date', today, 'timezone', 'Asia/Kolkata',
      'total_accounts', (select count(*) from ration_private.accounts),
      'new_today', (select count(*) from ration_private.accounts where (created_at at time zone 'Asia/Kolkata')::date = today),
      'new_month', (select count(*) from ration_private.accounts where (created_at at time zone 'Asia/Kolkata')::date between month_start and today),
      'active_today', (select count(distinct account_id) from ration_private.activity_daily where activity_date = today),
      'active_month', (select count(distinct account_id) from ration_private.activity_daily where activity_date between month_start and today),
      'features', (select coalesce(jsonb_agg(f), '[]'::jsonb) from (
        select feature, sum(requests) as requests, count(distinct account_id) as accounts
        from ration_private.activity_daily where activity_date between month_start and today
        group by feature order by feature) f),
      'accounts', (select coalesce(jsonb_agg(u), '[]'::jsonb) from (
        select a.id, a.fps_id, a.mobile, a.created_at, a.disabled,
          (select coalesce(jsonb_agg(usage), '[]'::jsonb) from (
            select d.feature, sum(d.requests) as requests, max(d.last_used_at) as last_used_at
            from ration_private.activity_daily d where d.account_id = a.id
              and d.activity_date between month_start and today
            group by d.feature order by max(d.last_used_at) desc
          ) usage) as features,
          (select max(last_used_at) from ration_private.activity_daily d where d.account_id = a.id) as last_activity
        from ration_private.accounts a order by a.created_at desc, a.id
        limit 50 offset greatest(0, (p_data->>'offset')::integer)) u)
    ) into result;
    return result;
  end if;
  raise exception 'Unsupported activity operation';
end;
$$;
revoke all on function public.ration_activity(text, jsonb) from public, anon, authenticated;
grant execute on function public.ration_activity(text, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
