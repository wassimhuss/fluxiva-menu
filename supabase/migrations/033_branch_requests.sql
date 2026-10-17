-- Owners request additional branches; one approval authorizes one exact slug.
create table if not exists private.branch_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name_en text not null, name_ar text not null, slug text not null,
  address_en text not null, address_ar text not null, whatsapp text,
  status text not null default 'pending' check(status in ('pending','approved','rejected','created')),
  decision_note text not null default '' check(length(decision_note)<=1000),
  created_at timestamptz not null default now(), reviewed_at timestamptz,
  reviewed_by uuid, restaurant_id uuid
);
create unique index if not exists branch_requests_open_slug on private.branch_requests(owner_id,slug) where status in ('pending','approved');
create index if not exists branch_requests_owner on private.branch_requests(owner_id,created_at desc);
alter table private.branch_requests enable row level security;
revoke all on private.branch_requests from public,anon,authenticated;

create or replace function public.owner_request_branch(input_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if auth.uid() is null or public.is_platform_admin() then raise exception 'Shop ownership required'; end if;
  perform 1 from public.brands where owner_id=auth.uid() for update;
  if not exists(select 1 from public.restaurants where owner_id=auth.uid()) then raise exception 'Create your first restaurant before requesting a branch'; end if;
  if exists(select 1 from public.restaurants r where r.owner_id=auth.uid() and not public.subscription_is_live(r.subscription_status,r.trial_ends_at,r.subscription_ends_at)) then
    raise exception 'Resolve expired or suspended shops before adding another place';
  end if;
  if jsonb_typeof(input_data) is distinct from 'object'
    or nullif(trim(input_data->>'name_en'),'') is null or nullif(trim(input_data->>'name_ar'),'') is null
    or nullif(trim(input_data->>'address_en'),'') is null or nullif(trim(input_data->>'address_ar'),'') is null
    or coalesce(input_data->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or length(input_data->>'slug')>100 or length(input_data->>'name_en')>200 or length(input_data->>'name_ar')>200
    or length(input_data->>'address_en')>1000 or length(input_data->>'address_ar')>1000 or length(input_data->>'whatsapp')>100 then
    raise exception 'Enter both names, both addresses and a menu link.';
  end if;
  if exists(select 1 from public.restaurants where slug=input_data->>'slug') then raise exception 'This menu link is already taken. Choose a different one.'; end if;
  if exists(select 1 from private.branch_requests where owner_id=auth.uid() and slug=input_data->>'slug' and status in ('pending','approved')) then
    raise exception 'A request for this menu link is already pending or approved';
  end if;
  insert into private.branch_requests(owner_id,name_en,name_ar,slug,address_en,address_ar,whatsapp)
    values(auth.uid(),trim(input_data->>'name_en'),trim(input_data->>'name_ar'),input_data->>'slug',trim(input_data->>'address_en'),trim(input_data->>'address_ar'),nullif(trim(input_data->>'whatsapp'),'')) returning id into result;
  return result;
end;
$$;

create or replace function public.list_branch_requests(admin_input boolean default false,page_input integer default 0)
returns jsonb language plpgsql security definer stable set search_path='' as $$
declare result jsonb;
begin
  if admin_input then perform private.billing_require_admin();
  elsif auth.uid() is null then raise exception 'Shop ownership required'; end if;
  with matching as materialized (
    select r.*,u.email as owner_email from private.branch_requests r join auth.users u on u.id=r.owner_id
    where admin_input or r.owner_id=auth.uid()
  ), paged as (
    select * from matching order by (status='pending') desc,created_at desc,id
      limit 25 offset least(greatest(coalesce(page_input,0),0),1000000)*25
  ) select jsonb_build_object('requests',coalesce((select jsonb_agg(to_jsonb(p) order by (status='pending') desc,created_at desc,id) from paged p),'[]'::jsonb),
    'total',(select count(*) from matching),'pending_count',(select count(*) from matching where status='pending'),
    'page',least(greatest(coalesce(page_input,0),0),1000000),'page_size',25) into result;
  return result;
end;
$$;

create or replace function public.platform_review_branch_request(request_input uuid,approve_input boolean,note_input text default '')
returns void language plpgsql security definer set search_path='' as $$
declare request private.branch_requests%rowtype;
begin
  perform private.billing_require_admin(true);
  if approve_input is null or length(coalesce(note_input,''))>1000 then raise exception 'Enter a decision and a note under 1000 characters'; end if;
  select * into request from private.branch_requests where id=request_input for update;
  if not found or request.status<>'pending' then raise exception 'This request has already been reviewed or removed'; end if;
  update private.branch_requests set status=case when approve_input then 'approved' else 'rejected' end,
    decision_note=trim(coalesce(note_input,'')),reviewed_at=now(),reviewed_by=auth.uid() where id=request_input;
  insert into private.platform_audit_log(actor_id,actor_email,action,details)
    values(auth.uid(),(select email from auth.users where id=auth.uid()),case when approve_input then 'branch.approved' else 'branch.rejected' end,
      jsonb_build_object('owner_id',request.owner_id,'request_id',request.id,'slug',request.slug,'reason',trim(coalesce(note_input,''))));
end;
$$;

-- Also runs inside the security-definer menu-copy RPC. The caller's role is
-- preserved by the role GUC; serializing on the brand prevents duplicate use.
create or replace function private.require_branch_approval()
returns trigger language plpgsql security definer set search_path='' as $$
declare approved_id uuid;
begin
  if coalesce(current_setting('role',true),'none') not in ('authenticated','anon') or public.is_platform_super_admin() then return new; end if;
  if auth.uid() is null or new.owner_id is distinct from auth.uid() then raise exception 'Shop ownership required'; end if;
  perform 1 from public.brands where owner_id=new.owner_id for update;
  if not exists(select 1 from public.restaurants where owner_id=new.owner_id) then return new; end if;
  select id into approved_id from private.branch_requests where owner_id=new.owner_id and slug=new.slug and status='approved' for update;
  if approved_id is null then raise exception 'Request approval before creating another branch'; end if;
  update private.branch_requests set status='created',restaurant_id=new.id where id=approved_id;
  return new;
end;
$$;
revoke all on function private.require_branch_approval() from public,anon,authenticated;
drop trigger if exists zz_branch_approval_guard on public.restaurants;
create trigger zz_branch_approval_guard before insert on public.restaurants for each row execute function private.require_branch_approval();

-- A failed personal-photo copy may be rolled back by the owner. Restore its
-- authorization only for an unfinished copy; normal branch deletion never does.
create or replace function private.restore_failed_branch_approval()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.menu_copy_pending then update private.branch_requests set status='approved',restaurant_id=null where restaurant_id=old.id and status='created'; end if;
  return old;
end;
$$;
revoke all on function private.restore_failed_branch_approval() from public,anon,authenticated;
drop trigger if exists branch_copy_approval_restore on public.restaurants;
create trigger branch_copy_approval_restore after delete on public.restaurants for each row execute function private.restore_failed_branch_approval();

revoke all on function public.owner_request_branch(jsonb),public.list_branch_requests(boolean,integer),public.platform_review_branch_request(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.owner_request_branch(jsonb),public.list_branch_requests(boolean,integer),public.platform_review_branch_request(uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
