-- Cash only. All money is integer USD cents; dates use Beirut calendar time.
-- Historical access is preserved, but no historical receipts are fabricated.
-- RLS limits owners to their rows, but a whole-row UPDATE grant alone does not
-- protect billing columns. Trusted security-definer RPCs run as the table owner.
create or replace function private.guard_subscription_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_op='INSERT' then
      new.subscription_status:='trial';
      new.trial_ends_at:=now()+interval '14 days';
      new.subscription_ends_at:=null;
    elsif new.subscription_status is distinct from old.subscription_status
      or new.subscription_ends_at is distinct from old.subscription_ends_at
      or new.trial_ends_at is distinct from old.trial_ends_at then
      raise exception using errcode='42501', message='Subscription dates can only be changed by billing operations';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_subscription_fields on public.restaurants;
create trigger guard_subscription_fields before insert or update on public.restaurants
  for each row execute function private.guard_subscription_fields();
revoke all on function private.guard_subscription_fields() from public,anon,authenticated;

create table if not exists private.shop_billing_prices (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  annual_cents bigint not null check (annual_cents between 1 and 100000000),
  revision bigint not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create table if not exists private.cash_agreements (
  id uuid primary key default gen_random_uuid(),
  sequence_number bigint generated always as identity unique,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  shop_id uuid not null,
  owner_id uuid not null,
  owner_email text,
  name_en text not null,
  name_ar text not null,
  slug text not null,
  annual_cents bigint not null check (annual_cents between 1 and 100000000),
  baseline_until timestamptz,
  baseline_status public.subscription_status not null,
  created_at timestamptz not null default now()
);
create index if not exists cash_agreements_shop_idx on private.cash_agreements(shop_id, sequence_number desc);
create index if not exists cash_agreements_restaurant_idx on private.cash_agreements(restaurant_id) where restaurant_id is not null;
create index if not exists cash_agreements_owner_idx on private.cash_agreements(owner_id);
create table if not exists private.cash_receipts (
  id uuid primary key, -- caller-generated idempotency key
  agreement_id uuid not null references private.cash_agreements(id),
  amount_cents bigint not null check (amount_cents between 1 and 100000000),
  collected_at timestamptz not null,
  reference text not null check (length(reference) between 1 and 120),
  note text not null default '' check (length(note) <= 2000),
  actor_id uuid not null,
  actor_email text,
  coverage_from timestamptz not null,
  coverage_until timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists cash_receipts_agreement_idx on private.cash_receipts(agreement_id, collected_at, created_at, id);
create index if not exists cash_receipts_collected_idx on private.cash_receipts(collected_at desc);
create table if not exists private.cash_receipt_voids (
  id uuid primary key,
  receipt_id uuid not null unique references private.cash_receipts(id),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  actor_id uuid not null,
  actor_email text,
  created_at timestamptz not null default now()
);
alter table private.shop_billing_prices enable row level security;
alter table private.cash_agreements enable row level security;
alter table private.cash_receipts enable row level security;
alter table private.cash_receipt_voids enable row level security;
revoke all on private.shop_billing_prices, private.cash_agreements, private.cash_receipts, private.cash_receipt_voids from public, anon, authenticated;

create or replace function private.billing_require_admin(write_input boolean default false)
returns void language plpgsql stable set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform access required'; end if;
  if write_input and not public.is_platform_super_admin() then raise exception 'Super admin access required'; end if;
end;
$$;

-- Anchored addition avoids Jan 31 -> Feb 28 -> Mar 28 drift. Fractions use the
-- next actual calendar month, including leap years and Beirut DST transitions.
create or replace function private.billing_calendar_end(anchor_input timestamptz, cents_input bigint, annual_input bigint)
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare
  months_numeric numeric := 12::numeric * cents_input / annual_input;
  whole_months integer := floor(months_numeric);
  local_anchor timestamp := anchor_input at time zone 'Asia/Beirut';
  month_start timestamptz;
  month_end timestamptz;
begin
  month_start := (local_anchor + make_interval(months => whole_months)) at time zone 'Asia/Beirut';
  month_end := (local_anchor + make_interval(months => whole_months + 1)) at time zone 'Asia/Beirut';
  return month_start + floor((months_numeric - whole_months) * extract(epoch from month_end - month_start)) * interval '1 second';
end;
$$;

-- Replay only non-voided receipts. A lapse resets the continuous segment, but
-- never resets the agreement's annual balance or three-receipt limit.
create or replace function private.billing_replay(
  agreement_input uuid, extra_cents bigint default 0,
  extra_collected timestamptz default null, omit_receipt uuid default null
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  agreement private.cash_agreements%rowtype;
  payment record;
  paid bigint := 0;
  receipt_count integer := 0;
  segment_cents bigint := 0;
  segment_anchor timestamptz;
  paid_until timestamptz;
  coverage_from timestamptz;
  latest_collected timestamptz;
begin
  select * into strict agreement from private.cash_agreements where id = agreement_input;
  paid_until := agreement.baseline_until;
  for payment in
    select r.amount_cents, r.collected_at
      from private.cash_receipts r
      where r.agreement_id = agreement_input and r.id is distinct from omit_receipt
        and not exists (select 1 from private.cash_receipt_voids v where v.receipt_id = r.id)
      order by r.collected_at, r.created_at, r.id
  loop
    coverage_from := greatest(payment.collected_at, coalesce(paid_until, payment.collected_at));
    if segment_anchor is null or paid_until < payment.collected_at then
      segment_anchor := coverage_from; segment_cents := 0;
    end if;
    paid := paid + payment.amount_cents;
    segment_cents := segment_cents + payment.amount_cents;
    receipt_count := receipt_count + 1;
    paid_until := private.billing_calendar_end(segment_anchor, segment_cents, agreement.annual_cents);
    latest_collected := payment.collected_at;
  end loop;
  if extra_cents > 0 then
    coverage_from := greatest(extra_collected, coalesce(paid_until, extra_collected));
    if segment_anchor is null or paid_until < extra_collected then
      segment_anchor := coverage_from; segment_cents := 0;
    end if;
    paid := paid + extra_cents; receipt_count := receipt_count + 1;
    paid_until := private.billing_calendar_end(segment_anchor, segment_cents + extra_cents, agreement.annual_cents);
    latest_collected := extra_collected;
  end if;
  return jsonb_build_object('paid_cents',paid,'payment_count',receipt_count,
    'paid_until',paid_until,'coverage_from',coverage_from,'latest_collected',latest_collected);
end;
$$;

create or replace function private.billing_version(shop_input uuid)
returns text language sql stable set search_path = '' as $$
  select md5(jsonb_build_object(
    'restaurant',(select jsonb_build_array(r.subscription_status,r.subscription_ends_at,r.trial_ends_at,r.is_published) from public.restaurants r where r.id=shop_input),
    'price',(select jsonb_build_array(p.annual_cents,p.revision) from private.shop_billing_prices p where p.restaurant_id=shop_input),
    'agreements',(select jsonb_agg(a.id order by a.created_at,a.id) from private.cash_agreements a where a.shop_id=shop_input),
    'receipts',(select jsonb_agg(r.id order by r.id) from private.cash_receipts r join private.cash_agreements a on a.id=r.agreement_id where a.shop_id=shop_input),
    'voids',(select jsonb_agg(v.id order by v.id) from private.cash_receipt_voids v join private.cash_receipts r on r.id=v.receipt_id join private.cash_agreements a on a.id=r.agreement_id where a.shop_id=shop_input)
  )::text);
$$;

create or replace function private.billing_payload(shop_input uuid, admin_input boolean)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  shop public.restaurants%rowtype;
  agreement private.cash_agreements%rowtype;
  calculated jsonb;
  price bigint;
  histories jsonb;
begin
  select * into shop from public.restaurants where id=shop_input;
  select * into agreement from private.cash_agreements where shop_id=shop_input order by sequence_number desc limit 1;
  if shop.id is null and agreement.id is null then raise exception 'Shop not found'; end if;
  select annual_cents into price from private.shop_billing_prices where restaurant_id=shop_input;
  if agreement.id is not null then calculated:=private.billing_replay(agreement.id); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'annual_cents',a.annual_cents,'created_at',a.created_at,
    'paid_cents',(private.billing_replay(a.id)->>'paid_cents')::bigint,
    'receipts',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',r.id,'amount_cents',r.amount_cents,'collected_at',r.collected_at,'reference',r.reference,
      'coverage_from',r.coverage_from,'coverage_until',r.coverage_until,
      'voided',v.id is not null,'can_void',admin_input and public.is_platform_super_admin() and shop.id is not null and a.id=agreement.id and v.id is null,
      'note',case when admin_input then r.note else null end,
      'actor_email',case when admin_input then r.actor_email else null end,
      'void_reason',case when admin_input then v.reason else null end
    ) order by r.collected_at desc,r.created_at desc,r.id desc),'[]'::jsonb)
      from private.cash_receipts r left join private.cash_receipt_voids v on v.receipt_id=r.id where r.agreement_id=a.id)
    ) order by a.sequence_number desc),'[]'::jsonb) into histories
    from private.cash_agreements a where a.shop_id=shop_input;
  return jsonb_build_object(
    'restaurant_id',shop_input,'name_en',coalesce(shop.name_en,agreement.name_en),'name_ar',coalesce(shop.name_ar,agreement.name_ar),
    'whatsapp',shop.whatsapp,'address_en',shop.address_en,'address_ar',shop.address_ar,
    'slug',coalesce(shop.slug,agreement.slug),'archived',shop.id is null,'owner_id',coalesce(shop.owner_id,agreement.owner_id),
    'subscription_status',coalesce(shop.subscription_status,agreement.baseline_status),
    'is_published',coalesce(shop.is_published,false),'trial_ends_at',shop.trial_ends_at,
    'paid_until',case when shop.id is null then (calculated->>'paid_until')::timestamptz when shop.subscription_status='trial' then shop.trial_ends_at else shop.subscription_ends_at end,
    'next_annual_cents',price,'annual_cents',coalesce(agreement.annual_cents,price),
    'agreement_id',agreement.id,'paid_cents',coalesce((calculated->>'paid_cents')::bigint,0),
    'remaining_cents',case when agreement.id is not null then agreement.annual_cents-(calculated->>'paid_cents')::bigint else null end,
    'payment_count',coalesce((calculated->>'payment_count')::integer,0),
    'legacy_access',agreement.id is null and shop.subscription_status<>'trial',
    'version',private.billing_version(shop_input),'agreements',histories);
