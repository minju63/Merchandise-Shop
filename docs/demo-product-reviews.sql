-- Demo reviews only: test-my@goodspang.test + explicitly labeled demo stores.
-- Repeatable IDs prevent duplicate seeds. Existing reviews, stock, and payments are preserved.
-- Reviews require order items, so isolated DEMO-REV-* completed demo orders are created.
-- No checkout, payment, notification, or stock deduction is performed by this seed.
begin;
select pg_advisory_xact_lock(hashtext('demo-product-reviews-v1'));

do $$ begin
  if not exists(select 1 from public.users where email='test-my@goodspang.test' and status='ACTIVE') then
    raise exception 'Active test account missing';
  end if;
end $$;

create temporary table demo_review_targets on commit drop as
select distinct on (p.id) p.id as product_id, p.name, p.thumbnail_url,
  sp.id as store_product_id, sp.store_id, sp.price,
  (select id from public.users where email='test-my@goodspang.test') as user_id
from public.products p
join public.store_products sp on sp.product_id=p.id
join public.stores s on s.id=sp.store_id
where p.status in ('ON_SALE','SOLD_OUT') and sp.status in ('ON_SALE','SOLD_OUT')
  and s.status='ACTIVE' and s.address like '%(테스트용)%'
  and s.id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004',
    'd101e327-d58c-4850-938f-386d775c07fb','6d903525-8dee-4ea4-af78-2963c0434014')
order by p.id, (sp.status='ON_SALE' and sp.stock>0) desc, sp.id;

insert into public.orders(id,order_no,user_id,store_id,fulfillment_type,status,items_amount,
  delivery_fee,discount_amount,total_amount,commission_rate,commission_amount,delivery_request,created_at,updated_at)
select md5('demo-review-order-v1:'||t.store_id||':'||n)::uuid,
  'DEMO-REV-'||substr(md5(t.store_id::text),1,8)||'-'||n,
  t.user_id,t.store_id,'DELIVERY','COMPLETED',sum(t.price)::integer,0,0,sum(t.price)::integer,0,0,
  '[샘플] 리뷰 화면 테스트용 주문입니다. 실제 결제·배송 없음.',
  now()-((n+4)||' days')::interval,now()-((n+3)||' days')::interval
from demo_review_targets t cross join generate_series(1,3) n
group by t.user_id,t.store_id,n
on conflict(id) do nothing;

insert into public.order_items(id,order_id,store_product_id,product_name,product_image_url,
  condition_grade,unit_price,quantity,subtotal,created_at)
select md5('demo-review-item-v1:'||t.product_id||':'||n)::uuid,
  md5('demo-review-order-v1:'||t.store_id||':'||n)::uuid,
  t.store_product_id,t.name,t.thumbnail_url,'NEW',t.price,1,t.price,
  now()-((n+4)||' days')::interval
from demo_review_targets t cross join generate_series(1,3) n
on conflict(id) do nothing;

insert into public.reviews(id,user_id,order_item_id,store_id,product_id,rating,content,created_at,updated_at)
select md5('demo-review-v1:'||t.product_id||':'||n)::uuid,t.user_id,
  md5('demo-review-item-v1:'||t.product_id||':'||n)::uuid,t.store_id,t.product_id,
  case n when 1 then 5 when 2 then 4 else 3 end,
  '[샘플 리뷰 · 실제 구매 후기 아님] '||t.name||E'\n'||
  case n when 1 then '디자인과 색감이 마음에 들어요. 소장용으로 두기 좋은 굿즈예요!'
    when 2 then '사진으로 본 느낌과 비슷해요. 포장도 깔끔하고 전반적으로 만족합니다.'
    else '디자인은 예쁜데 생각했던 크기와 조금 달랐어요. 상세 정보를 확인하고 골라보세요.' end ||
  case when n<3 and t.thumbnail_url is not null then E'\n※ 첨부 사진은 상품 대표 이미지를 사용한 테스트 사진입니다.' else '' end,
  now()-((n+1)||' days')::interval,now()-((n+1)||' days')::interval
from demo_review_targets t cross join generate_series(1,3) n
on conflict(id) do nothing;

insert into public.review_images(id,review_id,image_url,display_order)
select md5('demo-review-image-v1:'||t.product_id||':'||n)::uuid,
  md5('demo-review-v1:'||t.product_id||':'||n)::uuid,
  case when t.thumbnail_url ~ '^https?://' then t.thumbnail_url
    else 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/'||regexp_replace(t.thumbnail_url,'^goods-images/','') end,0
from demo_review_targets t cross join generate_series(1,2) n
where nullif(t.thumbnail_url,'') is not null
on conflict(id) do nothing;

-- Keep the normal product rating/count cache consistent with public review data.
update public.products p set rating_avg=a.average_rating,review_count=a.review_count
from (select r.product_id,round(avg(r.rating)::numeric,2) as average_rating,count(*)::integer as review_count
  from public.reviews r join demo_review_targets t on t.product_id=r.product_id
  where r.is_hidden=false and r.deleted_at is null group by r.product_id) a
where p.id=a.product_id;

commit;

select json_build_object(
  'demoReviews',count(*), 'productsWithDemoReviews',count(distinct product_id),
  'photoReviews',count(*) filter(where exists(select 1 from public.review_images i where i.review_id=r.id))
) as result
from public.reviews r
where r.id=md5('demo-review-v1:'||r.product_id||':1')::uuid
   or r.id=md5('demo-review-v1:'||r.product_id||':2')::uuid
   or r.id=md5('demo-review-v1:'||r.product_id||':3')::uuid;
