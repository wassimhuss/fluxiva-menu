-- Preserve the existing filtered directory and add review status to its page.
create or replace function public.platform_subscribers_with_review(search_input text default '',filters_input jsonb default '{}'::jsonb,page_input integer default 0)
returns jsonb language plpgsql security definer stable set search_path='' as $$
declare result jsonb; subscribers jsonb;
begin
  perform private.billing_require_admin();
  result:=public.platform_search_subscribers(search_input,filters_input,page_input);
  select coalesce(jsonb_agg(entry||jsonb_build_object(
    'registration_status',case when (entry->>'archived')::boolean then null when review.owner_id is not null then 'approved' else 'pending' end,
    'registration_reviewed_at',review.reviewed_at) order by position),'[]'::jsonb)
    into subscribers from jsonb_array_elements(result->'subscribers') with ordinality as j(entry,position)
    left join private.shop_registration_reviews review on review.owner_id=(entry->>'id')::uuid;
  return jsonb_set(result,'{subscribers}',subscribers);
end;
$$;
revoke all on function public.platform_subscribers_with_review(text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.platform_subscribers_with_review(text,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
