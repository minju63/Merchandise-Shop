-- 재입고 예정 상품도 사전예약을 받는다.
-- 품절 상태이고 재입고 시각이 아직 오지 않은 판매상품을 사전예약 가능으로 바꾼다. 여러 번 실행해도 안전하다.
update store_products
set preorder_available = true
where status = 'SOLD_OUT'
  and restock_expected_at is not null
  and restock_expected_at > now()
  and preorder_available is distinct from true;
