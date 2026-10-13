-- Admin-entered coverage dates replace proportional calendar grants.
-- No existing shop dates, prices, agreements or receipts are rewritten.

-- Preserve receipt periods literally, including pre-migration receipts.
-- A void removes that receipt's cash credit and expiry only. It never moves
-- the dates on another receipt or converts its amount into a duration.
create or replace function private.billing_replay(
  agreement_input uuid, extra_cents bigint default 0,
  extra_collected timestamptz default null, omit_receipt uuid default null
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  agreement private.cash_agreements%rowtype;
  payment record;
  paid bigint:=0;
  receipt_count integer:=0;
  paid_until timestamptz;
  coverage_from timestamptz;
  latest_collected timestamptz;
begin
  if extra_cents<>0 or extra_collected is not null then raise exception 'Enter access start and expiry dates manually'; end if;
  select * into strict agreement from private.cash_agreements where id=agreement_input;
  paid_until:=agreement.baseline_until;
  for payment in
    select r.* from private.cash_receipts r where r.agreement_id=agreement_input and r.id is distinct from omit_receipt
      and not exists(select 1 from private.cash_receipt_voids v where v.receipt_id=r.id)
    order by r.collected_at,r.created_at,r.id
  loop
    paid:=paid+payment.amount_cents; receipt_count:=receipt_count+1;
    paid_until:=greatest(paid_until,payment.coverage_until);
    coverage_from:=payment.coverage_from; latest_collected:=payment.collected_at;
  end loop;
  return jsonb_build_object('paid_cents',paid,'payment_count',receipt_count,'paid_until',paid_until,
    'coverage_from',coverage_from,'latest_collected',latest_collected);
end;
$$;

create or replace function public.platform_preview_manual_cash_payment(shop_input uuid, amount_input bigint, collected_input timestamptz, starts_input timestamptz, ends_input timestamptz)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare
  shop public.restaurants%rowtype;
  agreement private.cash_agreements%rowtype;
  price bigint;
  calculated jsonb;
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
  if collected_input is not null and not isfinite(collected_input) then raise exception 'Enter a valid Beirut date and time'; end if;
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

  else
    price:=agreement.annual_cents;
    if amount_input > price-paid then raise exception 'Cash amount exceeds the remaining annual balance'; end if;
    baseline:=case when shop.subscription_status='trial' or (shop.subscription_status='suspended' and shop.subscription_ends_at is null) then shop.trial_ends_at else shop.subscription_ends_at end;
  end if;
  if amount_input > price-paid then raise exception 'Cash amount exceeds the remaining annual balance'; end if;
  if count_paid >= 3 then raise exception 'Maximum three payments per agreement'; end if;
  if count_paid=2 and amount_input<>price-paid then raise exception 'The third payment must settle the remaining balance'; end if;
  -- Dates are chosen explicitly; the amount never determines access duration.
  if starts_input is null or ends_input is null or not isfinite(starts_input) or not isfinite(ends_input) then
    raise exception 'Enter access start and expiry dates manually';
  end if;
  -- The form displays minutes. Choosing the current expiry keeps its original
  -- seconds/microseconds rather than shortening or extending existing access.
  if baseline is not null and ends_input < baseline and ends_input >= date_trunc('minute',baseline) then
    ends_input:=baseline;
  end if;
  if ends_input <= starts_input or ends_input <= collected_input then
    raise exception 'Expiry must be after the access start and collection date';
  end if;
  if baseline is not null and ends_input < baseline then
    raise exception 'Expiry cannot shorten existing trial or paid access';
  end if;
  if starts_input > greatest(collected_input,coalesce(baseline,collected_input)) then
    raise exception 'Access start cannot leave a future gap after current access';
  end if;
  starts:=starts_input; ends:=ends_input;
  return jsonb_build_object('restaurant_id',shop_input,'annual_cents',price,'amount_cents',amount_input,
    'collected_at',collected_input,'previous_paid_until',case when shop.subscription_status='trial' then shop.trial_ends_at else shop.subscription_ends_at end,
    'coverage_from',starts,'paid_until',ends,'remaining_cents',price-paid-amount_input,'payment_count',count_paid+1,
    'version',private.billing_version(shop_input),'suspended',shop.subscription_status='suspended','is_published',shop.is_published);
end;
$$;

create or replace function public.platform_record_manual_cash_payment(
  shop_input uuid, amount_input bigint, collected_input timestamptz, starts_input timestamptz, ends_input timestamptz,
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
      or receipt.coverage_from is distinct from starts_input or receipt.coverage_until is distinct from ends_input
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
  quote:=public.platform_preview_manual_cash_payment(shop_input,amount_input,collected_input,starts_input,ends_input);
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
      jsonb_build_object('receipt_id',request_input,'amount_cents',amount_input,'reference',trim(reference_input),'starts_at',starts_input,'ends_at',ends_input,'access_dates','manual'));
  return private.billing_payload(shop_input,true);
end;
$$;

-- Block old clients explicitly instead of allowing automatic duration grants.
create or replace function public.platform_preview_cash_payment(shop_input uuid, amount_input bigint, collected_input timestamptz)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  perform private.billing_require_admin(true);
  raise exception 'Enter access start and expiry dates manually';
end;
$$;
create or replace function public.platform_record_cash_payment(
  shop_input uuid, amount_input bigint, collected_input timestamptz,
  reference_input text, note_input text, request_input uuid, version_input text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare receipt private.cash_receipts%rowtype;
begin
  perform private.billing_require_admin(true);
  perform 1 from public.restaurants where id=shop_input for update;
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
  raise exception 'Enter access start and expiry dates manually';
end;
$$;

revoke all on function private.billing_replay(uuid,bigint,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.platform_preview_manual_cash_payment(uuid,bigint,timestamptz,timestamptz,timestamptz) from public,anon;
revoke all on function public.platform_record_manual_cash_payment(uuid,bigint,timestamptz,timestamptz,timestamptz,text,text,uuid,text) from public,anon;
grant execute on function public.platform_preview_manual_cash_payment(uuid,bigint,timestamptz,timestamptz,timestamptz) to authenticated;
grant execute on function public.platform_record_manual_cash_payment(uuid,bigint,timestamptz,timestamptz,timestamptz,text,text,uuid,text) to authenticated;
notify pgrst, 'reload schema';
