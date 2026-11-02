-- 구매확정 시각. COMPLETED(배송·수령 완료) 주문을 고객이 구매확정하면 채워지고,
-- 이때 적립금이 확정되고 리뷰 작성이 열린다. (Supabase에 이미 적용됨)
alter table public.orders add column if not exists purchase_confirmed_at timestamptz;
-- 기존 완료 주문은 이미 확정된 것으로 본다.
update public.orders set purchase_confirmed_at = coalesce(updated_at, now())
where status = 'COMPLETED' and purchase_confirmed_at is null;
