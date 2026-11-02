-- Verified against the connected project on 2026-11-02: six stores.
-- D: 서면굿즈샵 (...0004), E: 집에서면 (6d903525-8dee-4ea4-af78-2963c0434014)
-- receive no coupons. Existing coupons and business data are preserved.
begin;
do $$ begin
  if (select count(*) from public.stores where id in
    ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'))<>3
    then raise exception '테스트 쿠폰 대상 매장이 없습니다. 실제 매장 매핑을 확인하세요.'; end if;
end $$;
insert into public.coupons(store_id,code,name,discount_type,discount_value,min_order_amount,max_discount,applies_to,valid_from,valid_until,total_quantity)
values
('10000000-0000-4000-8000-000000000001','SHOP_MOMO_1000','모모굿즈 1,000원 할인','FIXED',1000,10000,null,'ALL',now()-interval '1 day',now()+interval '90 days',1000),
('10000000-0000-4000-8000-000000000002','SHOP_PLANET_3000','굿즈플래닛 3,000원 할인','FIXED',3000,20000,null,'ALL',now()-interval '1 day',now()+interval '90 days',1000),
('10000000-0000-4000-8000-000000000002','SHOP_PLANET_10','굿즈플래닛 10% 할인','RATE',10,30000,5000,'ALL',now()-interval '1 day',now()+interval '90 days',1000),
('10000000-0000-4000-8000-000000000003','SHOP_DEOK_2000','덕질상점 2,000원 할인','FIXED',2000,15000,null,'ALL',now()-interval '1 day',now()+interval '90 days',1000)
on conflict(code) do nothing;
commit;
select s.id,s.name,count(c.id) filter(where c.is_active and c.valid_from<=now() and c.valid_until>now()) as active_coupons
from public.stores s left join public.coupons c on c.store_id=s.id group by s.id,s.name order by s.id;
