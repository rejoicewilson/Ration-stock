-- Step 2: Razorpay order ledger. Run after 20261012_subscription_foundation.sql.
-- Additive and repeatable. Existing accounts and entitlements are preserved.
begin;

create table if not exists ration_private.subscription_orders (
  receipt uuid primary key,
  order_id text unique,
  account_id uuid not null references ration_private.accounts(id) on delete cascade,
  mode text not null check (mode in ('test', 'live')),
  amount_paise integer not null default 9900 check (amount_paise = 9900),
  payment_id text unique,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  granted_until timestamptz
);

create index if not exists subscription_orders_account_idx
  on ration_private.subscription_orders(account_id, mode, created_at);
alter table ration_private.subscription_orders enable row level security;
revoke all on ration_private.subscription_orders from public, anon, authenticated;

create or replace function public.ration_subscription(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  expiry timestamptz;
  payment_mode text := p_data->>'mode';
  selected_order ration_private.subscription_orders%rowtype;
  pending jsonb;
begin
  if payment_mode not in ('test', 'live') or payment_mode is null then
    raise exception 'Invalid payment mode';
  end if;

  if p_action = 'subscription_status' then
    select e.paid_until into expiry
    from ration_private.entitlements e
    where e.account_id = (p_data->>'account_id')::uuid
      and e.mode = payment_mode;
    return jsonb_build_object('active', coalesce(expiry > now(), false), 'paid_until', expiry);

  elsif p_action = 'billing_intent' then
    insert into ration_private.subscription_orders(receipt, account_id, mode)
    values ((p_data->>'receipt')::uuid, (p_data->>'account_id')::uuid, payment_mode);
    return jsonb_build_object('ok', true);

  elsif p_action = 'billing_attach' then
    update ration_private.subscription_orders
    set order_id = p_data->>'order_id'
    where receipt = (p_data->>'receipt')::uuid and mode = payment_mode and order_id is null;
    if not found then raise exception 'Payment intent missing'; end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'billing_order' then
    select * into selected_order
    from ration_private.subscription_orders
    where order_id = p_data->>'order_id' and mode = payment_mode;
    if not found then return null; end if;
    return to_jsonb(selected_order);

  elsif p_action = 'billing_pending' then
    select coalesce(jsonb_agg(t), '[]'::jsonb) into pending from (
      select * from ration_private.subscription_orders
      where account_id = (p_data->>'account_id')::uuid and mode = payment_mode
        and activated_at is null and order_id is not null
      order by created_at desc limit 5
    ) t;
    return pending;

  elsif p_action = 'billing_activate' then
    -- Callback and webhook can race. Lock the order, then the account so that
    -- multiple renewals for one account extend the expiry in sequence.
    select * into selected_order
    from ration_private.subscription_orders
    where order_id = p_data->>'order_id' and mode = payment_mode for update;
    if not found then raise exception 'Payment order missing'; end if;
    if selected_order.activated_at is not null then
      if selected_order.payment_id <> p_data->>'payment_id' then
        raise exception 'Payment mismatch';
      end if;
      return jsonb_build_object('ok', true, 'paid_until', selected_order.granted_until, 'duplicate', true);
    end if;
    if nullif(p_data->>'payment_id', '') is null then raise exception 'Payment required'; end if;

    perform a.id from ration_private.accounts a where a.id = selected_order.account_id for update;
    select e.paid_until into expiry from ration_private.entitlements e
    where e.account_id = selected_order.account_id and e.mode = payment_mode;
    expiry := greatest(coalesce(expiry, now()), now()) + interval '30 days';
    insert into ration_private.entitlements(account_id, mode, paid_until)
    values (selected_order.account_id, payment_mode, expiry)
    on conflict (account_id, mode) do update set paid_until = excluded.paid_until;
    update ration_private.subscription_orders
    set payment_id = p_data->>'payment_id', activated_at = now(), granted_until = expiry
    where receipt = selected_order.receipt;
    return jsonb_build_object('ok', true, 'paid_until', expiry, 'duplicate', false);
  end if;

  raise exception 'Unsupported subscription operation';
end;
$$;

revoke all on function public.ration_subscription(text, jsonb) from public, anon, authenticated;
grant execute on function public.ration_subscription(text, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
