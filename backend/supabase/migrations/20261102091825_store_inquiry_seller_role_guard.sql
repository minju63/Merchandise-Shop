-- Match the existing seller center: an active SELLER/ADMIN must also own the store.
create or replace function public.validate_store_inquiry() returns trigger
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
      or not exists (select 1 from public.users where id = new.answered_by and status = 'ACTIVE' and role in ('SELLER', 'ADMIN')) then
      raise exception 'Only an active store-owner seller may answer' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_store_inquiry() from public, anon, authenticated;
