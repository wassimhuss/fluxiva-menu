-- Extra restaurant details used by the public menu contact and opening-hours controls.
alter table public.restaurants
  add column if not exists whatsapp text,
  add column if not exists maps_url text,
  add column if not exists opening_hours text,
  add column if not exists temporarily_closed boolean not null default false;

-- Keep sold-out items visible so customers see a clear unavailable state.
drop policy if exists "Public can view available items" on public.menu_items;
create policy "Public can view menu items" on public.menu_items for select
using (exists (select 1 from public.restaurants r where r.id = restaurant_id and ((r.subscription_status = 'active') or (r.subscription_status = 'trial' and r.trial_ends_at > now()))));
