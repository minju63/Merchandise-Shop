-- Apply after reviewing against the target project. Existing catalog tables are unchanged.
create table public.showcase_backgrounds (
  id text primary key,
  name text not null,
  image_path text not null,
  enabled boolean not null default true
);
insert into public.showcase_backgrounds (id, name, image_path) values
  ('pastel', '파스텔 선반', '/showcase/pastel.svg'),
  ('glass', '유리 장식장', '/showcase/glass.svg'),
  ('white', '화이트 선반', '/showcase/white.svg'),
  ('board', '꾸미기 보드', '/showcase/board.svg');

create table public.showcases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('PERSONAL', 'SHOP')),
  store_id uuid references public.stores(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  background_id text not null default 'pastel' references public.showcase_backgrounds(id),
  is_public boolean not null default false,
  thumbnail_path text,
  published_at timestamptz,
  version integer not null default 1,
  like_count integer not null default 0 check (like_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint showcase_type_store_check check (
    (type = 'PERSONAL' and store_id is null) or
    (type = 'SHOP' and store_id is not null)
  )
);
create index showcases_public_feed_idx on public.showcases(type, is_public, created_at desc);
create index showcases_popular_idx on public.showcases(type, is_public, like_count desc, created_at desc);
create index showcases_store_idx on public.showcases(store_id, created_at desc);
create index showcases_owner_idx on public.showcases(owner_id, created_at desc);

create table public.showcase_items (
  id uuid primary key default gen_random_uuid(),
  showcase_id uuid not null references public.showcases(id) on delete cascade,
  store_product_id uuid references public.store_products(id) on delete cascade,
  goods_name text check (goods_name is null or char_length(goods_name) <= 100),
  work_title text check (work_title is null or char_length(work_title) <= 100),
  character_name text check (character_name is null or char_length(character_name) <= 100),
  note text check (note is null or char_length(note) <= 300),
  original_path text,
  cutout_path text,
  x numeric(6,5) not null check (x between 0 and 1),
  y numeric(6,5) not null check (y between 0 and 1),
  scale numeric(5,3) not null default 1 check (scale between 0.25 and 3),
  rotation numeric(6,2) not null default 0 check (rotation between -180 and 180),
  layer_order integer not null default 0 check (layer_order between 0 and 100),
  constraint showcase_item_source_check check (
    (store_product_id is null and original_path is not null) or
    (store_product_id is not null and original_path is null)
  )
);
create index showcase_items_showcase_idx on public.showcase_items(showcase_id, layer_order);

create table public.showcase_likes (
  showcase_id uuid not null references public.showcases(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (showcase_id, user_id)
);
create index showcase_likes_user_idx on public.showcase_likes(user_id);

create function public.showcase_like_guard() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.showcases s join public.users u on u.id = new.user_id
    join public.users owner on owner.id = s.owner_id
    where s.id = new.showcase_id and s.is_public and s.owner_id <> new.user_id
      and u.status = 'ACTIVE' and owner.status = 'ACTIVE'
      and (s.type = 'PERSONAL' or exists (select 1 from public.stores st where st.id = s.store_id and st.status = 'ACTIVE'))) then
    raise exception 'Showcase cannot be liked';
  end if;
  return new;
end $$;
create trigger showcase_like_validate before insert on public.showcase_likes
  for each row execute function public.showcase_like_guard();
create function public.showcase_like_count() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.showcases set like_count = like_count + 1 where id = new.showcase_id;
  else
    update public.showcases set like_count = greatest(0, like_count - 1) where id = old.showcase_id;
  end if;
  return null;
end $$;
create trigger showcase_like_count_insert after insert on public.showcase_likes
  for each row execute function public.showcase_like_count();
create trigger showcase_like_count_delete after delete on public.showcase_likes
  for each row execute function public.showcase_like_count();

create function public.showcase_validate() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'showcases' then
    if not exists (select 1 from public.users u where u.id = new.owner_id and u.status = 'ACTIVE') then
      raise exception 'Inactive showcase owner';
    end if;
    if new.type = 'SHOP' and not exists (
      select 1 from public.stores s join public.users u on u.id = s.owner_id
      where s.id = new.store_id and s.owner_id = new.owner_id
        and u.role in ('SELLER', 'ADMIN') and u.status = 'ACTIVE'
    ) then raise exception 'Invalid shop owner'; end if;
  else
    if not exists (
      select 1 from public.showcases s
      where s.id = new.showcase_id and (
        (s.type = 'PERSONAL' and new.store_product_id is null and new.original_path like s.owner_id::text || '/%')
        or (s.type = 'SHOP' and new.store_product_id is not null and exists (
          select 1 from public.store_products p where p.id = new.store_product_id and p.store_id = s.store_id
        ))
      )
    ) then raise exception 'Invalid showcase item'; end if;
  end if;
  return new;
end $$;
create trigger showcase_validate_row before insert or update on public.showcases
  for each row execute function public.showcase_validate();
create trigger showcase_item_validate_row before insert or update on public.showcase_items
  for each row execute function public.showcase_validate();

-- The Express server validates ownership and calls this as service_role. One transaction
-- replaces items and advances the version, so a failed save keeps the prior arrangement.
create function public.save_showcase(p_id uuid, p_owner uuid, p_version integer,
  p_name text, p_description text, p_background text, p_public boolean, p_items jsonb)
returns public.showcases language plpgsql security invoker as $$
declare result public.showcases; item jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then
    raise exception 'Invalid item count';
  end if;
  update public.showcases set name = p_name, description = p_description,
    background_id = p_background, is_public = p_public,
    published_at = case when p_public then coalesce(published_at, now()) else null end,
    version = version + 1, updated_at = now()
  where id = p_id and owner_id = p_owner and version = p_version
  returning * into result;
  if result.id is null then raise exception 'Showcase was changed elsewhere'; end if;
  delete from public.showcase_items where showcase_id = p_id;
  for item in select value from jsonb_array_elements(p_items) loop
    insert into public.showcase_items (showcase_id, store_product_id, goods_name,
      work_title, character_name, note, original_path, cutout_path, x, y, scale, rotation, layer_order)
    values (p_id, (item->>'store_product_id')::uuid, item->>'goods_name',
      item->>'work_title', item->>'character_name', item->>'note',
      item->>'original_path', item->>'cutout_path', (item->>'x')::numeric,
      (item->>'y')::numeric, (item->>'scale')::numeric,
      (item->>'rotation')::numeric, (item->>'layer_order')::integer);
  end loop;
  return result;
end $$;
revoke all on function public.save_showcase(uuid,uuid,integer,text,text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.save_showcase(uuid,uuid,integer,text,text,text,boolean,jsonb) to service_role;

create function public.showcases_by_category(p_category uuid, p_store uuid, p_sort text)
returns setof public.showcases language sql stable security invoker as $$
  select s.* from public.showcases s
  join public.users u on u.id = s.owner_id and u.status = 'ACTIVE'
  join public.stores st on st.id = s.store_id and st.status = 'ACTIVE'
  where s.type = 'SHOP' and s.is_public and (p_store is null or s.store_id = p_store)
    and exists (
      select 1 from public.showcase_items i
      join public.store_products sp on sp.id = i.store_product_id
      join public.product_categories pc on pc.product_id = sp.product_id
      where i.showcase_id = s.id and pc.category_id = p_category
    )
  order by case when p_sort = 'popular' then s.like_count end desc nulls last,
    s.created_at desc
$$;
revoke all on function public.showcases_by_category(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.showcases_by_category(uuid,uuid,text) to service_role;

alter table public.showcase_backgrounds enable row level security;
alter table public.showcases enable row level security;
alter table public.showcase_items enable row level security;
alter table public.showcase_likes enable row level security;
create policy showcase_background_read on public.showcase_backgrounds for select to anon, authenticated using (enabled);
create policy showcase_read on public.showcases for select to anon, authenticated
  using (
    exists (select 1 from public.users u where u.id = owner_id and u.status = 'ACTIVE')
    and (is_public or owner_id = (select auth.uid()))
    and (type = 'PERSONAL' or exists (select 1 from public.stores s where s.id = store_id and s.status = 'ACTIVE'))
  );
create policy showcase_item_read on public.showcase_items for select to anon, authenticated
  using (exists (select 1 from public.showcases s where s.id = showcase_id
    and (s.is_public or s.owner_id = (select auth.uid()))
    and exists (select 1 from public.users u where u.id = s.owner_id and u.status = 'ACTIVE')));
create policy showcase_like_read on public.showcase_likes for select to authenticated
  using (user_id = (select auth.uid()));
-- Writes use the server's service role after checking the active account and shop owner.
revoke all on public.showcase_backgrounds, public.showcases, public.showcase_items, public.showcase_likes from public, anon, authenticated;
grant all on public.showcase_backgrounds, public.showcases, public.showcase_items, public.showcase_likes to service_role;
grant select on public.showcase_backgrounds, public.showcases, public.showcase_items to anon, authenticated;
grant select on public.showcase_likes to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('showcase-private', 'showcase-private', false, 6291456,
  array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
-- This bucket has no client write policies. Express issues short-lived signed URLs only
-- after checking showcase visibility, and uploads via service_role only.
