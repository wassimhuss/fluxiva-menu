-- Optional alternate menu price. Existing primary values and all access rules
-- remain unchanged. Missing alternates convert at the product rate in the UI.
alter table public.menu_items add column if not exists price_secondary numeric;
comment on column public.menu_items.price_secondary is 'Manual alternate currency price: USD for LBP menus, LBP for USD menus; null means automatic at 89500 LBP/USD.';

create or replace function public.menu_secondary_prices_valid(entries jsonb)
returns boolean language sql immutable parallel safe set search_path='' as $$
  select coalesce(bool_and(case
    when entry->'price_secondary' is null or jsonb_typeof(entry->'price_secondary')='null' then true
    when jsonb_typeof(entry->'price_secondary')<>'number' then false
    else (entry->>'price_secondary')::numeric between 0 and 999999999999.99
      and round((entry->>'price_secondary')::numeric,2)=(entry->>'price_secondary')::numeric
    end),true) from jsonb_array_elements(entries) entry;
$$;

do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.menu_items'::regclass and conname='menu_items_secondary_prices_valid') then
    alter table public.menu_items add constraint menu_items_secondary_prices_valid check (
      (price_secondary is null or (price_secondary between 0 and 999999999999.99 and round(price_secondary,2)=price_secondary))
      and public.menu_secondary_prices_valid(variants) and public.menu_secondary_prices_valid(extras));
  end if;
end $$;

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
      price, price_secondary, image_url, gallery_image_id, variants, extras, available, highlighted, sort_order
    ) select target.id, new_category_id, i.name_en, i.name_ar, i.description_en, i.description_ar,
      i.price, i.price_secondary, i.image_url, case when g.active then i.gallery_image_id else null end,
      i.variants, i.extras, i.available, i.highlighted, i.sort_order
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

revoke all on function public.owner_create_place_with_menu(uuid, jsonb) from public, anon;
grant execute on function public.owner_create_place_with_menu(uuid, jsonb) to authenticated;

-- Switching the primary currency must not reinterpret a stored manual USD
-- override as LBP (or vice versa). Swap each price pair transactionally.
create or replace function public.menu_price_other(amount numeric, alternate numeric, from_currency text)
returns numeric language sql immutable parallel safe set search_path='' as $$
  select coalesce(alternate,case when from_currency='USD' then round(amount*89500) else round(amount/89500,2) end);
$$;

create or replace function public.menu_swap_price(entry jsonb, from_currency text)
returns jsonb language sql immutable parallel safe set search_path='' as $$
  select entry || jsonb_build_object('price',public.menu_price_other((entry->>'price')::numeric,(entry->>'price_secondary')::numeric,from_currency),'price_secondary',(entry->>'price')::numeric);
$$;

create or replace function public.reprice_menu_currency()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.currency is distinct from new.currency then
    update public.menu_items i set price=public.menu_price_other(i.price,i.price_secondary,old.currency),price_secondary=i.price,
      variants=(select coalesce(jsonb_agg(public.menu_swap_price(v,old.currency) order by position),'[]'::jsonb) from jsonb_array_elements(i.variants) with ordinality as entries(v,position)),
      extras=(select coalesce(jsonb_agg(public.menu_swap_price(v,old.currency) order by position),'[]'::jsonb) from jsonb_array_elements(i.extras) with ordinality as entries(v,position))
      where i.restaurant_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.reprice_menu_currency() from public,anon,authenticated;
drop trigger if exists restaurants_reprice_currency on public.restaurants;
create trigger restaurants_reprice_currency before update of currency on public.restaurants
  for each row execute function public.reprice_menu_currency();

notify pgrst,'reload schema';

