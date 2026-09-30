-- Super-admin recovery workflow for replacing a retired shared-gallery set.
-- Folders intentionally remain, so the new curated photos can be uploaded
-- into the existing bilingual structure.

create or replace function public.platform_clear_gallery_images()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  deleted_count integer;
begin
  if not public.is_platform_super_admin() then
    raise exception 'Super admin access required';
  end if;

  -- A gallery UUID means the item image is shared. Clear both fields so no
  -- menu item keeps a URL to a gallery image that is about to be removed.
  update public.menu_items
  set gallery_image_id = null, image_url = null
  where gallery_image_id is not null;

  delete from public.gallery_images;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.platform_clear_gallery_images() from public;
grant execute on function public.platform_clear_gallery_images() to authenticated;
