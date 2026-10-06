-- Run once in the Ration Stock project's SQL Editor. Does not use Supabase Auth.
-- All account tables are private. Only our backend secret may execute this RPC.
begin;
create schema if not exists ration_private;
revoke all on schema ration_private from public, anon, authenticated;

create table if not exists ration_private.accounts (
  id uuid primary key default gen_random_uuid(),
  mobile text not null unique check (mobile ~ '^91[6-9][0-9]{9}$'),
  fps_id text not null check (fps_id ~ '^[0-9]{7}$'),
  password_hash text not null,
  disabled boolean not null default false,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_device_replaced_at timestamptz
);
create table if not exists ration_private.devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ration_private.accounts(id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[a-f0-9]{64}$'),
  session_hash text unique check (session_hash ~ '^[a-f0-9]{64}$'),
  label text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (account_id, device_hash)
);
create table if not exists ration_private.attempts (
  key_hash text primary key,
  hits integer not null,
  expires_at timestamptz not null
);
create table if not exists ration_private.recovery_audit (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ration_private.accounts(id),
  reason text not null,
  created_at timestamptz not null default now()
);
alter table ration_private.accounts enable row level security;
alter table ration_private.devices enable row level security;
alter table ration_private.attempts enable row level security;
alter table ration_private.recovery_audit enable row level security;
revoke all on all tables in schema ration_private from public, anon, authenticated;

