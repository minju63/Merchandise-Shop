-- 테스트 주문 4건 (test-my@goodspang.test 계정용). Supabase SQL Editor에서 실행.
-- 정리: 맨 아래 삭제 SQL 참고
do $$
declare
  uid uuid := (select id from public.users where email = 'test-my@goodspang.test');
  sid uuid := '10000000-0000-4000-8000-000000000001';
  p1 uuid := '30000000-0000-4000-8000-000000000001'; -- 12,000
  p2 uuid := '30000000-0000-4000-8000-000000000002'; --  9,000
  p3 uuid := '30000000-0000-4000-8000-000000000003'; -- 18,000
  oid uuid;
  r record;
begin
  if uid is null then raise exception '테스트 계정이 없어요'; end if;

  for r in select * from (values
    ('SEED-000001','PICKUP','READY_FOR_PICKUP', p1, '별빛 소녀 아크릴 스탠드', 12000, p2, '별빛 소녀 캔뱃지', 9000),
    ('SEED-000002','DELIVERY','SHIPPING',        p3, '냥냥 키링 세트',        18000, null::uuid, null, 0),
    ('SEED-000003','PICKUP','PAID',              p1, '별빛 소녀 아크릴 스탠드', 12000, null::uuid, null, 0),
    ('SEED-000004','DELIVERY','COMPLETED',       p2, '달토끼 인형 키링',        9000, null::uuid, null, 0)
  ) as t(no, ftype, st, a_id, a_name, a_price, b_id, b_name, b_price)
  loop
    oid := gen_random_uuid();
    insert into public.orders (
      id, order_no, user_id, store_id, fulfillment_type, status,
      items_amount, delivery_fee, discount_amount, total_amount,
      commission_rate, commission_amount,
      recipient_name, recipient_phone, shipping_address, delivery_request,
      pickup_code, pickup_deadline, created_at, updated_at
    ) values (
      oid, to_char(now(), 'YYYYMMDD') || '-' || r.no, uid, sid, r.ftype, r.st,
      r.a_price + r.b_price, 0, 0, r.a_price + r.b_price,
      0, 0,
      case when r.ftype = 'DELIVERY' then '김굿즈' end,
      case when r.ftype = 'DELIVERY' then '01012345678' end,
      case when r.ftype = 'DELIVERY' then '(48058) 부산 해운대구 센텀중앙로 00, 101동 1001호' end,
      '{"version":1,"storeRequest":"포장은 간단하게 부탁드려요","deliveryRequest":"문 앞에 놓아주세요"}',
      case when r.ftype = 'PICKUP' then '482716' end,
      case when r.st = 'READY_FOR_PICKUP' then now() + interval '5 hours' end,
      now() - interval '1 day', now() - interval '1 hour'
    );

    insert into public.order_items (order_id, store_product_id, product_name, condition_grade, unit_price, quantity, subtotal)
    values (oid, r.a_id, r.a_name, 'NEW', r.a_price, 1, r.a_price);
    if r.b_id is not null then
      insert into public.order_items (order_id, store_product_id, product_name, condition_grade, unit_price, quantity, subtotal)
      values (oid, r.b_id, r.b_name, 'NEW', r.b_price, 1, r.b_price);
    end if;

    insert into public.order_status_histories (order_id, from_status, to_status, changed_by, memo, created_at)
    values (oid, null, 'PAID', uid, '시연 결제', now() - interval '1 day');
    if r.st <> 'PAID' then
      insert into public.order_status_histories (order_id, from_status, to_status, changed_by, memo, created_at)
      values (oid, 'PAID', 'PREPARING', uid, null, now() - interval '20 hours');
      insert into public.order_status_histories (order_id, from_status, to_status, changed_by, memo, created_at)
      values (oid, 'PREPARING', r.st, uid, null, now() - interval '1 hour');
    end if;

    insert into public.payments (user_id, purpose, order_id, method_label, amount, status, is_mock, approved_at)
    values (uid, 'ORDER', oid, '신한카드 ****1234', r.a_price + r.b_price, 'PAID', true, now() - interval '1 day');
  end loop;
end $$;

-- 삭제(정리)
-- delete from public.payments where order_id in (select id from public.orders where order_no like '%-SEED-%');
-- delete from public.order_status_histories where order_id in (select id from public.orders where order_no like '%-SEED-%');
-- delete from public.order_items where order_id in (select id from public.orders where order_no like '%-SEED-%');
-- delete from public.orders where order_no like '%-SEED-%';
