-- How often each menu is actually opened.
--
-- The renewal conversation is "your menu was opened 1,240 times last month",
-- and without this there is nothing to point at.

-- Aggregated per day rather than one row per scan: a busy restaurant would
-- otherwise write tens of thousands of rows a month to answer a question that
-- only ever needs daily totals.
create table if not exists public.menu_view_daily (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  viewed_on date not null,
  views integer not null default 0,
  primary key (restaurant_id, viewed_on)
);

create index if not exists menu_view_daily_restaurant_date_idx
  on public.menu_view_daily(restaurant_id, viewed_on desc);

alter table public.menu_view_daily enable row level security;

-- Readable by the restaurant's own owner. There is deliberately no insert or
-- update policy: the only way to write is the security definer function below,
-- so a visitor cannot set counts to anything they choose.
drop policy if exists "Owners read their menu views" on public.menu_view_daily;
create policy "Owners read their menu views" on public.menu_view_daily for select
using (exists (
  select 1 from public.restaurants r
  where r.id = restaurant_id and r.owner_id = auth.uid()
));

/**
 * Records one view. Called by anonymous visitors, so it stays deliberately
 * narrow: it takes no count, only ever adds one, and ignores restaurants that
 * are not currently being served — otherwise a suspended menu would still
 * accumulate numbers nobody should be billed against.
 */
create or replace function public.record_menu_view(restaurant_id_input uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id_input
      and public.subscription_is_live(r.subscription_status, r.trial_ends_at, r.subscription_ends_at)
  ) then
    return;
  end if;

  insert into public.menu_view_daily (restaurant_id, viewed_on, views)
  values (restaurant_id_input, (now() at time zone 'utc')::date, 1)
  on conflict (restaurant_id, viewed_on)
  do update set views = public.menu_view_daily.views + 1;
end;
$$;

revoke all on function public.record_menu_view(uuid) from public;
grant execute on function public.record_menu_view(uuid) to anon, authenticated;

-- Add a 30-day view count to the console listing, so the operator can see which
-- restaurants are actually being used before a renewal conversation.
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
  item_count bigint,
  views_30d bigint
) language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform access required'; end if;
  return query
    select r.id, r.slug, r.name_en, r.name_ar, r.primary_color, r.template_id, r.temporarily_closed,
           r.subscription_status, r.trial_ends_at, r.subscription_ends_at, r.created_at,
           u.email::text,
           (select count(*) from public.menu_items i where i.restaurant_id = r.id),
           coalesce((
             select sum(v.views) from public.menu_view_daily v
             where v.restaurant_id = r.id
               and v.viewed_on >= ((now() at time zone 'utc')::date - 29)
           ), 0)
    from public.restaurants r
    left join auth.users u on u.id = r.owner_id
    order by r.created_at desc;
end;
$$;

revoke all on function public.platform_list_restaurants() from public;
grant execute on function public.platform_list_restaurants() to authenticated;
