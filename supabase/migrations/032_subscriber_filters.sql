-- Filtering precedes owner pagination. Existing directory RPC remains compatible.
create or replace function public.platform_search_subscribers(search_input text default '', filters_input jsonb default '{}'::jsonb, page_input integer default 0)
returns jsonb language plpgsql security definer stable set search_path='' as $$
declare
  f jsonb:=coalesce(filters_input,'{}'::jsonb); term text:=trim(coalesce(search_input,''));
  pattern text; digits text; result jsonb;
  status_filter text:=coalesce(nullif(f->>'status',''),'any');
  visibility_filter text:=coalesce(nullif(f->>'visibility',''),'any');
  payment_filter text:=coalesce(nullif(f->>'payments',''),'any');
  account_filter text:=coalesce(nullif(f->>'account',''),'any');
  shop_filter text:=coalesce(nullif(f->>'shops',''),'any');
  sort_filter text:=coalesce(nullif(f->>'sort',''),'newest');
  from_date date:=nullif(f->>'registered_from','')::date;
  to_date date:=nullif(f->>'registered_to','')::date;
  shop_criteria boolean;
begin
  perform private.billing_require_admin();
  if jsonb_typeof(f)<>'object' or length(term)>200
    or status_filter not in ('any','trial','active','expired','suspended','expiring')
    or visibility_filter not in ('any','listed','hidden')
    or payment_filter not in ('any','balance','settled','none')
    or account_filter not in ('any','current','archived')
    or shop_filter not in ('any','with','none')
    or sort_filter not in ('newest','oldest','email_asc','email_desc','expiry') then
    raise exception 'Invalid subscriber filters';
  end if;
  if from_date is not null and to_date is not null and from_date>to_date then
    raise exception 'Enter a valid registration date range';
  end if;
  pattern:='%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
  digits:=translate(term,'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');
  if digits ~ '^[+()0-9 .-]+$' then digits:=regexp_replace(digits,'[^0-9]','','g'); else digits:=null; end if;
  if length(digits)<3 then digits:=null; end if;
  shop_criteria:=status_filter<>'any' or visibility_filter<>'any' or payment_filter<>'any';
  with owners as (
    select u.id,u.email,u.created_at,false as archived,
      (u.email ilike pattern or u.phone ilike pattern
       or (digits is not null and regexp_replace(translate(u.phone,'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[^0-9]','','g') like '%'||digits||'%')
       or exists(select 1 from public.brands b where b.owner_id=u.id and (b.name_en ilike pattern or b.name_ar ilike pattern or b.slug ilike pattern))) as text_match
    from auth.users u where not exists(select 1 from private.platform_admins p where p.user_id=u.id)
    union all
    select a.owner_id,max(a.owner_email),null::timestamptz,true,max(a.owner_email) ilike pattern
      from private.cash_agreements a where not exists(select 1 from auth.users u where u.id=a.owner_id) group by a.owner_id
  ), current_shops as (
    select r.id,r.owner_id,
      case when r.subscription_status='trial' then r.trial_ends_at else r.subscription_ends_at end as ends_at,
      case when r.subscription_status='suspended' then 'suspended'
        when not public.subscription_is_live(r.subscription_status,r.trial_ends_at,r.subscription_ends_at) then 'expired'
        else r.subscription_status::text end as state,
      r.is_published,a.id as agreement_id,a.annual_cents,coalesce(cash.paid,0) as paid,coalesce(cash.payments,0) as payments,
      (r.name_en ilike pattern or r.name_ar ilike pattern or r.slug ilike pattern or r.whatsapp ilike pattern or r.phone ilike pattern
        or (digits is not null and (regexp_replace(translate(r.phone,'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[^0-9]','','g') like '%'||digits||'%' or regexp_replace(translate(r.whatsapp,'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[^0-9]','','g') like '%'||digits||'%'))) as text_match
    from public.restaurants r
    left join lateral (select a.id,a.annual_cents from private.cash_agreements a where a.restaurant_id=r.id order by a.sequence_number desc limit 1) a on true
    left join lateral (select sum(p.amount_cents) as paid,count(*) as payments from private.cash_receipts p where p.agreement_id=a.id
      and not exists(select 1 from private.cash_receipt_voids v where v.receipt_id=p.id)) cash on true
  ), eligible_shops as (
    select s.* from current_shops s where
      (status_filter='any' or s.state=status_filter or (status_filter='expiring' and s.state in ('trial','active') and s.ends_at>now() and s.ends_at<=now()+interval '168 hours'))
      and (visibility_filter='any' or (visibility_filter='listed' and s.is_published) or (visibility_filter='hidden' and not s.is_published))
      and (payment_filter='any' or (payment_filter='balance' and s.agreement_id is not null and s.paid<s.annual_cents)
        or (payment_filter='settled' and s.agreement_id is not null and s.payments>0 and s.paid=s.annual_cents)
        or (payment_filter='none' and s.payments=0))
  ), matching as materialized (
    select o.*,
      (select min(s.ends_at) from eligible_shops s where s.owner_id=o.id and s.state<>'suspended' and (term='' or o.text_match or s.text_match)) as first_expiry
    from owners o where
      (account_filter='any' or (account_filter='archived' and o.archived) or (account_filter='current' and not o.archived))
      and (shop_filter='any' or (shop_filter='with' and exists(select 1 from current_shops s where s.owner_id=o.id))
        or (shop_filter='none' and not exists(select 1 from current_shops s where s.owner_id=o.id)))
      and (from_date is null or o.created_at>=from_date::timestamp at time zone 'Asia/Beirut')
      and (to_date is null or o.created_at<(to_date+1)::timestamp at time zone 'Asia/Beirut')
      and ((not shop_criteria and (term='' or o.text_match
          or exists(select 1 from eligible_shops s where s.owner_id=o.id and s.text_match)
          or exists(select 1 from private.cash_agreements a where a.owner_id=o.id and (a.name_en ilike pattern or a.name_ar ilike pattern or a.slug ilike pattern))))
        or exists(select 1 from eligible_shops s where s.owner_id=o.id and (term='' or o.text_match or s.text_match)))
  ), paged as (
    select o.* from matching o order by
      case when sort_filter='newest' then o.created_at end desc nulls last,
      case when sort_filter='oldest' then o.created_at end asc nulls last,
      case when sort_filter='email_asc' then lower(o.email) end asc,
      case when sort_filter='email_desc' then lower(o.email) end desc,
      case when sort_filter='expiry' then o.first_expiry end asc nulls last,o.id
    limit 25 offset least(greatest(coalesce(page_input,0),0),1000000)*25
  )
  select jsonb_build_object('total',(select count(*) from matching),'page',least(greatest(coalesce(page_input,0),0),1000000),'page_size',25,
    'subscribers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'email',o.email,'created_at',o.created_at,'archived',o.archived,
      'matching_shop_ids',(select coalesce(jsonb_agg(s.id order by s.id),'[]'::jsonb) from eligible_shops s where s.owner_id=o.id and (term='' or o.text_match or s.text_match)),
      'shops',(select coalesce(jsonb_agg(private.billing_payload(s.id,true)-'agreements' order by s.name_en,s.id),'[]'::jsonb) from (
        select r.id,r.name_en from public.restaurants r where r.owner_id=o.id
        union all select historical.shop_id,historical.name_en from (
          select distinct on(a.shop_id) a.shop_id,a.name_en from private.cash_agreements a where a.owner_id=o.id and a.restaurant_id is null order by a.shop_id,a.sequence_number desc
        ) historical
      ) s)) order by
      case when sort_filter='newest' then o.created_at end desc nulls last,
      case when sort_filter='oldest' then o.created_at end asc nulls last,
      case when sort_filter='email_asc' then lower(o.email) end asc,
      case when sort_filter='email_desc' then lower(o.email) end desc,
      case when sort_filter='expiry' then o.first_expiry end asc nulls last,o.id) from paged o),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.platform_search_subscribers(text,jsonb,integer) from public,anon;
grant execute on function public.platform_search_subscribers(text,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
