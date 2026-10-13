-- Read-only operator profiles. Auth credentials and raw metadata are never returned.
create or replace function public.platform_subscriber_details(owner_input uuid, activity_page_input integer default 0)
returns jsonb language plpgsql security definer stable set search_path='' as $$
declare account_data jsonb; shops_data jsonb; activity_data jsonb; activity_count bigint; shop_ids uuid[];
begin
  perform private.billing_require_admin();
  if owner_input is null or exists(select 1 from private.platform_admins where user_id=owner_input) then
    raise exception 'Subscriber not found';
  end if;
  select jsonb_build_object('id',u.id,'email',u.email,'created_at',u.created_at,'updated_at',u.updated_at,
    'last_sign_in_at',u.last_sign_in_at,'email_confirmed_at',u.email_confirmed_at,
    'phone',nullif(u.phone,''),'phone_confirmed_at',u.phone_confirmed_at,'banned_until',u.banned_until,'archived',false)
    into account_data from auth.users u where u.id=owner_input;
  if account_data is null then
    select jsonb_build_object('id',owner_input,'email',max(a.owner_email),'created_at',null,'updated_at',null,
      'last_sign_in_at',null,'email_confirmed_at',null,'phone',null,'phone_confirmed_at',null,'banned_until',null,'archived',true)
      into account_data from private.cash_agreements a where a.owner_id=owner_input having count(*)>0;
  end if;
  if account_data is null then raise exception 'Subscriber not found'; end if;
  select array_agg(s.id) into shop_ids from (
    select r.id from public.restaurants r where r.owner_id=owner_input
    union select a.shop_id from private.cash_agreements a where a.owner_id=owner_input and a.restaurant_id is null
  ) s;
  select coalesce(jsonb_agg(jsonb_build_object(
    'billing',private.billing_payload(s.id,true)-'agreements',
    'restaurant',to_jsonb(r),'created_at',r.created_at,'updated_at',r.updated_at,
    'category_count',case when r.id is not null then (select count(*) from public.menu_categories c where c.restaurant_id=r.id) end,
    'item_count',case when r.id is not null then (select count(*) from public.menu_items i where i.restaurant_id=r.id) end,
    'unavailable_count',case when r.id is not null then (select count(*) from public.menu_items i where i.restaurant_id=r.id and not i.available) end,
    'views_30d',case when r.id is not null then coalesce((select sum(v.views) from public.menu_view_daily v where v.restaurant_id=r.id and v.viewed_on >= (now() at time zone 'Asia/Beirut')::date-29),0) end,
    'storage_files',case when r.id is not null then (select count(*) from storage.objects o where o.bucket_id='menu-assets' and split_part(o.name,'/',1)=r.id::text) end,
    'storage_bytes',case when r.id is not null then coalesce((select sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::numeric else 0 end) from storage.objects o where o.bucket_id='menu-assets' and split_part(o.name,'/',1)=r.id::text),0) end
  ) order by r.created_at nulls last,s.id),'[]'::jsonb) into shops_data
  from unnest(shop_ids) as s(id) left join public.restaurants r on r.id=s.id and r.owner_id=owner_input;
  -- Match IDs and retained receipt ownership, never a possibly reused public slug.
  with relevant as (
    select l.* from private.platform_audit_log l where l.restaurant_id=any(shop_ids)
      or l.details->>'owner_id'=owner_input::text
      or exists(select 1 from private.cash_receipts p join private.cash_agreements a on a.id=p.agreement_id
        where p.id::text=l.details->>'receipt_id' and a.owner_id=owner_input)
  ) select count(*) into activity_count from relevant;
  with relevant as (
    select l.* from private.platform_audit_log l where l.restaurant_id=any(shop_ids)
      or l.details->>'owner_id'=owner_input::text
      or exists(select 1 from private.cash_receipts p join private.cash_agreements a on a.id=p.agreement_id
        where p.id::text=l.details->>'receipt_id' and a.owner_id=owner_input)
    order by l.created_at desc,l.id desc limit 25 offset least(greatest(coalesce(activity_page_input,0),0),1000000)*25
  ) select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'actor_email',l.actor_email,'action',l.action,
    'restaurant_slug',l.restaurant_slug,'details',l.details,'created_at',l.created_at) order by l.created_at desc,l.id desc),'[]'::jsonb) into activity_data from relevant l;
  return jsonb_build_object('account',account_data,'brand',(select to_jsonb(b) from public.brands b where b.owner_id=owner_input),
    'shops',shops_data,'activity',jsonb_build_object('entries',activity_data,'total',activity_count,
      'page',least(greatest(coalesce(activity_page_input,0),0),1000000),'page_size',25));
end;
$$;
revoke all on function public.platform_subscriber_details(uuid,integer) from public,anon;
grant execute on function public.platform_subscriber_details(uuid,integer) to authenticated;
notify pgrst,'reload schema';
