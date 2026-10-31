-- 팬 응원 전광판 3단계: 응모권 지급·회수, 응모 함수, 기념일 샘플
-- 초안입니다. 원격 Supabase 적용 전 사용자 확인 필요 (아직 적용하지 않음).
--
-- 규칙
--  · 한 주 응모권 최대 10장: 기본 1 / 픽업 완료 건당 +1(최대 5) / 리뷰 건당 +1(최대 2) / 누적 5만 원 +1 / 굿즈 패스 +1
--  · 한 주 응모는 최대 10회 (응모 1회에 응모권 1장 이상 사용)
--  · 주문 취소·환불, 리뷰 삭제·숨김 시 그 응모권은 회수(REVOKED)되고,
--    이미 응모에 쓴 응모권이면 응모 장수가 그만큼 줄어든다 (0장이 되면 응모 취소). 추첨 후에는 건드리지 않는다.
--  · 모든 지급·회수는 DB 함수/트리거에서만 일어난다 (클라이언트는 읽기만 가능, RLS).

-- 회수된 응모권이 있어도 같은 사유를 다시 받을 수 있게, 유니크 조건은 유효한 응모권(GRANTED·USED)에만 건다
drop index if exists fan_banner_tickets_order_uniq;
drop index if exists fan_banner_tickets_review_uniq;
drop index if exists fan_banner_tickets_once_uniq;
create unique index fan_banner_tickets_order_uniq on fan_banner_tickets (user_id, week_id, reason, order_id)
  where order_id is not null and status in ('GRANTED', 'USED');
create unique index fan_banner_tickets_review_uniq on fan_banner_tickets (user_id, week_id, reason, review_id)
  where review_id is not null and status in ('GRANTED', 'USED');
create unique index fan_banner_tickets_once_uniq on fan_banner_tickets (user_id, week_id, reason)
  where reason in ('BASE', 'PURCHASE_50K', 'GOODS_PASS') and status in ('GRANTED', 'USED');

-- ── 응모권 지급 (사유별 한도 확인)
create or replace function fan_grant_ticket(p_user uuid, p_reason text, p_order uuid default null, p_review uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks := ensure_fan_week(now());
  v_cap integer := case p_reason when 'PICKUP' then 5 when 'REVIEW' then 2 else 1 end;
  v_reason_count integer;
  v_total integer;
begin
  -- 응모 기간(목 23:59:59) 이후에 받은 응모권은 쓸 수 없으므로 지급하지 않는다
  if now() > v_week.apply_end_at then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || v_week.id::text, 0));

  select count(*) filter (where reason = p_reason), count(*)
    into v_reason_count, v_total
    from fan_banner_tickets
   where user_id = p_user and week_id = v_week.id and status in ('GRANTED', 'USED');

  if v_reason_count >= v_cap or v_total >= 10 then return; end if;

  insert into fan_banner_tickets (user_id, week_id, reason, order_id, review_id)
  values (p_user, v_week.id, p_reason, p_order, p_review)
  on conflict do nothing;
end;
$$;

