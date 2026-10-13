-- Seven elapsed days of owner editing after expiry; public eligibility is
-- unchanged and stops at expiry. Suspended shops lock immediately.
create or replace function public.shop_editing_is_open(status_input public.subscription_status, trial_input timestamptz, paid_input timestamptz)
returns boolean language sql stable set search_path='' as $$
  select case when status_input='suspended' then false
    when status_input='active' and paid_input is null then true
    else coalesce(now() < (case when status_input='trial' then trial_input else paid_input end) + interval '168 hours',false) end;
$$;
revoke all on function public.shop_editing_is_open(public.subscription_status,timestamptz,timestamptz) from public,anon;
grant execute on function public.shop_editing_is_open(public.subscription_status,timestamptz,timestamptz) to authenticated;

create or replace function private.guard_owner_menu_editing()
returns trigger language plpgsql security definer set search_path='' as $$
declare shop record; first_id uuid; second_id uuid;
begin
  -- The role GUC retains the caller's role inside security-definer copy RPCs.
  -- Trusted migration/service operations and super-admin billing stay usable.
  if coalesce(current_setting('role',true),'none') not in ('authenticated','anon')
    or public.is_platform_super_admin() then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name='restaurants' then
    if tg_op='INSERT' then
      if new.owner_id=auth.uid() and exists(select 1 from public.restaurants r where r.owner_id=auth.uid()
        and not public.subscription_is_live(r.subscription_status,r.trial_ends_at,r.subscription_ends_at)) then
        raise exception 'Resolve expired or suspended shops before adding another place';
      end if;
      return new;
    end if;
    -- Keep the expired row until collection is resolved; otherwise deleting it
    -- during the warning week would bypass the replacement-trial restriction.
    if tg_op='DELETE' and old.owner_id=auth.uid() and not public.subscription_is_live(old.subscription_status,old.trial_ends_at,old.subscription_ends_at) then
      raise exception 'Resolve expired or suspended shops before deleting this place';
    end if;
    if old.owner_id=auth.uid() and not public.shop_editing_is_open(old.subscription_status,old.trial_ends_at,old.subscription_ends_at) then
      raise exception 'Shop editing is locked; arrange cash collection with Fluxiva';
    end if;
  else
    if tg_op<>'INSERT' then first_id:=old.restaurant_id; end if;
    if tg_op<>'DELETE' then second_id:=new.restaurant_id; end if;
    for shop in select r.* from public.restaurants r where r.id in (first_id,second_id) and r.owner_id=auth.uid() order by r.id for share loop
      if not public.shop_editing_is_open(shop.subscription_status,shop.trial_ends_at,shop.subscription_ends_at) then
        raise exception 'Shop editing is locked; arrange cash collection with Fluxiva';
      end if;
    end loop;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.guard_owner_menu_editing() from public,anon,authenticated;
drop trigger if exists owner_edit_guard on public.restaurants;
create trigger owner_edit_guard before insert or update or delete on public.restaurants for each row execute function private.guard_owner_menu_editing();
drop trigger if exists owner_edit_guard on public.menu_categories;
create trigger owner_edit_guard before insert or update or delete on public.menu_categories for each row execute function private.guard_owner_menu_editing();
drop trigger if exists owner_edit_guard on public.menu_items;
create trigger owner_edit_guard before insert or update or delete on public.menu_items for each row execute function private.guard_owner_menu_editing();

create or replace function public.owner_can_edit_menu_asset(folder_input text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.restaurants r where r.id::text=folder_input
    and r.owner_id=auth.uid() and public.shop_editing_is_open(r.subscription_status,r.trial_ends_at,r.subscription_ends_at));
$$;
revoke all on function public.owner_can_edit_menu_asset(text) from public,anon;
grant execute on function public.owner_can_edit_menu_asset(text) to authenticated;
drop policy if exists "Expired shops cannot upload assets" on storage.objects;
create policy "Expired shops cannot upload assets" on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'menu-assets' or public.owner_can_edit_menu_asset((storage.foldername(name))[1]));
drop policy if exists "Expired shops cannot update assets" on storage.objects;
create policy "Expired shops cannot update assets" on storage.objects as restrictive for update to authenticated
using(bucket_id<>'menu-assets' or public.owner_can_edit_menu_asset((storage.foldername(name))[1]))
with check(bucket_id<>'menu-assets' or public.owner_can_edit_menu_asset((storage.foldername(name))[1]));
drop policy if exists "Expired shops cannot delete assets" on storage.objects;
create policy "Expired shops cannot delete assets" on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'menu-assets' or public.owner_can_edit_menu_asset((storage.foldername(name))[1]));
notify pgrst,'reload schema';
