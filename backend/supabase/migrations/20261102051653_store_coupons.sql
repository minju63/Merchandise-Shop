-- Existing store_id is the shop boundary; RATE is this project's PERCENT enum.
-- API verifies Supabase Auth; privileged mutation RPCs accept only service_role.
begin;
alter table public.user_coupons add column used_order_id uuid references public.orders(id);
alter table public.orders add column coupon_snapshot jsonb;
alter table public.orders add column checkout_request_id uuid;
alter table public.orders add column checkout_request_hash text;
create unique index orders_checkout_request_store on public.orders(user_id, checkout_request_id, store_id)
  where checkout_request_id is not null;
create index coupons_store_period on public.coupons(store_id, valid_until);
create index user_coupons_used_order on public.user_coupons(used_order_id) where used_order_id is not null;
alter table public.coupons add constraint coupon_discount_policy check (
  discount_value>=0 and (discount_type<>'RATE' or discount_value<=100)
  and min_order_amount>=0 and (max_discount is null or max_discount>=0)
  and (total_quantity is null or total_quantity>=0) and valid_until>valid_from
);

alter table public.coupons enable row level security;
alter table public.user_coupons enable row level security;
-- Replace only coupon policies; mutation is exclusively through the authenticated API.
do $$ declare p record; begin
  for p in select policyname,tablename from pg_policies where schemaname='public'
    and tablename in ('coupons','user_coupons') loop
    execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  end loop;
end $$;

create function public.commit_coupon_checkout(p_user_id uuid,p_request_id uuid,p_hash text,p_group_id uuid,
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
  if p_balance_use<0 or p_balance_use>coalesce((select sum(amount) from public.point_transactions where user_id=p_user_id and status='CONFIRMED'),0)
    then raise exception '적립금 잔액이 변경됐어요.'; end if;
  had_order:=exists(select 1 from public.orders where user_id=p_user_id and status<>'CANCELED');
  -- Lock sale rows in a consistent order across buyers before reading price/stock.
  perform s.id from public.store_products s where s.id in
    (select (item->>'storeProductId')::uuid from jsonb_array_elements(p_orders) ord,
      lateral jsonb_array_elements(ord->'items') item) order by s.id for update;
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
    for i in select value from jsonb_array_elements(o->'items') loop
      select * into sale from public.store_products where id=(i->>'storeProductId')::uuid;
      if not found or sale.store_id<>(o->>'storeId')::uuid or sale.price<>(i->>'unitPrice')::integer
        or sale.status<>'ON_SALE' or (i->>'quantity')::integer<1 or sale.stock<(i->>'quantity')::integer
        or (sale.max_per_order is not null and sale.max_per_order<(i->>'quantity')::integer)
        then raise exception '상품 가격·재고가 변경됐어요.'; end if;
      subtotal:=subtotal+sale.price::bigint*(i->>'quantity')::integer;
    end loop;
    if subtotal is distinct from (o->>'itemsAmount')::bigint then raise exception '상품 금액이 변경됐어요.'; end if;
    order_id:=gen_random_uuid(); discount:=0; snapshot:=null;
    insert into public.orders(id,order_no,user_id,store_id,checkout_group_id,fulfillment_type,status,
      items_amount,delivery_fee,discount_amount,total_amount,commission_rate,commission_amount,
      used_coupon_id,recipient_name,recipient_phone,shipping_address,delivery_request,pickup_code,pickup_deadline,
      points_used_amount,points_earn_amount,checkout_request_id,checkout_request_hash)
    values(order_id,to_char(now(),'YYYYMMDD')||'-'||replace(order_id::text,'-',''),p_user_id,(o->>'storeId')::uuid,p_group_id,
      o->>'fulfillmentType','PAID',(o->>'itemsAmount')::integer,(o->>'deliveryFee')::integer,
      (o->>'discountAmount')::integer+(o->>'cartCouponDiscountAmount')::integer,(o->>'payAmount')::integer,
      (o->>'commissionRate')::integer,(o->>'commissionAmount')::integer,(o->'coupon'->>'userCouponId')::uuid,
      o->'address'->>'recipient_name',o->'address'->>'recipient_phone',o->>'shippingAddress',o->>'orderRequests',
      case when o->>'fulfillmentType'='PICKUP' then lpad(floor(random()*1000000)::text,6,'0') end,
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
  if cardinality(p_cart_ids)>0 then
    -- Reject a stale/foreign cart selection before committing any changes.
    if (select count(*) from public.cart_items where user_id=p_user_id and id=any(p_cart_ids))<>cardinality(p_cart_ids)
      then raise exception '장바구니 선택이 변경됐어요.'; end if;
    delete from public.cart_items where user_id=p_user_id and id=any(p_cart_ids);
  end if;
  return p_group_id;
end $$;
create policy coupon_policy_read on public.coupons for select to authenticated
  using (is_active or exists(select 1 from public.user_coupons u where u.coupon_id=coupons.id and u.user_id=(select auth.uid())));
create policy owned_coupon_read on public.user_coupons for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.coupons, public.user_coupons from anon, authenticated;
grant select on public.coupons, public.user_coupons to authenticated;

create function public.list_store_coupons(p_user_id uuid,p_store_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.users where id=p_user_id and status='ACTIVE') then raise exception '사용할 수 없는 계정이에요.'; end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object(
    'owned',exists(select 1 from public.user_coupons u where u.user_id=p_user_id and u.coupon_id=c.id),
    'soldOut',c.total_quantity is not null and c.issued_count>=c.total_quantity) order by c.id)
    from public.coupons c where c.store_id=p_store_id and c.is_active
    and c.valid_from<=now() and c.valid_until>now()
    and coalesce(c.code,'') !~ '^(SIGNUP_|DELIVERY_|FIRST_ORDER_)'), '[]'::jsonb));
