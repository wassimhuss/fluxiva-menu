-- Load platform gallery images one folder at a time. The existing no-argument
-- function remains available for deliberate bulk operations such as clearing
-- the gallery, while the platform UI uses this filtered overload for browsing.
create or replace function public.platform_list_gallery_images(category_id_input uuid)
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
    where g.category_id = category_id_input
    order by g.created_at desc;
end;
$$;

revoke all on function public.platform_list_gallery_images(uuid) from public;
grant execute on function public.platform_list_gallery_images(uuid) to authenticated;
