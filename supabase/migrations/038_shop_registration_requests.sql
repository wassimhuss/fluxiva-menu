-- Account review is separate from trial eligibility, cash and branch approvals.
-- Pending registrations are derived from Auth: no signup trigger can lose a request.
create table if not exists private.shop_registration_reviews (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid not null,
  reviewer_email text
);
alter table private.shop_registration_reviews enable row level security;
revoke all on private.shop_registration_reviews from public,anon,authenticated;

create or replace function public.platform_shop_registrations(search_input text default '',status_input text default 'pending',page_input integer default 0)
returns jsonb language plpgsql security definer stable set search_path='' as $$
declare term text:=trim(coalesce(search_input,'')); pattern text; result jsonb;
begin
  perform private.billing_require_admin();
  if status_input is null or status_input not in ('pending','approved','all') or length(term)>200 then raise exception 'Invalid registration filters'; end if;
  pattern:='%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
  with accounts as materialized (
    select u.id as owner_id,u.email as owner_email,u.created_at as registered_at,u.email_confirmed_at,
      case when review.owner_id is null then 'pending' else 'approved' end as status,
      review.reviewed_at,review.reviewer_email,
      case when shop.id is null then null else jsonb_build_object('id',shop.id,'name_en',shop.name_en,'name_ar',shop.name_ar,'slug',shop.slug,
        'whatsapp',shop.whatsapp,'created_at',shop.created_at,'subscription_status',shop.subscription_status,
        'trial_ends_at',shop.trial_ends_at,'subscription_ends_at',shop.subscription_ends_at,'is_published',shop.is_published) end as shop
    from auth.users u left join private.shop_registration_reviews review on review.owner_id=u.id
    left join lateral (select r.* from public.restaurants r where r.owner_id=u.id order by r.created_at,r.id limit 1) shop on true
    where not exists(select 1 from private.platform_admins p where p.user_id=u.id)
      and (term='' or u.email ilike pattern or shop.name_en ilike pattern or shop.name_ar ilike pattern or shop.slug ilike pattern or shop.whatsapp ilike pattern)
  ), matching as materialized (select * from accounts where status_input='all' or status=status_input),
  paged as (select * from matching order by registered_at desc,owner_id limit 25 offset least(greatest(coalesce(page_input,0),0),1000000)*25)
  select jsonb_build_object('requests',coalesce((select jsonb_agg(to_jsonb(p) order by registered_at desc,owner_id) from paged p),'[]'::jsonb),
    'total',(select count(*) from matching),'pending_count',(select count(*) from accounts where status='pending'),
    'page',least(greatest(coalesce(page_input,0),0),1000000),'page_size',25) into result;
  return result;
end;
$$;

create or replace function public.platform_approve_shop_registration(owner_input uuid,shop_input uuid)
returns void language plpgsql security definer set search_path='' as $$
declare first_shop public.restaurants%rowtype; existing private.shop_registration_reviews%rowtype;
begin
  perform private.billing_require_admin(true);
  perform 1 from auth.users u where u.id=owner_input and not exists(select 1 from private.platform_admins p where p.user_id=u.id) for update;
  if not found then raise exception 'Registration no longer available'; end if;
  select * into first_shop from public.restaurants where owner_id=owner_input order by created_at,id limit 1 for update;
  if not found then raise exception 'The owner must finish shop setup before approval'; end if;
  if shop_input is distinct from first_shop.id then raise exception 'Registration changed. Refresh and try again.'; end if;
  select * into existing from private.shop_registration_reviews where owner_id=owner_input;
  if found then
    if existing.restaurant_id=shop_input then return; end if;
    raise exception 'Registration has already been reviewed';
  end if;
  insert into private.shop_registration_reviews(owner_id,restaurant_id,reviewed_by,reviewer_email)
    values(owner_input,first_shop.id,auth.uid(),(select email from auth.users where id=auth.uid()));
  insert into private.platform_audit_log(actor_id,actor_email,action,restaurant_id,restaurant_slug,details)
    values(auth.uid(),(select email from auth.users where id=auth.uid()),'registration.approved',first_shop.id,first_shop.slug,
      jsonb_build_object('owner_id',owner_input,'owner_email',(select email from auth.users where id=owner_input)));
end;
$$;
revoke all on function public.platform_shop_registrations(text,text,integer),public.platform_approve_shop_registration(uuid,uuid) from public,anon,authenticated;
grant execute on function public.platform_shop_registrations(text,text,integer),public.platform_approve_shop_registration(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
