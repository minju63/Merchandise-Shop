-- 응원 4단계: 결과 정산 · 반환 · 꾸미기 권한자 선정
-- 초안입니다. 원격 Supabase 적용 전 사용자 확인 필요 (아직 적용하지 않음).
--
-- 결과 정산(fan_settle_week)은 목요일 마감 뒤 금요일 00:00 이후에 한 번 실행한다 (스케줄은 6단계에서 pg_cron 으로 연결).
-- 같은 주차를 다시 실행해도 결과·반환이 중복되지 않는다 (unique 인덱스 + on conflict do nothing).
--
-- 규칙 요약
--  · 기념일: 날짜(슬롯)별로 응원 수 1위 최애가 이긴다. 동점이면 그 수에 먼저 도달한 최애(마지막 응원 순번이 빠른 쪽).
--  · 자유: 주차 전체 순위의 상위 free_slot_count 명이 확정권. 기념일이 있는 날을 뺀 빈 날짜에 순위 순서대로 배정하고,
--          1위는 free_first_days(기본 2일) 연속 게시, 나머지는 1일.
--  · 성립: 이긴 최애의 "현금 구매 응원권" 응원 합계가 주차의 최소 성립 금액 이상이어야 게시한다. 미달이면 NOT_ESTABLISHED.
--  · 반환(적립금으로 즉시 지급, 선택 단계 없음):
--      - 진 최애: 현금 구매 응원권 금액의 105% + 적립금 구매 응원권 금액의 100%
--      - 성립 미달로 게시되지 않은 최애: 이긴 최애도 포함해 100% (보너스 없이 돌려줌)
--      - 이긴 최애에 쓴 응원, 무료 응원권으로 한 응원은 반환 없음
--  · 꾸미기 권한: 이긴 최애를 가장 많이 응원한 팬(무료+유료 합산, 동점이면 먼저 그 수에 도달한 팬).
--      due_at(토 23:59) 까지 제출하지 않으면 다음 순위 팬에게 넘어간다 (fan_pass_design_authority).

-- ── 보조 컬럼 · 설정값
alter table fan_banner_slots add column if not exists publish_days smallint not null default 1;
alter table fan_banner_designs add column if not exists due_at timestamptz;

insert into fan_settings (key, int_value, description) values
  ('free_first_days', 2, '자유 응원 1위 최애의 게시 일수'),
  ('authority_pass_hours', 24, '꾸미기 권한이 다음 순위 팬에게 넘어갔을 때 제출 가능 시간(시간)')
on conflict (key) do nothing;

