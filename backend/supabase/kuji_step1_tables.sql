-- 담당: 연수
-- 굿즈픽 쿠지 1단계: 테이블 구조 · 접근 권한(RLS)
-- Supabase SQL Editor에서 한 번 실행한다. 여러 번 실행해도 안전하다.
--
-- 실행 순서 (앞 파일이 먼저 적용돼 있어야 한다)
--   mytab_points_claims_views.sql → mytab_review_points.sql → 이 파일 → kuji_step2_functions.sql → kuji_step3_seed.sql
--
-- · 번호마다 어떤 상품이 들어 있는지는 kuji_tickets 에 있고, 구매 전에 새 나가면 안 되므로
--   kuji_tickets · kuji_purchases · kuji_swap_* 는 화면(anon/authenticated)에서 직접 읽지 못하게 막는다.
--   화면은 kuji_step2_functions.sql 의 함수(RPC)로만 읽고 쓴다.
-- · 쿠지 이벤트 · 등급별 상품 · 상품 종류(kuji_events · kuji_prizes · kuji_prize_variants)는 누구나 읽을 수 있다.
-- · 결제는 모의다. kuji_purchases 에 금액만 기록하고 실제 PG 호출은 하지 않는다.

-- 1) 쿠지 이벤트
create table if not exists kuji_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  shop_name text not null,
  status text not null default 'ON_SALE' check (status in ('UPCOMING', 'ON_SALE', 'CLOSED')),
  ticket_price integer not null check (ticket_price > 0),
  total_tickets integer not null check (total_tickets > 0),
  max_per_purchase integer not null default 10 check (max_per_purchase > 0),
  last_one_text text,
  opens_at timestamptz,
  closes_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table kuji_events add column if not exists cover_url text;
alter table kuji_events add column if not exists banner_url text;

-- 2) 등급별 상품. 되팔기 금액(buyback_price)은 등급마다 고정이다.
create table if not exists kuji_prizes (
  id uuid primary key default gen_random_uuid(),
  kuji_id uuid not null references kuji_events(id) on delete cascade,
  grade text not null check (grade in ('A', 'B', 'C', 'D', 'E', 'F')),
  name text not null,
  description text,
  retail_price integer not null default 0 check (retail_price >= 0),
  buyback_price integer not null default 0 check (buyback_price >= 0),
  total_count integer not null check (total_count > 0),
  image_url text,
  unique (kuji_id, grade)
);

-- 3) 상품 종류(같은 등급 안의 디자인). 종류가 2개 이상인 등급만 교환할 수 있다.
create table if not exists kuji_prize_variants (
  id uuid primary key default gen_random_uuid(),
  prize_id uuid not null references kuji_prizes(id) on delete cascade,
  kuji_id uuid not null references kuji_events(id) on delete cascade,
  grade text not null check (grade in ('A', 'B', 'C', 'D', 'E', 'F')),
  label text not null,
  sort_order integer not null default 0,
  unique (prize_id, label)
);
create index if not exists kuji_prize_variants_kuji_idx on kuji_prize_variants (kuji_id, grade, sort_order);

-- 4) 티켓. 번호(number)마다 들어 있는 상품 종류(variant_id)가 정해져 있다 (판매 중에는 바뀌지 않는다. 교환만 예외).
--    sold_at 이 있으면 판매됨. owner_id 가 없고 seed_owner_name 만 있으면 "다른 구매자"가 산 시드 데이터다.
create table if not exists kuji_tickets (
  id uuid primary key default gen_random_uuid(),
  kuji_id uuid not null references kuji_events(id) on delete cascade,
  number integer not null check (number > 0),
  grade text not null check (grade in ('A', 'B', 'C', 'D', 'E', 'F')),
  variant_id uuid not null references kuji_prize_variants(id),
  owner_id uuid references users(id) on delete set null,
  seed_owner_name text,
  sold_at timestamptz,
  opened_at timestamptz,
  resold_at timestamptz,
  swap_count smallint not null default 0 check (swap_count >= 0),
  unique (kuji_id, number)
);
create index if not exists kuji_tickets_owner_idx on kuji_tickets (owner_id, kuji_id);
create index if not exists kuji_tickets_left_idx on kuji_tickets (kuji_id, grade) where sold_at is null;

