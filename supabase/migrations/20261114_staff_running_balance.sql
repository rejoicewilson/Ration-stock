-- Daily-wage running totals with month-filtered history. Preserves all existing records.
-- Apply after staff_attendance_salary and staff_daily_backdate. Safe to rerun.
begin;
create or replace function public.ration_staff(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := (p_data->>'account_id')::uuid;
  request_uuid uuid := (p_data->>'request_id')::uuid;
  member ration_private.staff_members%rowtype;
  receipt ration_private.staff_operations%rowtype;
  selected date := (p_data->>'day')::date;
  work_day date := (p_data->>'work_date')::date;
  current_day date := (now() at time zone 'Asia/Kolkata')::date;
  low_day date;
  high_day date;
  period_day date := (p_data->>'period_start')::date;
  paid_day date := (p_data->>'paid_on')::date;
  status_value text := p_data->>'status';
  amount bigint := (p_data->>'amount_paise')::bigint;
  extra bigint := coalesce((p_data->>'extra_paise')::bigint,0);
  previous jsonb;
  result jsonb;
  rows_json jsonb;
  payment_uuid uuid;
begin
  -- All mutations serialize by owner, including idempotency checks and creation.
  perform 1 from ration_private.accounts where id=owner_id and not disabled and not must_change_password for update;
  if not found then return jsonb_build_object('error','unauthorized'); end if;
  if p_action='staff_report' then
    if selected is null or selected < date '2020-01-01' or selected > current_day + 366 then
      return jsonb_build_object('error','invalid');
    end if;
    low_day := least(date_trunc('month',selected)::date,date_trunc('week',selected)::date);
    high_day := greatest((date_trunc('month',selected)+interval '1 month - 1 day')::date,
      date_trunc('week',selected)::date+6);
    select coalesce(jsonb_agg(to_jsonb(items) order by items.created_at,items.id),'[]'::jsonb) into rows_json from (
      select m.id,m.name,m.pay_cycle,m.rate_paise,m.start_date,m.revision,m.created_at,
        case when m.pay_cycle='daily' then (
          select jsonb_build_object(
            'earned_units',coalesce(sum(case a.status when 'present' then 2 when 'paid_leave' then 2 when 'half_day' then 1 else 0 end),0),
            'absent_units',coalesce(sum(case a.status when 'absent' then 2 when 'half_day' then 1 else 0 end),0),
            'extra_paise',coalesce(sum(a.extra_paise),0),
            'marked_days',count(*) filter(where a.status<>'holiday_work'),
            'present_days',count(*) filter(where a.status='present'),
            'half_days',count(*) filter(where a.status='half_day'),
            'absent_days',count(*) filter(where a.status='absent'),
            'paid_leave_days',count(*) filter(where a.status='paid_leave'),
            'paid_paise',(select coalesce(sum(p.amount_paise),0) from ration_private.staff_payments p
              where p.account_id=owner_id and p.staff_id=m.id and not p.voided and p.paid_on<=current_day))
          from ration_private.staff_attendance a where a.account_id=owner_id and a.staff_id=m.id
            and a.work_date between m.start_date and current_day
        ) else null end as daily_totals,
        coalesce((select jsonb_agg(to_jsonb(a) - 'account_id' order by a.work_date desc)
          from ration_private.staff_attendance a where a.account_id=owner_id and a.staff_id=m.id
          and a.work_date between
            (case when m.pay_cycle='daily' then date_trunc('month',selected)::date else low_day end)
            and (case when m.pay_cycle='daily' then (date_trunc('month',selected)+interval '1 month - 1 day')::date else high_day end)),'[]'::jsonb) as attendance,
        coalesce((select jsonb_agg(to_jsonb(p) - 'account_id' order by p.created_at desc,p.id)
          from ration_private.staff_payments p where p.account_id=owner_id and p.staff_id=m.id
          and ((m.pay_cycle='daily' and p.paid_on between date_trunc('month',selected)::date
            and (date_trunc('month',selected)+interval '1 month - 1 day')::date)
            or (m.pay_cycle<>'daily' and p.period_start between low_day and high_day))),'[]'::jsonb) as payments
      from ration_private.staff_members m where m.account_id=owner_id
    ) items;
    return jsonb_build_object('staff',rows_json);
  end if;
  if request_uuid is null then return jsonb_build_object('error','invalid'); end if;
  select * into receipt from ration_private.staff_operations where account_id=owner_id and request_id=request_uuid;
  if found then
    if receipt.action<>p_action or receipt.payload<>p_data then return jsonb_build_object('error','request_conflict'); end if;
    return receipt.result || jsonb_build_object('replayed',true);
  end if;
  if p_action='staff_create' then
    if not coalesce(length(trim(p_data->>'name')) between 1 and 80
      and p_data->>'pay_cycle' in ('daily','weekly','monthly')
      and (p_data->>'rate_paise')::bigint between 1 and 100000000
      and (p_data->>'start_date')::date between date '2020-01-01' and current_day+366,false) then
      return jsonb_build_object('error','invalid');
    end if;
    if (select count(*) from ration_private.staff_members where account_id=owner_id)>=50 then
      return jsonb_build_object('error','limit');
    end if;
    insert into ration_private.staff_members(account_id,name,pay_cycle,rate_paise,start_date)
      values(owner_id,trim(p_data->>'name'),p_data->>'pay_cycle',(p_data->>'rate_paise')::bigint,
        (p_data->>'start_date')::date) returning * into member;
    result := jsonb_build_object('ok',true,'staff_id',member.id,'revision',member.revision);
  else
    select * into member from ration_private.staff_members where account_id=owner_id and id=(p_data->>'staff_id')::uuid for update;
    if not found then return jsonb_build_object('error','not_found'); end if;
    if (p_data->>'expected_revision')::bigint is distinct from member.revision then
      return jsonb_build_object('error','conflict');
    end if;
    if p_action='staff_attendance' then
      if not coalesce(work_day between (case when member.pay_cycle='daily' then date '2020-01-01' else member.start_date end) and current_day
        and status_value in ('present','half_day','absent','paid_leave','holiday_work','unmarked')
        and extra between 0 and 100000000,false) then return jsonb_build_object('error','invalid'); end if;
      if (status_value='holiday_work' and (extract(isodow from work_day)<>7 or extra<=0))
        or (status_value<>'holiday_work' and (extra<>0 or (extract(isodow from work_day)=7 and status_value<>'unmarked'))) then
        return jsonb_build_object('error','invalid');
      end if;
      select to_jsonb(a) into previous from ration_private.staff_attendance a
        where account_id=owner_id and staff_id=member.id and work_date=work_day;
      if status_value='unmarked' then
        delete from ration_private.staff_attendance where account_id=owner_id and staff_id=member.id and work_date=work_day;
      else
        insert into ration_private.staff_attendance(account_id,staff_id,work_date,status,extra_paise)
          values(owner_id,member.id,work_day,status_value,extra)
          on conflict(account_id,staff_id,work_date) do update
          set status=excluded.status,extra_paise=excluded.extra_paise,updated_at=now();
      end if;
    elsif p_action='staff_payment' then
      -- Daily staff payments settle one running balance; never allocate to an attendance day.
      if member.pay_cycle='daily' then period_day := paid_day; end if;
      if not coalesce(amount between 1 and 100000000 and paid_day between member.start_date and current_day
        and period_day between date '2020-01-01' and current_day
        and p_data->>'kind' in ('salary','advance') and length(coalesce(p_data->>'note',''))<=200,false) then
        return jsonb_build_object('error','invalid');
      end if;
      if (member.pay_cycle='weekly' and extract(isodow from period_day)<>1)
        or (member.pay_cycle='monthly' and extract(day from period_day)<>1)
        or (case member.pay_cycle when 'weekly' then period_day+6
          when 'monthly' then (period_day+interval '1 month - 1 day')::date else period_day end)<member.start_date then
        return jsonb_build_object('error','invalid');
      end if;
      insert into ration_private.staff_payments(account_id,staff_id,period_start,paid_on,kind,amount_paise,note)
        values(owner_id,member.id,period_day,paid_day,p_data->>'kind',amount,coalesce(p_data->>'note','')) returning id into payment_uuid;
    elsif p_action='staff_void' then
      select to_jsonb(p) into previous from ration_private.staff_payments p where account_id=owner_id
        and staff_id=member.id and id=(p_data->>'payment_id')::uuid and not voided;
      if not found then return jsonb_build_object('error','not_found'); end if;
      update ration_private.staff_payments set voided=true where account_id=owner_id
        and staff_id=member.id and id=(p_data->>'payment_id')::uuid;
    else
      return jsonb_build_object('error','invalid');
    end if;
    update ration_private.staff_members set revision=revision+1,
      start_date=case when p_action='staff_attendance' and member.pay_cycle='daily'
        and status_value<>'unmarked' then least(start_date,work_day) else start_date end
      where id=member.id and account_id=owner_id returning * into member;
    result := jsonb_build_object('ok',true,'staff_id',member.id,'revision',member.revision,
      'payment_id',payment_uuid,'previous',previous);
  end if;
  insert into ration_private.staff_operations(account_id,request_id,action,payload,result)
    values(owner_id,request_uuid,p_action,p_data,result);
  return result;
end;
$$;
revoke all on function public.ration_staff(text,jsonb) from public,anon,authenticated;
grant execute on function public.ration_staff(text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
