-- Account-specific free periods for the new preproduction plan-status reader.
-- Requires the existing accounts and entitlements tables. Preserves all records
-- and the existing ration_auth / ration_subscription functions.
begin;

create table if not exists ration_private.account_free_periods (
  account_id uuid primary key references ration_private.accounts(id) on delete cascade,
  free_until timestamptz not null
);

alter table ration_private.account_free_periods enable row level security;
revoke all on ration_private.account_free_periods from public, anon, authenticated;

create or replace function public.ration_plan_status(p_action text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_action is distinct from 'subscription_status'
      or p_data->>'mode' is distinct from 'live' then
    raise exception 'Unsupported plan status operation';
  end if;

  select jsonb_build_object('paid_until', e.paid_until, 'free_until', f.free_until)
    into result
  from ration_private.accounts a
  left join ration_private.entitlements e on e.account_id = a.id and e.mode = 'live'
  left join ration_private.account_free_periods f on f.account_id = a.id
  where a.id = (p_data->>'account_id')::uuid;

  if result is null then
    raise exception 'Account not found';
  end if;
  return result;
end;
$$;

revoke all on function public.ration_plan_status(text, jsonb) from public, anon, authenticated;
grant execute on function public.ration_plan_status(text, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
