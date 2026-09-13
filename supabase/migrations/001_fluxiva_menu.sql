-- Fluxiva Menu: multi-restaurant schema, row security, storage and platform controls.
create extension if not exists pgcrypto;

create type public.subscription_status as enum ('trial', 'active', 'suspended');

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  logo_url text,
  primary_color text not null default '#173f35' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  phone text,
  instagram text,
  address_en text,
  address_ar text,
  default_language text not null default 'en' check (default_language in ('en', 'ar')),
  subscription_status public.subscription_status not null default 'trial',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  subscription_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  price_lbp bigint not null default 0 check (price_lbp >= 0),
  image_url text,
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_categories_restaurant_order_idx on public.menu_categories(restaurant_id, sort_order);
create index menu_items_restaurant_category_order_idx on public.menu_items(restaurant_id, category_id, sort_order);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger restaurants_updated_at before update on public.restaurants for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.menu_categories for each row execute function public.set_updated_at();
create trigger items_updated_at before update on public.menu_items for each row execute function public.set_updated_at();

alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

create policy "Public can view available restaurants" on public.restaurants for select
using ((subscription_status = 'active') or (subscription_status = 'trial' and trial_ends_at > now()) or owner_id = auth.uid());
create policy "Owners create their restaurant" on public.restaurants for insert
with check (owner_id = auth.uid());
create policy "Owners update their restaurant" on public.restaurants for update
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete their restaurant" on public.restaurants for delete
using (owner_id = auth.uid());

create policy "Public can view categories for available restaurants" on public.menu_categories for select
using (exists (select 1 from public.restaurants r where r.id = restaurant_id and ((r.subscription_status = 'active') or (r.subscription_status = 'trial' and r.trial_ends_at > now()) or r.owner_id = auth.uid())));
create policy "Owners create categories" on public.menu_categories for insert
with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Owners update categories" on public.menu_categories for update
using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Owners delete categories" on public.menu_categories for delete
using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));

create policy "Public can view available items" on public.menu_items for select
using ((available = true and exists (select 1 from public.restaurants r where r.id = restaurant_id and ((r.subscription_status = 'active') or (r.subscription_status = 'trial' and r.trial_ends_at > now())))) or exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Owners create items" on public.menu_items for insert
with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Owners update items" on public.menu_items for update
using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));
create policy "Owners delete items" on public.menu_items for delete
using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));

insert into storage.buckets (id, name, public) values ('menu-assets', 'menu-assets', true)
on conflict (id) do nothing;

create policy "Public reads menu assets" on storage.objects for select using (bucket_id = 'menu-assets');
create policy "Owners upload menu assets" on storage.objects for insert to authenticated
with check (bucket_id = 'menu-assets' and exists (select 1 from public.restaurants r where r.id::text = (storage.foldername(name))[1] and r.owner_id = auth.uid()));
create policy "Owners update menu assets" on storage.objects for update to authenticated
using (bucket_id = 'menu-assets' and exists (select 1 from public.restaurants r where r.id::text = (storage.foldername(name))[1] and r.owner_id = auth.uid()));
create policy "Owners delete menu assets" on storage.objects for delete to authenticated
using (bucket_id = 'menu-assets' and exists (select 1 from public.restaurants r where r.id::text = (storage.foldername(name))[1] and r.owner_id = auth.uid()));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from private.platform_admins where user_id = auth.uid());
$$;

create or replace function public.platform_list_restaurants()
returns setof public.restaurants language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform access required'; end if;
  return query select * from public.restaurants order by created_at desc;
end;
$$;

create or replace function public.platform_set_subscription(restaurant_id_input uuid, status_input public.subscription_status, ends_at_input timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform access required'; end if;
  update public.restaurants set subscription_status = status_input, subscription_ends_at = ends_at_input where id = restaurant_id_input;
end;
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.platform_list_restaurants() from public;
revoke all on function public.platform_set_subscription(uuid, public.subscription_status, timestamptz) from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.platform_list_restaurants() to authenticated;
grant execute on function public.platform_set_subscription(uuid, public.subscription_status, timestamptz) to authenticated;

-- After creating your own account, add it as the platform admin in the SQL editor:
-- insert into private.platform_admins (user_id) select id from auth.users where email = 'your@email.com';
