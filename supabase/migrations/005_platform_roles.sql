-- Operator console: roles, an audit trail for billing changes, and real
-- enforcement of paid subscription expiry.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

-- One role today, but the column means adding a read-only helper later is a
-- row insert rather than another migration.
alter table private.platform_admins
  add column if not exists role text not null default 'super_admin';

alter table private.platform_admins drop constraint if exists platform_admins_role_check;
alter table private.platform_admins
  add constraint platform_admins_role_check check (role in ('super_admin', 'support'));

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

-- Subscription changes decide whether a restaurant's menu stays online, so they
-- are worth attributing. The email is copied in rather than joined later, so the
-- record survives the account being deleted.
create table if not exists private.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  restaurant_id uuid,
  restaurant_slug text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_log_created_idx
  on private.platform_audit_log(created_at desc);

revoke all on table private.platform_audit_log from public, anon, authenticated;

-- Third layer, on top of the revoked schema and the revoked table grants. No
-- policy is defined, so nothing reaches this table through the API at all; the
-- security definer functions below run as the table owner and bypass RLS.
alter table private.platform_audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Subscription liveness
-- ---------------------------------------------------------------------------

-- Single definition of "this restaurant's menu should be served", so the three
-- public policies below cannot drift apart.
--
-- A null subscription_ends_at means no expiry: existing paid rows keep working
-- exactly as they do today, and only a row with a date in the past goes dark.
create or replace function public.subscription_is_live(
  status public.subscription_status,
  trial_ends timestamptz,
  subscription_ends timestamptz
) returns boolean language sql stable set search_path = '' as $$
  select case status
    when 'active' then subscription_ends is null or subscription_ends > now()
    when 'trial' then trial_ends > now()
    else false
  end;
$$;

grant execute on function public.subscription_is_live(public.subscription_status, timestamptz, timestamptz) to anon, authenticated;

drop policy if exists "Public can view available restaurants" on public.restaurants;
create policy "Public can view available restaurants" on public.restaurants for select
using (
  public.subscription_is_live(subscription_status, trial_ends_at, subscription_ends_at)
  or owner_id = auth.uid()
);

drop policy if exists "Public can view categories for available restaurants" on public.menu_categories;
create policy "Public can view categories for available restaurants" on public.menu_categories for select
using (exists (
  select 1 from public.restaurants r
  where r.id = restaurant_id
    and (public.subscription_is_live(r.subscription_status, r.trial_ends_at, r.subscription_ends_at)
         or r.owner_id = auth.uid())
));

-- Both historical names are dropped: 001 created "Public can view available
-- items" and 002 replaced it with "Public can view menu items".
drop policy if exists "Public can view available items" on public.menu_items;
drop policy if exists "Public can view menu items" on public.menu_items;
create policy "Public can view menu items" on public.menu_items for select
using (exists (
  select 1 from public.restaurants r
  where r.id = restaurant_id
    -- The owner clause was lost in 002, which left an owner unable to see their
    -- own menu once the trial lapsed — exactly when they need to come back and
    -- renew it.
    and (public.subscription_is_live(r.subscription_status, r.trial_ends_at, r.subscription_ends_at)
         or r.owner_id = auth.uid())
));

-- ---------------------------------------------------------------------------
-- Console functions
-- ---------------------------------------------------------------------------

-- The caller's console role, or null for everyone else. Lets the app hide the
-- console instead of rendering it and failing at the first request.
create or replace function public.platform_admin_role()
returns text language sql security definer stable set search_path = '' as $$
  select role from private.platform_admins where user_id = auth.uid();
$$;

-- Return type changes, so this cannot be a create-or-replace.
drop function if exists public.platform_list_restaurants();
create function public.platform_list_restaurants()
returns table (
  id uuid,
  slug text,
  name_en text,
  name_ar text,
  primary_color text,
  template_id text,
  temporarily_closed boolean,
  subscription_status public.subscription_status,
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  created_at timestamptz,
  owner_email text,
  item_count bigint
) language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform access required'; end if;
  return query
    select r.id, r.slug, r.name_en, r.name_ar, r.primary_color, r.template_id, r.temporarily_closed,
           r.subscription_status, r.trial_ends_at, r.subscription_ends_at, r.created_at,
           u.email::text,
           (select count(*) from public.menu_items i where i.restaurant_id = r.id)
    from public.restaurants r
    left join auth.users u on u.id = r.owner_id
    order by r.created_at desc;
end;
$$;

create or replace function public.platform_set_subscription(
  restaurant_id_input uuid,
  status_input public.subscription_status,
  ends_at_input timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_role text;
  caller_email text;
  current_ends timestamptz;
  next_ends timestamptz;
  target_slug text;
begin
  select role into caller_role from private.platform_admins where user_id = auth.uid();
  if caller_role is null then raise exception 'Platform access required'; end if;
  if caller_role <> 'super_admin' then raise exception 'This console role cannot change subscriptions'; end if;

  select subscription_ends_at, slug into current_ends, target_slug
  from public.restaurants where id = restaurant_id_input;
  if not found then raise exception 'Restaurant not found'; end if;

  if status_input = 'active' then
    -- An explicit date always wins. Otherwise extend a year from whichever is
    -- later, so renewing early adds to the remaining time instead of discarding it.
    next_ends := coalesce(ends_at_input, greatest(now(), coalesce(current_ends, now())) + interval '1 year');
  else
    next_ends := ends_at_input;
  end if;

  update public.restaurants
     set subscription_status = status_input,
         subscription_ends_at = next_ends
   where id = restaurant_id_input;

  select email::text into caller_email from auth.users where id = auth.uid();

  insert into private.platform_audit_log (actor_id, actor_email, action, restaurant_id, restaurant_slug, details)
  values (
    auth.uid(), caller_email, 'subscription.' || status_input::text,
    restaurant_id_input, target_slug,
    jsonb_build_object('previous_ends_at', current_ends, 'ends_at', next_ends)
  );
end;
$$;

create or replace function public.platform_audit(limit_input integer default 50)
returns table (
  id uuid,
  actor_email text,
  action text,
  restaurant_slug text,
  details jsonb,
  created_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform access required'; end if;
  return query
    select a.id, a.actor_email, a.action, a.restaurant_slug, a.details, a.created_at
      from private.platform_audit_log a
     order by a.created_at desc
     limit least(coalesce(limit_input, 50), 200);
end;
$$;

revoke all on function public.platform_admin_role() from public;
revoke all on function public.platform_list_restaurants() from public;
revoke all on function public.platform_audit(integer) from public;
grant execute on function public.platform_admin_role() to authenticated;
grant execute on function public.platform_list_restaurants() to authenticated;
grant execute on function public.platform_audit(integer) to authenticated;

-- After creating your own account, make it the super admin in the SQL editor:
-- insert into private.platform_admins (user_id, role)
-- select id, 'super_admin' from auth.users where email = 'your@email.com'
-- on conflict (user_id) do update set role = 'super_admin';
