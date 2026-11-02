alter table public.reviews
  add column like_count integer not null default 0 check (like_count >= 0);

grant select, update on public.reviews to service_role;

create table public.product_review_likes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index product_review_likes_user_id_idx
  on public.product_review_likes(user_id, review_id);

alter table public.product_review_likes enable row level security;
revoke all on public.product_review_likes from public, anon, authenticated;
grant select, insert, delete on public.product_review_likes to service_role;

create function public.adjust_product_review_like_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews
      set like_count = like_count + 1
      where id = new.review_id;
    return new;
  end if;

  update public.reviews
    set like_count = greatest(0, like_count - 1)
    where id = old.review_id;
  return old;
end;
$$;

revoke all on function public.adjust_product_review_like_count() from public, anon, authenticated;
grant execute on function public.adjust_product_review_like_count() to service_role;

create trigger product_review_like_count_insert
  after insert on public.product_review_likes
  for each row execute function public.adjust_product_review_like_count();

create trigger product_review_like_count_delete
  after delete on public.product_review_likes
  for each row execute function public.adjust_product_review_like_count();
