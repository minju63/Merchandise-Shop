-- 담당: 연수
-- 리뷰 작성 적립금. Supabase SQL Editor에서 한 번 실행한다(여러 번 실행해도 안전).
-- mytab_points_claims_views.sql 을 먼저 실행해야 한다.
alter table point_transactions
  add column if not exists order_item_id uuid references order_items(id) on delete set null;

alter table point_transactions drop constraint if exists point_transactions_type_check;
alter table point_transactions add constraint point_transactions_type_check
  check (type in ('EARN', 'USE', 'USE_CANCEL', 'REVIEW_REWARD'));

-- 같은 주문 상품에는 리뷰 적립금을 한 번만 준다(삭제 후 다시 써도 중복 지급 없음).
create unique index if not exists point_transactions_review_reward_uidx
  on point_transactions (order_item_id)
  where type = 'REVIEW_REWARD';
