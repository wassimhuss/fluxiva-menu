-- Group independently managed restaurant places behind one public brand QR.
-- Existing owners are backfilled into a brand before the one-restaurant-per-
-- owner constraint is removed, so this migration is safe for live data.

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text not null,
  logo_url text,
  primary_color text not null default '#173f35' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  default_language text not null default 'en' check (default_language in ('en', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger brands_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

alter table public.restaurants add column brand_id uuid;

insert into public.brands (id, owner_id, slug, name_en, name_ar, logo_url, primary_color, default_language)
select r.id, r.owner_id, r.slug, r.name_en, r.name_ar, r.logo_url, r.primary_color, r.default_language
from public.restaurants r
on conflict (owner_id) do nothing;

update public.restaurants r
set brand_id = b.id
from public.brands b
where b.owner_id = r.owner_id and r.brand_id is null;

alter table public.restaurants
  alter column brand_id set not null,
  add constraint restaurants_brand_id_fkey
    foreign key (brand_id) references public.brands(id) on delete restrict;

-- The original schema allowed one restaurant per owner. A brand remains unique
-- to its owner, while that owner may now create any number of restaurant rows.
alter table public.restaurants drop constraint if exists restaurants_owner_id_key;

create index brands_owner_idx on public.brands(owner_id);
create index restaurants_brand_idx on public.restaurants(brand_id, created_at);

alter table public.brands enable row level security;

create policy "Public can view available brands" on public.brands for select
using (
  owner_id = auth.uid()
  or exists (
    select 1
    from public.restaurants r
    where r.brand_id = brands.id
      and public.subscription_is_live(r.subscription_status, r.trial_ends_at, r.subscription_ends_at)
  )
);

create policy "Owners create their brand" on public.brands for insert
with check (owner_id = auth.uid());

create policy "Owners update their brand" on public.brands for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- A restaurant may only be attached to the signed-in owner's brand. Keeping
-- owner_id on each place preserves all existing menu/storage RLS rules.
drop policy if exists "Owners create their restaurant" on public.restaurants;
create policy "Owners create their restaurant" on public.restaurants for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.brands b
    where b.id = brand_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "Owners update their restaurant" on public.restaurants;
create policy "Owners update their restaurant" on public.restaurants for update
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.brands b
    where b.id = brand_id and b.owner_id = auth.uid()
  )
);

revoke all on public.brands from anon, authenticated;
grant select on public.brands to anon;
grant select, insert, update on public.brands to authenticated;
grant all on public.brands to service_role;
