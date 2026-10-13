-- Migration 029: protected storage reporting for the platform console. The Storage service
-- keeps object metadata in Postgres, so the report can be calculated without
-- exposing a service-role key or a Supabase Management API token to the app.

create or replace function public.platform_storage_usage()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform access required';
  end if;

  with object_sizes as (
    select
      o.bucket_id,
      o.name,
      case
        when coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
          then (o.metadata->>'size')::bigint
        else 0::bigint
      end as size_bytes
    from storage.objects o
  ),
  bucket_totals as (
    select bucket_id, count(*)::bigint as file_count, coalesce(sum(size_bytes), 0)::bigint as bytes
    from object_sizes
    group by bucket_id
  ),
  menu_objects as (
    select
      name,
      size_bytes,
      split_part(name, '/', 1) as restaurant_id_text
    from object_sizes
    where bucket_id = 'menu-assets'
  ),
  restaurant_totals as (
    select
      r.id as restaurant_id,
      r.owner_id,
      r.name_en,
      r.name_ar,
      r.slug,
      count(m.name)::bigint as file_count,
      coalesce(sum(m.size_bytes), 0)::bigint as bytes
    from public.restaurants r
    left join menu_objects m on m.restaurant_id_text = r.id::text
    group by r.id, r.owner_id, r.name_en, r.name_ar, r.slug
  ),
  owner_totals as (
    select
      r.owner_id,
      coalesce(u.email::text, 'Archived owner') as owner_email,
      sum(r.file_count)::bigint as file_count,
      sum(r.bytes)::bigint as bytes,
      jsonb_agg(
        jsonb_build_object(
          'restaurant_id', r.restaurant_id,
          'name_en', r.name_en,
          'name_ar', r.name_ar,
          'slug', r.slug,
          'file_count', r.file_count,
          'bytes', r.bytes
        ) order by r.name_en, r.restaurant_id
      ) as restaurants
    from restaurant_totals r
    left join auth.users u on u.id = r.owner_id
    group by r.owner_id, u.email
  ),
  all_totals as (
    select count(*)::bigint as file_count, coalesce(sum(size_bytes), 0)::bigint as bytes
    from object_sizes
  ),
  menu_totals as (
    select count(*)::bigint as file_count, coalesce(sum(size_bytes), 0)::bigint as bytes
    from menu_objects
  ),
  attributed_menu_totals as (
    select coalesce(sum(file_count), 0)::bigint as file_count, coalesce(sum(bytes), 0)::bigint as bytes
    from restaurant_totals
  )
  select jsonb_build_object(
    'generated_at', now(),
    'total_files', all_totals.file_count,
    'used_bytes', all_totals.bytes,
    'buckets', coalesce((
      select jsonb_agg(
        jsonb_build_object('bucket_id', bucket_id, 'file_count', file_count, 'bytes', bytes)
        order by bucket_id
      )
      from bucket_totals
    ), '[]'::jsonb),
    'owners', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'owner_id', owner_id,
          'owner_email', owner_email,
          'file_count', file_count,
          'bytes', bytes,
          'restaurants', restaurants
        ) order by owner_email, owner_id
      )
      from owner_totals
    ), '[]'::jsonb),
    'unattributed_menu_files', greatest(menu_totals.file_count - attributed_menu_totals.file_count, 0),
    'unattributed_menu_bytes', greatest(menu_totals.bytes - attributed_menu_totals.bytes, 0),
    'shared_gallery_files', coalesce((select file_count from bucket_totals where bucket_id = 'gallery-assets'), 0),
    'shared_gallery_bytes', coalesce((select bytes from bucket_totals where bucket_id = 'gallery-assets'), 0)
  ) into result
  from all_totals, menu_totals, attributed_menu_totals;

  return result;
end;
$$;

revoke all on function public.platform_storage_usage() from public, anon, authenticated;
grant execute on function public.platform_storage_usage() to authenticated;