create or replace function public.ration_auth(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a ration_private.accounts%rowtype;
  d ration_private.devices%rowtype;
  account_uuid uuid;
  device_list jsonb;
  attempt_count integer;
  next_replacement timestamptz;
begin
  if p_action = 'limit' then
    delete from ration_private.attempts where expires_at < now();
    insert into ration_private.attempts(key_hash, hits, expires_at)
      values (p_data->>'key', 1, now() + interval '15 minutes')
      on conflict (key_hash) do update set hits = ration_private.attempts.hits + 1
      returning hits into attempt_count;
    return jsonb_build_object('allowed', attempt_count <= (p_data->>'max')::integer);
  elsif p_action = 'find' then
    select * into a from ration_private.accounts where mobile = p_data->>'mobile';
    if not found then return null; end if;
    return jsonb_build_object('id', a.id, 'password_hash', a.password_hash, 'disabled', a.disabled);
  elsif p_action = 'register' then
    insert into ration_private.accounts(mobile, fps_id, password_hash)
      values (p_data->>'mobile', p_data->>'fps_id', p_data->>'password_hash')
      on conflict (mobile) do nothing returning * into a;
    if not found then return jsonb_build_object('error', 'account_exists'); end if;
    insert into ration_private.devices(account_id, device_hash, session_hash, label, expires_at)
      values (a.id, p_data->>'device_hash', p_data->>'session_hash', left(p_data->>'label', 80),
        now() + make_interval(days => (p_data->>'session_days')::integer));
    return jsonb_build_object('ok', true);
  elsif p_action = 'session' then
    select * into d from ration_private.devices where session_hash = p_data->>'session_hash'
      and expires_at > now();
    if not found then return null; end if;
    select * into a from ration_private.accounts where id = d.account_id and not disabled;
    if not found then return null; end if;
    -- Avoid a write for every request in a burst.
    update ration_private.devices set last_seen_at = now() where id = d.id and last_seen_at < now() - interval '5 minutes';
    return jsonb_build_object('id', a.id, 'mobile', a.mobile, 'fps_id', a.fps_id,
      'device_id', d.id, 'must_change_password', a.must_change_password);
  elsif p_action = 'open_session' then
    select * into a from ration_private.accounts where id = (p_data->>'account_id')::uuid for update;
    if not found or a.disabled or a.password_hash <> p_data->>'expected_hash' then
      return jsonb_build_object('error', 'invalid_credentials');
    end if;
    select * into d from ration_private.devices where account_id = a.id and device_hash = p_data->>'device_hash';
    if not found then
      if (select count(*) from ration_private.devices where account_id = a.id) >= (p_data->>'max_devices')::integer then
        next_replacement := a.last_device_replaced_at + make_interval(days => (p_data->>'cooldown_days')::integer);
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label, 'last_seen_at', last_seen_at)
          order by created_at), '[]'::jsonb) into device_list from ration_private.devices where account_id = a.id;
        if next_replacement > now() then
          return jsonb_build_object('error', 'replacement_cooldown', 'available_at', next_replacement);
        end if;
        if nullif(p_data->>'replace_device_id', '') is null then
          return jsonb_build_object('error', 'device_limit', 'devices', device_list);
        end if;
        delete from ration_private.devices where account_id = a.id and id = (p_data->>'replace_device_id')::uuid;
        if not found then return jsonb_build_object('error', 'device_not_found'); end if;
        update ration_private.accounts set last_device_replaced_at = now() where id = a.id;
      end if;
      insert into ration_private.devices(account_id, device_hash, session_hash, label, expires_at)
        values (a.id, p_data->>'device_hash', p_data->>'session_hash', left(p_data->>'label', 80),
          now() + make_interval(days => (p_data->>'session_days')::integer));
    else
      update ration_private.devices set session_hash = p_data->>'session_hash', last_seen_at = now(),
        expires_at = now() + make_interval(days => (p_data->>'session_days')::integer) where id = d.id;
    end if;
    return jsonb_build_object('ok', true);
  elsif p_action = 'logout' then
    -- Keep the slot: signing out must not bypass the device replacement limit.
    update ration_private.devices set session_hash = null, expires_at = null
      where session_hash = p_data->>'session_hash';
    return jsonb_build_object('ok', true);
  elsif p_action = 'devices' then
    select account_id into account_uuid from ration_private.devices
      where session_hash = p_data->>'session_hash' and expires_at > now();
    if not found then return jsonb_build_object('error', 'unauthorized'); end if;
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label, 'last_seen_at', last_seen_at,
      'current', session_hash = p_data->>'session_hash', 'signed_in', session_hash is not null and expires_at > now())
      order by created_at), '[]'::jsonb) into device_list from ration_private.devices where account_id = account_uuid;
    return jsonb_build_object('devices', device_list);
  elsif p_action = 'change_password' then
    select * into a from ration_private.accounts where id = (p_data->>'account_id')::uuid for update;
    if not found or a.disabled or a.password_hash <> p_data->>'expected_hash' then
      return jsonb_build_object('error', 'invalid_credentials');
    end if;
    select * into d from ration_private.devices where account_id = a.id
      and session_hash = p_data->>'session_hash' and expires_at > now();
    if not found then return jsonb_build_object('error', 'unauthorized'); end if;
    update ration_private.accounts set password_hash = p_data->>'password_hash', must_change_password = false where id = a.id;
    update ration_private.devices set session_hash = null, expires_at = null where account_id = a.id and id <> d.id;
    update ration_private.devices set session_hash = p_data->>'new_session_hash',
      expires_at = now() + make_interval(days => (p_data->>'session_days')::integer) where id = d.id;
    return jsonb_build_object('ok', true);
  elsif p_action = 'reset_password' then
    -- Operator-only recovery; no public HTTP endpoint maps to this action.
    select * into a from ration_private.accounts where mobile = p_data->>'mobile' for update;
    if not found then return jsonb_build_object('error', 'account_not_found'); end if;
    if length(trim(coalesce(p_data->>'reason', ''))) < 10 then raise exception 'Recovery reason is required'; end if;
    insert into ration_private.recovery_audit(account_id, reason) values (a.id, left(p_data->>'reason', 500));
    update ration_private.accounts set password_hash = p_data->>'password_hash', must_change_password = true,
      last_device_replaced_at = null where id = a.id;
    delete from ration_private.devices where account_id = a.id;
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Unsupported account operation';
end;
$$;
revoke all on function public.ration_auth(text, jsonb) from public, anon, authenticated;
grant execute on function public.ration_auth(text, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
