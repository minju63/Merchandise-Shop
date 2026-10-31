-- 응원 포인트 → 유료 응원권 구조로 교체 (3단계 보정)
-- 초안입니다. 원격 Supabase 적용 전 사용자 확인 필요 (아직 적용하지 않음).
--
-- 변경 이유: 돈을 맡기는 "포인트 잔액" 대신, 1장 = 응원 1회 = 1,000원짜리 응원권을 산다.
--   · 무료 응원권(free_cheer_tickets): 주마다 지급 (그대로)
--   · 현금 구매 응원권: PG 결제로 구매 (지금은 모의)
--   · 적립금 구매 응원권: 적립금으로 구매 (적립금의 쓸 곳)
--   응원할 때는 무료 → 적립금 구매 → 현금 구매 순서로 쓴다.
--   지면: 현금 구매분은 적립금 105%, 적립금 구매분은 적립금 100% (5% 이자 복리 방지), 무료는 반환 없음.
--   최소 성립 금액은 현금 구매 응원권으로 한 응원만 센다.
--   반환은 적립금 한 가지뿐이라 선택 단계 없이 결과 확정 때 바로 지급한다 (4단계 SQL).
-- 3단계에서 만든 포인트 원장은 실제 데이터가 없어서 지우고 응원권 재고로 바꾼다.

-- ── 설정값
insert into fan_settings (key, int_value, description) values
  ('ticket_valid_days', 365, '유료 응원권 유효기간(일)'),
  ('cash_refund_days', 7, '현금 구매 응원권 미사용분 환불 가능 기간(일)')
on conflict (key) do nothing;

-- ── 이전 함수 · 원장 정리
drop function if exists cheer_charge(uuid, uuid);
drop function if exists cheer_balance(uuid);
drop function if exists cheer_ranking(text, date, uuid, uuid);
drop table if exists cheer_point_ledger cascade;

-- ── 유료 응원권 묶음 (구매 단위). 남은 장수는 묶음에서 오래된 것부터 차감한다.
create table cheer_ticket_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source text not null check (source in ('CASH', 'CREDIT')),
  quantity integer not null check (quantity > 0),
  remaining integer not null check (remaining >= 0),
  unit_price integer not null check (unit_price > 0),   -- 구매 당시 1장 가격
  payment_id uuid references payments(id),              -- 현금 구매일 때 결제
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REFUNDED', 'EXPIRED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (remaining <= quantity),
  check ((source = 'CASH') = (payment_id is not null))
);
create index cheer_ticket_packs_user_idx on cheer_ticket_packs (user_id, source, status, created_at);
create unique index cheer_ticket_packs_payment_uniq on cheer_ticket_packs (payment_id) where payment_id is not null;

alter table cheer_ticket_packs enable row level security;
create policy ticket_packs_own on cheer_ticket_packs for select using (user_id = auth.uid());

-- ── 응원의 결제 수단: 무료 / 적립금 구매 / 현금 구매
alter table cheers drop constraint if exists cheers_pay_type_check;
update cheers set pay_type = 'CASH_TICKET' where pay_type = 'POINT';
alter table cheers add constraint cheers_pay_type_check
  check (pay_type in ('FREE_TICKET', 'CREDIT_TICKET', 'CASH_TICKET'));

-- ── 적립금 원장 유형: 응원권 구매·환불, 100% 반환 추가
alter table reward_credit_ledger drop constraint if exists reward_credit_ledger_type_check;
alter table reward_credit_ledger add constraint reward_credit_ledger_type_check
  check (type in ('RETURN_105', 'RETURN_100', 'USE', 'EXPIRE', 'TICKET_BUY', 'TICKET_REFUND'));

-- ── 반환 기록: 선택 단계가 없어졌으므로 선택·기한 컬럼은 비워 둘 수 있게 한다
alter table return_choices
  add column if not exists cash_amount integer not null default 0,     -- 현금 구매 응원권으로 한 응원 금액
  add column if not exists credit_amount integer not null default 0,   -- 적립금 구매 응원권으로 한 응원 금액
  add column if not exists credit_granted integer not null default 0,  -- 실제 지급한 적립금
  alter column deadline_at drop not null,
  alter column amount drop not null;
