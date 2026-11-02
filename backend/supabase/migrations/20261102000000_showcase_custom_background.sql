-- Apply after 20261101000000_showcases.sql and before deploying the matching API.
alter table public.showcases add column background_path text;
alter table public.showcases add constraint showcase_background_path_check check (
  background_path is null or (
    background_id = 'glass'
    and background_path like owner_id::text || '/' || id::text || '/background/%'
  )
);

-- Keep the prior RPC for existing API instances; the new API uses this function.
create function public.save_showcase_with_background(
  p_id uuid, p_owner uuid, p_version integer, p_name text, p_description text,
  p_background text, p_background_path text, p_public boolean, p_items jsonb
)
returns public.showcases language plpgsql security invoker as $$
declare result public.showcases; item jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then
    raise exception 'Invalid item count';
  end if;
  if p_background_path is not null and (
    p_background <> 'glass'
    or p_background_path not like p_owner::text || '/' || p_id::text || '/background/%'
  ) then
    raise exception 'Invalid showcase background';
  end if;
  update public.showcases set name = p_name, description = p_description,
    background_id = p_background, background_path = p_background_path, is_public = p_public,
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
revoke all on function public.save_showcase_with_background(uuid,uuid,integer,text,text,text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.save_showcase_with_background(uuid,uuid,integer,text,text,text,text,boolean,jsonb) to service_role;
