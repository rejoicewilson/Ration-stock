-- Step 1: read-only subscription status. Additive; preserves existing accounts.
-- Run after 20261005_python_accounts.sql. Payment orders are added later.
begin;

create table if not exists ration_private.entitlements (
  account_id uuid not null references ration_private.accounts(id) on delete cascade,
  mode text not null check (mode in ('test', 'live')),
  paid_until timestamptz not null,
  primary key (account_id, mode)
);

alter table ration_private.entitlements enable row level security;
revoke all on ration_private.entitlements from public, anon, authenticated;

create or replace function public.ration_subscription(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  expiry timestamptz;
  payment_mode text := p_data->>'mode';
begin
  if p_action <> 'subscription_status' then
    raise exception 'Unsupported subscription operation';
  end if;
  if payment_mode not in ('test', 'live') or payment_mode is null then
    raise exception 'Invalid payment mode';
  end if;

  select e.paid_until into expiry
  from ration_private.entitlements e
  where e.account_id = (p_data->>'account_id')::uuid
    and e.mode = payment_mode;

  return jsonb_build_object(
    'active', coalesce(expiry > now(), false),
    'paid_until', expiry
  );
end;
$$;

revoke all on function public.ration_subscription(text, jsonb) from public, anon, authenticated;
grant execute on function public.ration_subscription(text, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
