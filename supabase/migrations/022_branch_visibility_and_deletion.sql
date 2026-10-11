-- Hiding a branch is separate from temporarily closing it and from billing.
alter table public.restaurants add column if not exists is_published boolean not null default true;

drop policy if exists "Public can view available restaurants" on public.restaurants;
create policy "Public can view available restaurants" on public.restaurants for select
using (
  owner_id = auth.uid()
  or (is_published and public.subscription_is_live(subscription_status, trial_ends_at, subscription_ends_at))
);

drop policy if exists "Public can view categories for available restaurants" on public.menu_categories;
create policy "Public can view categories for available restaurants" on public.menu_categories for select
using (exists (
  select 1 from public.restaurants r where r.id = restaurant_id
    and (r.owner_id = auth.uid() or (r.is_published and public.subscription_is_live(r.subscription_status, r.trial_ends_at, r.subscription_ends_at)))
));

drop policy if exists "Public can view menu items" on public.menu_items;
create policy "Public can view menu items" on public.menu_items for select
using (exists (
  select 1 from public.restaurants r where r.id = restaurant_id
    and (r.owner_id = auth.uid() or (r.is_published and public.subscription_is_live(r.subscription_status, r.trial_ends_at, r.subscription_ends_at)))
));

drop policy if exists "Public can view available brands" on public.brands;
create policy "Public can view available brands" on public.brands for select
using (owner_id = auth.uid() or exists (
  select 1 from public.restaurants r where r.brand_id = brands.id
    and r.is_published and public.subscription_is_live(r.subscription_status, r.trial_ends_at, r.subscription_ends_at)
));

-- Do not expose a deliberately hidden branch through the contact-card escape hatch.
create or replace function public.menu_contact_card(slug_input text)
returns table (name_en text, name_ar text, logo_url text, primary_color text, phone text, whatsapp text, instagram text, default_language text)
language plpgsql security definer stable set search_path = '' as $$
begin
  return query select r.name_en, r.name_ar, r.logo_url, r.primary_color, r.phone, r.whatsapp, r.instagram, r.default_language
  from public.restaurants r where r.slug = slug_input and r.is_published;
end;
$$;

create or replace function public.record_menu_view(restaurant_id_input uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.restaurants r where r.id = restaurant_id_input
    and r.is_published and public.subscription_is_live(r.subscription_status, r.trial_ends_at, r.subscription_ends_at)) then return; end if;
  insert into public.menu_view_daily (restaurant_id, viewed_on, views)
  values (restaurant_id_input, (now() at time zone 'utc')::date, 1)
  on conflict (restaurant_id, viewed_on) do update set views = public.menu_view_daily.views + 1;
end;
$$;

-- No broad DELETE grant. This narrow operation validates ownership and the
-- confirmation again on the server. Lock the brand to serialize concurrent
-- deletes so two browser tabs cannot accidentally delete the owner's last place.
create or replace function public.owner_delete_place(restaurant_id_input uuid, slug_confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.restaurants;
begin
  if auth.uid() is null then raise exception 'Sign in to delete a place.'; end if;
  perform 1 from public.brands where owner_id = auth.uid() for update;
  select * into target from public.restaurants where id = restaurant_id_input and owner_id = auth.uid() for update;
  if not found then raise exception 'Place not found or not owned by you.'; end if;
  if slug_confirmation is distinct from target.slug then raise exception 'The menu link does not match.'; end if;
  if (select count(*) from public.restaurants where owner_id = auth.uid()) <= 1 then
    raise exception 'Keep at least one place. Hide it instead.';
  end if;
  -- Foreign keys cascade categories, items and analytics; the brand/QR stays.
  delete from public.restaurants where id = target.id and owner_id = auth.uid();
end;
$$;

revoke all on function public.owner_delete_place(uuid, text) from public, anon;
grant execute on function public.owner_delete_place(uuid, text) to authenticated;
revoke all on function public.menu_contact_card(text) from public;
grant execute on function public.menu_contact_card(text) to anon, authenticated;
revoke all on function public.record_menu_view(uuid) from public;
grant execute on function public.record_menu_view(uuid) to anon, authenticated;
