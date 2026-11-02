-- 회원 등급 할인: 주문의 discountAmount = 매장 쿠폰 할인 + 등급 할인 (gradeDiscountAmount).
-- 등급 할인이 없는 요청(gradeDiscountAmount 없음 또는 0)은 이전과 똑같이 검증한다.
begin;

create or replace function public.commit_coupon_checkout(p_user_id uuid,p_request_id uuid,p_hash text,p_group_id uuid,
  p_orders jsonb,p_cart_coupon jsonb,p_method jsonb,p_cart_ids uuid[],p_balance_use integer) returns uuid
language plpgsql security invoker set search_path='' as $$
declare o jsonb; i jsonb; sale public.store_products; order_id uuid; subtotal bigint;
  discount integer; snapshot jsonb; consumed jsonb; had_order boolean; existing public.orders;
  cart_discount integer:=0; allocated integer:=0; total_items integer; total_fee integer; mode text;
  grade_discount integer;
begin
  -- Serialize a buyer's requests (also protects their points and first-order rules).
  perform 1 from public.users where id=p_user_id and status='ACTIVE' for update;
  if not found then raise exception '사용할 수 없는 계정이에요.'; end if;
  select * into existing from public.orders where user_id=p_user_id and checkout_request_id=p_request_id limit 1;
  if found then
    if existing.checkout_request_hash is distinct from p_hash then raise exception '같은 결제 요청의 내용이 변경됐어요.'; end if;
    return existing.checkout_group_id;
  end if;
  if jsonb_array_length(p_orders)=0 then raise exception '주문할 상품이 없어요.'; end if;
  if p_balance_use<0 or (p_balance_use>0 and p_balance_use>coalesce((select sum(amount) from public.point_transactions where user_id=p_user_id and status='CONFIRMED'),0))
    then raise exception '적립금 잔액이 변경됐어요.'; end if;
  perform ci.id from public.cart_items ci where ci.user_id=p_user_id and ci.id=any(p_cart_ids) order by ci.id for update;
  had_order:=exists(select 1 from public.orders where user_id=p_user_id and status<>'CANCELED');
  -- Lock sale rows in a consistent order across buyers before reading price/stock.
  perform s.id from public.store_products s where s.id in
    (select (item->>'storeProductId')::uuid from jsonb_array_elements(p_orders) ord,
      lateral jsonb_array_elements(ord->'items') item) order by s.id for update;
  perform p.id from public.products p where p.id in
    (select sp.product_id from public.store_products sp where sp.id in
      (select (item->>'storeProductId')::uuid from jsonb_array_elements(p_orders) ord,
        lateral jsonb_array_elements(ord->'items') item)) order by p.id for share;
  select sum((v->>'itemsAmount')::integer),sum((v->>'deliveryFee')::integer),
    case when count(distinct v->>'fulfillmentType')=1 then min(v->>'fulfillmentType') else 'ALL' end
    into total_items,total_fee,mode from jsonb_array_elements(p_orders) v;
  -- Legacy global coupons remain supported, but store coupons cannot enter this path.
  if p_cart_coupon is not null and p_cart_coupon<>'null'::jsonb then
    consumed:=public.consume_checkout_coupon(p_user_id,(p_cart_coupon->>'userCouponId')::uuid,null,
      total_items,total_fee,mode,null,had_order);
    cart_discount:=(consumed->>'discount')::integer;
    if cart_discount is distinct from (p_cart_coupon->>'discountAmount')::integer then raise exception '쿠폰 할인액이 변경됐어요.'; end if;
  end if;
  for o in select value from jsonb_array_elements(p_orders) loop
    subtotal:=0;
    if cardinality(p_cart_ids)>0 then
      for i in select value from jsonb_array_elements(o->'items') loop
        if (select coalesce(sum(quantity),0) from public.cart_items where user_id=p_user_id and id=any(p_cart_ids)
          and store_product_id=(i->>'storeProductId')::uuid) is distinct from (i->>'quantity')::bigint
          then raise exception '장바구니 수량이 변경됐어요. 주문을 다시 확인해 주세요.'; end if;
      end loop;
    end if;
    for i in select value from jsonb_array_elements(o->'items') loop
      select * into sale from public.store_products where id=(i->>'storeProductId')::uuid;
      if not found or sale.store_id<>(o->>'storeId')::uuid or sale.price<>(i->>'unitPrice')::integer
        or not exists(select 1 from public.products p where p.id=sale.product_id and p.status='ON_SALE' and (p.open_at is null or p.open_at<=clock_timestamp()))
        or sale.status<>'ON_SALE' or (i->>'quantity')::integer<1 or sale.stock<(i->>'quantity')::integer
        or (sale.max_per_order is not null and sale.max_per_order<(i->>'quantity')::integer)
        then raise exception using message='SALE_CHANGED',detail='{"code":"SALE_CHANGED"}'; end if;
      subtotal:=subtotal+sale.price::bigint*(i->>'quantity')::integer;
    end loop;
    if subtotal is distinct from (o->>'itemsAmount')::bigint then raise exception '상품 금액이 변경됐어요.'; end if;
    order_id:=gen_random_uuid(); discount:=0; snapshot:=null;
    -- 회원 등급 할인은 discountAmount 안에 쿠폰 할인과 함께 들어온다(이전 API는 0).
    grade_discount:=coalesce((o->>'gradeDiscountAmount')::integer,0);
    if grade_discount<0 or grade_discount>subtotal then raise exception '등급 할인 금액을 확인해 주세요.'; end if;
    insert into public.orders(id,order_no,user_id,store_id,checkout_group_id,fulfillment_type,status,
      items_amount,delivery_fee,discount_amount,total_amount,commission_rate,commission_amount,
      used_coupon_id,recipient_name,recipient_phone,shipping_address,delivery_request,pickup_code,pickup_deadline,
      points_used_amount,points_earn_amount,checkout_request_id,checkout_request_hash)
    values(order_id,to_char(now(),'YYYYMMDD')||'-'||left(replace(order_id::text,'-',''),20),p_user_id,(o->>'storeId')::uuid,p_group_id,
      o->>'fulfillmentType','PAID',(o->>'itemsAmount')::integer,(o->>'deliveryFee')::integer,
      (o->>'discountAmount')::integer+(o->>'cartCouponDiscountAmount')::integer,(o->>'payAmount')::integer,
      (o->>'commissionRate')::integer,(o->>'commissionAmount')::integer,(o->'coupon'->>'userCouponId')::uuid,
      o->'address'->>'recipient_name',o->'address'->>'recipient_phone',o->>'shippingAddress',o->>'orderRequests',
      case when o->>'fulfillmentType'='PICKUP' then (100000+floor(random()*900000)::integer)::text end,
      (o->'pickup'->>'deadline')::timestamptz,(o->>'pointsUsedAmount')::integer,(o->>'pointsEarnAmount')::integer,p_request_id,p_hash);
    if o->'coupon' is not null and o->'coupon'<>'null'::jsonb then
      consumed:=public.consume_checkout_coupon(p_user_id,(o->'coupon'->>'userCouponId')::uuid,(o->>'storeId')::uuid,
        subtotal::integer,(o->>'deliveryFee')::integer,o->>'fulfillmentType',order_id,had_order);
      discount:=(consumed->>'discount')::integer; snapshot:=consumed;
    end if;
    if discount+grade_discount is distinct from (o->>'discountAmount')::integer or (o->>'payAmount')::integer<0
      or (o->>'payAmount')::integer is distinct from subtotal+(o->>'deliveryFee')::integer-discount-grade_discount
        -(o->>'cartCouponDiscountAmount')::integer-(o->>'pointsUsedAmount')::integer
      then raise exception '최종 결제금액이 변경됐어요.'; end if;
    allocated:=allocated+(o->>'cartCouponDiscountAmount')::integer;
    update public.orders set coupon_snapshot=jsonb_build_object('store',snapshot,'cart',p_cart_coupon) where id=order_id;
    for i in select value from jsonb_array_elements(o->'items') loop
      select * into sale from public.store_products where id=(i->>'storeProductId')::uuid;
      if sale.stock<(i->>'quantity')::integer then raise exception '재고가 부족해요.'; end if;
      insert into public.order_items(order_id,store_product_id,product_name,product_image_url,condition_grade,unit_price,quantity,subtotal)
        values(order_id,sale.id,i->>'productName',i->>'thumbnailUrl',sale.condition_grade,sale.price,(i->>'quantity')::integer,sale.price*(i->>'quantity')::integer);
      update public.store_products set stock=stock-(i->>'quantity')::integer,
        status=case when stock=(i->>'quantity')::integer then 'SOLD_OUT' else status end,updated_at=now() where id=sale.id;
      insert into public.inventory_logs(store_product_id,change_type,quantity_delta,stock_before,stock_after,order_id,changed_by)
        values(sale.id,'ORDER',-(i->>'quantity')::integer,sale.stock,sale.stock-(i->>'quantity')::integer,order_id,p_user_id);
    end loop;
    insert into public.order_status_histories(order_id,from_status,to_status,changed_by,memo) values(order_id,null,'PAID',p_user_id,'시연 결제');
    if (o->>'pointsUsedAmount')::integer>0 then
      insert into public.point_transactions(user_id,order_id,type,status,amount,memo) values(p_user_id,order_id,'USE','CONFIRMED',-(o->>'pointsUsedAmount')::integer,'주문 결제에 적립금 사용');
    end if;
    if (o->>'pointsEarnAmount')::integer>0 then
      insert into public.point_transactions(user_id,order_id,type,status,amount,memo) values(p_user_id,order_id,'EARN','PENDING',(o->>'pointsEarnAmount')::integer,'구매 확정 시 적립');
    end if;
    if (o->>'payAmount')::integer>0 then
      insert into public.payments(user_id,purpose,order_id,payment_method_id,method_label,amount,status,is_mock,approved_at)
        values(p_user_id,'ORDER',order_id,(p_method->>'id')::uuid,p_method->>'label',(o->>'payAmount')::integer,'PAID',true,now());
    end if;
  end loop;
  if allocated<>cart_discount then raise exception '장바구니 쿠폰 배분 금액이 변경됐어요.'; end if;
  if p_cart_coupon is not null and p_cart_coupon<>'null'::jsonb then
    update public.user_coupons set used_order_id=order_id where id=(p_cart_coupon->>'userCouponId')::uuid;
  end if;
  -- A coupon may expire while a multi-store transaction is writing the other orders.
  if exists(select 1 from public.orders ord join public.user_coupons uc on uc.used_order_id=ord.id
    join public.coupons cp on cp.id=uc.coupon_id where ord.checkout_group_id=p_group_id
    and (uc.expires_at<=clock_timestamp() or cp.valid_until<=clock_timestamp())) then
    raise exception using message='COUPON_EXPIRED',detail='{"code":"COUPON_EXPIRED"}';
  end if;
  if cardinality(p_cart_ids)>0 then
    -- Reject a stale/foreign cart selection before committing any changes.
    if (select count(*) from public.cart_items where user_id=p_user_id and id=any(p_cart_ids))<>cardinality(p_cart_ids)
      then raise exception '장바구니 선택이 변경됐어요.'; end if;
    delete from public.cart_items where user_id=p_user_id and id=any(p_cart_ids);
  end if;
  return p_group_id;
end $$;
commit;
