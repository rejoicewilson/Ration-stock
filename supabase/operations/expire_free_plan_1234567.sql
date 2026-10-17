-- Run after migrations/20261016_account_free_periods.sql in Supabase SQL Editor.
-- October 15, 2026 is this account's last free day (IST).
-- Matches both shop AND mobile; does not change any other account or paid plan.
begin;
-- Fill this locally in SQL Editor; do not publish the account's mobile number.
set local ration.target_mobile = 'REPLACE_WITH_CONFIRMED_MOBILE';

do $$
declare
  target_id uuid;
begin
  select id into strict target_id
  from ration_private.accounts
  where fps_id = '1234567' and mobile = current_setting('ration.target_mobile');

  insert into ration_private.account_free_periods(account_id, free_until)
  values (target_id, timestamptz '2026-10-16 00:00:00+05:30')
  on conflict (account_id) do update set free_until = excluded.free_until;
end;
$$;

select a.fps_id,
       f.free_until at time zone 'Asia/Kolkata' as free_until_ist,
       f.free_until <= now() as free_period_ended
from ration_private.account_free_periods f
join ration_private.accounts a on a.id = f.account_id
where a.fps_id = '1234567' and a.mobile = current_setting('ration.target_mobile');

commit;
