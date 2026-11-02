-- Apply after 20261102000000_showcase_custom_background.sql.
-- Adds photo positioning without changing the already deployed background RPC.
alter table public.showcases add column background_x numeric(5,4) not null default 0.5 check (background_x between 0 and 1);
alter table public.showcases add column background_y numeric(5,4) not null default 0.5 check (background_y between 0 and 1);

create function public.save_showcase_with_background(
  p_id uuid, p_owner uuid, p_version integer, p_name text, p_description text,
  p_background text, p_background_path text, p_background_x numeric, p_background_y numeric,
  p_public boolean, p_items jsonb
)
returns public.showcases language plpgsql security invoker as $$
declare result public.showcases;
begin
  if p_background_x is null or p_background_y is null
    or p_background_x not between 0 and 1 or p_background_y not between 0 and 1 then
    raise exception 'Invalid showcase background position';
  end if;
  result := public.save_showcase_with_background(
    p_id, p_owner, p_version, p_name, p_description,
    p_background, p_background_path, p_public, p_items
  );
  update public.showcases
    set background_x = p_background_x, background_y = p_background_y
    where id = p_id and owner_id = p_owner
    returning * into result;
  return result;
end $$;
revoke all on function public.save_showcase_with_background(uuid,uuid,integer,text,text,text,text,numeric,numeric,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.save_showcase_with_background(uuid,uuid,integer,text,text,text,text,numeric,numeric,boolean,jsonb) to service_role;
