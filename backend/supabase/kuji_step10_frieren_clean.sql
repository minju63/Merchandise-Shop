-- 담당: 연수
-- 굿즈픽 쿠지 10단계: 오픈 전인 「장송의 프리렌 쿠지」에서 시연용 교환글을 지우고 티켓을 전부 판매 전 상태로 되돌린다.
-- step9 를 이미 실행한 DB 용이다. 여러 번 실행해도 안전하다. 실제 구매자가 생긴(owner_id 가 있는) 티켓은 건드리지 않는다.

delete from kuji_swap_listings l
 using kuji_events e
 where l.kuji_id = e.id and e.slug = 'frieren-journey' and e.status = 'UPCOMING' and l.user_id is null;

update kuji_tickets t
   set sold_at = null, opened_at = null, seed_owner_name = null
  from kuji_events e
 where t.kuji_id = e.id and e.slug = 'frieren-journey' and e.status = 'UPCOMING'
   and t.owner_id is null and (t.sold_at is not null or t.seed_owner_name is not null);
