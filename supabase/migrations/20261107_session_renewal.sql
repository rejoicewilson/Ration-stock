-- Run BEFORE deploying the backend session-renewal change.
-- Only valid sessions are renewed. Plans, passwords and expired/revoked sessions are untouched.
begin;
create or replace function public.ration_session(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a ration_private.accounts%rowtype;
  d ration_private.devices%rowtype;
begin
  if p_action <> 'session' then raise exception 'Unsupported session operation'; end if;
  -- Match the lock order of password changes/resets: account, then device.
  -- Shared account lock prevents a concurrent reset/disable from racing renewal.
  select accounts.* into a from ration_private.accounts accounts
    join ration_private.devices devices on devices.account_id = accounts.id
    where devices.session_hash = p_data->>'session_hash'
      and devices.expires_at > now() and not accounts.disabled
    for share of accounts;
  if not found then return null; end if;
  select * into d from ration_private.devices
    where account_id = a.id and session_hash = p_data->>'session_hash'
      and expires_at > now() for update;
  if not found then return null; end if;
  -- At most one expiry extension per day; old valid 30-day sessions upgrade on use.
  if d.expires_at <= now() + interval '59 days' then
    update ration_private.devices set expires_at = now() + interval '60 days',
      last_seen_at = now() where id = d.id returning * into d;
  elsif d.last_seen_at < now() - interval '5 minutes' then
    update ration_private.devices set last_seen_at = now() where id = d.id;
  end if;
  return jsonb_build_object('id', a.id, 'mobile', a.mobile, 'fps_id', a.fps_id,
    'device_id', d.id, 'must_change_password', a.must_change_password,
    'session_expires_at', extract(epoch from d.expires_at));
end;
$$;
revoke all on function public.ration_session(text, jsonb) from public, anon, authenticated;
grant execute on function public.ration_session(text, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