end;
$$;

create or replace function public.platform_get_shop_billing(shop_input uuid)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin perform private.billing_require_admin(); return private.billing_payload(shop_input,true); end;
$$;
create or replace function public.owner_get_shop_billing(shop_input uuid)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.restaurants where id=shop_input and owner_id=auth.uid()) then
    raise exception 'Shop ownership required';
  end if;
  return private.billing_payload(shop_input,false);
end;
$$;

create or replace function public.platform_set_shop_price(shop_input uuid, annual_input bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.billing_require_admin(true);
  perform 1 from public.restaurants where id=shop_input for update;
  if not found then raise exception 'Shop not found'; end if;
  if annual_input is null or annual_input < 1 or annual_input > 100000000 then raise exception 'Enter a valid annual USD price'; end if;
  insert into private.shop_billing_prices(restaurant_id,annual_cents,updated_by) values(shop_input,annual_input,auth.uid())
    on conflict(restaurant_id) do update set annual_cents=excluded.annual_cents,revision=private.shop_billing_prices.revision+1,updated_by=auth.uid(),updated_at=now();
  insert into private.platform_audit_log(actor_id,actor_email,action,restaurant_id,restaurant_slug,details)
    select auth.uid(),(select email from auth.users where id=auth.uid()),'billing.price',id,slug,jsonb_build_object('annual_cents',annual_input)
    from public.restaurants where id=shop_input;
  return private.billing_payload(shop_input,true);
end;
$$;

create or replace function public.platform_preview_cash_payment(shop_input uuid, amount_input bigint, collected_input timestamptz)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  shop public.restaurants%rowtype;
  agreement private.cash_agreements%rowtype;
  price bigint;
  calculated jsonb;
  next_state jsonb;
  baseline timestamptz;
  starts timestamptz;
  ends timestamptz;
  paid bigint:=0;
  count_paid integer:=0;
  last_collected timestamptz;
begin
  perform private.billing_require_admin(true);
  select * into shop from public.restaurants where id=shop_input;
  if not found then raise exception 'Shop not found'; end if;
  if amount_input is null or amount_input < 1 or amount_input > 100000000 then raise exception 'Enter a positive cash amount'; end if;
  if collected_input is null or collected_input > now() then raise exception 'Collection date cannot be in the future'; end if;
  select * into agreement from private.cash_agreements where shop_id=shop_input order by sequence_number desc limit 1;
  if agreement.id is not null then
    calculated:=private.billing_replay(agreement.id);
    paid:=(calculated->>'paid_cents')::bigint; count_paid:=(calculated->>'payment_count')::integer;
    -- Include voided receipts in date validation: corrections cannot reorder history.
    select max(collected_at) into last_collected from private.cash_receipts where agreement_id=agreement.id;
    if collected_input < last_collected then raise exception 'Collection date precedes the latest receipt'; end if;
  end if;
  if agreement.id is null or paid=agreement.annual_cents then
    select annual_cents into price from private.shop_billing_prices where restaurant_id=shop_input;
    if price is null then raise exception 'Set the annual shop price before recording cash'; end if;
    paid:=0; count_paid:=0;
    baseline:=case when shop.subscription_status='trial' or (shop.subscription_status='suspended' and shop.subscription_ends_at is null) then shop.trial_ends_at else shop.subscription_ends_at end;
    if shop.subscription_status='active' and shop.subscription_ends_at is null then
      raise exception 'Existing access has no expiry; a carryover end date must be reviewed before billing';
    end if;
    starts:=greatest(collected_input,coalesce(baseline,collected_input));
    if amount_input > price then raise exception 'Cash amount exceeds the remaining annual balance'; end if;
    ends:=private.billing_calendar_end(starts,amount_input,price);
  else
    price:=agreement.annual_cents;
    if amount_input > price-paid then raise exception 'Cash amount exceeds the remaining annual balance'; end if;
    next_state:=private.billing_replay(agreement.id,amount_input,collected_input);
    starts:=(next_state->>'coverage_from')::timestamptz; ends:=(next_state->>'paid_until')::timestamptz;
  end if;
  if amount_input > price-paid then raise exception 'Cash amount exceeds the remaining annual balance'; end if;
  if count_paid >= 3 then raise exception 'Maximum three payments per agreement'; end if;
  if count_paid=2 and amount_input<>price-paid then raise exception 'The third payment must settle the remaining balance'; end if;
  if ends <= starts then raise exception 'Cash amount is too small to grant access'; end if;
  return jsonb_build_object('restaurant_id',shop_input,'annual_cents',price,'amount_cents',amount_input,
    'collected_at',collected_input,'previous_paid_until',case when shop.subscription_status='trial' then shop.trial_ends_at else shop.subscription_ends_at end,
    'coverage_from',starts,'paid_until',ends,'remaining_cents',price-paid-amount_input,'payment_count',count_paid+1,
    'version',private.billing_version(shop_input),'suspended',shop.subscription_status='suspended','is_published',shop.is_published);
end;
$$;

create or replace function public.platform_record_cash_payment(
  shop_input uuid, amount_input bigint, collected_input timestamptz,
  reference_input text, note_input text, request_input uuid, version_input text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  shop public.restaurants%rowtype;
  agreement private.cash_agreements%rowtype;
  receipt private.cash_receipts%rowtype;
  quote jsonb;
  calculated jsonb;
  caller_email text;
begin
  perform private.billing_require_admin(true);
  if request_input is null then raise exception 'Receipt request ID required'; end if;
  select * into shop from public.restaurants where id=shop_input for update;
  if not found then raise exception 'Shop not found'; end if;
  select * into receipt from private.cash_receipts where id=request_input;
  if found then
    if receipt.actor_id<>auth.uid() or receipt.amount_cents is distinct from amount_input or receipt.collected_at is distinct from collected_input
      or receipt.reference is distinct from trim(reference_input) or receipt.note is distinct from coalesce(trim(note_input),'')
      or not exists(select 1 from private.cash_agreements where id=receipt.agreement_id and shop_id=shop_input) then
      raise exception 'Receipt request ID already used for different information';
    end if;
    return private.billing_payload(shop_input,true);
  end if;
  if coalesce(length(trim(reference_input)),0) not between 1 and 120 or length(coalesce(trim(note_input),''))>2000 then
    raise exception 'Enter a receipt reference and a note under 2000 characters';
  end if;
  if version_input is distinct from private.billing_version(shop_input) then raise exception 'Billing changed; refresh the payment preview'; end if;
  quote:=public.platform_preview_cash_payment(shop_input,amount_input,collected_input);
  select * into agreement from private.cash_agreements where shop_id=shop_input order by sequence_number desc limit 1;
  if agreement.id is not null then calculated:=private.billing_replay(agreement.id); end if;
  if agreement.id is null or (calculated->>'paid_cents')::bigint=agreement.annual_cents then
    insert into private.cash_agreements(restaurant_id,shop_id,owner_id,owner_email,name_en,name_ar,slug,annual_cents,baseline_until,baseline_status)
      values(shop.id,shop.id,shop.owner_id,(select email from auth.users where id=shop.owner_id),
        shop.name_en,shop.name_ar,shop.slug,(quote->>'annual_cents')::bigint,
        case when shop.subscription_status='trial' or (shop.subscription_status='suspended' and shop.subscription_ends_at is null) then shop.trial_ends_at else shop.subscription_ends_at end,
        case when shop.subscription_status='suspended' then case when shop.subscription_ends_at is null then 'trial'::public.subscription_status else 'active'::public.subscription_status end else shop.subscription_status end)
      returning * into agreement;
  end if;
  select email into caller_email from auth.users where id=auth.uid();
  insert into private.cash_receipts(id,agreement_id,amount_cents,collected_at,reference,note,actor_id,actor_email,coverage_from,coverage_until)
    values(request_input,agreement.id,amount_input,collected_input,trim(reference_input),coalesce(trim(note_input),''),auth.uid(),caller_email,
      (quote->>'coverage_from')::timestamptz,(quote->>'paid_until')::timestamptz);
  update public.restaurants set subscription_ends_at=(quote->>'paid_until')::timestamptz,
    subscription_status=case when subscription_status='suspended' then subscription_status else 'active'::public.subscription_status end where id=shop_input;
  insert into private.platform_audit_log(actor_id,actor_email,action,restaurant_id,restaurant_slug,details)
    values(auth.uid(),caller_email,'billing.cash_received',shop_input,shop.slug,
      jsonb_build_object('receipt_id',request_input,'amount_cents',amount_input,'reference',trim(reference_input),'ends_at',quote->>'paid_until'));
  return private.billing_payload(shop_input,true);
end;
$$;

-- Explicit review for legacy unlimited access, never an inferred expiry.
create or replace function public.platform_review_legacy_access(shop_input uuid, ends_input timestamptz, version_input text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare shop public.restaurants%rowtype;
begin
  perform private.billing_require_admin(true);
  select * into shop from public.restaurants where id=shop_input for update;
  if not found then raise exception 'Shop not found'; end if;
  if version_input is distinct from private.billing_version(shop_input) then raise exception 'Billing changed; refresh the payment preview'; end if;
  if ends_input is null or shop.subscription_ends_at is not null or shop.subscription_status='trial'
    or exists(select 1 from private.cash_agreements where shop_id=shop_input) then raise exception 'Only undated legacy access can be reviewed'; end if;
  update public.restaurants set subscription_ends_at=ends_input where id=shop_input;
  insert into private.platform_audit_log(actor_id,actor_email,action,restaurant_id,restaurant_slug,details)
    values(auth.uid(),(select email from auth.users where id=auth.uid()),'billing.legacy_review',shop.id,shop.slug,
      jsonb_build_object('previous_ends_at',null,'ends_at',ends_input));
  return private.billing_payload(shop_input,true);
end;
$$;

create or replace function public.platform_void_cash_receipt(receipt_input uuid, reason_input text, request_input uuid, version_input text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  agreement private.cash_agreements%rowtype;
  receipt private.cash_receipts%rowtype;
  existing_void private.cash_receipt_voids%rowtype;
  calculated jsonb;
  caller_email text;
begin
  perform private.billing_require_admin(true);
  select * into strict receipt from private.cash_receipts where id=receipt_input;
  select * into strict agreement from private.cash_agreements where id=receipt.agreement_id;
  perform 1 from public.restaurants where id=agreement.shop_id for update;
  if not found then raise exception 'Archived shop receipts are read-only'; end if;
  select * into existing_void from private.cash_receipt_voids where id=request_input;
  if found then
    if existing_void.receipt_id<>receipt_input or existing_void.reason is distinct from trim(reason_input) or existing_void.actor_id<>auth.uid() then
      raise exception 'Correction request ID already used';
    end if;
    return private.billing_payload(agreement.shop_id,true);
  end if;
  if request_input is null or coalesce(length(trim(reason_input)),0) not between 3 and 2000 then raise exception 'A correction reason of 3 to 2000 characters is required'; end if;
  if version_input is distinct from private.billing_version(agreement.shop_id) then raise exception 'Billing changed; refresh before correcting the receipt'; end if;
  if agreement.id is distinct from (select id from private.cash_agreements where shop_id=agreement.shop_id order by sequence_number desc limit 1) then
    raise exception 'Only the latest agreement can be corrected';
  end if;
  if exists(select 1 from private.cash_receipt_voids where receipt_id=receipt_input) then raise exception 'Receipt already voided'; end if;
  select email into caller_email from auth.users where id=auth.uid();
  insert into private.cash_receipt_voids(id,receipt_id,reason,actor_id,actor_email) values(request_input,receipt_input,trim(reason_input),auth.uid(),caller_email);
  calculated:=private.billing_replay(agreement.id);
  update public.restaurants set subscription_ends_at=case
      when (calculated->>'payment_count')::integer=0 and agreement.baseline_status='trial' then null
      else (calculated->>'paid_until')::timestamptz end,
    subscription_status=case when subscription_status='suspended' then subscription_status
      when (calculated->>'payment_count')::integer=0 then agreement.baseline_status else 'active'::public.subscription_status end
    where id=agreement.shop_id;
  insert into private.platform_audit_log(actor_id,actor_email,action,restaurant_id,restaurant_slug,details)
    values(auth.uid(),caller_email,'billing.receipt_voided',agreement.shop_id,agreement.slug,
      jsonb_build_object('receipt_id',receipt_input,'reason',trim(reason_input),'ends_at',calculated->>'paid_until'));
  return private.billing_payload(agreement.shop_id,true);
end;
$$;

-- Retain the old signature for suspension/restoration compatibility, but never
-- extend dates. A cash receipt is the only way to purchase additional access.
create or replace function public.platform_set_subscription(restaurant_id_input uuid, status_input public.subscription_status, ends_at_input timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare shop public.restaurants%rowtype; restored public.subscription_status;
begin
  perform private.billing_require_admin(true);
  select * into shop from public.restaurants where id=restaurant_id_input for update;
  if not found then raise exception 'Shop not found'; end if;
  if status_input='active' then
    if shop.subscription_status<>'suspended' or ends_at_input is distinct from shop.subscription_ends_at then
      raise exception 'Record a cash payment to extend access';
    end if;
    restored:=case when shop.subscription_ends_at is null and shop.trial_ends_at is not null then 'trial' else 'active' end;
  elsif status_input='suspended' then restored:='suspended';
  else raise exception 'Trial dates cannot be changed through billing'; end if;
  update public.restaurants set subscription_status=restored where id=restaurant_id_input;
  insert into private.platform_audit_log(actor_id,actor_email,action,restaurant_id,restaurant_slug,details)
    values(auth.uid(),(select email from auth.users where id=auth.uid()),'subscription.'||restored::text,shop.id,shop.slug,
      jsonb_build_object('previous_ends_at',shop.subscription_ends_at,'ends_at',shop.subscription_ends_at));
end;
$$;

-- All non-operator accounts, including owners who have not created a shop.
-- Deleted owners/shops with a ledger remain discoverable as archived records.
create or replace function public.platform_subscribers(search_input text default '', page_input integer default 0)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare result jsonb; total_count bigint;
begin
  perform private.billing_require_admin();
  with owners as (
    select u.id,u.email,u.created_at,false as archived from auth.users u
      where not exists(select 1 from private.platform_admins p where p.user_id=u.id)
    union all
    select a.owner_id,max(a.owner_email),min(a.created_at),true from private.cash_agreements a
      where not exists(select 1 from auth.users u where u.id=a.owner_id) group by a.owner_id
  ), matching as (
    select o.* from owners o where coalesce(search_input,'')='' or o.email ilike '%'||search_input||'%'
      or exists(select 1 from public.restaurants r where r.owner_id=o.id and
        (r.name_en ilike '%'||search_input||'%' or r.name_ar ilike '%'||search_input||'%' or r.slug ilike '%'||search_input||'%' or r.whatsapp ilike '%'||search_input||'%'))
      or exists(select 1 from private.cash_agreements a where a.owner_id=o.id and
        (a.name_en ilike '%'||search_input||'%' or a.name_ar ilike '%'||search_input||'%' or a.slug ilike '%'||search_input||'%'))
  )
  select count(*) into total_count from matching;
  with owners as (
    select u.id,u.email,u.created_at,false as archived from auth.users u where not exists(select 1 from private.platform_admins p where p.user_id=u.id)
    union all
    select a.owner_id,max(a.owner_email),min(a.created_at),true from private.cash_agreements a where not exists(select 1 from auth.users u where u.id=a.owner_id) group by a.owner_id
  ), matching as (
    select o.* from owners o where coalesce(search_input,'')='' or o.email ilike '%'||search_input||'%'
      or exists(select 1 from public.restaurants r where r.owner_id=o.id and (r.name_en ilike '%'||search_input||'%' or r.name_ar ilike '%'||search_input||'%' or r.slug ilike '%'||search_input||'%' or r.whatsapp ilike '%'||search_input||'%'))
      or exists(select 1 from private.cash_agreements a where a.owner_id=o.id and (a.name_en ilike '%'||search_input||'%' or a.name_ar ilike '%'||search_input||'%' or a.slug ilike '%'||search_input||'%'))
    order by o.created_at desc,o.id limit 25 offset greatest(coalesce(page_input,0),0)*25
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'email',o.email,'created_at',o.created_at,'archived',o.archived,
    'shops',(select coalesce(jsonb_agg(private.billing_payload(s.id,true)-'agreements' order by s.name_en),'[]'::jsonb) from (
      select r.id,r.name_en from public.restaurants r where r.owner_id=o.id
      union all select historical.shop_id,historical.name_en from (
        select distinct on(a.shop_id) a.shop_id,a.name_en from private.cash_agreements a
        where a.owner_id=o.id and a.restaurant_id is null order by a.shop_id,a.sequence_number desc
      ) historical
    ) s)) order by o.created_at desc,o.id),'[]'::jsonb) into result from matching o;
  return jsonb_build_object('subscribers',result,'total',total_count,'page',greatest(coalesce(page_input,0),0),'page_size',25);
end;
$$;

create or replace function public.platform_cash_collections(from_input date, until_input date, page_input integer default 0)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare total_cash bigint; history jsonb; due jsonb; due_count bigint; daily jsonb;
begin
  perform private.billing_require_admin();
  if from_input is null or until_input is null or until_input < from_input then raise exception 'Enter a valid collection date range'; end if;
  select coalesce(sum(r.amount_cents),0) into total_cash from private.cash_receipts r
    where (r.collected_at at time zone 'Asia/Beirut')::date between from_input and until_input
      and not exists(select 1 from private.cash_receipt_voids v where v.receipt_id=r.id);
  select coalesce(jsonb_agg(to_jsonb(d) order by d.date desc),'[]'::jsonb) into daily from (
    select (r.collected_at at time zone 'Asia/Beirut')::date as date,
      sum(r.amount_cents) as collected_cents,count(*) as receipt_count
    from private.cash_receipts r where (r.collected_at at time zone 'Asia/Beirut')::date between from_input and until_input
      and not exists(select 1 from private.cash_receipt_voids v where v.receipt_id=r.id)
    group by (r.collected_at at time zone 'Asia/Beirut')::date
  ) d;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.collected_at desc,h.id desc),'[]'::jsonb) into history from (
    select r.id,r.amount_cents,r.collected_at,r.reference,a.name_en,a.name_ar,a.slug,a.owner_email,a.shop_id,
      exists(select 1 from private.cash_receipt_voids v where v.receipt_id=r.id) as voided
      from private.cash_receipts r join private.cash_agreements a on a.id=r.agreement_id
      where (r.collected_at at time zone 'Asia/Beirut')::date between from_input and until_input
      order by r.collected_at desc,r.id desc limit 25 offset greatest(coalesce(page_input,0),0)*25
  ) h;
  select count(*) into due_count from public.restaurants r where
    coalesce(case when r.subscription_status='trial' then r.trial_ends_at else r.subscription_ends_at end,'infinity')<=now()+interval '30 days';
  select coalesce(jsonb_agg(private.billing_payload(s.id,true)-'agreements' order by s.due_at,s.id),'[]'::jsonb) into due from (
    select r.id,case when r.subscription_status='trial' then r.trial_ends_at else r.subscription_ends_at end as due_at from public.restaurants r
      where coalesce(case when r.subscription_status='trial' then r.trial_ends_at else r.subscription_ends_at end,'infinity')<=now()+interval '30 days'
      order by due_at,r.id limit 25 offset greatest(coalesce(page_input,0),0)*25
  ) s;
  return jsonb_build_object('collected_cents',total_cash,'daily_totals',daily,'receipts',history,'due_shops',due,'due_total',due_count,
    'receipts_total',(select count(*) from private.cash_receipts r where (r.collected_at at time zone 'Asia/Beirut')::date between from_input and until_input));
end;
$$;

-- Explicit EXECUTE grants. Private helpers/tables are never callable directly.
revoke all on function private.billing_require_admin(boolean), private.billing_calendar_end(timestamptz,bigint,bigint),
  private.billing_replay(uuid,bigint,timestamptz,uuid),private.billing_version(uuid),private.billing_payload(uuid,boolean) from public,anon,authenticated;
revoke all on function public.platform_get_shop_billing(uuid),public.owner_get_shop_billing(uuid),
  public.platform_set_shop_price(uuid,bigint),public.platform_preview_cash_payment(uuid,bigint,timestamptz),
  public.platform_record_cash_payment(uuid,bigint,timestamptz,text,text,uuid,text),
  public.platform_void_cash_receipt(uuid,text,uuid,text),public.platform_subscribers(text,integer),
  public.platform_cash_collections(date,date,integer),public.platform_review_legacy_access(uuid,timestamptz,text),public.platform_set_subscription(uuid,public.subscription_status,timestamptz) from public,anon,authenticated;
grant execute on function public.platform_get_shop_billing(uuid),public.owner_get_shop_billing(uuid),
  public.platform_set_shop_price(uuid,bigint),public.platform_preview_cash_payment(uuid,bigint,timestamptz),
  public.platform_record_cash_payment(uuid,bigint,timestamptz,text,text,uuid,text),
  public.platform_void_cash_receipt(uuid,text,uuid,text),public.platform_subscribers(text,integer),
  public.platform_cash_collections(date,date,integer),public.platform_review_legacy_access(uuid,timestamptz,text),public.platform_set_subscription(uuid,public.subscription_status,timestamptz) to authenticated;
