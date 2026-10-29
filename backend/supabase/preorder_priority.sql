-- 사전예약 순번(priority) — 판매상품별로 1부터 부여
-- preorder.repository.js 의 nextPriority() 가 호출한다.
create or replace function next_preorder_priority(p_store_product_id uuid)
returns int language plpgsql as $$
declare v int;
begin
  perform pg_advisory_xact_lock(hashtext(p_store_product_id::text));
  select coalesce(max(priority), 0) + 1 into v
    from preorders where store_product_id = p_store_product_id;
  return v;
end $$;
