-- 담당: 연수
-- 마이탭 신규 기능용 테이블: 적립금 · 반품/교환 · 최근 본 상품
-- Supabase SQL Editor에서 한 번 실행한다. 여러 번 실행해도 안전하다.

-- 1) 적립금 내역. 잔액은 CONFIRMED 행의 amount 합계로 계산한다.
--    EARN(+, 결제 적립, 구매확정 전 PENDING) · USE(-, 결제 사용) · USE_CANCEL(+, 취소 복구)
create table if not exists point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  type text not null check (type in ('EARN', 'USE', 'USE_CANCEL')),
  status text not null default 'CONFIRMED' check (status in ('PENDING', 'CONFIRMED', 'CANCELED')),
  amount integer not null check (amount <> 0),
  memo text,
  created_at timestamptz not null default now()
);
create index if not exists point_transactions_user_idx on point_transactions (user_id, created_at desc);
create index if not exists point_transactions_order_idx on point_transactions (order_id);
alter table point_transactions enable row level security;

alter table orders
  add column if not exists points_used_amount integer not null default 0,
  add column if not exists points_earn_amount integer not null default 0;

-- 2) 반품/교환 요청. 취소는 orders.status = 'CANCELED'로 이미 기록된다.
create table if not exists order_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  order_item_id uuid references order_items(id) on delete set null,
  user_id uuid not null references users(id) on delete cascade,
  claim_type text not null check (claim_type in ('RETURN', 'EXCHANGE')),
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED', 'APPROVED', 'COLLECTING', 'COMPLETED', 'REJECTED')),
  reason text not null,
  detail text,
  refund_payment_method_id uuid references payment_methods(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_claims_user_idx on order_claims (user_id, created_at desc);
create index if not exists order_claims_order_idx on order_claims (order_id);
alter table order_claims enable row level security;

-- 3) 최근 본 상품. 사용자·상품당 1행, 다시 보면 viewed_at만 갱신한다. 조회 시 14일 이내만 사용한다.
create table if not exists product_views (
  user_id uuid not null references users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists product_views_user_idx on product_views (user_id, viewed_at desc);
alter table product_views enable row level security;
