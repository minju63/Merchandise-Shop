-- Live database integration test. Every mutation below is rolled back.
-- Run after the migration and seed; requires two active profiles and in-stock sales.
begin;
do $$
declare buyer uuid; outsider uuid; c uuid; uc uuid; sale public.store_products; sale_b public.store_products;
  payload jsonb; second_order jsonb; req uuid:=gen_random_uuid(); grp uuid; repeated uuid; oid uuid; res jsonb;
  total integer; before_stock integer;
begin
  select id into buyer from public.users where status='ACTIVE' order by id limit 1;
  select id into outsider from public.users where status='ACTIVE' and id<>buyer order by id limit 1;
  if buyer is null or outsider is null then raise exception '검증용 활성 계정 두 개가 필요합니다.'; end if;
  select * into sale from public.store_products where store_id='10000000-0000-4000-8000-000000000001'
    and status='ON_SALE' and stock>=2 and price>0 and (max_per_order is null or max_per_order>=2) order by id limit 1;
  select * into sale_b from public.store_products where store_id='10000000-0000-4000-8000-000000000002'
    and status='ON_SALE' and stock>=1 and price>0 order by id limit 1;
  if sale.id is null or sale_b.id is null then raise exception '검증용 판매상품이 필요합니다.'; end if;
  total:=sale.price*2; before_stock:=sale.stock;
  insert into public.coupons(store_id,code,name,discount_type,discount_value,min_order_amount,total_quantity,valid_from,valid_until)
    values(sale.store_id,'TX_'||left(replace(gen_random_uuid()::text,'-',''),20),'롤백 전용 검증 쿠폰','FIXED',least(1000,total),total,1,now()-interval '1 day',now()+interval '1 day') returning id into c;
  res:=public.issue_store_coupons(buyer,sale.store_id,c);
  if (res->>'issuedCount')::integer<>1 then raise exception '개별 발급 실패'; end if;
  if (public.issue_store_coupons(buyer,sale.store_id,c)->>'issuedCount')::integer<>0 then raise exception '재발급 차단 실패'; end if;
  if (public.issue_store_coupons(outsider,sale.store_id,c)->>'issuedCount')::integer<>0 then raise exception '발급 한도 차단 실패'; end if;
  select id into uc from public.user_coupons where user_id=buyer and coupon_id=c;
  begin
    perform public.consume_checkout_coupon(outsider,uc,sale.store_id,total,0,'PICKUP',null,false);
    raise exception using errcode='ZX001', message='타인 사용이 허용됨';
  exception when raise_exception then null; end;
  begin
    perform public.consume_checkout_coupon(buyer,uc,sale_b.store_id,total,0,'PICKUP',null,false);
    raise exception using errcode='ZX001', message='다른 매장 사용이 허용됨';
  exception when raise_exception then null; end;
  begin
    perform public.consume_checkout_coupon(buyer,uc,sale.store_id,total-1,0,'DELIVERY',null,false);
    raise exception using errcode='ZX001', message='최소 금액 미달 사용이 허용됨';
  exception when raise_exception then null; end;
  payload:=jsonb_build_object('storeId',sale.store_id,'fulfillmentType','PICKUP','itemsAmount',total,'deliveryFee',0,
    'discountAmount',least(1000,total),'cartCouponDiscountAmount',0,'payAmount',total-least(1000,total),
    'pointsUsedAmount',0,'pointsEarnAmount',0,'commissionRate',0,'commissionAmount',0,
    'coupon',jsonb_build_object('userCouponId',uc),'items',jsonb_build_array(jsonb_build_object(
      'storeProductId',sale.id,'productName','롤백 전용 상품 스냅샷','quantity',2,'unitPrice',sale.price)));
  second_order:=jsonb_build_object('storeId',sale_b.store_id,'fulfillmentType','DELIVERY','itemsAmount',sale_b.price,
    'deliveryFee',3000,'discountAmount',0,'cartCouponDiscountAmount',0,'payAmount',sale_b.price+3000,
    'pointsUsedAmount',0,'pointsEarnAmount',0,'commissionRate',0,'commissionAmount',0,'coupon',null,
    'items',jsonb_build_array(jsonb_build_object('storeProductId',sale_b.id,'productName','롤백 전용 상품 B', 'quantity',1,'unitPrice',sale_b.price)));
  begin
    perform public.commit_coupon_checkout(buyer,req,'verify',gen_random_uuid(),jsonb_build_array(payload,second_order||'{"payAmount":-1}'),null,'{"label":"롤백 시연 결제"}','{}',0);
    raise exception using errcode='ZX001', message='실패 주문이 허용됨';
  exception when raise_exception then null; end;
  if (select status from public.user_coupons where id=uc)<>'AVAILABLE'
    or (select stock from public.store_products where id=sale.id)<>before_stock
    or exists(select 1 from public.orders where checkout_request_id=req) then raise exception '실패 주문 롤백 실패'; end if;
  grp:=public.commit_coupon_checkout(buyer,req,'verify',gen_random_uuid(),jsonb_build_array(payload,second_order),null,'{"label":"롤백 시연 결제"}','{}',0);
  repeated:=public.commit_coupon_checkout(buyer,req,'verify',gen_random_uuid(),jsonb_build_array(payload,second_order),null,'{"label":"롤백 시연 결제"}','{}',0);
  if grp<>repeated or (select count(*) from public.orders where checkout_group_id=grp)<>2 then raise exception '다중 매장/중복 요청 차단 실패'; end if;
  select used_order_id into oid from public.user_coupons where id=uc and status='USED';
  if oid is null or (select discount_amount from public.orders where id=oid)<>least(1000,total) then raise exception '쿠폰 사용 스냅샷 저장 실패'; end if;
  perform public.cancel_coupon_order(buyer,oid,'롤백 검증');
  if (select status from public.user_coupons where id=uc)<>'AVAILABLE' or (select stock from public.store_products where id=sale.id)<>before_stock then raise exception '취소 복구 실패'; end if;
  -- Use again in a separate request, then cancel after expiry.
  perform public.commit_coupon_checkout(buyer,gen_random_uuid(),'expiry',gen_random_uuid(),jsonb_build_array(payload),null,'{"label":"롤백 시연 결제"}','{}',0);
  select used_order_id into oid from public.user_coupons where id=uc;
  update public.user_coupons set expires_at=clock_timestamp()+interval '150 milliseconds' where id=uc;
  perform pg_sleep(0.2);
  perform public.cancel_coupon_order(buyer,oid,'만료 복구 검증');
  if (select status from public.user_coupons where id=uc)<>'EXPIRED' then raise exception '만료 쿠폰 복구 정책 실패'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from public.users where status='ACTIVE' order by id limit 1),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.user_coupons where user_id<>auth.uid()) then raise exception '보유 쿠폰 RLS 격리 실패'; end if;
  if has_table_privilege(current_user,'public.user_coupons','INSERT') or has_table_privilege(current_user,'public.user_coupons','UPDATE')
    or has_function_privilege(current_user,'public.issue_coupon_atomic(uuid,uuid)','EXECUTE')
    or has_function_privilege(current_user,'public.commit_coupon_checkout(uuid,uuid,text,uuid,jsonb,jsonb,jsonb,uuid[],integer)','EXECUTE')
    then raise exception '클라이언트 직접 조작 차단 실패'; end if;
end $$;
rollback;
select 'PASS: live issuance, limit, ownership, store/minimum validation, multi-store atomic checkout, replay, cancellation, expiry and authenticated RLS; all test mutations rolled back' as result;
