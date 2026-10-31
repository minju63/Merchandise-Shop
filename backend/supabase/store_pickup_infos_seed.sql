-- 픽업을 받는 매장인데 픽업 정책(store_pickup_infos)이 없는 곳에 기본값을 넣는다.
-- 정책이 없으면 픽업 주문이 "매장 픽업 정보가 아직 없어요"(PICKUP_POLICY_MISSING)로 막혀 결제하기가 켜지지 않는다.
-- 준비 30분 · 보관 48시간은 기존 매장(굿즈플래닛 · 모모굿즈)과 같은 수준이다. 이미 정책이 있는 매장은 건드리지 않는다.
-- 픽업을 받지 않는 매장(stores.pickup_available = false)은 넣지 않는다.
insert into store_pickup_infos (store_id, prepare_minutes, hold_hours, guide_text, parking_available)
select s.id, 30, 48, '준비 완료 알림 확인 후 매장 카운터에서 주문번호를 제시하고 수령해주세요.', false
  from stores s
 where s.pickup_available = true
   and not exists (select 1 from store_pickup_infos pi where pi.store_id = s.id);
