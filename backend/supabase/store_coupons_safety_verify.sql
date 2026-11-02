-- Run after store_coupon_exception_safety. All fixtures and status changes roll back.
begin;
do $$
declare buyer uuid; other_buyer uuid; shop uuid:='10000000-0000-4000-8000-000000000001';
  good uuid; expired uuid; sold uuid; inactive uuid; late uuid; owned uuid; res jsonb; detail text;
begin
  select id into buyer from public.users where status='ACTIVE' order by id limit 1;
  select id into other_buyer from public.users where status='ACTIVE' and id<>buyer order by id limit 1;
  if buyer is null or other_buyer is null then raise exception 'Two active test profiles are required'; end if;
  insert into public.coupons(store_id,name,discount_type,discount_value,min_order_amount,valid_from,valid_until)
    values(shop,'rollback good','FIXED',1000,10000,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day') returning id into good;
  insert into public.coupons(store_id,name,discount_type,discount_value,valid_from,valid_until)
    values(shop,'rollback expired','FIXED',1000,clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 second') returning id into expired;
  insert into public.coupons(store_id,name,discount_type,discount_value,total_quantity,valid_from,valid_until)
    values(shop,'rollback sold','FIXED',1000,1,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day') returning id into sold;
  insert into public.coupons(store_id,name,discount_type,discount_value,is_active,valid_from,valid_until)
    values(shop,'rollback inactive','FIXED',1000,false,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day') returning id into inactive;
  perform public.issue_store_coupons_checked(other_buyer,shop,array[sold]);
  res:=public.issue_store_coupons_checked(buyer,shop,array[good,expired,sold,inactive]);
  if (res->>'issuedCount')::integer<>1 or (res->>'failedCount')::integer<>3
    or not (res->'results' @> '[{"status":"COUPON_ISSUE_EXPIRED"},{"status":"COUPON_SOLD_OUT"},{"status":"COUPON_NOT_ISSUABLE"}]')
    then raise exception 'Partial issuance classification failed'; end if;
  select id into owned from public.user_coupons where user_id=buyer and coupon_id=good;
  begin
    perform public.consume_checkout_coupon(buyer,owned,shop,9999,0,'PICKUP',null,false);
    raise exception using errcode='ZX001',message='Minimum order bypass';
  exception when raise_exception then
    get stacked diagnostics detail=PG_EXCEPTION_DETAIL;
    if (detail::jsonb->>'code')<>'COUPON_MIN_ORDER_AMOUNT' then raise; end if;
  end;
  update public.user_coupons set expires_at=clock_timestamp()+interval '150 milliseconds' where id=owned;
  perform pg_sleep(0.2);
  begin
    perform public.consume_checkout_coupon(buyer,owned,shop,20000,0,'PICKUP',null,false);
    raise exception using errcode='ZX001',message='Expired checkout allowed';
  exception when raise_exception then
    get stacked diagnostics detail=PG_EXCEPTION_DETAIL;
    if (detail::jsonb->>'code')<>'COUPON_EXPIRED' then raise; end if;
  end;
  if (select status from public.user_coupons where id=owned)<>'AVAILABLE' then raise exception 'Failed checkout consumed coupon'; end if;
  insert into public.coupons(store_id,name,discount_type,discount_value,valid_from,valid_until)
    values(shop,'rollback late','FIXED',1000,clock_timestamp()-interval '1 day',clock_timestamp()+interval '150 milliseconds') returning id into late;
  perform pg_sleep(0.2);
  res:=public.issue_store_coupons_checked(buyer,shop,array[late]);
  if res->'results'->0->>'status'<>'COUPON_ISSUE_EXPIRED' or exists(select 1 from public.user_coupons where coupon_id=late)
    then raise exception 'Expired issuance allowed'; end if;
  if has_function_privilege('authenticated','public.issue_store_coupons_checked(uuid,uuid,uuid[])','execute')
    or has_function_privilege('anon','public.issue_store_coupons_checked(uuid,uuid,uuid[])','execute') then raise exception 'RPC exposed to clients'; end if;
end $$;
rollback;
select 'PASS: issuance expiry after transaction start, stock exhaustion, partial results, checkout expiry/minimum, no consumption on failure, RPC grants; all fixtures rolled back' as result;
