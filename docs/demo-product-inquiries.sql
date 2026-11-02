-- Public demo samples use exact deterministic IDs; normal support inquiries remain private.
begin;
select pg_advisory_xact_lock(hashtext('demo-product-inquiries-v1'));
do $$ begin
  if not exists(select 1 from public.users where id='3cb113a1-e296-44eb-9ea3-6e188bba9c52' and email='test-my@goodspang.test') then
    raise exception 'Demo account missing';
  end if;
end $$;
insert into public.inquiries(id,user_id,store_id,category,title,content,status,answer_content,answered_at,created_at)
select md5('demo-product-inquiry-v1:'||s.id||':'||n)::uuid,
  '3cb113a1-e296-44eb-9ea3-6e188bba9c52'::uuid,s.id,'PRODUCT',
  case n when 1 then '[샘플] 매장에서 직접 픽업할 수 있나요?'
    when 2 then '[샘플] 선물용으로 포장 가능한가요?'
    else '[샘플] 품절 상품은 언제 재입고되나요?' end,
  case n when 1 then '[샘플 문의] 온라인으로 주문한 굿즈를 매장에 방문해서 받고 싶어요. 픽업 방법이 궁금합니다.'
    when 2 then '[샘플 문의] 친구에게 선물하려고 합니다. 상품 보호 포장이나 선물 포장이 가능한지 알려주세요.'
    else '[샘플 문의] 찾고 있는 굿즈가 품절로 표시됩니다. 재입고 일정이나 알림 신청 방법이 있나요?' end,
  case when n<3 then 'ANSWERED' else 'PENDING' end,
  case n when 1 then '[샘플 답변] 상품에 픽업 가능 표시가 있다면 주문 시 매장 픽업을 선택해 주세요. 준비 완료 알림을 확인한 뒤 매장에 방문하시면 됩니다.'
    when 2 then '[샘플 답변] 기본 보호 포장 후 전달해 드립니다. 선물 포장 가능 여부와 추가 비용은 주문 전 매장에 확인해 주세요.'
    else null end,
  case when n<3 then now()-(n||' days')::interval else null end,
  now()-((n+1)||' days')::interval
from public.stores s cross join generate_series(1,3) n
where s.status='ACTIVE' and s.address like '%(테스트용)%'
  and s.id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004',
    'd101e327-d58c-4850-938f-386d775c07fb','6d903525-8dee-4ea4-af78-2963c0434014')
on conflict(id) do nothing;
commit;
select status,count(*) as count from public.inquiries i
where i.id=md5('demo-product-inquiry-v1:'||i.store_id||':1')::uuid
   or i.id=md5('demo-product-inquiry-v1:'||i.store_id||':2')::uuid
   or i.id=md5('demo-product-inquiry-v1:'||i.store_id||':3')::uuid
group by status;
