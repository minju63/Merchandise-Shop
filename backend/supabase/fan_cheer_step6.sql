-- 무료 응원권 한도 변경: 매장 픽업 완료 · 구매한 굿즈 리뷰를 각각 하루(KST) 최대 5장으로 바꾼다.
-- fan_cheer_step2.sql 을 이미 실행한 DB에서 이 파일만 한 번 실행하면 된다.

create or replace function fan_grant_ticket(p_user uuid, p_reason text, p_order uuid default null, p_review uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week fan_banner_weeks := ensure_fan_week(now());
  v_cap integer := case p_reason when 'PICKUP' then 5 when 'REVIEW' then 5 else 1 end;
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_count integer;
begin
  -- 응원 기간(목 23:59:59) 이후에 받은 응원권은 쓸 수 없으므로 지급하지 않는다
  if now() > v_week.apply_end_at then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || v_week.id::text, 0));

  select count(*) into v_count from free_cheer_tickets
   where user_id = p_user and week_id = v_week.id and reason = p_reason and status in ('GRANTED', 'USED')
     -- 픽업·리뷰는 하루(KST) 기준, 나머지는 한 주 기준
     and (p_reason not in ('PICKUP', 'REVIEW') or created_at >= v_today_start);
  if v_count >= v_cap then return; end if;

  insert into free_cheer_tickets (user_id, week_id, reason, order_id, review_id)
  values (p_user, v_week.id, p_reason, p_order, p_review)
  on conflict do nothing;
end;
$$;

-- 주문 또는 리뷰로 받은 응원권 회수. 이미 응원에 쓴 응원권이면 그 응원 횟수에서도 뺀다.
-- 결과가 확정된 주차는 건드리지 않는다.
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
    select t.id, t.cheer_id, w.settled_at
      from free_cheer_tickets t
      join fan_banner_weeks w on w.id = t.week_id
     where t.status in ('GRANTED', 'USED')
       and ((p_order is not null and t.order_id = p_order) or (p_review is not null and t.review_id = p_review))
     for update of t
  loop
    if v_ticket.settled_at is not null then continue; end if;

    update free_cheer_tickets set status = 'REVOKED', updated_at = now() where id = v_ticket.id;

    if v_ticket.cheer_id is not null then
      select count(*) into v_remaining from free_cheer_tickets
       where cheer_id = v_ticket.cheer_id and status = 'USED';
      if v_remaining = 0 then
        delete from cheers where id = v_ticket.cheer_id;
      else
        update cheers set cheer_count = v_remaining where id = v_ticket.cheer_id;
      end if;
    end if;
  end loop;
end;
$$;