-- ── 응모권 회수: 주문 또는 리뷰로 받은 응모권을 REVOKED 로 바꾸고, 쓴 응모권은 응모 장수에서 뺀다
create or replace function fan_revoke_tickets(p_order uuid default null, p_review uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket record;
  v_remaining integer;
begin
  for v_ticket in
    select t.id, t.application_id, w.drawn_at
      from fan_banner_tickets t
      join fan_banner_weeks w on w.id = t.week_id
     where t.status in ('GRANTED', 'USED')
       and ((p_order is not null and t.order_id = p_order) or (p_review is not null and t.review_id = p_review))
     for update of t
  loop
    -- 추첨이 끝난 응모는 그대로 둔다
    if v_ticket.drawn_at is not null and v_ticket.application_id is not null then continue; end if;

    update fan_banner_tickets set status = 'REVOKED', updated_at = now() where id = v_ticket.id;

    if v_ticket.application_id is not null then
      select count(*) into v_remaining from fan_banner_tickets
       where application_id = v_ticket.application_id and status = 'USED';
      if v_remaining = 0 then
        delete from fan_banner_applications where id = v_ticket.application_id;
      else
        update fan_banner_applications set ticket_count = v_remaining where id = v_ticket.application_id;
      end if;
    end if;
  end loop;
end;
$$;

-- ── 이번 주 누적 5만 원 이상 구매 확인 (취소 시 다시 계산해서 회수)
create or replace function fan_recheck_purchase(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks := ensure_fan_week(now());
  v_sum integer;
begin
  select coalesce(sum(total_amount), 0) into v_sum from orders
   where user_id = p_user and status <> 'CANCELED'
     and created_at >= v_week.apply_start_at and created_at < v_week.apply_start_at + interval '7 days';

  if v_sum >= 50000 then
    perform fan_grant_ticket(p_user, 'PURCHASE_50K');
  else
    update fan_banner_tickets set status = 'REVOKED', updated_at = now()
     where user_id = p_user and week_id = v_week.id and reason = 'PURCHASE_50K' and status = 'GRANTED';
  end if;
end;
$$;

-- ── 주문 트리거
create or replace function fan_on_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- INSERT 에서는 OLD 가 없으므로 상태가 바뀐 경우만 따로 판단한다
  declare
    v_changed boolean := tg_op = 'INSERT';
  begin
    if tg_op = 'UPDATE' then v_changed := old.status is distinct from new.status; end if;

    if v_changed and new.status = 'CANCELED' then
      perform fan_revoke_tickets(p_order => new.id);
    elsif v_changed and new.status = 'COMPLETED' and new.fulfillment_type = 'PICKUP' then
      perform fan_grant_ticket(new.user_id, 'PICKUP', p_order => new.id);
    end if;
  end;
  perform fan_recheck_purchase(new.user_id);
  return new;
end;
$$;

drop trigger if exists fan_orders_tickets on orders;
create trigger fan_orders_tickets
  after insert or update of status, total_amount on orders
  for each row execute function fan_on_order_change();

-- ── 리뷰 트리거
create or replace function fan_on_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not new.is_hidden and new.deleted_at is null then
      perform fan_grant_ticket(new.user_id, 'REVIEW', p_review => new.id);
    end if;
  else
    if (new.is_hidden and not old.is_hidden) or (new.deleted_at is not null and old.deleted_at is null) then
      perform fan_revoke_tickets(p_review => new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists fan_reviews_tickets on reviews;
create trigger fan_reviews_tickets
  after insert or update of is_hidden, deleted_at on reviews
  for each row execute function fan_on_review_change();

-- ── 기본(BASE)·굿즈 패스 응모권: 이벤트가 없어서 화면을 열 때 서버가 부른다
create or replace function fan_ensure_tickets(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fan_grant_ticket(p_user, 'BASE');
  if exists (
    select 1 from user_memberships
     where user_id = p_user and plan_code = 'CONSUMER_PLUS' and status = 'ACTIVE'
       and (current_period_end is null or current_period_end > now())
  ) then
    perform fan_grant_ticket(p_user, 'GOODS_PASS');
  end if;
end;
$$;

-- ── 금칙어 1차 필터 (비방·광고성). 운영하면서 목록을 늘린다.
create or replace function fan_has_banned_word(p_text text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1 from unnest(array['씨발', '시발', '병신', '개새끼', '좆', '꺼져', 'http://', 'https://', 'www.', '카톡', '텔레그램', '대출', '도박', '카지노']) w
     where lower(p_text) like '%' || w || '%'
  );
$$;

-- ── 응모: 기간·보유 응모권·기념일·횟수를 한 트랜잭션에서 검사하고 응모권을 사용 처리한다
create or replace function fan_apply(
  p_user uuid,
  p_slot text,
  p_character uuid,
  p_anniversary uuid,
  p_message text,
  p_nickname text,
  p_ticket_count integer,
  p_agreed_image_rights boolean,
  p_agreed_rules boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks := ensure_fan_week(now());
  v_message text := btrim(coalesce(p_message, ''));
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_available integer;
  v_application uuid;
begin
  if now() > v_week.apply_end_at then raise exception 'FAN_APPLY_CLOSED'; end if;
  if p_slot not in ('ANNIV', 'FREE') then raise exception 'FAN_INVALID_SLOT'; end if;
  if not (p_agreed_image_rights and p_agreed_rules) then raise exception 'FAN_NOT_AGREED'; end if;
  if char_length(v_message) not between 1 and 30 then raise exception 'FAN_INVALID_MESSAGE'; end if;
  if char_length(v_nickname) not between 1 and 20 then raise exception 'FAN_INVALID_NICKNAME'; end if;
  if fan_has_banned_word(v_message) or fan_has_banned_word(v_nickname) then raise exception 'FAN_BANNED_WORD'; end if;
  if p_ticket_count is null or p_ticket_count not between 1 and 10 then raise exception 'FAN_INVALID_TICKET_COUNT'; end if;
  if not exists (select 1 from characters where id = p_character) then raise exception 'FAN_CHARACTER_NOT_FOUND'; end if;

  if p_slot = 'ANNIV' then
    if not exists (
      select 1 from anniversaries
       where id = p_anniversary and character_id = p_character and is_active
         and event_date between v_week.publish_start and v_week.publish_end
    ) then raise exception 'FAN_ANNIVERSARY_NOT_NEXT_WEEK'; end if;
  elsif p_anniversary is not null then
    raise exception 'FAN_INVALID_SLOT';
  end if;

  perform fan_ensure_tickets(p_user);
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || v_week.id::text, 0));

  if (select count(*) from fan_banner_applications where user_id = p_user and week_id = v_week.id) >= 10 then
    raise exception 'FAN_APPLY_LIMIT';
  end if;

  select count(*) into v_available from fan_banner_tickets
   where user_id = p_user and week_id = v_week.id and status = 'GRANTED';
  if v_available < p_ticket_count then raise exception 'FAN_NOT_ENOUGH_TICKETS'; end if;

  insert into fan_banner_applications (user_id, week_id, slot_type, character_id, anniversary_id,
                                       cheer_message, nickname, ticket_count, agreed_image_rights, agreed_rules)
  values (p_user, v_week.id, p_slot, p_character, p_anniversary, v_message, v_nickname, p_ticket_count, true, true)
  returning id into v_application;

  update fan_banner_tickets set status = 'USED', application_id = v_application, updated_at = now()
   where id in (
     select id from fan_banner_tickets
      where user_id = p_user and week_id = v_week.id and status = 'GRANTED'
      order by created_at
      limit p_ticket_count
      for update
   );

  return v_application;
end;
$$;

-- ── 목요일 마감 후 남은 응모권 소멸 (5단계에서 pg_cron 으로 실행)
create or replace function fan_expire_tickets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update fan_banner_tickets set status = 'EXPIRED', updated_at = now()
   where status = 'GRANTED'
     and week_id in (select id from fan_banner_weeks where apply_end_at < now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── 응모 화면·안내 화면용 요약: 주차, 보유 응모권, 지급 사유별 진행도, 응모 수
create or replace function fan_overview(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks := ensure_fan_week(now());
begin
  perform fan_ensure_tickets(p_user);
  return jsonb_build_object(
    'weekId', v_week.id,
    'applyEndAt', v_week.apply_end_at,
    'announceAt', v_week.announce_at,
    'submitDeadlineAt', v_week.submit_deadline_at,
    'publishStart', v_week.publish_start,
    'publishEnd', v_week.publish_end,
    'open', now() <= v_week.apply_end_at,
    'totalApplications', (select count(*) from fan_banner_applications where week_id = v_week.id),
    'myApplications', (select count(*) from fan_banner_applications where week_id = v_week.id and user_id = p_user),
    'availableTickets', (select count(*) from fan_banner_tickets where week_id = v_week.id and user_id = p_user and status = 'GRANTED'),
    'earnedTickets', (select count(*) from fan_banner_tickets where week_id = v_week.id and user_id = p_user and status in ('GRANTED', 'USED')),
    'progress', (
      select coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) from (
        select reason, count(*) n from fan_banner_tickets
         where week_id = v_week.id and user_id = p_user and status in ('GRANTED', 'USED')
         group by reason
      ) s
    )
  );
end;
$$;

-- 함수는 서버(service role)만 호출한다
revoke execute on function fan_grant_ticket, fan_revoke_tickets, fan_recheck_purchase, fan_ensure_tickets,
  fan_apply, fan_expire_tickets, fan_overview from public, anon, authenticated;

-- ── 기념일 샘플 (11월 생일 캐릭터. 날짜는 공개 설정 기준이라 운영 전에 확인 필요)
insert into characters (name, work_title) values
  ('헬로키티', '산리오'),
  ('미키마우스', '디즈니'),
  ('미니마우스', '디즈니')
on conflict do nothing;

insert into anniversaries (character_id, kind, event_date, label, base_year)
select c.id, 'BIRTHDAY', d.event_date::date, c.name || ' 생일', null
from (values
  ('헬로키티', '2026-11-01'), ('헬로키티', '2027-11-01'),
  ('미키마우스', '2026-11-18'), ('미키마우스', '2027-11-18'),
  ('미니마우스', '2026-11-18'), ('미니마우스', '2027-11-18')
) as d(name, event_date)
join characters c on c.name = d.name
on conflict do nothing;
