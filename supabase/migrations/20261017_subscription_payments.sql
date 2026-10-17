-- Fresh checkout implementation using the existing subscription tables.
-- Run after 20261016_account_free_periods.sql. Existing billing RPC is preserved.
begin;

alter table ration_private.subscription_orders
  add column if not exists gateway_key_id text,
  add column if not exists creation_failed boolean not null default false;

create or replace function public.ration_plan_status(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_action is distinct from 'subscription_status'
     or coalesce(p_data->>'mode', '') not in ('test', 'live') then
    raise exception 'Unsupported plan status operation';
  end if;
  select jsonb_build_object('paid_until', e.paid_until, 'free_until', f.free_until)
    into result
  from ration_private.accounts a
  left join ration_private.entitlements e on e.account_id = a.id and e.mode = p_data->>'mode'
  left join ration_private.account_free_periods f on f.account_id = a.id
  where a.id = (p_data->>'account_id')::uuid;
  if result is null then raise exception 'Account not found'; end if;
  return result;
end;
$$;

create or replace function public.ration_checkout(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  selected ration_private.subscription_orders%rowtype;
  account_uuid uuid := nullif(p_data->>'account_id', '')::uuid;
  payment_mode text := p_data->>'mode';
  key_id text := p_data->>'key_id';
  expiry timestamptz;
  result jsonb;
begin
  if coalesce(payment_mode, '') not in ('test', 'live')
     or coalesce(key_id, '') not like 'rzp_' || payment_mode || '_%' then
    raise exception 'Invalid billing configuration';
  end if;

  if p_action = 'checkout_prepare' then
    perform a.id from ration_private.accounts a where a.id = account_uuid and not a.disabled for update;
    if not found then raise exception 'Account unavailable'; end if;
    select * into selected from ration_private.subscription_orders
    where account_id = account_uuid and mode = payment_mode and gateway_key_id = key_id
      and activated_at is null and not creation_failed
    order by created_at desc limit 1;
    if found then return to_jsonb(selected) || '{"new_intent":false}'::jsonb; end if;
    insert into ration_private.subscription_orders(receipt, account_id, mode, gateway_key_id)
    values ((p_data->>'receipt')::uuid, account_uuid, payment_mode, key_id)
    returning * into selected;
    return to_jsonb(selected) || '{"new_intent":true}'::jsonb;

  elsif p_action = 'checkout_get' then
    select * into selected from ration_private.subscription_orders
    where mode = payment_mode and gateway_key_id = key_id
      and (account_uuid is null or account_id = account_uuid)
      and ((p_data->>'order_id' is not null and order_id = p_data->>'order_id')
        or (p_data->>'receipt' is not null and receipt = (p_data->>'receipt')::uuid));
    if not found then return null; end if;
    return to_jsonb(selected);

  elsif p_action = 'checkout_pending' then
    select coalesce(jsonb_agg(t), '[]'::jsonb) into result from (
      select * from ration_private.subscription_orders
      where account_id = account_uuid and mode = payment_mode and gateway_key_id = key_id
        and activated_at is null and not creation_failed
      order by created_at desc limit 3
    ) t;
    return result;

  elsif p_action in ('checkout_attach', 'checkout_creation_failed', 'checkout_activate') then
    -- Consistent lock order also serializes separate renewals for one account.
    perform a.id from ration_private.accounts a where a.id = account_uuid for update;
    if not found then raise exception 'Account unavailable'; end if;
    select * into selected from ration_private.subscription_orders
    where receipt = (p_data->>'receipt')::uuid and account_id = account_uuid
      and mode = payment_mode and gateway_key_id = key_id for update;
    if not found then raise exception 'Order unavailable'; end if;

    if p_action = 'checkout_creation_failed' then
      if selected.order_id is null then
        update ration_private.subscription_orders set creation_failed = true where receipt = selected.receipt;
      end if;
      return '{"ok":true}'::jsonb;
    end if;
    if nullif(p_data->>'order_id', '') is null then raise exception 'Order required'; end if;
    if selected.order_id is not null and selected.order_id <> p_data->>'order_id' then
      raise exception 'Order mismatch';
    end if;
    if p_action = 'checkout_attach' then
      update ration_private.subscription_orders set order_id = p_data->>'order_id', creation_failed = false
      where receipt = selected.receipt returning * into selected;
      return to_jsonb(selected);
    end if;

    if selected.order_id is null or nullif(p_data->>'payment_id', '') is null
       or p_data->>'currency' is distinct from 'INR'
       or (p_data->>'amount_paise')::integer is distinct from selected.amount_paise then
      raise exception 'Payment mismatch';
    end if;
    if selected.activated_at is not null then
      if selected.payment_id is distinct from p_data->>'payment_id' then raise exception 'Payment mismatch'; end if;
      return jsonb_build_object('ok', true, 'paid_until', selected.granted_until, 'duplicate', true);
    end if;
    select paid_until into expiry from ration_private.entitlements
      where account_id = account_uuid and mode = payment_mode;
    expiry := greatest(now(), coalesce(expiry, now())) + interval '720 hours';
    insert into ration_private.entitlements(account_id, mode, paid_until)
      values (account_uuid, payment_mode, expiry)
      on conflict (account_id, mode) do update set paid_until = excluded.paid_until;
    update ration_private.subscription_orders
      set payment_id = p_data->>'payment_id', activated_at = now(), granted_until = expiry
      where receipt = selected.receipt;
    return jsonb_build_object('ok', true, 'paid_until', expiry, 'duplicate', false);
  end if;
  raise exception 'Unsupported checkout operation';
end;
$$;

revoke all on function public.ration_plan_status(text, jsonb) from public, anon, authenticated;
revoke all on function public.ration_checkout(text, jsonb) from public, anon, authenticated;
grant execute on function public.ration_plan_status(text, jsonb) to service_role;
grant execute on function public.ration_checkout(text, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
