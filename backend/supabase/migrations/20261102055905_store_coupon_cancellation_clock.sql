-- Restore using the actual time after lock waits, not transaction start time.
begin;
create or replace function public.cancel_coupon_order(p_user_id uuid,p_order_id uuid,p_memo text) returns boolean
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
  update public.orders set status='CANCELED',canceled_at=clock_timestamp(),updated_at=clock_timestamp() where id=o.id;
  for i in select * from public.order_items where order_id=o.id loop
    select * into s from public.store_products where id=i.store_product_id;
    update public.store_products set stock=stock+i.quantity,status=case when status='SOLD_OUT' then 'ON_SALE' else status end,updated_at=clock_timestamp() where id=s.id;
    insert into public.inventory_logs(store_product_id,change_type,quantity_delta,stock_before,stock_after,order_id,changed_by)
      values(s.id,'ORDER_CANCEL',i.quantity,s.stock,s.stock+i.quantity,o.id,p_user_id);
  end loop;
  for cid in select o.used_coupon_id where o.used_coupon_id is not null
    union select (o.coupon_snapshot->'cart'->>'userCouponId')::uuid
      where o.coupon_snapshot->'cart'->>'userCouponId' is not null
      and not exists(select 1 from public.orders where checkout_group_id=o.checkout_group_id and status<>'CANCELED') loop
    update public.user_coupons u set status=case when u.expires_at>clock_timestamp() and c.valid_until>clock_timestamp() and c.is_active then 'AVAILABLE' else 'EXPIRED' end,
      used_at=null,used_order_id=null from public.coupons c
      where u.id=cid and u.user_id=p_user_id and u.coupon_id=c.id and u.status='USED'
      and not exists(select 1 from public.orders other where other.used_coupon_id=u.id and other.status<>'CANCELED');
  end loop;
  update public.payments set status='CANCELED',canceled_at=clock_timestamp() where order_id=o.id and user_id=p_user_id and is_mock and status='PAID';
  select greatest(0,-coalesce(sum(amount),0)) into restored from public.point_transactions
    where user_id=p_user_id and order_id=o.id and status='CONFIRMED' and type in ('USE','USE_CANCEL');
  if restored>0 then
    insert into public.point_transactions(user_id,order_id,type,status,amount,memo) values(p_user_id,o.id,'USE_CANCEL','CONFIRMED',restored,'주문 취소로 적립금 복구');
  end if;
  update public.point_transactions set status='CANCELED' where user_id=p_user_id and order_id=o.id and type='EARN' and status='PENDING';
  insert into public.order_status_histories(order_id,from_status,to_status,changed_by,memo) values(o.id,'PAID','CANCELED',p_user_id,p_memo);
  return true;
end $$;
commit;
