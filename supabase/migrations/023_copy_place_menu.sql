-- Copy an owned menu into independent records. A pending copy stays hidden
-- while the client duplicates personal files using the existing Storage RLS.
alter table public.restaurants
  add column if not exists menu_copy_pending boolean not null default false;

alter table public.restaurants drop constraint if exists restaurants_pending_copy_hidden;
alter table public.restaurants add constraint restaurants_pending_copy_hidden
  check (not (menu_copy_pending and is_published));

create or replace function public.owner_create_place_with_menu(source_restaurant_id_input uuid, place_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  source public.restaurants;
  target public.restaurants;
  source_category public.menu_categories;
  new_category_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to copy a menu.'; end if;
  -- Serialize with branch deletion and verify the source, even if publicly readable.
  perform 1 from public.brands where owner_id = auth.uid() for update;
  select * into source from public.restaurants
    where id = source_restaurant_id_input and owner_id = auth.uid()
      and brand_id in (select b.id from public.brands b where b.owner_id = auth.uid()) for share;
  if not found then raise exception 'Place not found or not owned by you.'; end if;
  if source.menu_copy_pending then raise exception 'Finish this menu copy first.'; end if;
  if jsonb_typeof(place_input) is distinct from 'object'
    or nullif(btrim(place_input->>'name_en'), '') is null
    or nullif(btrim(place_input->>'name_ar'), '') is null
    or nullif(btrim(place_input->>'slug'), '') is null
    or nullif(btrim(place_input->>'address_en'), '') is null
    or nullif(btrim(place_input->>'address_ar'), '') is null then
    raise exception 'Enter both names, both addresses and a menu link.';
  end if;

  -- Never copy billing, analytics, old branch identity/location or closed state.
  insert into public.restaurants (
    owner_id, brand_id, slug, name_en, name_ar, address_en, address_ar, whatsapp,
    description_en, description_ar, logo_url, cover_image_url, primary_color,
    instagram, currency, default_language, template_id, show_item_images,
    takeaway_enabled, temporarily_closed, is_published, menu_copy_pending,
    subscription_status, trial_ends_at
  ) values (
    auth.uid(), source.brand_id, btrim(place_input->>'slug'),
    btrim(place_input->>'name_en'), btrim(place_input->>'name_ar'),
    btrim(place_input->>'address_en'), btrim(place_input->>'address_ar'),
    nullif(btrim(place_input->>'whatsapp'), ''), source.description_en, source.description_ar,
    source.logo_url, source.cover_image_url, source.primary_color,
    source.instagram, source.currency, source.default_language, source.template_id,
    source.show_item_images, source.takeaway_enabled, false, false, true,
    'trial', now() + interval '14 days'
  ) returning * into target;

  for source_category in select * from public.menu_categories
    where restaurant_id = source.id order by sort_order, id
  loop
    new_category_id := gen_random_uuid();
    insert into public.menu_categories (id, restaurant_id, name_en, name_ar, sort_order)
    values (new_category_id, target.id, source_category.name_en, source_category.name_ar, source_category.sort_order);

    insert into public.menu_items (
      restaurant_id, category_id, name_en, name_ar, description_en, description_ar,
      price, image_url, gallery_image_id, variants, extras, available, sort_order
    ) select target.id, new_category_id, i.name_en, i.name_ar, i.description_en, i.description_ar,
      i.price, i.image_url, case when g.active then i.gallery_image_id else null end,
      i.variants, i.extras, i.available, i.sort_order
      from public.menu_items i left join public.gallery_images g on g.id = i.gallery_image_id
      where i.restaurant_id = source.id and i.category_id = source_category.id;
    -- Archived gallery photos become independent personal copies, rather than
    -- bypassing the gallery trigger's prohibition on new inactive selections.
  end loop;

  return jsonb_build_object(
    'restaurant', to_jsonb(target),
    'categories', (select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order, c.id), '[]'::jsonb)
      from public.menu_categories c where c.restaurant_id = target.id),
    'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order, i.id), '[]'::jsonb)
      from public.menu_items i where i.restaurant_id = target.id)
  );
end;
$$;

create or replace function public.owner_finish_place_menu_copy(restaurant_id_input uuid, asset_urls_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.restaurants;
  old_url text;
  new_url text;
  destination_path text;
  marker constant text := '/storage/v1/object/public/menu-assets/';
begin
  if auth.uid() is null then raise exception 'Sign in to copy a menu.'; end if;
  select * into target from public.restaurants
    where id = restaurant_id_input and owner_id = auth.uid() for update;
  if not found then raise exception 'Place not found or not owned by you.'; end if;
  if not target.menu_copy_pending or target.is_published then raise exception 'This menu copy is not pending.'; end if;
  if jsonb_typeof(asset_urls_input) is distinct from 'object' then raise exception 'Invalid copied photos.'; end if;

  -- Every personal (or archived gallery) URL must resolve to an existing file
  -- under THIS restaurant UUID. Active gallery references remain shared.
  for old_url in
    select target.logo_url union select target.cover_image_url union
    select i.image_url from public.menu_items i
      where i.restaurant_id = target.id and i.gallery_image_id is null
  loop
    if old_url is null or (
      position('/storage/v1/object/public/menu-assets/' in old_url) = 0
      and position('/storage/v1/object/public/gallery-assets/' in old_url) = 0
    ) then continue; end if;
    new_url := asset_urls_input->>old_url;
    if new_url is null or position(marker || target.id::text || '/' in new_url) = 0 then
      raise exception 'A copied photo is missing.';
    end if;
    destination_path := split_part(new_url, marker, 2);
    if destination_path like '%..%' or not exists (
      select 1 from storage.objects o where o.bucket_id = 'menu-assets' and o.name = destination_path
    ) then raise exception 'A copied photo is missing.'; end if;
  end loop;

  update public.menu_items set image_url = asset_urls_input->>image_url
    where restaurant_id = target.id and gallery_image_id is null and asset_urls_input ? image_url;
  update public.restaurants set
    logo_url = coalesce(asset_urls_input->>logo_url, logo_url),
    cover_image_url = coalesce(asset_urls_input->>cover_image_url, cover_image_url),
    menu_copy_pending = false
    where id = target.id returning * into target;
  -- Deliberately remain hidden until the owner reviews prices and chooses Show.
  return jsonb_build_object(
    'restaurant', to_jsonb(target),
    'categories', (select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order, c.id), '[]'::jsonb)
      from public.menu_categories c where c.restaurant_id = target.id),
    'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order, i.id), '[]'::jsonb)
      from public.menu_items i where i.restaurant_id = target.id)
  );
end;
$$;

revoke all on function public.owner_create_place_with_menu(uuid, jsonb) from public, anon;
revoke all on function public.owner_finish_place_menu_copy(uuid, jsonb) from public, anon;
grant execute on function public.owner_create_place_with_menu(uuid, jsonb) to authenticated;
grant execute on function public.owner_finish_place_menu_copy(uuid, jsonb) to authenticated;
