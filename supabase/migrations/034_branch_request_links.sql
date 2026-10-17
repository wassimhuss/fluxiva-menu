-- Super admins can correct a pending request's menu slug before approval.
create or replace function public.platform_update_branch_request_link(
  request_input uuid, slug_input text, previous_slug_input text
)
returns void language plpgsql security definer set search_path='' as $$
declare request private.branch_requests%rowtype; next_slug text:=trim(slug_input);
begin
  perform private.billing_require_admin(true);
  select * into request from private.branch_requests where id=request_input for update;
  if not found or request.status<>'pending' then raise exception 'Only pending branch requests can be edited'; end if;
  if request.slug is distinct from previous_slug_input then raise exception 'The request link changed. Refresh and try again.'; end if;
  if next_slug is null or length(next_slug)>100 or next_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Use lowercase letters, numbers and single hyphens for the menu link';
  end if;
  if next_slug=request.slug then return; end if;
  if exists(select 1 from public.restaurants where slug=next_slug) then raise exception 'This menu link is already taken. Choose a different one.'; end if;
  if exists(select 1 from private.branch_requests where owner_id=request.owner_id and slug=next_slug and id<>request.id and status in ('pending','approved')) then
    raise exception 'A request for this menu link is already pending or approved';
  end if;
  begin
    update private.branch_requests set slug=next_slug where id=request.id;
  exception when unique_violation then
    raise exception 'A request for this menu link is already pending or approved';
  end;
  insert into private.platform_audit_log(actor_id,actor_email,action,details)
    values(auth.uid(),(select email from auth.users where id=auth.uid()),'branch.link_updated',
      jsonb_build_object('owner_id',request.owner_id,'request_id',request.id,'previous_slug',request.slug,'slug',next_slug));
end;
$$;

-- Approval/rejection is tied to the exact link the operator reviewed. Another
-- admin's edit cannot silently change the branch authorized by this decision.
create or replace function public.platform_review_branch_request_with_link(
  request_input uuid, approve_input boolean, note_input text, expected_slug_input text
)
returns void language plpgsql security definer set search_path='' as $$
declare request private.branch_requests%rowtype;
begin
  perform private.billing_require_admin(true);
  select * into request from private.branch_requests where id=request_input for update;
  if not found or request.status<>'pending' then raise exception 'This request has already been reviewed or removed'; end if;
  if request.slug is distinct from expected_slug_input then raise exception 'The request link changed. Refresh and try again.'; end if;
  perform public.platform_review_branch_request(request_input,approve_input,note_input);
end;
$$;

revoke all on function public.platform_update_branch_request_link(uuid,text,text),public.platform_review_branch_request_with_link(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.platform_update_branch_request_link(uuid,text,text),public.platform_review_branch_request_with_link(uuid,boolean,text,text) to authenticated;
notify pgrst,'reload schema';
