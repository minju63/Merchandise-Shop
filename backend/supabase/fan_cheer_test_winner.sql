-- 테스트 전용: 응원 결과 화면(/fan/result)에 보여줄 데이터를 만든다. 운영 DB에서는 실행하지 않는다.
--   · 이번 주(정산됨): 자유 응원 당첨 → "전광판 꾸미러 가기" 버튼이 보인다
--   · 지난 주(정산됨): 응원에서 탈락 → 유료 응원 10,000P 가 적립금 10,500원으로 반환됨
-- 여러 번 실행해도 같은 데이터를 다시 쓴다.
-- 먼저 fan_cheer_step7.sql 을 실행해 두어야 지난 응모가 화면에 나온다.
--
-- 사용법: v_email 을 테스트 계정 이메일로 바꾸고 SQL Editor 에서 실행한다.
do $$
declare
  v_email text := 'mj04060341@gmail.com';
  v_user uuid;
  v_win uuid;     -- 이번 주 당첨 최애
  v_lose uuid;    -- 지난 주 탈락한 최애 (내가 응원한 쪽)
  v_champ uuid;   -- 지난 주 1위 최애
  v_week fan_banner_weeks;
  v_past fan_banner_weeks;
  v_slot uuid;
  v_past_slot uuid;
  v_return uuid;
begin
  select id into v_user from users where email = v_email;
  if v_user is null then raise exception '테스트 계정을 찾을 수 없습니다: %', v_email; end if;

  select id into v_win from characters order by created_at, id offset 0 limit 1;
  select id into v_lose from characters order by created_at, id offset 1 limit 1;
  select id into v_champ from characters order by created_at, id offset 2 limit 1;
  if v_champ is null then raise exception 'characters 가 3개 이상 필요합니다'; end if;

  v_week := ensure_fan_week(now());
  v_past := ensure_fan_week(now() - interval '7 days');
  -- 꾸미기 제출 마감은 그 주 토요일 23:59 (KST). 예전에 만든 주차 행의 어긋난 값도 바로잡는다
  update fan_banner_weeks
     set settled_at = coalesce(settled_at, now()),
         submit_deadline_at = ((week_start + 5)::timestamp + interval '23 hours 59 minutes') at time zone 'Asia/Seoul'
   where id in (v_week.id, v_past.id);
  select * into v_week from fan_banner_weeks where id = v_week.id;

  -- ───────── 이번 주: 당첨 ─────────
  insert into fan_banner_slots (week_id, slot_type, publish_date, winner_character_id, status, publish_days)
  values (v_week.id, 'FREE', v_week.publish_start, v_win, 'DECIDED', 2)
  on conflict (week_id, slot_type, publish_date)
    do update set winner_character_id = excluded.winner_character_id, status = 'DECIDED'
  returning id into v_slot;

  delete from cheers where user_id = v_user and week_id = v_week.id;
  insert into cheers (user_id, week_id, slot_type, character_id, pay_type, cheer_count, message, nickname,
                      agreed_rules, agreed_image_rights)
  values (v_user, v_week.id, 'FREE', v_win, 'FREE_TICKET', 5, '테스트 응원이에요', '테스트팬', true, true);

  insert into cheer_results (week_id, slot_type, slot_id, character_id, rank_no, cheer_count, paid_amount, is_winner)
  values (v_week.id, 'FREE', null, v_win, 1, 128, 24000, true)
  on conflict (week_id, slot_type, coalesce(slot_id, '00000000-0000-0000-0000-000000000000'::uuid), character_id)
    do update set rank_no = 1, cheer_count = 128, paid_amount = 24000, is_winner = true;

  insert into fan_banner_designs (slot_id, user_id, rank_no, authority, due_at)
  values (v_slot, v_user, 1, 'ACTIVE', v_week.submit_deadline_at)
  on conflict (slot_id, rank_no)
    do update set user_id = excluded.user_id, authority = 'ACTIVE', review_status = 'DRAFT',
                  due_at = excluded.due_at, reject_reason = null;

  -- ───────── 지난 주: 탈락 + 반환 ─────────
  insert into fan_banner_slots (week_id, slot_type, publish_date, winner_character_id, status, publish_days)
  values (v_past.id, 'FREE', v_past.publish_start, v_champ, 'DECIDED', 2)
  on conflict (week_id, slot_type, publish_date)
    do update set winner_character_id = excluded.winner_character_id, status = 'DECIDED'
  returning id into v_past_slot;

  delete from return_choices where user_id = v_user and week_id = v_past.id;
  delete from cheers where user_id = v_user and week_id = v_past.id;
  insert into cheers (user_id, week_id, slot_type, character_id, pay_type, cheer_count, unit_price, message, nickname,
                      agreed_rules, agreed_image_rights, created_at)
  values (v_user, v_past.id, 'FREE', v_lose, 'CASH_TICKET', 10, 1000, '다음엔 꼭 1위!', '테스트팬',
          true, true, v_past.apply_start_at + interval '1 day');

  insert into cheer_results (week_id, slot_type, slot_id, character_id, rank_no, cheer_count, paid_amount, is_winner)
  values (v_past.id, 'FREE', null, v_champ, 1, 97, 52000, true),
         (v_past.id, 'FREE', null, v_lose, 2, 64, 10000, false)
  on conflict (week_id, slot_type, coalesce(slot_id, '00000000-0000-0000-0000-000000000000'::uuid), character_id)
    do update set rank_no = excluded.rank_no, cheer_count = excluded.cheer_count,
                  paid_amount = excluded.paid_amount, is_winner = excluded.is_winner;

  insert into return_choices (user_id, week_id, slot_type, slot_id, character_id, reason, amount, choice,
                              status, chosen_at, cash_amount, credit_amount, credit_granted)
  values (v_user, v_past.id, 'FREE', null, v_lose, 'LOST', 10000, 'CREDIT_105',
          'PROCESSED', now(), 10000, 0, 10500)
  returning id into v_return;

  delete from reward_credit_ledger where user_id = v_user and type = 'RETURN_105' and return_choice_id is null;
  insert into reward_credit_ledger (user_id, type, amount, expires_at, return_choice_id)
  values (v_user, 'RETURN_105', 10500, now() + interval '1 year', v_return);
end $$;

-- 확인: 이번 주 꾸미기 designId (/fan/design/<designId> 로도 바로 열 수 있다)
select d.id as design_id, d.review_status, d.due_at
  from fan_banner_designs d
  join users u on u.id = d.user_id
 where u.email = 'mj04060341@gmail.com' and d.authority = 'ACTIVE'
 order by d.created_at desc limit 1;
