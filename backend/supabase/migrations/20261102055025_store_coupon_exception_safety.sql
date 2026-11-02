begin;
-- Recheck wall-clock time AFTER row locks; now() is the transaction start time.
create or replace function public.issue_coupon_atomic(p_user_id uuid,p_coupon_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.coupons; u public.user_coupons; n integer; checked_at timestamptz;
begin
  perform 1 from public.users where id=p_user_id and status='ACTIVE' for update;
  if not found then raise exception '사용할 수 없는 계정이에요.'; end if;
  select * into c from public.coupons where id=p_coupon_id for update;
  if not found then raise exception '쿠폰을 찾지 못했어요.'; end if;
  select * into u from public.user_coupons where user_id=p_user_id and coupon_id=c.id;
  if found then return jsonb_build_object('id',u.id,'alreadyOwned',true); end if;
  checked_at:=clock_timestamp();
  if c.valid_until<=checked_at then
    raise exception using message='쿠폰 발급 기간이 종료되었습니다.', detail='{"code":"COUPON_ISSUE_EXPIRED"}';
  end if;
  if not c.is_active or c.valid_from>checked_at then raise exception '현재 발급할 수 없는 쿠폰입니다.'; end if;
  select count(*) into n from public.user_coupons where coupon_id=c.id;
  if c.total_quantity is not null and n>=c.total_quantity then
    raise exception using message='쿠폰이 모두 소진되었습니다.', detail='{"code":"COUPON_SOLD_OUT"}';
  end if;
  insert into public.user_coupons(user_id,coupon_id,expires_at,created_at) values(p_user_id,c.id,c.valid_until,checked_at) returning * into u;
  update public.coupons set issued_count=n+1 where id=c.id;
  return jsonb_build_object('id',u.id,'alreadyOwned',false);
end $$;

create or replace function public.list_store_coupons(p_user_id uuid,p_store_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare checked_at timestamptz;
begin
  -- A reconciliation read waits for an issuing transaction that already owns this lock.
  perform 1 from public.users where id=p_user_id and status='ACTIVE' for update;
  if not found then raise exception '사용할 수 없는 계정이에요.'; end if;
  checked_at:=clock_timestamp();
  return jsonb_build_object('serverTime',checked_at,'ownedCouponIds',coalesce((select jsonb_agg(u.coupon_id)
    from public.user_coupons u join public.coupons c on c.id=u.coupon_id where u.user_id=p_user_id and c.store_id=p_store_id),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object(
      'owned',exists(select 1 from public.user_coupons u where u.user_id=p_user_id and u.coupon_id=c.id),
      'soldOut',c.total_quantity is not null and (select count(*) from public.user_coupons u where u.coupon_id=c.id)>=c.total_quantity) order by c.id)
      from public.coupons c where c.store_id=p_store_id and c.is_active
      and c.valid_from<=checked_at and c.valid_until>checked_at
      and coalesce(c.code,'') !~ '^(SIGNUP_|DELIVERY_|FIRST_ORDER_)'),'[]'::jsonb));
end $$;