alter table return_choices drop constraint if exists return_choices_choice_check;
alter table return_choices add constraint return_choices_choice_check check (choice in ('CREDIT_105', 'CREDIT'));
alter table return_choices drop constraint if exists return_choices_amount_check;
alter table return_choices drop constraint if exists return_choices_check;

-- ── 잔액 · 오늘 남은 횟수 · 무료 응원권 진행도
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
    'credit', (select coalesce(sum(amount), 0) from reward_credit_ledger where user_id = p_user),
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

-- ── 현금 구매: 서버 결제 모듈이 만든 결제를 응원권 묶음으로 반영한다 (5천 원 = 5장)
create or replace function cheer_buy_with_cash(p_user uuid, p_payment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments;
  v_price integer := fan_setting('cheer_price');
  v_qty integer;
begin
  select * into v_payment from payments where id = p_payment for update;
  if not found or v_payment.user_id <> p_user or v_payment.purpose <> 'CHEER_CHARGE' or v_payment.status <> 'PAID' then
    raise exception 'FAN_INVALID_PAYMENT';
  end if;
  if v_payment.amount not in (5000, 10000, 30000, 50000) or v_payment.amount % v_price <> 0 then
    raise exception 'FAN_INVALID_CHARGE_AMOUNT';
  end if;
  v_qty := v_payment.amount / v_price;

  insert into cheer_ticket_packs (user_id, source, quantity, remaining, unit_price, payment_id, expires_at)
  values (p_user, 'CASH', v_qty, v_qty, v_price, p_payment, now() + make_interval(days => fan_setting('ticket_valid_days')))
  on conflict do nothing;

  return jsonb_build_object('bought', v_qty, 'paid', v_payment.amount);
end;
$$;

-- ── 적립금 구매: 적립금으로 응원권을 산다 (1장 = 적립금 1,000원)
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

  select coalesce(sum(amount), 0) into v_credit from reward_credit_ledger where user_id = p_user;
  if v_credit < p_quantity * v_price then raise exception 'FAN_NOT_ENOUGH_CREDIT'; end if;

  insert into reward_credit_ledger (user_id, type, amount) values (p_user, 'TICKET_BUY', -(p_quantity * v_price));
  insert into cheer_ticket_packs (user_id, source, quantity, remaining, unit_price, expires_at)
  values (p_user, 'CREDIT', p_quantity, p_quantity, v_price, now() + make_interval(days => fan_setting('ticket_valid_days')));

  return jsonb_build_object('bought', p_quantity, 'credit', v_credit - p_quantity * v_price);
end;
$$;

-- ── 미사용 응원권 환불: 적립금 구매분은 적립금으로 복원, 현금 구매분은 구매 후 기한 안에서 결제 취소 대상으로 돌려준다
-- 결제 취소 호출(모의)은 서버 결제 모듈이 맡고, 이 함수는 묶음을 닫고 환불 금액을 돌려준다.
create or replace function cheer_refund_pack(p_user uuid, p_pack uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack cheer_ticket_packs;
  v_amount integer;
begin
  select * into v_pack from cheer_ticket_packs where id = p_pack and user_id = p_user for update;
  if not found or v_pack.status <> 'ACTIVE' or v_pack.remaining = 0 then raise exception 'FAN_PACK_NOT_REFUNDABLE'; end if;

  v_amount := v_pack.remaining * v_pack.unit_price;

  if v_pack.source = 'CASH' then
    -- 현금 구매분은 사용하지 않은 장수가 전부 남아 있고 환불 가능 기간 안일 때만 결제 취소가 가능하다
    if v_pack.remaining <> v_pack.quantity
       or v_pack.created_at < now() - make_interval(days => fan_setting('cash_refund_days')) then
      raise exception 'FAN_PACK_NOT_REFUNDABLE';
    end if;
    update cheer_ticket_packs set remaining = 0, status = 'REFUNDED' where id = p_pack;
    return jsonb_build_object('source', 'CASH', 'amount', v_amount, 'paymentId', v_pack.payment_id);
  end if;

  update cheer_ticket_packs set remaining = 0, status = 'REFUNDED' where id = p_pack;
  insert into reward_credit_ledger (user_id, type, amount, expires_at)
  values (p_user, 'TICKET_REFUND', v_amount, now() + make_interval(days => fan_setting('credit_valid_days')));
  return jsonb_build_object('source', 'CREDIT', 'amount', v_amount);
end;
$$;

-- ── 응원하기: 무료 → 적립금 구매 → 현금 구매 순서로 응원권을 쓴다
create or replace function cheer_send(
  p_user uuid,
  p_slot text,
  p_character uuid,
  p_anniversary uuid,
  p_message text,
  p_nickname text,
  p_count integer,
  p_agreed_rules boolean,
  p_agreed_image_rights boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks := ensure_fan_week(now());
  v_message text := btrim(coalesce(p_message, ''));
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_price integer := fan_setting('cheer_price');
  v_limit integer := fan_setting('daily_cheer_limit');
  v_today integer;
  v_free_available integer;
  v_credit_available integer;
  v_cash_available integer;
  v_free_use integer;
  v_credit_use integer;
  v_cash_use integer;
  v_slot_id uuid;
  v_event_date date;
  v_cheer uuid;
  v_pack record;
  v_take integer;
  v_left integer;
begin
  if now() > v_week.apply_end_at then raise exception 'FAN_CHEER_CLOSED'; end if;
  if p_slot not in ('ANNIV', 'FREE') then raise exception 'FAN_INVALID_SLOT'; end if;
  if not (coalesce(p_agreed_rules, false) and coalesce(p_agreed_image_rights, false)) then raise exception 'FAN_NOT_AGREED'; end if;
  if char_length(v_message) not between 1 and 30 then raise exception 'FAN_INVALID_MESSAGE'; end if;
  if char_length(v_nickname) not between 1 and 20 then raise exception 'FAN_INVALID_NICKNAME'; end if;
  if fan_has_banned_word(v_message) or fan_has_banned_word(v_nickname) then raise exception 'FAN_BANNED_WORD'; end if;
  if p_count is null or p_count not between 1 and 100 then raise exception 'FAN_INVALID_COUNT'; end if;
  if not exists (select 1 from characters where id = p_character) then raise exception 'FAN_CHARACTER_NOT_FOUND'; end if;

  if p_slot = 'ANNIV' then
    select event_date into v_event_date from anniversaries
     where id = p_anniversary and character_id = p_character and is_active
       and event_date between v_week.publish_start and v_week.publish_end;
    if v_event_date is null then raise exception 'FAN_ANNIVERSARY_NOT_NEXT_WEEK'; end if;
  elsif p_anniversary is not null then
    raise exception 'FAN_INVALID_SLOT';
  end if;

  perform fan_ensure_tickets(p_user);
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || 'cheer', 0));

  select coalesce(sum(cheer_count), 0) into v_today from cheers
   where user_id = p_user and created_at >= fan_today_start();
  if v_today + p_count > v_limit then raise exception 'FAN_DAILY_LIMIT'; end if;

  select count(*) into v_free_available from free_cheer_tickets
   where user_id = p_user and week_id = v_week.id and status = 'GRANTED';
  select coalesce(sum(remaining), 0) into v_credit_available from cheer_ticket_packs
   where user_id = p_user and source = 'CREDIT' and status = 'ACTIVE' and expires_at > now();
  select coalesce(sum(remaining), 0) into v_cash_available from cheer_ticket_packs
   where user_id = p_user and source = 'CASH' and status = 'ACTIVE' and expires_at > now();

  v_free_use := least(v_free_available, p_count);
  v_credit_use := least(v_credit_available, p_count - v_free_use);
  v_cash_use := p_count - v_free_use - v_credit_use;
  if v_cash_use > v_cash_available then raise exception 'FAN_NOT_ENOUGH_TICKETS'; end if;

  if p_slot = 'ANNIV' then
    insert into fan_banner_slots (week_id, slot_type, publish_date)
    values (v_week.id, 'ANNIV', v_event_date)
    on conflict (week_id, slot_type, publish_date) do nothing;
    select id into v_slot_id from fan_banner_slots
     where week_id = v_week.id and slot_type = 'ANNIV' and publish_date = v_event_date;
  end if;

  if v_free_use > 0 then
    insert into cheers (user_id, week_id, slot_type, slot_id, character_id, anniversary_id, pay_type, cheer_count,
                        unit_price, message, nickname, agreed_rules, agreed_image_rights)
    values (p_user, v_week.id, p_slot, v_slot_id, p_character, p_anniversary, 'FREE_TICKET', v_free_use,
            0, v_message, v_nickname, true, true)
    returning id into v_cheer;

    update free_cheer_tickets set status = 'USED', cheer_id = v_cheer, updated_at = now()
     where id in (
       select id from free_cheer_tickets
        where user_id = p_user and week_id = v_week.id and status = 'GRANTED'
        order by created_at limit v_free_use for update
     );
  end if;

  -- 적립금 구매 → 현금 구매 순서로 묶음에서 오래된 것부터 차감한다
  for v_pack in
    select unnest(array['CREDIT', 'CASH']) as source, unnest(array[v_credit_use, v_cash_use]) as need
  loop
    continue when v_pack.need = 0;

    insert into cheers (user_id, week_id, slot_type, slot_id, character_id, anniversary_id, pay_type, cheer_count,
                        unit_price, message, nickname, agreed_rules, agreed_image_rights)
    values (p_user, v_week.id, p_slot, v_slot_id, p_character, p_anniversary,
            case v_pack.source when 'CREDIT' then 'CREDIT_TICKET' else 'CASH_TICKET' end,
            v_pack.need, v_price, v_message, v_nickname, true, true);

    v_left := v_pack.need;
    declare
      v_row record;
    begin
      for v_row in
        select id, remaining from cheer_ticket_packs
         where user_id = p_user and source = v_pack.source and status = 'ACTIVE' and expires_at > now() and remaining > 0
         order by expires_at, created_at for update
      loop
        exit when v_left = 0;
        v_take := least(v_row.remaining, v_left);
        update cheer_ticket_packs set remaining = remaining - v_take where id = v_row.id;
        v_left := v_left - v_take;
      end loop;
    end;
  end loop;

  return jsonb_build_object(
    'slotId', v_slot_id,
    'publishDate', v_event_date,
    'freeUsed', v_free_use,
    'creditUsed', v_credit_use,
    'cashUsed', v_cash_use
  );
end;
$$;

-- ── 순위: 최소 성립 금액은 현금 구매 응원권으로 한 응원만 센다
create or replace function cheer_ranking(p_slot text, p_date date default null, p_user uuid default null, p_week uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks;
  v_slot_id uuid;
  v_items jsonb;
begin
  if p_week is null then v_week := ensure_fan_week(now());
  else select * into v_week from fan_banner_weeks where id = p_week; end if;
  if v_week.id is null then raise exception 'FAN_WEEK_NOT_FOUND'; end if;

  if p_slot = 'ANNIV' then
    select id into v_slot_id from fan_banner_slots
     where week_id = v_week.id and slot_type = 'ANNIV' and publish_date = p_date;
  end if;

  select coalesce(jsonb_agg(item order by (item->>'rank')::int), '[]'::jsonb) into v_items
  from (
    select jsonb_build_object(
      'rank', row_number() over (order by sum(c.cheer_count) desc, max(c.seq) asc),
      'characterId', ch.id,
      'name', ch.name,
      'workTitle', ch.work_title,
      'imageUrl', ch.profile_image_url,
      'cheerCount', sum(c.cheer_count),
      'paidAmount', coalesce(sum(c.cheer_count * c.unit_price) filter (where c.pay_type = 'CASH_TICKET'), 0),
      'myCount', coalesce(sum(c.cheer_count) filter (where c.user_id = p_user), 0)
    ) as item
    from cheers c
    join characters ch on ch.id = c.character_id
    where c.week_id = v_week.id and c.slot_type = p_slot
      and (p_slot = 'FREE' or c.slot_id = v_slot_id)
    group by ch.id, ch.name, ch.work_title, ch.profile_image_url
    order by sum(c.cheer_count) desc, max(c.seq) asc
    limit 50
  ) ranked;

  return jsonb_build_object(
    'weekId', v_week.id,
    'slotType', p_slot,
    'publishDate', p_date,
    'applyEndAt', v_week.apply_end_at,
    'open', now() <= v_week.apply_end_at,
    'minPaidAmount', v_week.min_paid_amount,
    'freeSlotCount', v_week.free_slot_count,
    'items', v_items
  );
end;
$$;

revoke execute on function cheer_balance, cheer_buy_with_cash, cheer_buy_with_credit, cheer_refund_pack,
  cheer_send, cheer_ranking from public, anon, authenticated;
