-- Shared Fluxiva food-image gallery. Owners may select active images; only a
-- super admin may upload or change the curated collection.

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  category_en text not null check (length(trim(category_en)) > 0),
  category_ar text not null check (length(trim(category_ar)) > 0),
  tags_en text[] not null default '{}',
  tags_ar text[] not null default '{}',
  image_url text not null,
  thumbnail_url text not null,
  source text,
  license_notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger gallery_images_updated_at before update on public.gallery_images
for each row execute function public.set_updated_at();

alter table public.gallery_images enable row level security;
revoke all on public.gallery_images from anon, authenticated;
grant all on public.gallery_images to service_role;

alter table public.menu_items
  add column gallery_image_id uuid references public.gallery_images(id) on delete set null;
create index menu_items_gallery_image_idx on public.menu_items(gallery_image_id)
  where gallery_image_id is not null;

-- The UUID is the source of truth: owners cannot pair a gallery record with a
-- different URL, nor attach a newly archived record by bypassing the UI.
create function public.apply_gallery_image()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  selected_url text;
  selection_changed boolean := false;
begin
  if new.gallery_image_id is not null then
    if tg_op = 'INSERT' then
      selection_changed := true;
    elsif new.gallery_image_id is distinct from old.gallery_image_id then
      selection_changed := true;
    end if;
  end if;

  if selection_changed then
    select image_url into selected_url from public.gallery_images
      where id = new.gallery_image_id and active;
    if selected_url is null then raise exception 'Gallery image is unavailable'; end if;
    new.image_url := selected_url;
  elsif tg_op = 'UPDATE' and old.gallery_image_id is not null and new.gallery_image_id is null
        and new.image_url is not distinct from old.image_url then
    new.image_url := null;
  end if;
  return new;
end;
$$;

create trigger menu_items_apply_gallery_image before insert or update on public.menu_items
for each row execute function public.apply_gallery_image();
revoke all on function public.apply_gallery_image() from public, anon, authenticated;

create or replace function public.is_platform_super_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from private.platform_admins
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

create function public.list_gallery_images()
returns table (
  id uuid, name_en text, name_ar text, category_en text, category_ar text,
  tags_en text[], tags_ar text[], image_url text, thumbnail_url text,
  active boolean, created_at timestamptz, updated_at timestamptz
) language plpgsql security definer stable set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
    select g.id, g.name_en, g.name_ar, g.category_en, g.category_ar,
           g.tags_en, g.tags_ar, g.image_url, g.thumbnail_url,
           g.active, g.created_at, g.updated_at
      from public.gallery_images g
     where g.active
     order by g.category_en, g.name_en;
end;
$$;

create function public.platform_list_gallery_images()
returns table (
  id uuid, name_en text, name_ar text, category_en text, category_ar text,
  tags_en text[], tags_ar text[], image_url text, thumbnail_url text,
  source text, license_notes text, active boolean, usage_count bigint,
  created_at timestamptz, updated_at timestamptz
) language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  return query
    select g.id, g.name_en, g.name_ar, g.category_en, g.category_ar,
           g.tags_en, g.tags_ar, g.image_url, g.thumbnail_url,
           g.source, g.license_notes, g.active,
           (select count(*) from public.menu_items i where i.gallery_image_id = g.id),
           g.created_at, g.updated_at
      from public.gallery_images g
     order by g.created_at desc;
end;
$$;

create function public.platform_create_gallery_image(
  id_input uuid, name_en_input text, name_ar_input text,
  category_en_input text, category_ar_input text,
  tags_en_input text[], tags_ar_input text[], image_url_input text,
  thumbnail_url_input text, source_input text, license_notes_input text
) returns public.gallery_images language plpgsql security definer set search_path = '' as $$
declare result public.gallery_images;
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  insert into public.gallery_images (
    id, name_en, name_ar, category_en, category_ar, tags_en, tags_ar,
    image_url, thumbnail_url, source, license_notes, created_by
  ) values (
    id_input, trim(name_en_input), trim(name_ar_input), trim(category_en_input),
    trim(category_ar_input), coalesce(tags_en_input, '{}'), coalesce(tags_ar_input, '{}'),
    image_url_input, thumbnail_url_input, nullif(trim(source_input), ''),
    nullif(trim(license_notes_input), ''), auth.uid()
  ) returning * into result;
  return result;
end;
$$;

create function public.platform_update_gallery_image(
  id_input uuid, name_en_input text, name_ar_input text,
  category_en_input text, category_ar_input text,
  tags_en_input text[], tags_ar_input text[], source_input text,
  license_notes_input text, active_input boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  update public.gallery_images set
    name_en = trim(name_en_input), name_ar = trim(name_ar_input),
    category_en = trim(category_en_input), category_ar = trim(category_ar_input),
    tags_en = coalesce(tags_en_input, '{}'), tags_ar = coalesce(tags_ar_input, '{}'),
    source = nullif(trim(source_input), ''), license_notes = nullif(trim(license_notes_input), ''),
    active = active_input
  where id = id_input;
  if not found then raise exception 'Gallery image not found'; end if;
end;
$$;

create function public.platform_delete_gallery_image(id_input uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
  if exists (select 1 from public.menu_items where gallery_image_id = id_input) then
    raise exception 'This image is still used by menu items. Archive it instead.';
  end if;
  delete from public.gallery_images where id = id_input;
  if not found then raise exception 'Gallery image not found'; end if;
end;
$$;

revoke all on function public.is_platform_super_admin() from public;
revoke all on function public.list_gallery_images() from public;
revoke all on function public.platform_list_gallery_images() from public;
revoke all on function public.platform_create_gallery_image(uuid,text,text,text,text,text[],text[],text,text,text,text) from public;
revoke all on function public.platform_update_gallery_image(uuid,text,text,text,text,text[],text[],text,text,boolean) from public;
revoke all on function public.platform_delete_gallery_image(uuid) from public;
grant execute on function public.is_platform_super_admin() to authenticated;
grant execute on function public.list_gallery_images() to authenticated;
grant execute on function public.platform_list_gallery_images() to authenticated;
grant execute on function public.platform_create_gallery_image(uuid,text,text,text,text,text[],text[],text,text,text,text) to authenticated;
grant execute on function public.platform_update_gallery_image(uuid,text,text,text,text,text[],text[],text,text,boolean) to authenticated;
grant execute on function public.platform_delete_gallery_image(uuid) to authenticated;

insert into storage.buckets (id, name, public) values ('gallery-assets', 'gallery-assets', true)
on conflict (id) do nothing;
create policy "Public reads gallery assets" on storage.objects for select
using (bucket_id = 'gallery-assets');
create policy "Super admins upload gallery assets" on storage.objects for insert to authenticated
with check (bucket_id = 'gallery-assets' and public.is_platform_super_admin());
create policy "Super admins update gallery assets" on storage.objects for update to authenticated
using (bucket_id = 'gallery-assets' and public.is_platform_super_admin())
with check (bucket_id = 'gallery-assets' and public.is_platform_super_admin());
create policy "Super admins delete gallery assets" on storage.objects for delete to authenticated
using (bucket_id = 'gallery-assets' and public.is_platform_super_admin());