create function public.issue_store_coupons_checked(p_user_id uuid,p_store_id uuid,p_coupon_ids uuid[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cid uuid; c public.coupons; result jsonb; results jsonb:='[]'; code text; issued integer:=0; failed integer:=0;
begin
  perform 1 from public.users where id=p_user_id and status='ACTIVE' for update;
  if not found then raise exception '사용할 수 없는 계정이에요.'; end if;
  if cardinality(p_coupon_ids)>100 then raise exception '쿠폰 요청 수를 확인해 주세요.'; end if;
  for cid in select distinct unnest(p_coupon_ids) order by 1 loop
    select * into c from public.coupons where id=cid and store_id=p_store_id for update;
    code:=null; result:=null;
    if not found then code:='COUPON_NOT_FOUND';
    elsif coalesce(c.code,'') ~ '^(SIGNUP_|DELIVERY_|FIRST_ORDER_)' then code:='COUPON_NOT_ISSUABLE';
    else
      begin
        result:=public.issue_coupon_atomic(p_user_id,cid);
        code:=case when (result->>'alreadyOwned')::boolean then 'ALREADY_OWNED' else 'ISSUED' end;
      exception when raise_exception then
        -- Only expected business failures are partial successes. Unexpected DB errors roll back ALL.
        get stacked diagnostics code=PG_EXCEPTION_DETAIL;
        if code='{"code":"COUPON_ISSUE_EXPIRED"}' then code:='COUPON_ISSUE_EXPIRED';
        elsif code='{"code":"COUPON_SOLD_OUT"}' then code:='COUPON_SOLD_OUT';
        elsif not c.is_active or c.valid_from>clock_timestamp() then code:='COUPON_NOT_ISSUABLE';
        else raise; end if;
      end;
    end if;
    if code='ISSUED' then issued:=issued+1;
    elsif code<>'ALREADY_OWNED' then failed:=failed+1; end if;
    results:=results||jsonb_build_array(jsonb_build_object('couponId',cid,'name',c.name,'status',code,'userCouponId',result->>'id'));
  end loop;
  return public.list_store_coupons(p_user_id,p_store_id)||jsonb_build_object('issuedCount',issued,'failedCount',failed,'results',results);
end $$;

-- Keep the existing three-argument RPC contract for other callers.
create or replace function public.issue_store_coupons(p_user_id uuid,p_store_id uuid,p_coupon_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ids uuid[];
begin
  if p_coupon_id is not null then ids:=array[p_coupon_id];
  else select array_agg(id order by id) into ids from public.coupons where store_id=p_store_id and is_active
    and valid_from<=clock_timestamp() and valid_until>clock_timestamp()
    and coalesce(code,'') !~ '^(SIGNUP_|DELIVERY_|FIRST_ORDER_)'; end if;
  return public.issue_store_coupons_checked(p_user_id,p_store_id,coalesce(ids,'{}'));
end $$;

create or replace function public.consume_checkout_coupon(p_user_id uuid,p_user_coupon_id uuid,p_store_id uuid,
  p_amount integer,p_fee integer,p_type text,p_order_id uuid,p_had_order boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare u public.user_coupons; c public.coupons; base integer; discount integer; checked_at timestamptz; reason text; message text;
begin
  select * into u from public.user_coupons where id=p_user_coupon_id and user_id=p_user_id for update;
  if not found then reason:='COUPON_NOT_OWNED'; message:='본인 보유 쿠폰을 다시 확인해 주세요.';
  else
    select * into c from public.coupons where id=u.coupon_id for share;
    checked_at:=clock_timestamp();
    if u.status='USED' then reason:='COUPON_USED'; message:='이미 사용한 쿠폰입니다. 주문금액을 다시 확인해 주세요.';
    elsif u.status='EXPIRED' or u.expires_at<=checked_at or c.valid_until<=checked_at then
      reason:='COUPON_EXPIRED'; message:='선택한 쿠폰의 사용 기간이 종료되었습니다. 주문금액을 다시 확인해 주세요.';
    elsif not c.is_active or c.valid_from>checked_at or (c.store_id is not null and c.store_id is distinct from p_store_id)
      or (c.applies_to<>'ALL' and c.applies_to<>p_type) or (position('FIRST_ORDER_' in coalesce(c.code,''))>0 and p_had_order)
      then reason:='COUPON_NOT_USABLE'; message:='쿠폰 사용 조건이 변경되었습니다. 주문금액을 다시 확인해 주세요.';
    elsif p_amount<c.min_order_amount then reason:='COUPON_MIN_ORDER_AMOUNT'; message:='주문금액이 변경되어 쿠폰 적용 조건을 충족하지 않습니다.';
    end if;
  end if;
  if reason is not null then
    raise exception using message=message,detail=jsonb_build_object('code',reason,'userCouponId',p_user_coupon_id,'storeId',p_store_id)::text;
  end if;
  base:=case when position('DELIVERY_' in coalesce(c.code,''))>0 then p_fee else p_amount end;
  discount:=least(base,coalesce(c.max_discount,base),case when c.discount_type='FIXED' then c.discount_value else floor(base::numeric*c.discount_value/100)::integer end);
  if discount<0 then raise exception '잘못된 쿠폰 정책이에요.'; end if;
  update public.user_coupons set status='USED',used_at=checked_at,used_order_id=p_order_id where id=u.id;
  return jsonb_build_object('discount',discount,'policy',to_jsonb(c),'userCouponId',u.id);
end $$;

revoke all on function public.issue_store_coupons_checked(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.issue_store_coupons_checked(uuid,uuid,uuid[]) to service_role;

create or replace function public.commit_coupon_checkout(p_user_id uuid,p_request_id uuid,p_hash text,p_group_id uuid,
  p_orders jsonb,p_cart_coupon jsonb,p_method jsonb,p_cart_ids uuid[],p_balance_use integer) returns uuid
language plpgsql security invoker set search_path='' as $$
declare o jsonb; i jsonb; sale public.store_products; order_id uuid; subtotal bigint;
  discount integer; snapshot jsonb; consumed jsonb; had_order boolean; existing public.orders;
  cart_discount integer:=0; allocated integer:=0; total_items integer; total_fee integer; mode text;
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
    if discount is distinct from (o->>'discountAmount')::integer or (o->>'payAmount')::integer<0
      or (o->>'payAmount')::integer is distinct from subtotal+(o->>'deliveryFee')::integer-discount
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
