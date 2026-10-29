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

create index if not exists products_upcoming_home_idx
  on products (open_at asc, alert_count desc)
  where status = 'UPCOMING';

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
