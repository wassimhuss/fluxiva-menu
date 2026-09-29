-- Real bilingual folders for the shared gallery. Existing free-text categories
-- are converted into folder rows and every existing image is preserved.

create table public.gallery_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name_en, name_ar)
);

create trigger gallery_categories_updated_at before update on public.gallery_categories
for each row execute function public.set_updated_at();
alter table public.gallery_categories enable row level security;
revoke all on public.gallery_categories from anon, authenticated;
grant all on public.gallery_categories to service_role;

insert into public.gallery_categories (name_en, name_ar, sort_order)
select category_en, category_ar, row_number() over (order by category_en)::integer
from public.gallery_images
group by category_en, category_ar
on conflict (name_en, name_ar) do nothing;

alter table public.gallery_images add column category_id uuid references public.gallery_categories(id);
update public.gallery_images g set category_id = c.id
from public.gallery_categories c
where c.name_en = g.category_en and c.name_ar = g.category_ar;
alter table public.gallery_images alter column category_id set not null;
create index gallery_images_category_idx on public.gallery_images(category_id, active);

drop function public.list_gallery_images();
drop function public.platform_list_gallery_images();
drop function public.platform_create_gallery_image(uuid,text,text,text,text,text[],text[],text,text,text,text);
drop function public.platform_update_gallery_image(uuid,text,text,text,text,text[],text[],text,text,boolean);

create function public.list_gallery_categories()
returns table (id uuid, name_en text, name_ar text, active boolean, sort_order integer, image_count bigint)
language plpgsql security definer stable set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
    select c.id, c.name_en, c.name_ar, c.active, c.sort_order,
           (select count(*) from public.gallery_images g where g.category_id = c.id and g.active)
    from public.gallery_categories c
    where c.active
    order by c.sort_order, c.name_en;
end;
$$;

create function public.list_gallery_images()
returns table (
  id uuid, category_id uuid, name_en text, name_ar text, category_en text, category_ar text,
  tags_en text[], tags_ar text[], image_url text, thumbnail_url text,
  active boolean, created_at timestamptz, updated_at timestamptz
) language plpgsql security definer stable set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
    select g.id, g.category_id, g.name_en, g.name_ar, c.name_en, c.name_ar,
           g.tags_en, g.tags_ar, g.image_url, g.thumbnail_url,
           g.active, g.created_at, g.updated_at
    from public.gallery_images g
    join public.gallery_categories c on c.id = g.category_id
    where g.active and c.active
    order by c.sort_order, g.name_en;
end;
$$;

create function public.platform_list_gallery_categories()
returns table (
  id uuid, name_en text, name_ar text, active boolean, sort_order integer,
  image_count bigint, created_at timestamptz, updated_at timestamptz
) language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  return query
    select c.id, c.name_en, c.name_ar, c.active, c.sort_order,
           (select count(*) from public.gallery_images g where g.category_id = c.id),
           c.created_at, c.updated_at
    from public.gallery_categories c
    order by c.sort_order, c.name_en;
end;
$$;

create function public.platform_create_gallery_category(name_en_input text, name_ar_input text, sort_order_input integer)
returns public.gallery_categories language plpgsql security definer set search_path = '' as $$
declare result public.gallery_categories;
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  insert into public.gallery_categories (name_en, name_ar, sort_order, created_by)
  values (trim(name_en_input), trim(name_ar_input), coalesce(sort_order_input, 0), auth.uid())
  returning * into result;
  return result;
end;
$$;

