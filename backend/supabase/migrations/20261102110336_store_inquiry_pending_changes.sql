-- Preserve request IDs after removal so delayed create retries cannot recreate a deleted question.
alter table public.store_inquiries add column deleted_at timestamptz;

create or replace function public.validate_store_inquiry() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare store_owner uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'Use pending inquiry soft deletion' using errcode = '23514';
  end if;
  select owner_id into store_owner from public.stores where id = new.store_id and status = 'ACTIVE' for share;
  if store_owner is null then raise exception 'Store is unavailable' using errcode = '23514'; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.users where id = new.user_id and status = 'ACTIVE')
      or new.status <> 'PENDING' or new.deleted_at is not null then
      raise exception 'Active member and pending inquiry required' using errcode = '23514';
    end if;
  else
    if (new.id, new.store_id, new.user_id, new.request_id, new.created_at)
      is distinct from (old.id, old.store_id, old.user_id, old.request_id, old.created_at)
      or old.deleted_at is not null then
      raise exception 'Inquiry identity and deleted rows are immutable' using errcode = '23514';
    end if;
    if old.status = 'PENDING' and new.status = 'PENDING' then
      if not exists (select 1 from public.users where id = new.user_id and status = 'ACTIVE')
        or (new.deleted_at is not null and (new.title, new.content) is distinct from (old.title, old.content)) then
        raise exception 'Only an active author pending change is allowed' using errcode = '23514';
      end if;
      -- Backend atomically filters by verified user_id, PENDING and deleted_at IS NULL.
      return new;
    end if;
    if (new.title, new.content, new.deleted_at) is distinct from (old.title, old.content, old.deleted_at)
      or new.status <> 'ANSWERED' or new.answered_by is distinct from store_owner
      or not exists (select 1 from public.users where id = new.answered_by and status = 'ACTIVE' and role in ('SELLER', 'ADMIN')) then
      raise exception 'Answered questions cannot be edited or removed' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_store_inquiry() from public, anon, authenticated;
drop trigger validate_store_inquiry on public.store_inquiries;
create trigger validate_store_inquiry before insert or update or delete on public.store_inquiries
for each row execute function public.validate_store_inquiry();
