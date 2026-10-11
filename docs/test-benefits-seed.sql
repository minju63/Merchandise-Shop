-- 멤버십 요금제 2개 + 쿠폰 3개(테스트 계정에 지급) + 코드 등록 테스트용 쿠폰 1개.
-- Supabase SQL Editor에서 실행. 요금제가 이미 있으면 on conflict로 건너뜀.
insert into public.membership_plans (code, target, name, monthly_price, preorder_enabled, alert_priority_minutes, benefits, is_active)
values
  ('CONSUMER_BASIC', 'CONSUMER', '베이직', 1900, false, 0,  '["배달비 할인","쿠폰 1장"]'::jsonb, true),
  ('CONSUMER_PLUS',  'CONSUMER', '플러스', 3900, true,  10, '["배달비 할인","쿠폰 3장","재입고 우선"]'::jsonb, true)
on conflict (code) do nothing;

do $$
declare
  uid uuid := (select id from public.users where email = 'test-my@goodspang.test');
  sid uuid := '10000000-0000-4000-8000-000000000001';
  cid uuid;
  r record;
begin
  if uid is null then raise exception '테스트 계정이 없어요'; end if;

  -- 코드 등록 테스트용 (화면에서 HELLO_1000 입력)
  insert into public.coupons (code, name, discount_type, discount_value, min_order_amount, applies_to, issued_count, valid_from, valid_until, is_active)
  values ('HELLO_1000', '등록 테스트 쿠폰', 'FIXED', 1000, 0, 'ALL', 0, now() - interval '1 day', now() + interval '30 days', true);

  for r in select * from (values
    ('FIRST_ORDER_2000', '첫 주문 할인 쿠폰',  'FIXED', 2000, null::int, 15000, 'ALL',      null::uuid, 5),
    ('OPEN_SEOMYEON_10', '서면점 오픈 기념',   'RATE',  10,   3000,      0,     'PICKUP',   sid,        20),
    ('DELIVERY_PLUS_FREE','플러스 멤버십 쿠폰', 'FIXED', 3000, null::int, 20000, 'DELIVERY', null::uuid, 31)
  ) as t(code, name, dtype, dvalue, maxd, minorder, applies, store, days)
  loop
    insert into public.coupons (store_id, code, name, discount_type, discount_value, max_discount, min_order_amount, applies_to, issued_count, valid_from, valid_until, is_active)
    values (r.store, r.code, r.name, r.dtype, r.dvalue, r.maxd, r.minorder, r.applies, 1, now() - interval '1 day', now() + make_interval(days => r.days), true)
    returning id into cid;
    insert into public.user_coupons (user_id, coupon_id, status, expires_at)
    values (uid, cid, 'AVAILABLE', now() + make_interval(days => r.days));
  end loop;
end $$;

-- 정리
-- delete from public.user_coupons where coupon_id in (select id from public.coupons where code in ('FIRST_ORDER_2000','OPEN_SEOMYEON_10','DELIVERY_PLUS_FREE','HELLO_1000'));
-- delete from public.coupons where code in ('FIRST_ORDER_2000','OPEN_SEOMYEON_10','DELIVERY_PLUS_FREE','HELLO_1000');