end $$;

create function public.issue_coupon_atomic(p_user_id uuid,p_coupon_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.coupons; u public.user_coupons; n integer;
begin
  perform 1 from public.users where id=p_user_id and status='ACTIVE' for update;
  if not found then raise exception '사용할 수 없는 계정이에요.'; end if;
  select * into c from public.coupons where id=p_coupon_id for update;
  if not found then raise exception '쿠폰을 찾지 못했어요.'; end if;
  select * into u from public.user_coupons where user_id=p_user_id and coupon_id=c.id;
  if found then return jsonb_build_object('id',u.id,'alreadyOwned',true); end if;
  if not c.is_active or c.valid_from>now() or c.valid_until<=now() then raise exception '쿠폰 발급 기간이 아니에요.'; end if;
  select count(*) into n from public.user_coupons where coupon_id=c.id;
  if c.total_quantity is not null and n>=c.total_quantity then raise exception '쿠폰 발급 수량이 모두 소진됐어요.'; end if;
  insert into public.user_coupons(user_id,coupon_id,expires_at) values(p_user_id,c.id,c.valid_until) returning * into u;
  update public.coupons set issued_count=n+1 where id=c.id;
  return jsonb_build_object('id',u.id,'alreadyOwned',false);
end $$;

create function public.issue_store_coupons(p_user_id uuid,p_store_id uuid,p_coupon_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.coupons; result jsonb; issued integer:=0;
begin
  perform 1 from public.users where id=p_user_id and status='ACTIVE' for update;
  if not found then raise exception '사용할 수 없는 계정이에요.'; end if;
  for c in select * from public.coupons where store_id=p_store_id
    and (p_coupon_id is null or id=p_coupon_id) and is_active and valid_from<=now() and valid_until>now()
    and coalesce(code,'') !~ '^(SIGNUP_|DELIVERY_|FIRST_ORDER_)' order by id for update loop
    if exists(select 1 from public.user_coupons where user_id=p_user_id and coupon_id=c.id) then continue; end if;
    if c.total_quantity is not null and (select count(*) from public.user_coupons where coupon_id=c.id)>=c.total_quantity then continue; end if;
    result:=public.issue_coupon_atomic(p_user_id,c.id);
    if not (result->>'alreadyOwned')::boolean then issued:=issued+1; end if;
  end loop;
  return public.list_store_coupons(p_user_id,p_store_id)||jsonb_build_object('issuedCount',issued);
end $$;

-- A locked coupon is validated at commit time, independently of the preview.
create function public.consume_checkout_coupon(p_user_id uuid,p_user_coupon_id uuid,p_store_id uuid,
  p_amount integer,p_fee integer,p_type text,p_order_id uuid,p_had_order boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare u public.user_coupons; c public.coupons; base integer; discount integer;
begin
  select * into u from public.user_coupons where id=p_user_coupon_id and user_id=p_user_id for update;
  if not found or u.status<>'AVAILABLE' or u.expires_at<=now() then raise exception '쿠폰 상태가 변경됐어요.'; end if;
  select * into c from public.coupons where id=u.coupon_id for share;
  if not c.is_active or c.valid_from>now() or c.valid_until<=now()
    or (c.store_id is not null and c.store_id is distinct from p_store_id)
    or (c.applies_to<>'ALL' and c.applies_to<>p_type) or p_amount<c.min_order_amount
    or (position('FIRST_ORDER_' in coalesce(c.code,''))>0 and p_had_order)
    then raise exception '쿠폰의 매장·기간·최소 주문금액을 확인해 주세요.'; end if;
  base:=case when position('DELIVERY_' in coalesce(c.code,''))>0 then p_fee else p_amount end;
  discount:=least(base,coalesce(c.max_discount,base),case when c.discount_type='FIXED' then c.discount_value else floor(base::numeric*c.discount_value/100)::integer end);
  if discount<0 then raise exception '잘못된 쿠폰 정책이에요.'; end if;
  update public.user_coupons set status='USED',used_at=now(),used_order_id=p_order_id where id=u.id;
  return jsonb_build_object('discount',discount,'policy',to_jsonb(c),'userCouponId',u.id);
end $$;

create function public.cancel_coupon_order(p_user_id uuid,p_order_id uuid,p_memo text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare o public.orders; i public.order_items; s public.store_products; cid uuid; restored integer;
begin
  perform 1 from public.users where id=p_user_id and status='ACTIVE' for update;
  if not found then raise exception '사용할 수 없는 계정이에요.'; end if;
  select * into o from public.orders where id=p_order_id and user_id=p_user_id for update;
  if not found then raise exception '본인 주문을 찾지 못했어요.'; end if;
  if o.status='CANCELED' then return false; end if;
  if o.status<>'PAID' then raise exception '매장에서 확인하기 전 주문만 취소할 수 있어요.'; end if;
  if exists(select 1 from public.payments where order_id=o.id and not is_mock) then raise exception '실제 결제는 시연 API에서 취소할 수 없어요.'; end if;
  perform sp.id from public.store_products sp where sp.id in(select store_product_id from public.order_items where order_id=o.id) order by sp.id for update;
  update public.orders set status='CANCELED',canceled_at=now(),updated_at=now() where id=o.id;
  for i in select * from public.order_items where order_id=o.id loop
    select * into s from public.store_products where id=i.store_product_id;
    update public.store_products set stock=stock+i.quantity,status=case when status='SOLD_OUT' then 'ON_SALE' else status end,updated_at=now() where id=s.id;
    insert into public.inventory_logs(store_product_id,change_type,quantity_delta,stock_before,stock_after,order_id,changed_by)
      values(s.id,'ORDER_CANCEL',i.quantity,s.stock,s.stock+i.quantity,o.id,p_user_id);
  end loop;
  for cid in select o.used_coupon_id where o.used_coupon_id is not null
    union select (o.coupon_snapshot->'cart'->>'userCouponId')::uuid
      where o.coupon_snapshot->'cart'->>'userCouponId' is not null
      and not exists(select 1 from public.orders where checkout_group_id=o.checkout_group_id and status<>'CANCELED') loop
    update public.user_coupons u set status=case when u.expires_at>now() and c.valid_until>now() and c.is_active then 'AVAILABLE' else 'EXPIRED' end,
      used_at=null,used_order_id=null from public.coupons c
      where u.id=cid and u.user_id=p_user_id and u.coupon_id=c.id and u.status='USED'
      and not exists(select 1 from public.orders other where other.used_coupon_id=u.id and other.status<>'CANCELED');
  end loop;
  update public.payments set status='CANCELED',canceled_at=now() where order_id=o.id and user_id=p_user_id and is_mock and status='PAID';
  select greatest(0,-coalesce(sum(amount),0)) into restored from public.point_transactions
    where user_id=p_user_id and order_id=o.id and status='CONFIRMED' and type in ('USE','USE_CANCEL');
  if restored>0 then
    insert into public.point_transactions(user_id,order_id,type,status,amount,memo) values(p_user_id,o.id,'USE_CANCEL','CONFIRMED',restored,'주문 취소로 적립금 복구');
  end if;
  update public.point_transactions set status='CANCELED' where user_id=p_user_id and order_id=o.id and type='EARN' and status='PENDING';
  insert into public.order_status_histories(order_id,from_status,to_status,changed_by,memo) values(o.id,'PAID','CANCELED',p_user_id,p_memo);
  return true;
end $$;

revoke all on function public.list_store_coupons(uuid,uuid),public.issue_coupon_atomic(uuid,uuid),
  public.issue_store_coupons(uuid,uuid,uuid),public.consume_checkout_coupon(uuid,uuid,uuid,integer,integer,text,uuid,boolean),
  public.commit_coupon_checkout(uuid,uuid,text,uuid,jsonb,jsonb,jsonb,uuid[],integer),public.cancel_coupon_order(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.list_store_coupons(uuid,uuid),public.issue_coupon_atomic(uuid,uuid),
  public.issue_store_coupons(uuid,uuid,uuid),public.consume_checkout_coupon(uuid,uuid,uuid,integer,integer,text,uuid,boolean),
  public.commit_coupon_checkout(uuid,uuid,text,uuid,jsonb,jsonb,jsonb,uuid[],integer),public.cancel_coupon_order(uuid,uuid,text)
  to service_role;
commit;