-- 5) 구매 내역 (모의 결제)
create table if not exists kuji_purchases (
  id uuid primary key default gen_random_uuid(),
  kuji_id uuid not null references kuji_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  ticket_count integer not null check (ticket_count > 0),
  amount integer not null check (amount >= 0),
  status text not null default 'PAID' check (status in ('PAID', 'CANCELED')),
  created_at timestamptz not null default now()
);
create index if not exists kuji_purchases_user_idx on kuji_purchases (user_id, created_at desc);

-- 6) 교환글. 같은 쿠지 · 같은 등급 안에서 내가 가진 종류(티켓의 종류)를 내놓고 want_variant_id 를 원한다.
--    user_id 가 비어 있으면 시드 데이터(다른 구매자)의 글이다.
create table if not exists kuji_swap_listings (
  id uuid primary key default gen_random_uuid(),
  kuji_id uuid not null references kuji_events(id) on delete cascade,
  ticket_id uuid not null references kuji_tickets(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  grade text not null check (grade in ('A', 'B', 'C', 'D', 'E', 'F')),
  want_variant_id uuid not null references kuji_prize_variants(id),
  status text not null default 'OPEN' check (status in ('OPEN', 'MATCHED', 'CANCELED')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists kuji_swap_open_ticket_uidx on kuji_swap_listings (ticket_id) where status = 'OPEN';
create index if not exists kuji_swap_open_idx on kuji_swap_listings (kuji_id, status, created_at desc);

-- 7) 성사된 교환. 수수료(fee_each)는 한 사람당 금액이며 모의 결제로 기록만 한다.
create table if not exists kuji_swaps (
  id uuid primary key default gen_random_uuid(),
  kuji_id uuid not null references kuji_events(id) on delete cascade,
  listing_id uuid not null references kuji_swap_listings(id) on delete cascade,
  accepter_ticket_id uuid not null references kuji_tickets(id) on delete cascade,
  lister_ticket_id uuid not null references kuji_tickets(id) on delete cascade,
  accepter_user_id uuid references users(id) on delete set null,
  lister_user_id uuid references users(id) on delete set null,
  fee_each integer not null check (fee_each >= 0),
  created_at timestamptz not null default now()
);
create index if not exists kuji_swaps_accepter_idx on kuji_swaps (accepter_user_id, created_at desc);

-- 8) 되팔기 적립금을 기존 적립금 내역(point_transactions)에 넣는다.
--    같은 티켓은 한 번만 되팔 수 있다.
alter table point_transactions
  add column if not exists kuji_ticket_id uuid references kuji_tickets(id) on delete set null;

alter table point_transactions drop constraint if exists point_transactions_type_check;
alter table point_transactions add constraint point_transactions_type_check
  check (type in ('EARN', 'USE', 'USE_CANCEL', 'REVIEW_REWARD', 'KUJI_RESALE'));

create unique index if not exists point_transactions_kuji_resale_uidx
  on point_transactions (kuji_ticket_id)
  where type = 'KUJI_RESALE';

-- 9) 접근 권한: 읽기 전용 공개 3개를 빼고는 화면에서 직접 접근하지 못하게 한다.
alter table kuji_events enable row level security;
alter table kuji_prizes enable row level security;
alter table kuji_prize_variants enable row level security;
alter table kuji_tickets enable row level security;
alter table kuji_purchases enable row level security;
alter table kuji_swap_listings enable row level security;
alter table kuji_swaps enable row level security;

drop policy if exists kuji_events_read on kuji_events;
create policy kuji_events_read on kuji_events for select to anon, authenticated using (true);
drop policy if exists kuji_prizes_read on kuji_prizes;
create policy kuji_prizes_read on kuji_prizes for select to anon, authenticated using (true);
drop policy if exists kuji_prize_variants_read on kuji_prize_variants;
create policy kuji_prize_variants_read on kuji_prize_variants for select to anon, authenticated using (true);

revoke all on kuji_tickets, kuji_purchases, kuji_swap_listings, kuji_swaps from anon, authenticated;
revoke insert, update, delete on kuji_events, kuji_prizes, kuji_prize_variants from anon, authenticated;
grant select on kuji_events, kuji_prizes, kuji_prize_variants to anon, authenticated;
