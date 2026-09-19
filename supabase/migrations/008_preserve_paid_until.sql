-- Suspending a restaurant must not erase what it has already paid for.
--
-- The previous version assigned `ends_at_input` straight through for any
-- non-active status. The console passes "now" when suspending, so
-- `subscription_ends_at` was overwritten with today's date and the real
-- paid-until date was lost. Reactivating then extended a year from today,
-- silently deleting the customer's remaining time.
--
-- Now a null `ends_at_input` means "leave the date alone" for a suspension, and
-- the console passes the stored date back when reactivating so restoring an
-- account returns exactly the time it had rather than adding a year to it.
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
    -- An explicit date always wins, which is how the console restores a
    -- suspended account to exactly the time it had. Otherwise extend a year
    -- from whichever is later, so renewing early adds to the remaining time
    -- instead of discarding it.
    next_ends := coalesce(ends_at_input, greatest(now(), coalesce(current_ends, now())) + interval '1 year');
  else
    -- Keep the paid-until date through a suspension.
    next_ends := coalesce(ends_at_input, current_ends);
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
