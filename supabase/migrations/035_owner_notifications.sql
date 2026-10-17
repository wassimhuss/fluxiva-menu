-- Account-scoped in-app broadcasts. No email/WhatsApp delivery or public reads.
create table if not exists private.platform_announcements (
  id uuid primary key,
  title_en text not null check(length(trim(title_en)) between 1 and 200),
  title_ar text not null check(length(trim(title_ar)) between 1 and 200),
  body_en text not null check(length(trim(body_en)) between 1 and 5000),
  body_ar text not null check(length(trim(body_ar)) between 1 and 5000),
  created_at timestamptz not null default now(),
  actor_id uuid not null, actor_email text,
  recipient_count integer not null default 0
);
create table if not exists private.owner_notifications (
  announcement_id uuid not null references private.platform_announcements(id),
  owner_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  primary key(announcement_id,owner_id)
);
create index if not exists owner_notifications_owner on private.owner_notifications(owner_id,announcement_id);
alter table private.platform_announcements enable row level security;
alter table private.owner_notifications enable row level security;
revoke all on private.platform_announcements,private.owner_notifications from public,anon,authenticated;

create or replace function public.platform_send_announcement(request_input uuid,input_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.platform_announcements%rowtype; recipients integer;
begin
  perform private.billing_require_admin(true);
  if request_input is null or jsonb_typeof(input_data) is distinct from 'object'
    or nullif(trim(input_data->>'title_en'),'') is null or length(input_data->>'title_en')>200
    or nullif(trim(input_data->>'title_ar'),'') is null or length(input_data->>'title_ar')>200
    or nullif(trim(input_data->>'body_en'),'') is null or length(input_data->>'body_en')>5000
    or nullif(trim(input_data->>'body_ar'),'') is null or length(input_data->>'body_ar')>5000 then
    raise exception 'Enter both titles and both messages within the character limits.';
  end if;
  -- Retrying an uncertain send cannot broadcast a second copy.
  perform pg_advisory_xact_lock(hashtextextended(request_input::text,0));
  select * into existing from private.platform_announcements where id=request_input;
  if found then
    if existing.actor_id<>auth.uid() or existing.title_en<>trim(input_data->>'title_en') or existing.title_ar<>trim(input_data->>'title_ar')
      or existing.body_en<>trim(input_data->>'body_en') or existing.body_ar<>trim(input_data->>'body_ar') then
      raise exception 'This send ID was already used. Refresh sent messages before sending again.';
    end if;
    return jsonb_build_object('id',existing.id,'recipient_count',existing.recipient_count);
  end if;
  insert into private.platform_announcements(id,title_en,title_ar,body_en,body_ar,actor_id,actor_email)
    values(request_input,trim(input_data->>'title_en'),trim(input_data->>'title_ar'),trim(input_data->>'body_en'),trim(input_data->>'body_ar'),auth.uid(),(select email from auth.users where id=auth.uid()));
  insert into private.owner_notifications(announcement_id,owner_id)
    select request_input,u.id from auth.users u where not exists(select 1 from private.platform_admins a where a.user_id=u.id);
  get diagnostics recipients=row_count;
  if recipients=0 then raise exception 'There are no owner accounts to notify.'; end if;
  update private.platform_announcements set recipient_count=recipients where id=request_input;
  insert into private.platform_audit_log(actor_id,actor_email,action,details)
    values(auth.uid(),(select email from auth.users where id=auth.uid()),'announcement.sent',jsonb_build_object('announcement_id',request_input,'recipient_count',recipients));
  return jsonb_build_object('id',request_input,'recipient_count',recipients);
end;
$$;

create or replace function public.platform_list_announcements(page_input integer default 0)
returns jsonb language plpgsql security definer stable set search_path='' as $$
declare result jsonb; page_number integer:=least(greatest(coalesce(page_input,0),0),1000000);
begin
  perform private.billing_require_admin();
  select jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id) from (
    select a.*, (select count(*) from private.owner_notifications n where n.announcement_id=a.id and n.read_at is not null) as read_count
    from private.platform_announcements a order by created_at desc,id limit 25 offset page_number*25
  ) p),'[]'::jsonb),'total',(select count(*) from private.platform_announcements),'page',page_number,'page_size',25) into result;
  return result;
end;
$$;

create or replace function public.owner_notifications(page_input integer default 0)
returns jsonb language plpgsql security definer stable set search_path='' as $$
declare result jsonb; page_number integer:=least(greatest(coalesce(page_input,0),0),1000000);
begin
  if auth.uid() is null or public.is_platform_admin() then raise exception 'Owner access required'; end if;
  select jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id) from (
    select a.id,a.title_en,a.title_ar,a.body_en,a.body_ar,a.created_at,n.read_at
    from private.owner_notifications n join private.platform_announcements a on a.id=n.announcement_id
    where n.owner_id=auth.uid() order by a.created_at desc,a.id limit 25 offset page_number*25
  ) p),'[]'::jsonb),'total',(select count(*) from private.owner_notifications where owner_id=auth.uid()),
    'unread_count',(select count(*) from private.owner_notifications where owner_id=auth.uid() and read_at is null),
    'pending_requests',(select count(*) from private.branch_requests where owner_id=auth.uid() and status='pending'),
    'approved_requests',(select count(*) from private.branch_requests where owner_id=auth.uid() and status='approved'),
    'page',page_number,'page_size',25) into result;
  return result;
end;
$$;

create or replace function public.owner_read_notification(message_input uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or public.is_platform_admin() then raise exception 'Owner access required'; end if;
  update private.owner_notifications set read_at=coalesce(read_at,now()) where announcement_id=message_input and owner_id=auth.uid();
  if not found then raise exception 'This notification is unavailable.'; end if;
end;
$$;

revoke all on function public.platform_send_announcement(uuid,jsonb),public.platform_list_announcements(integer),public.owner_notifications(integer),public.owner_read_notification(uuid) from public,anon,authenticated;
grant execute on function public.platform_send_announcement(uuid,jsonb),public.platform_list_announcements(integer),public.owner_notifications(integer),public.owner_read_notification(uuid) to authenticated;
notify pgrst,'reload schema';
