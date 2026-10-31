-- 응원 포인트 + 응원 순위 방식 3단계: 충전 · 응원하기 · 순위
-- 초안입니다. 원격 Supabase 적용 전 사용자 확인 필요 (아직 적용하지 않음).
--
-- · 결제는 모의다. 서버의 결제 모듈(backend/src/payments)이 payments 행(CHEER_CHARGE, 모의 표시)을 만들고,
--   이 파일의 cheer_charge() 가 그 결제를 원장에 반영한다. 실제 PG 로 바꿔도 이 함수는 그대로 쓴다.
-- · 모든 함수는 서버(service role)만 호출한다. 잔액은 원장 합계로 계산한다.
-- · 오류는 'FAN_...' 코드를 메시지로 던지고, 서버가 화면용 문구로 바꾼다.

-- 같은 결제가 두 번 충전되지 않게 한다
create unique index if not exists cheer_point_ledger_charge_uniq
  on cheer_point_ledger (payment_id) where type = 'CHARGE';

-- KST 기준 오늘 00:00
create or replace function fan_today_start()
returns timestamptz
language sql
stable
as $$
  select date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
$$;

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
    'points', (select coalesce(sum(amount), 0) from cheer_point_ledger where user_id = p_user),
    'credit', (select coalesce(sum(amount), 0) from reward_credit_ledger where user_id = p_user),
    'freeTickets', (select count(*) from free_cheer_tickets where user_id = p_user and week_id = v_week.id and status = 'GRANTED'),
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

-- ── 충전: 서버 결제 모듈이 만든 결제(payments)를 원장에 반영한다
create or replace function cheer_charge(p_user uuid, p_payment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments;
begin
  select * into v_payment from payments where id = p_payment for update;
  if not found or v_payment.user_id <> p_user or v_payment.purpose <> 'CHEER_CHARGE' or v_payment.status <> 'PAID' then
    raise exception 'FAN_INVALID_PAYMENT';
  end if;
  if v_payment.amount not in (5000, 10000, 30000, 50000) then
    raise exception 'FAN_INVALID_CHARGE_AMOUNT';
  end if;

  -- 1원 = 1P
  insert into cheer_point_ledger (user_id, type, amount, payment_id, memo)
  values (p_user, 'CHARGE', v_payment.amount, p_payment, '응원 포인트 충전')
  on conflict do nothing;

  return jsonb_build_object(
    'charged', v_payment.amount,
    'points', (select coalesce(sum(amount), 0) from cheer_point_ledger where user_id = p_user)
  );
end;
$$;

-- ── 응원하기: 무료 응원권 먼저 → 나머지는 포인트 차감
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
  v_free_use integer;
  v_point_use integer;
  v_balance integer;
  v_slot_id uuid;
  v_event_date date;
  v_free_cheer uuid;
  v_point_cheer uuid;
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

  -- 1인 1일 한도 (유료 + 무료 합산, KST 00:00 기준)
  select coalesce(sum(cheer_count), 0) into v_today from cheers
   where user_id = p_user and created_at >= fan_today_start();
  if v_today + p_count > v_limit then raise exception 'FAN_DAILY_LIMIT'; end if;

  select count(*) into v_free_available from free_cheer_tickets
   where user_id = p_user and week_id = v_week.id and status = 'GRANTED';
  v_free_use := least(v_free_available, p_count);
  v_point_use := p_count - v_free_use;

  select coalesce(sum(amount), 0) into v_balance from cheer_point_ledger where user_id = p_user;
  if v_balance < v_point_use * v_price then raise exception 'FAN_NOT_ENOUGH_POINTS'; end if;

  -- 기념일 응원은 그 날짜의 슬롯에 담는다 (없으면 만든다)
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
    returning id into v_free_cheer;

    update free_cheer_tickets set status = 'USED', cheer_id = v_free_cheer, updated_at = now()
     where id in (
       select id from free_cheer_tickets
        where user_id = p_user and week_id = v_week.id and status = 'GRANTED'
        order by created_at
        limit v_free_use
        for update
     );
  end if;

  if v_point_use > 0 then
    insert into cheers (user_id, week_id, slot_type, slot_id, character_id, anniversary_id, pay_type, cheer_count,
                        unit_price, message, nickname, agreed_rules, agreed_image_rights)
    values (p_user, v_week.id, p_slot, v_slot_id, p_character, p_anniversary, 'POINT', v_point_use,
            v_price, v_message, v_nickname, true, true)
    returning id into v_point_cheer;

    insert into cheer_point_ledger (user_id, type, amount, cheer_id, memo)
    values (p_user, 'CHEER_USE', -(v_point_use * v_price), v_point_cheer, '최애 응원');
  end if;

  return jsonb_build_object(
    'slotId', v_slot_id,
    'publishDate', v_event_date,
    'freeUsed', v_free_use,
    'pointUsed', v_point_use,
    'pointsSpent', v_point_use * v_price,
    'points', v_balance - v_point_use * v_price
  );
end;
$$;

-- ── 순위: 응원 수 내림차순, 동점이면 그 수에 먼저 도달한 최애가 위
-- 기념일: p_date(게시 날짜)의 슬롯, 자유: 주차 전체. p_user 가 있으면 내 응원 수도 함께 준다.
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
      'paidAmount', sum(c.cheer_count * c.unit_price),
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

revoke execute on function fan_today_start, cheer_balance, cheer_charge, cheer_send, cheer_ranking
  from public, anon, authenticated;