-- ── 결과 정산
create or replace function fan_settle_week(p_week uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks;
  v_rate integer := fan_setting('credit_return_rate');
  v_valid_days integer := fan_setting('credit_valid_days');
  v_free_first integer := fan_setting('free_first_days');
  v_anniv_days integer := fan_setting('anniv_publish_days');
  v_slot record;
  v_winner record;
  v_ret record;
  v_fan record;
  v_blocked boolean[] := array_fill(false, array[7]);
  v_winner_char uuid;
  v_offset integer;
  v_day_offset integer;
  v_try integer;
  v_i integer;
  v_choice uuid;
  v_rate_used integer;
  v_cash_part integer;
  v_decided integer := 0;
  v_unestablished integer := 0;
  v_returns integer := 0;
  v_returned integer := 0;
begin
  select * into v_week from fan_banner_weeks where id = p_week for update;
  if not found then raise exception 'FAN_WEEK_NOT_FOUND'; end if;
  if v_week.settled_at is not null and not p_force then raise exception 'FAN_ALREADY_SETTLED'; end if;
  if now() < v_week.announce_at and not p_force then raise exception 'FAN_WEEK_NOT_CLOSED'; end if;

  -- 1. 기념일 슬롯: 날짜별 최애 순위 → 1위 확정 또는 미성립
  for v_slot in select * from fan_banner_slots where week_id = p_week and slot_type = 'ANNIV' loop
    insert into cheer_results (week_id, slot_type, slot_id, character_id, rank_no, cheer_count, paid_amount, is_winner)
    select p_week, 'ANNIV', v_slot.id, t.character_id,
           row_number() over (order by t.total desc, t.last_seq asc),
           t.total, t.paid,
           row_number() over (order by t.total desc, t.last_seq asc) = 1 and t.paid >= v_week.min_paid_amount
      from (
        select c.character_id, sum(c.cheer_count)::int as total,
               coalesce(sum(c.cheer_count * c.unit_price) filter (where c.pay_type = 'CASH_TICKET'), 0)::int as paid,
               max(c.seq) as last_seq
          from cheers c where c.slot_id = v_slot.id group by c.character_id
      ) t
    on conflict do nothing;

    select character_id into v_winner_char from cheer_results
     where slot_id = v_slot.id and is_winner;

    update fan_banner_slots
       set status = case when v_winner_char is null then 'NOT_ESTABLISHED' else 'DECIDED' end,
           winner_character_id = v_winner_char,
           anniversary_id = (select c.anniversary_id from cheers c
                              where c.slot_id = v_slot.id and c.character_id = v_winner_char limit 1),
           publish_days = v_anniv_days
     where id = v_slot.id;

    if v_winner_char is null then
      v_unestablished := v_unestablished + 1;
    else
      v_decided := v_decided + 1;
      -- 기념일 게시일은 자유 응원 날짜 배정에서 뺀다
      for v_i in 0..(v_anniv_days - 1) loop
        v_day_offset := (v_slot.publish_date - v_week.publish_start) + v_i;
        if v_day_offset between 0 and 6 then v_blocked[v_day_offset + 1] := true; end if;
      end loop;
    end if;
  end loop;

  -- 2. 자유 응원: 주차 전체 순위
  insert into cheer_results (week_id, slot_type, slot_id, character_id, rank_no, cheer_count, paid_amount, is_winner)
  select p_week, 'FREE', null, t.character_id,
         row_number() over (order by t.total desc, t.last_seq asc), t.total, t.paid, false
    from (
      select c.character_id, sum(c.cheer_count)::int as total,
             coalesce(sum(c.cheer_count * c.unit_price) filter (where c.pay_type = 'CASH_TICKET'), 0)::int as paid,
             max(c.seq) as last_seq
        from cheers c where c.week_id = p_week and c.slot_type = 'FREE' group by c.character_id
    ) t
  on conflict do nothing;

  -- 상위 n위 중 성립한 최애를 빈 날짜에 순위 순서대로 배정 (1위는 연속 free_first_days 일, 나머지 1일)
  for v_winner in
    select character_id, rank_no from cheer_results
     where week_id = p_week and slot_type = 'FREE' and rank_no <= v_week.free_slot_count
       and paid_amount >= v_week.min_paid_amount
     order by rank_no
  loop
    v_offset := null;
    foreach v_try in array (case when v_winner.rank_no = 1 and v_free_first > 1 then array[v_free_first, 1] else array[1] end) loop
      for v_i in 0..(7 - v_try) loop
        if not exists (select 1 from generate_series(v_i, v_i + v_try - 1) g where v_blocked[g + 1]) then
          v_offset := v_i;
          exit;
        end if;
      end loop;
      exit when v_offset is not null;
    end loop;

    if v_offset is not null then
      insert into fan_banner_slots (week_id, slot_type, publish_date, winner_character_id, status, publish_days)
      values (p_week, 'FREE', v_week.publish_start + v_offset, v_winner.character_id, 'DECIDED', v_try)
      on conflict do nothing;
      for v_i in v_offset..(v_offset + v_try - 1) loop v_blocked[v_i + 1] := true; end loop;
      update cheer_results set is_winner = true
       where week_id = p_week and slot_type = 'FREE' and character_id = v_winner.character_id;
      v_decided := v_decided + 1;
    end if;
  end loop;

  -- 3. 반환: 진 최애(또는 미성립)에 쓴 유료 응원을 적립금으로 즉시 지급
  for v_ret in
    select c.user_id, c.slot_type, c.slot_id, c.character_id, r.rank_no,
           coalesce(sum(c.cheer_count * c.unit_price) filter (where c.pay_type = 'CASH_TICKET'), 0)::int as cash_amount,
           coalesce(sum(c.cheer_count * c.unit_price) filter (where c.pay_type = 'CREDIT_TICKET'), 0)::int as credit_amount,
           case when (c.slot_type = 'ANNIV' and r.rank_no = 1)
                  or (c.slot_type = 'FREE' and r.rank_no <= v_week.free_slot_count)
                then 'NOT_ESTABLISHED' else 'LOST' end as reason
      from cheers c
      join cheer_results r on r.week_id = c.week_id and r.slot_type = c.slot_type
                          and r.slot_id is not distinct from c.slot_id and r.character_id = c.character_id
     where c.week_id = p_week and c.pay_type in ('CASH_TICKET', 'CREDIT_TICKET') and not r.is_winner
     group by c.user_id, c.slot_type, c.slot_id, c.character_id, r.rank_no
    having sum(c.cheer_count * c.unit_price) > 0
  loop
    v_rate_used := case when v_ret.reason = 'NOT_ESTABLISHED' then 100 else v_rate end;
    v_cash_part := v_ret.cash_amount * v_rate_used / 100;

    v_choice := null;
    insert into return_choices (user_id, week_id, slot_type, slot_id, character_id, reason, amount,
                                cash_amount, credit_amount, credit_granted, choice, status, chosen_at)
    values (v_ret.user_id, p_week, v_ret.slot_type, v_ret.slot_id, v_ret.character_id, v_ret.reason,
            v_ret.cash_amount + v_ret.credit_amount, v_ret.cash_amount, v_ret.credit_amount,
            v_cash_part + v_ret.credit_amount,
            case when v_rate_used > 100 then 'CREDIT_105' else 'CREDIT' end, 'PROCESSED', now())
    on conflict do nothing
    returning id into v_choice;

    if v_choice is not null then
      if v_cash_part > 0 then
        insert into reward_credit_ledger (user_id, type, amount, expires_at, return_choice_id)
        values (v_ret.user_id, case when v_rate_used > 100 then 'RETURN_105' else 'RETURN_100' end, v_cash_part,
                now() + make_interval(days => v_valid_days), v_choice);
      end if;
      if v_ret.credit_amount > 0 then
        insert into reward_credit_ledger (user_id, type, amount, expires_at, return_choice_id)
        values (v_ret.user_id, 'RETURN_100', v_ret.credit_amount, now() + make_interval(days => v_valid_days), v_choice);
      end if;

      insert into notifications (user_id, type, title, body, target_type, target_id)
      values (v_ret.user_id, 'FAN_BANNER',
              case v_ret.reason when 'NOT_ESTABLISHED' then '게시 조건 미달로 응원이 반환됐어요' else '응원 결과가 나왔어요' end,
              '적립금 ' || to_char(v_cash_part + v_ret.credit_amount, 'FM999,999,999') || '원이 지급됐어요.',
              'fan_result', p_week);
      v_returns := v_returns + 1;
      v_returned := v_returned + v_cash_part + v_ret.credit_amount;
    end if;
  end loop;

  -- 4. 꾸미기 권한자: 이긴 최애를 가장 많이 응원한 팬
  for v_slot in select * from fan_banner_slots where week_id = p_week and status = 'DECIDED' loop
    select t.user_id into v_fan from (
      select c.user_id, sum(c.cheer_count) as total, max(c.seq) as last_seq
        from cheers c
       where c.week_id = p_week and c.slot_type = v_slot.slot_type
         and c.character_id = v_slot.winner_character_id
         and (v_slot.slot_type = 'FREE' or c.slot_id = v_slot.id)
       group by c.user_id
       order by total desc, last_seq asc
       limit 1
    ) t;

    if v_fan.user_id is not null then
      insert into fan_banner_designs (slot_id, user_id, rank_no, authority, due_at)
      values (v_slot.id, v_fan.user_id, 1, 'ACTIVE', v_week.submit_deadline_at)
      on conflict do nothing;

      insert into notifications (user_id, type, title, body, target_type, target_id)
      values (v_fan.user_id, 'FAN_BANNER', '우리 최애가 1위! 전광판을 꾸며 주세요',
              '토요일 23:59까지 꾸미기를 제출해 주세요. 미제출 시 다음 순위 팬에게 넘어가요.', 'fan_slot', v_slot.id);

      -- 나머지 응원 팬에게는 1위 소식과 게시일 알림
      insert into notifications (user_id, type, title, body, target_type, target_id)
      select distinct c.user_id, 'FAN_BANNER', '우리 최애가 1위!',
             to_char(v_slot.publish_date, 'MM"월" DD"일"') || '에 홈 배너에 올라가요.', 'fan_slot', v_slot.id
        from cheers c
       where c.week_id = p_week and c.slot_type = v_slot.slot_type
         and c.character_id = v_slot.winner_character_id
         and (v_slot.slot_type = 'FREE' or c.slot_id = v_slot.id)
         and c.user_id <> v_fan.user_id;
    end if;
  end loop;

  update fan_banner_weeks set settled_at = coalesce(settled_at, now()) where id = p_week;

  return jsonb_build_object(
    'weekId', p_week,
    'decidedSlots', v_decided,
    'notEstablishedSlots', v_unestablished,
    'returns', v_returns,
    'returnedCredit', v_returned
  );
end;
$$;

-- ── 꾸미기 권한 이동: 제출 기한이 지났는데 제출하지 않았으면 다음 순위 팬에게 넘긴다
create or replace function fan_pass_design_authority()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_design record;
  v_slot fan_banner_slots;
  v_next record;
  v_count integer := 0;
begin
  for v_design in
    select d.id, d.slot_id, d.rank_no
      from fan_banner_designs d
     where d.authority = 'ACTIVE' and d.review_status in ('DRAFT', 'REJECTED') and d.due_at < now()
       and not exists (select 1 from fan_banner_designs x
                        where x.slot_id = d.slot_id and x.review_status in ('SUBMITTED', 'APPROVED'))
     for update of d skip locked
  loop
    update fan_banner_designs set authority = 'FORFEITED', updated_at = now() where id = v_design.id;

    select * into v_slot from fan_banner_slots where id = v_design.slot_id;

    select t.user_id into v_next from (
      select c.user_id, sum(c.cheer_count) as total, max(c.seq) as last_seq
        from cheers c
       where c.week_id = v_slot.week_id and c.slot_type = v_slot.slot_type
         and c.character_id = v_slot.winner_character_id
         and (v_slot.slot_type = 'FREE' or c.slot_id = v_slot.id)
         and c.user_id not in (select user_id from fan_banner_designs where slot_id = v_design.slot_id)
       group by c.user_id
       order by total desc, last_seq asc
       limit 1
    ) t;

    if v_next.user_id is not null then
      insert into fan_banner_designs (slot_id, user_id, rank_no, authority, due_at)
      values (v_design.slot_id, v_next.user_id, v_design.rank_no + 1, 'ACTIVE',
              now() + make_interval(hours => fan_setting('authority_pass_hours')))
      on conflict do nothing;

      insert into notifications (user_id, type, title, body, target_type, target_id)
      values (v_next.user_id, 'FAN_BANNER', '전광판 꾸미기 권한이 넘어왔어요',
              fan_setting('authority_pass_hours') || '시간 안에 제출해 주세요.', 'fan_slot', v_design.slot_id);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ── 내 결과: 응원한 최애별 순위 · 결과 · 반환 · 꾸미기 권한
create or replace function fan_result_for_user(p_user uuid, p_week uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks;
begin
  if p_week is null then
    select * into v_week from fan_banner_weeks where settled_at is not null order by week_start desc limit 1;
  else
    select * into v_week from fan_banner_weeks where id = p_week;
  end if;
  if v_week.id is null then
    return jsonb_build_object('weekId', null, 'settled', false, 'items', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'weekId', v_week.id,
    'settled', v_week.settled_at is not null,
    'announceAt', v_week.announce_at,
    'submitDeadlineAt', v_week.submit_deadline_at,
    'items', coalesce((
      select jsonb_agg(item order by item->>'slotType', item->>'publishDate') from (
        select jsonb_build_object(
          'slotType', c.slot_type,
          'slotId', c.slot_id,
          'publishDate', s.publish_date,
          'publishDays', s.publish_days,
          'characterId', ch.id,
          'name', ch.name,
          'myCount', sum(c.cheer_count),
          'rank', r.rank_no,
          'totalCount', r.cheer_count,
          'won', coalesce(r.is_winner, false),
          'slotStatus', s.status,
          'returnReason', rc.reason,
          'returnCredit', coalesce(rc.credit_granted, 0),
          'designId', d.id,
          'designDueAt', d.due_at,
          'designStatus', d.review_status
        ) as item
        from cheers c
        join characters ch on ch.id = c.character_id
        left join cheer_results r on r.week_id = c.week_id and r.slot_type = c.slot_type
                                 and r.slot_id is not distinct from c.slot_id and r.character_id = c.character_id
        left join fan_banner_slots s on s.id = c.slot_id
        left join return_choices rc on rc.user_id = c.user_id and rc.week_id = c.week_id and rc.slot_type = c.slot_type
                                   and rc.slot_id is not distinct from c.slot_id and rc.character_id = c.character_id
        left join fan_banner_designs d on d.user_id = c.user_id and d.authority = 'ACTIVE'
                                      and d.slot_id = coalesce(c.slot_id, (
                                        select fs.id from fan_banner_slots fs
                                         where fs.week_id = c.week_id and fs.slot_type = 'FREE'
                                           and fs.winner_character_id = c.character_id limit 1))
        where c.week_id = v_week.id and c.user_id = p_user
        group by c.slot_type, c.slot_id, s.publish_date, s.publish_days, s.status, ch.id, ch.name,
                 r.rank_no, r.cheer_count, r.is_winner, rc.reason, rc.credit_granted, d.id, d.due_at, d.review_status
      ) items
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function fan_settle_week, fan_pass_design_authority, fan_result_for_user
  from public, anon, authenticated;
