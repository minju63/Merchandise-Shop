-- Store-wide public Q&A. Existing inquiries/product Q&A and policies are untouched.
create table public.store_inquiries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  user_id uuid not null references public.users(id),
  request_id uuid not null,
  title varchar(100) not null check (char_length(title) between 1 and 100 and title ~ '[^[:space:]]'),
  content text not null check (char_length(content) between 1 and 5000 and content ~ '[^[:space:]]'),
  status text not null default 'PENDING' check (status in ('PENDING', 'ANSWERED')),
  answer_content text,
  answered_by uuid references public.users(id),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  constraint store_inquiries_answer_check check (
    (status = 'PENDING' and answer_content is null and answered_by is null and answered_at is null)
    or (status = 'ANSWERED' and answer_content is not null and char_length(answer_content) between 1 and 5000
      and answer_content ~ '[^[:space:]]' and answered_by is not null and answered_at is not null)
  )
);
create index store_inquiries_store_created_idx on public.store_inquiries(store_id, created_at desc, id desc);
create index store_inquiries_answered_by_idx on public.store_inquiries(answered_by) where answered_by is not null;
alter table public.store_inquiries enable row level security;

-- The trigger also validates service-role writes, including a store closing during a request.
create function public.validate_store_inquiry() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare store_owner uuid;
begin
  select owner_id into store_owner from public.stores where id = new.store_id and status = 'ACTIVE' for share;
  if store_owner is null then raise exception 'Store is unavailable' using errcode = '23514'; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.users where id = new.user_id and status = 'ACTIVE')
      or new.status <> 'PENDING' then
      raise exception 'Active member and pending inquiry required' using errcode = '23514';
    end if;
  else
    if (new.id, new.store_id, new.user_id, new.request_id, new.title, new.content, new.created_at)
      is distinct from (old.id, old.store_id, old.user_id, old.request_id, old.title, old.content, old.created_at)
      or new.status <> 'ANSWERED' or new.answered_by is distinct from store_owner
      or not exists (select 1 from public.users where id = new.answered_by and status = 'ACTIVE') then
      raise exception 'Only a store-owner answer may be updated' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_store_inquiry() from public, anon, authenticated;
create trigger validate_store_inquiry before insert or update on public.store_inquiries
for each row execute function public.validate_store_inquiry();

-- The project's stores/users have private RLS. All Q&A access goes through the
-- backend, which validates active stores, verified members, and store ownership.
-- Public GET requires no login; no privileged lookup functions are exposed.
create policy store_inquiries_backend_only on public.store_inquiries for all to anon, authenticated
using (false) with check (false);
revoke all on public.store_inquiries from public, anon, authenticated;
grant all on public.store_inquiries to service_role;
comment on table public.store_inquiries is 'Public store Q&A; never put private support/product inquiries here.';
notify pgrst, 'reload schema';