create function public.platform_update_gallery_category(
  id_input uuid, name_en_input text, name_ar_input text, active_input boolean, sort_order_input integer
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  update public.gallery_categories
  set name_en = trim(name_en_input), name_ar = trim(name_ar_input), active = active_input,
      sort_order = coalesce(sort_order_input, sort_order)
  where id = id_input;
  if not found then raise exception 'Gallery folder not found'; end if;
  update public.gallery_images g
  set category_en = trim(name_en_input), category_ar = trim(name_ar_input)
  where g.category_id = id_input;
end;
$$;

create function public.platform_delete_gallery_category(id_input uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  if exists (select 1 from public.gallery_images where category_id = id_input) then
    raise exception 'Move or delete the images in this folder first.';
  end if;
  delete from public.gallery_categories where id = id_input;
  if not found then raise exception 'Gallery folder not found'; end if;
end;
$$;

create function public.platform_list_gallery_images()
returns table (
  id uuid, category_id uuid, name_en text, name_ar text, category_en text, category_ar text,
  tags_en text[], tags_ar text[], image_url text, thumbnail_url text,
  source text, license_notes text, active boolean, usage_count bigint,
  created_at timestamptz, updated_at timestamptz
) language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  return query
    select g.id, g.category_id, g.name_en, g.name_ar, c.name_en, c.name_ar,
           g.tags_en, g.tags_ar, g.image_url, g.thumbnail_url,
           g.source, g.license_notes, g.active,
           (select count(*) from public.menu_items i where i.gallery_image_id = g.id),
           g.created_at, g.updated_at
    from public.gallery_images g
    join public.gallery_categories c on c.id = g.category_id
    order by c.sort_order, g.created_at desc;
end;
$$;

create function public.platform_create_gallery_image(
  id_input uuid, category_id_input uuid, name_en_input text, name_ar_input text,
  tags_en_input text[], tags_ar_input text[], image_url_input text,
  thumbnail_url_input text, source_input text, license_notes_input text
) returns public.gallery_images language plpgsql security definer set search_path = '' as $$
declare result public.gallery_images; folder public.gallery_categories;
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  select * into folder from public.gallery_categories where id = category_id_input and active;
  if not found then raise exception 'Choose an active gallery folder'; end if;
  insert into public.gallery_images (
    id, category_id, name_en, name_ar, category_en, category_ar, tags_en, tags_ar,
    image_url, thumbnail_url, source, license_notes, created_by
  ) values (
    id_input, folder.id, trim(name_en_input), trim(name_ar_input), folder.name_en, folder.name_ar,
    coalesce(tags_en_input, '{}'), coalesce(tags_ar_input, '{}'), image_url_input, thumbnail_url_input,
    nullif(trim(source_input), ''), nullif(trim(license_notes_input), ''), auth.uid()
  ) returning * into result;
  return result;
end;
$$;

create function public.platform_update_gallery_image(
  id_input uuid, category_id_input uuid, name_en_input text, name_ar_input text,
  tags_en_input text[], tags_ar_input text[], source_input text,
  license_notes_input text, active_input boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare folder public.gallery_categories;
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  select * into folder from public.gallery_categories where id = category_id_input;
  if not found then raise exception 'Gallery folder not found'; end if;
  update public.gallery_images set
    category_id = folder.id, category_en = folder.name_en, category_ar = folder.name_ar,
    name_en = trim(name_en_input), name_ar = trim(name_ar_input),
    tags_en = coalesce(tags_en_input, '{}'), tags_ar = coalesce(tags_ar_input, '{}'),
    source = nullif(trim(source_input), ''), license_notes = nullif(trim(license_notes_input), ''),
    active = active_input
  where id = id_input;
  if not found then raise exception 'Gallery image not found'; end if;
end;
$$;

revoke all on function public.list_gallery_categories() from public;
revoke all on function public.list_gallery_images() from public;
revoke all on function public.platform_list_gallery_categories() from public;
revoke all on function public.platform_create_gallery_category(text,text,integer) from public;
revoke all on function public.platform_update_gallery_category(uuid,text,text,boolean,integer) from public;
revoke all on function public.platform_delete_gallery_category(uuid) from public;
revoke all on function public.platform_list_gallery_images() from public;
revoke all on function public.platform_create_gallery_image(uuid,uuid,text,text,text[],text[],text,text,text,text) from public;
revoke all on function public.platform_update_gallery_image(uuid,uuid,text,text,text[],text[],text,text,boolean) from public;
grant execute on function public.list_gallery_categories() to authenticated;
grant execute on function public.list_gallery_images() to authenticated;
grant execute on function public.platform_list_gallery_categories() to authenticated;
grant execute on function public.platform_create_gallery_category(text,text,integer) to authenticated;
grant execute on function public.platform_update_gallery_category(uuid,text,text,boolean,integer) to authenticated;
grant execute on function public.platform_delete_gallery_category(uuid) to authenticated;
grant execute on function public.platform_list_gallery_images() to authenticated;
grant execute on function public.platform_create_gallery_image(uuid,uuid,text,text,text[],text[],text,text,text,text) to authenticated;
grant execute on function public.platform_update_gallery_image(uuid,uuid,text,text,text[],text[],text,text,boolean) to authenticated;
