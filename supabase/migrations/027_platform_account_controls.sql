-- Platform account controls. Suspension is reversible and applies to every
-- restaurant owned by the subscriber. Deletion removes the auth account and
-- cascaded menu data, while the cash ledger remains archived for audit.

create or replace function public.platform_set_subscriber_status(
  owner_id_input uuid,
  status_input public.subscription_status
)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_email text;
begin
  perform private.billing_require_admin(true);
  if owner_id_input is null then raise exception 'Subscriber is required'; end if;
  if not exists(select 1 from auth.users where id=owner_id_input) then
    raise exception 'Subscriber account not found';
  end if;
  if status_input not in ('active'::public.subscription_status, 'suspended'::public.subscription_status) then
    raise exception 'Subscriber accounts can only be active or suspended';
  end if;
  select email into caller_email from auth.users where id=auth.uid();
  update public.restaurants
  set subscription_status = case
    when status_input='suspended'::public.subscription_status then 'suspended'::public.subscription_status
    when subscription_ends_at is null and trial_ends_at is not null then 'trial'::public.subscription_status
    else 'active'::public.subscription_status
  end
  where owner_id=owner_id_input;
  insert into private.platform_audit_log(actor_id,actor_email,action,details)
    values(auth.uid(),caller_email,'account.'||status_input::text,
      jsonb_build_object('owner_id',owner_id_input));
end;
$$;

create or replace function public.platform_delete_subscriber(
  owner_id_input uuid,
  email_confirmation text
)
returns void language plpgsql security definer set search_path = '' as $$
declare target_email text; caller_email text;
begin
  perform private.billing_require_admin(true);
  if owner_id_input is null then raise exception 'Subscriber is required'; end if;
  select email into target_email from auth.users where id=owner_id_input;
  if target_email is null then raise exception 'Subscriber account not found'; end if;
  if trim(coalesce(email_confirmation,'')) is distinct from target_email then
    raise exception 'Enter the subscriber email to confirm deletion';
  end if;
  if exists(select 1 from private.platform_admins where user_id=owner_id_input) then
    raise exception 'Platform admin accounts cannot be deleted here';
  end if;
  select email into caller_email from auth.users where id=auth.uid();
  insert into private.platform_audit_log(actor_id,actor_email,action,details)
    values(auth.uid(),caller_email,'account.deleted',
      jsonb_build_object('owner_id',owner_id_input,'owner_email',target_email));
  -- Cascades remove the owner's brand, restaurants, categories, items and
  -- analytics. cash_agreements deliberately keep owner_id and become archived
  -- through platform_subscribers once auth.users no longer contains the owner.
  delete from auth.users where id=owner_id_input;
end;
$$;

revoke all on function public.platform_set_subscriber_status(uuid,public.subscription_status) from public, anon, authenticated;
revoke all on function public.platform_delete_subscriber(uuid,text) from public, anon, authenticated;
grant execute on function public.platform_set_subscriber_status(uuid,public.subscription_status) to authenticated;
grant execute on function public.platform_delete_subscriber(uuid,text) to authenticated;
