do $$ begin
  create type product_status as enum ('UPCOMING', 'ON_SALE', 'SOLD_OUT');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type product_open_type as enum ('NEW', 'RESTOCK');
exception
  when duplicate_object then null;
end $$;

alter table products
  add column if not exists open_at timestamptz,
  add column if not exists status product_status not null default 'ON_SALE',
  add column if not exists open_type product_open_type,
  add column if not exists alert_count integer not null default 0;

create table if not exists open_alerts (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- 이미 테이블이 존재하는 환경에서도 upsert의 충돌 대상이 보장되도록 한다.
-- 기존 중복 신청은 같은 알림이므로 가장 오래된 한 건만 남긴다.
delete from open_alerts
where ctid in (
  select duplicate.ctid
  from (
    select ctid,
           row_number() over (
             partition by user_id, product_id
             order by created_at, ctid
           ) as duplicate_number
    from open_alerts
  ) duplicate
  where duplicate.duplicate_number > 1
);

create unique index if not exists open_alerts_user_product_uidx
  on open_alerts (user_id, product_id);

create index if not exists products_upcoming_home_idx
  on products (open_at asc, alert_count desc)
  where status = 'UPCOMING';

-- 출시 예정 상세에서 사전예약을 제공한다. 이미 오픈했거나 판매 상태가 다른 상품은 제외한다.
update store_products listing
set preorder_available = true
from products product
where listing.product_id = product.id
  and listing.status = 'UPCOMING'
  and product.status = 'UPCOMING'
  and product.open_at > now();

create or replace function sync_product_open_alert_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
  set alert_count = (
    select count(*) from open_alerts where product_id = coalesce(new.product_id, old.product_id)
  )
  where id = coalesce(new.product_id, old.product_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists open_alert_count_trigger on open_alerts;
create trigger open_alert_count_trigger
after insert or delete on open_alerts
for each row execute function sync_product_open_alert_count();

alter table open_alerts enable row level security;

drop policy if exists "Users can read own open alerts" on open_alerts;
create policy "Users can read own open alerts"
on open_alerts for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own open alerts" on open_alerts;
create policy "Users can create own open alerts"
on open_alerts for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own open alerts" on open_alerts;
create policy "Users can delete own open alerts"
on open_alerts for delete
using (auth.uid() = user_id);
