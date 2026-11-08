-- Preserve all balances/history; filter before pagination. Run before deploying the updated app.
begin;
create or replace function public.ration_balance_ledger(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := (p_data->>'account_id')::uuid;
  c ration_private.ledger_customers%rowtype;
  e ration_private.ledger_entries%rowtype;
  original ration_private.ledger_entries%rowtype;
  request_uuid uuid;
  card text := p_data->>'card_number';
  entry_kind text := p_data->>'kind';
  amount bigint;
  delta bigint;
  memo text := trim(coalesce(p_data->>'note',''));
  person text := trim(coalesce(p_data->>'customer_name',''));
  list_status text := coalesce(p_data->>'status','all');
  q text := trim(coalesce(p_data->>'search',''));
  page_number integer := coalesce((p_data->>'page')::integer,1);
  rows_json jsonb;
  total bigint;
  totals jsonb;
begin
  -- Backend supplies owner_id from its authenticated session, not browser input.
  -- Lock account first, matching recovery/session lock order.
  perform 1 from ration_private.accounts where id=owner_id and not disabled and not must_change_password for share;
  if not found then return jsonb_build_object('error','unauthorized'); end if;
  if page_number < 1 or page_number > 10000 then return jsonb_build_object('error','invalid'); end if;
  if p_action='ledger_list' then
    if length(q)>80 or list_status not in ('open','closed','all') then return jsonb_build_object('error','invalid'); end if;
    select jsonb_build_object('to_receive_paise',coalesce(sum(greatest(balance_paise,0)),0),
      'to_return_paise',coalesce(sum(greatest(-balance_paise,0)),0),
      'customers',count(*)) into totals from ration_private.ledger_customers where account_id=owner_id;
    -- Literal substring search; % and _ are not wildcard inputs.
    select count(*) into total from ration_private.ledger_customers where account_id=owner_id
      and (list_status='all' or (list_status='open' and balance_paise<>0) or (list_status='closed' and balance_paise=0))
      and (q='' or strpos(card_number,q)>0 or strpos(lower(customer_name),lower(q))>0);
    select coalesce(jsonb_agg(to_jsonb(items) order by items.updated_at desc,items.id),'[]'::jsonb) into rows_json from (
      select id,card_number,customer_name,balance_paise,updated_at from ration_private.ledger_customers
        where account_id=owner_id
        and (list_status='all' or (list_status='open' and balance_paise<>0) or (list_status='closed' and balance_paise=0))
        and (q='' or strpos(card_number,q)>0 or strpos(lower(customer_name),lower(q))>0)
        order by updated_at desc,id limit 20 offset (page_number-1)*20
    ) items;
    return jsonb_build_object('customers',rows_json,'total',total,'page_size',20,'totals',totals,'status',list_status);
  end if;
  if card is null or card !~ '^[0-9]{10}$' then return jsonb_build_object('error','invalid'); end if;
  if p_action='ledger_detail' then
    select * into c from ration_private.ledger_customers where account_id=owner_id and card_number=card for share;
    if not found then
      return jsonb_build_object('customer',null,'entries','[]'::jsonb,'total',0,'page_size',30);
    end if;
    select count(*) into total from ration_private.ledger_entries where account_id=owner_id and customer_id=c.id;
    select coalesce(jsonb_agg(to_jsonb(items) order by items.sequence desc),'[]'::jsonb) into rows_json from (
      select ent.id,ent.sequence,ent.kind,ent.amount_paise,ent.delta_paise,ent.balance_after_paise,
        ent.note,ent.created_at,ent.reverses_id,
        exists(select 1 from ration_private.ledger_entries rev where rev.account_id=owner_id and rev.reverses_id=ent.id) as reversed
      from ration_private.ledger_entries ent where ent.account_id=owner_id and ent.customer_id=c.id
      order by ent.sequence desc limit 30 offset (page_number-1)*30
    ) items;
    return jsonb_build_object('customer',jsonb_build_object('card_number',c.card_number,
      'customer_name',c.customer_name,'balance_paise',c.balance_paise),'entries',rows_json,'total',total,'page_size',30);
  end if;
  if p_action not in ('ledger_add','ledger_reverse') then raise exception 'Unsupported ledger operation'; end if;
  request_uuid := (p_data->>'request_id')::uuid;
  if request_uuid is null then return jsonb_build_object('error','invalid'); end if;
  if p_action='ledger_add' then
    amount := (p_data->>'amount_paise')::bigint;
    if entry_kind is null or entry_kind not in ('owed_to_shop','owed_to_customer','received','returned')
      or amount is null or amount not between 1 and 10000000 or length(memo)>200 or length(person)>80 then
      return jsonb_build_object('error','invalid');
    end if;
  else
    memo := trim(coalesce(p_data->>'reason',''));
    if length(memo)<3 or length(memo)>200 or p_data->>'entry_id' is null then return jsonb_build_object('error','invalid'); end if;
  end if;
  -- Serializes retries even if the same request key is sent for a different card.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || request_uuid::text,0));
  select * into e from ration_private.ledger_entries where account_id=owner_id and request_id=request_uuid;
  if found then
    select * into c from ration_private.ledger_customers where account_id=owner_id and id=e.customer_id;
    if c.card_number<>card or (p_action='ledger_add' and (e.kind<>entry_kind or e.amount_paise<>amount or e.note<>memo))
      or (p_action='ledger_reverse' and (e.kind<>'reversal' or e.reverses_id<>(p_data->>'entry_id')::uuid or e.note<>memo)) then
      return jsonb_build_object('error','request_conflict');
    end if;
    return jsonb_build_object('ok',true,'entry_id',e.id,'balance_paise',c.balance_paise,'replayed',true);
  end if;
  if p_action='ledger_add' and entry_kind in ('owed_to_shop','owed_to_customer') then
    insert into ration_private.ledger_customers(account_id,card_number,customer_name)
      values(owner_id,card,person) on conflict(account_id,card_number) do nothing;
  end if;
  select * into c from ration_private.ledger_customers where account_id=owner_id and card_number=card for update;
  if not found then return jsonb_build_object('error','not_found'); end if;
  if p_action='ledger_reverse' then
    select * into original from ration_private.ledger_entries where account_id=owner_id and customer_id=c.id and id=(p_data->>'entry_id')::uuid;
    if not found then return jsonb_build_object('error','not_found'); end if;
    if original.kind='reversal' or exists(select 1 from ration_private.ledger_entries where account_id=owner_id and reverses_id=original.id) then
      return jsonb_build_object('error','already_reversed');
    end if;
    entry_kind := 'reversal';
    amount := original.amount_paise;
    delta := -original.delta_paise;
  else
    if (entry_kind='received' and (c.balance_paise<=0 or amount>c.balance_paise))
      or (entry_kind='returned' and (c.balance_paise>=0 or amount> -c.balance_paise)) then
      return jsonb_build_object('error','settlement_exceeds_balance');
    end if;
    delta := case when entry_kind in ('owed_to_shop','returned') then amount else -amount end;
  end if;
  if abs(c.balance_paise+delta)>1000000000000 then return jsonb_build_object('error','invalid'); end if;
  update ration_private.ledger_customers set balance_paise=balance_paise+delta,updated_at=now(),
    customer_name=case when customer_name='' and person<>'' then person else customer_name end where id=c.id returning * into c;
  insert into ration_private.ledger_entries(account_id,customer_id,request_id,kind,amount_paise,delta_paise,balance_after_paise,note,reverses_id)
    values(owner_id,c.id,request_uuid,entry_kind,amount,delta,c.balance_paise,memo,
      case when p_action='ledger_reverse' then original.id else null end) returning * into e;
  return jsonb_build_object('ok',true,'entry_id',e.id,'balance_paise',c.balance_paise,'replayed',false);
end;
$$;
revoke all on function public.ration_balance_ledger(text,jsonb) from public,anon,authenticated;
grant execute on function public.ration_balance_ledger(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
