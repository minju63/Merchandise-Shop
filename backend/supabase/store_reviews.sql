create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  content text not null,
  image_urls text[] not null default '{}'::text[],
  selected_order_item_ids uuid[] not null default '{}'::uuid[],
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint store_reviews_user_store_key unique (user_id, store_id)
);

alter table public.store_reviews
  add column if not exists selected_order_item_ids uuid[] not null default '{}'::uuid[];

create index if not exists store_reviews_store_visible_created_idx
  on public.store_reviews (store_id, created_at desc)
  where is_hidden = false and deleted_at is null;

alter table public.store_reviews enable row level security;
revoke all on table public.store_reviews from anon, authenticated;
grant all on table public.store_reviews to service_role;
