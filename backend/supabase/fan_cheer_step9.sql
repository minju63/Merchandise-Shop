-- 응원 9단계: 응원할 때 "응원 한마디"를 받지 않는다.
-- 전광판 문구는 꾸미기 화면의 메인 문구가 맡고, 응원 한마디는 화면 어디에도 쓰이지 않는다.
-- cheer_send 의 메시지 검사를 "1~30자 필수"에서 "30자 이하(빈 값 허용)"로 바꾼다. fan_cheer_step3b.sql 실행 후 한 번 실행한다.

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
  -- 응원 한마디는 입력받지 않는다(전광판 문구는 꾸미기 화면의 메인 문구로 정한다). 보내온 경우에만 길이·금칙어를 확인한다.
  if char_length(v_message) > 30 then raise exception 'FAN_INVALID_MESSAGE'; end if;
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
