-- 담당: 연수
-- 굿즈픽 쿠지 11단계: 쿠지 구매 때 적립금을 쓸 수 있다.
-- kuji_step1~2 와 mytab_points_claims_views.sql, mytab_review_points.sql 을 먼저 실행한다. 여러 번 실행해도 안전하다.
--
-- · 적립금은 point_transactions 에 KUJI_USE(-) 로 기록한다. 잔액은 기존처럼 CONFIRMED 합계다.
-- · 1,000원 이상부터 쓸 수 있고(주문 결제와 같은 기준), 티켓 금액보다 많이 쓸 수는 없다.
-- · kuji_purchases.amount 는 티켓 총액, points_used 는 그중 적립금으로 낸 금액이다.
-- · kuji_buy 는 인자가 하나 늘어(p_points) 예전 함수를 지우고 다시 만든다.

alter table kuji_purchases add column if not exists points_used integer not null default 0 check (points_used >= 0);

alter table point_transactions
  add column if not exists kuji_purchase_id uuid references kuji_purchases(id) on delete set null;

-- 응원 적립금 통합(fan_credit_unify_points.sql)의 CHEER_* 종류도 함께 유지한다.
alter table point_transactions drop constraint if exists point_transactions_type_check;
alter table point_transactions add constraint point_transactions_type_check
  check (type in ('EARN', 'USE', 'USE_CANCEL', 'REVIEW_REWARD', 'KUJI_RESALE', 'KUJI_USE',
                  'CHEER_RETURN', 'CHEER_TICKET_BUY', 'CHEER_TICKET_REFUND'));

drop function if exists kuji_buy(uuid, integer[]);

create or replace function kuji_buy(p_kuji uuid, p_numbers integer[], p_points integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := kuji_uid();
  v_event kuji_events;
  v_numbers integer[];
  v_count integer;
  v_ids uuid[];
  v_purchase uuid;
  v_amount integer;
  v_points integer := coalesce(p_points, 0);
  v_balance bigint;
begin
  select * into v_event from kuji_events where id = p_kuji;
  if not found then raise exception 'KUJI_NOT_FOUND'; end if;
  if v_event.status <> 'ON_SALE' then raise exception 'KUJI_NOT_ON_SALE'; end if;

  select array_agg(distinct n) into v_numbers from unnest(p_numbers) as n;
  v_count := coalesce(cardinality(v_numbers), 0);
  if v_count = 0 then raise exception 'KUJI_NO_NUMBERS'; end if;
  if v_count > v_event.max_per_purchase then raise exception 'KUJI_TOO_MANY'; end if;

  v_amount := v_count * v_event.ticket_price;
  if v_points < 0 or v_points > v_amount then raise exception 'KUJI_POINTS_INVALID'; end if;
  if v_points > 0 and v_points < 1000 then raise exception 'KUJI_POINTS_MIN'; end if;
  if v_points > 0 then
    -- 같은 사람이 동시에 두 번 써서 잔액이 모자라지 않도록 사용자 행을 잠근다.
    perform 1 from users where id = v_user for update;
    select coalesce(sum(amount), 0) into v_balance
      from point_transactions where user_id = v_user and status = 'CONFIRMED';
    if v_points > v_balance then raise exception 'KUJI_POINTS_SHORT'; end if;
  end if;

  select array_agg(s.id order by s.number) into v_ids
  from (
    select t.id, t.number from kuji_tickets t
    where t.kuji_id = p_kuji and t.number = any(v_numbers) and t.sold_at is null
    order by t.number
    for update
  ) s;
  if coalesce(cardinality(v_ids), 0) <> v_count then raise exception 'KUJI_TICKET_TAKEN'; end if;

  update kuji_tickets set owner_id = v_user, sold_at = now() where id = any(v_ids);

  insert into kuji_purchases (kuji_id, user_id, ticket_count, amount, points_used)
  values (p_kuji, v_user, v_count, v_amount, v_points)
  returning id into v_purchase;

  if v_points > 0 then
    insert into point_transactions (user_id, type, status, amount, memo, kuji_purchase_id)
    values (v_user, 'KUJI_USE', 'CONFIRMED', -v_points,
            '쿠지 구매에 적립금 사용 · ' || v_event.title || ' ' || v_count || '장', v_purchase);
  end if;

  return jsonb_build_object(
    'purchaseId', v_purchase,
    'amount', v_amount,
    'pointsUsed', v_points,
    'payAmount', v_amount - v_points,
    'tickets', (
      select coalesce(jsonb_agg(kuji_ticket_json(u.id) order by u.ord), '[]'::jsonb)
      from unnest(v_ids) with ordinality as u(id, ord)
    )
  );
end;
$$;

revoke execute on function kuji_buy(uuid, integer[], integer) from public, anon;
grant execute on function kuji_buy(uuid, integer[], integer) to authenticated;
