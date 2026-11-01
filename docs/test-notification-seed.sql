-- 테스트용 알림 2건. 개발 DB의 활성 사용자 모두에게 한 번씩 넣는다.
-- 여러 번 실행해도 같은 제목의 목업 알림은 중복 생성하지 않는다.

insert into notifications (user_id, type, title, body, target_type, is_read)
select u.id,
       'RESTOCK',
       '찜한 상품이 재입고됐어요',
       '블랙핑크 콘서트 공식 응원봉을 지금 구매할 수 있어요. 다시 품절되기 전에 확인해 보세요.',
       'MOCK',
       false
  from users u
 where u.status = 'ACTIVE'
   and not exists (
     select 1 from notifications n
      where n.user_id = u.id
        and n.target_type = 'MOCK'
        and n.title = '찜한 상품이 재입고됐어요'
   );

insert into notifications (user_id, type, title, body, target_type, is_read)
select u.id,
       'ORDER_STATUS',
       '주문하신 상품의 픽업 준비가 끝났어요',
       '준비 완료일로부터 7일 이내에 매장을 방문해 수령해 주세요.',
       'MOCK',
       false
  from users u
 where u.status = 'ACTIVE'
   and not exists (
     select 1 from notifications n
      where n.user_id = u.id
        and n.target_type = 'MOCK'
        and n.title = '주문하신 상품의 픽업 준비가 끝났어요'
   );

select u.nickname, n.type, n.title, n.is_read, n.created_at
  from notifications n
  join users u on u.id = n.user_id
 where n.target_type = 'MOCK'
 order by u.nickname, n.created_at;
