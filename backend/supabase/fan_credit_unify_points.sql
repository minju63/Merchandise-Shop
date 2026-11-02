-- 응원 적립금(reward_credit_ledger)을 마이 적립금(point_transactions)과 한 지갑으로 합친다.
-- · 응원 적립금 내역은 마이 적립금에도 함께 기록되고, 굿즈 결제·응원권 구매에서 같은 잔액을 쓴다.
-- · 응원 적립금에 있던 유효기간(1년)은 없어진다 (마이 적립금에는 유효기간이 없다).

alter table point_transactions drop constraint point_transactions_type_check;
alter table point_transactions add constraint point_transactions_type_check
  check (type = any (array['EARN', 'USE', 'USE_CANCEL', 'REVIEW_REWARD', 'KUJI_RESALE', 'CHEER_RETURN', 'CHEER_TICKET_BUY', 'CHEER_TICKET_REFUND']));

-- 지금까지의 응원 적립금 내역을 마이 적립금으로 옮긴다
insert into point_transactions (user_id, type, status, amount, memo, created_at)
select l.user_id,
       case l.type when 'TICKET_BUY' then 'CHEER_TICKET_BUY' when 'TICKET_REFUND' then 'CHEER_TICKET_REFUND' when 'USE' then 'USE' when 'EXPIRE' then 'USE' else 'CHEER_RETURN' end,
       'CONFIRMED', l.amount,
       case l.type when 'RETURN_105' then '응원 반환(105%)' when 'RETURN_100' then '응원 반환(100%)' when 'TICKET_BUY' then '응원권 구매' when 'TICKET_REFUND' then '응원권 환불' when 'EXPIRE' then '응원 적립금 소멸' else '응원 적립금 사용' end,
       l.created_at
  from reward_credit_ledger l
 -- 이미 옮긴 내역은 건너뛴다 (파일을 다시 실행해도 중복되지 않게)
 where not exists (
   select 1 from point_transactions p
    where p.user_id = l.user_id and p.created_at = l.created_at and p.amount = l.amount
      and p.type in ('CHEER_RETURN', 'CHEER_TICKET_BUY', 'CHEER_TICKET_REFUND')
 );

-- 앞으로 응원 적립금이 쌓이거나 쓰이면 같은 금액이 마이 적립금에도 기록된다
create or replace function mirror_credit_to_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into point_transactions (user_id, type, status, amount, memo, created_at)
  values (
    new.user_id,
    case new.type when 'TICKET_BUY' then 'CHEER_TICKET_BUY' when 'TICKET_REFUND' then 'CHEER_TICKET_REFUND' when 'USE' then 'USE' when 'EXPIRE' then 'USE' else 'CHEER_RETURN' end,
    'CONFIRMED',
    new.amount,
    case new.type when 'RETURN_105' then '응원 반환(105%)' when 'RETURN_100' then '응원 반환(100%)' when 'TICKET_BUY' then '응원권 구매' when 'TICKET_REFUND' then '응원권 환불' when 'EXPIRE' then '응원 적립금 소멸' else '응원 적립금 사용' end,
    new.created_at
  );
  return new;
end;
$$;
drop trigger if exists reward_credit_ledger_mirror on reward_credit_ledger;
create trigger reward_credit_ledger_mirror after insert on reward_credit_ledger
  for each row execute function mirror_credit_to_points();

-- 보유 적립금·응원권 구매 가능 금액은 마이 적립금(point_transactions) 기준으로 본다
create or replace function cheer_balance(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks := ensure_fan_week(now());
  v_limit integer := fan_setting('daily_cheer_limit');
  v_today integer;
begin
  perform fan_ensure_tickets(p_user);

  select coalesce(sum(cheer_count), 0) into v_today
    from cheers where user_id = p_user and created_at >= fan_today_start();

  return jsonb_build_object(
    'weekId', v_week.id,
    'open', now() <= v_week.apply_end_at,
    'applyEndAt', v_week.apply_end_at,
    'announceAt', v_week.announce_at,
    'submitDeadlineAt', v_week.submit_deadline_at,
    'publishStart', v_week.publish_start,
    'publishEnd', v_week.publish_end,
    'cheerPrice', fan_setting('cheer_price'),
    'dailyLimit', v_limit,
    'todayUsed', v_today,
    'todayRemaining', greatest(v_limit - v_today, 0),
    'freeTickets', (select count(*) from free_cheer_tickets where user_id = p_user and week_id = v_week.id and status = 'GRANTED'),
    'creditTickets', (select coalesce(sum(remaining), 0) from cheer_ticket_packs
                       where user_id = p_user and source = 'CREDIT' and status = 'ACTIVE' and expires_at > now()),
    'cashTickets', (select coalesce(sum(remaining), 0) from cheer_ticket_packs
                     where user_id = p_user and source = 'CASH' and status = 'ACTIVE' and expires_at > now()),
    'credit', (select coalesce(sum(amount), 0) from point_transactions where user_id = p_user and status = 'CONFIRMED'),
    'freeProgress', (
      select coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) from (
        select reason, count(*) n from free_cheer_tickets
         where user_id = p_user and week_id = v_week.id and status in ('GRANTED', 'USED')
         group by reason
      ) s
    ),
    'weekCheers', (select coalesce(sum(cheer_count), 0) from cheers where week_id = v_week.id)
  );
end;
$$;

create or replace function cheer_buy_with_credit(p_user uuid, p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer := fan_setting('cheer_price');
  v_credit integer;
begin
  if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'FAN_INVALID_COUNT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || 'credit', 0));

  select coalesce(sum(amount), 0) into v_credit from point_transactions where user_id = p_user and status = 'CONFIRMED';
  if v_credit < p_quantity * v_price then raise exception 'FAN_NOT_ENOUGH_CREDIT'; end if;

  insert into reward_credit_ledger (user_id, type, amount) values (p_user, 'TICKET_BUY', -(p_quantity * v_price));
  insert into cheer_ticket_packs (user_id, source, quantity, remaining, unit_price, expires_at)
  values (p_user, 'CREDIT', p_quantity, p_quantity, v_price, now() + make_interval(days => fan_setting('ticket_valid_days')));

  return jsonb_build_object('bought', p_quantity, 'credit', v_credit - p_quantity * v_price);
end;
$$;

revoke execute on function mirror_credit_to_points, cheer_balance, cheer_buy_with_credit from public, anon, authenticated;
