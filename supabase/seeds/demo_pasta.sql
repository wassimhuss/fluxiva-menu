-- Approved demo content only; not a schema migration.
-- Run in a transaction. Re-running adds no duplicate categories/items and
-- only moves/reprices the explicitly approved existing Fettuccine Alfredo.
-- Other items, restaurants, gallery records and files remain unchanged.
do $pasta$
declare
  demo_id constant uuid := '00000000-0000-0000-0000-000000000001';
  folder_id constant uuid := '4e5a41ae-e87d-4a82-94f5-9098c0853992';
  pasta_id uuid;
  last_rank integer;
  category_ids uuid[];
  item_ids uuid[];
  saved_categories jsonb;
  saved_items jsonb;
  moved_id uuid;
  moved_content jsonb;
begin
  perform 1 from public.restaurants where id=demo_id and slug='demo' and currency='LBP' for update;
  if not found then raise exception 'Expected LBP demo restaurant not found'; end if;
  if not exists(select 1 from public.gallery_categories where id=folder_id and active)
    or (select count(*) from public.gallery_images where category_id=folder_id and active)<>13 then
    raise exception 'Expected 13 active pasta gallery images';
  end if;

  select array_agg(id),jsonb_agg(to_jsonb(c) order by id) into category_ids,saved_categories
    from public.menu_categories c where restaurant_id=demo_id;
  if (select count(*) from public.menu_categories where restaurant_id=demo_id and lower(trim(name_en)) in ('pasta','pastas'))>1 then
    raise exception 'Multiple pasta categories need manual review';
  end if;
  select id into pasta_id from public.menu_categories
    where restaurant_id=demo_id and lower(trim(name_en)) in ('pasta','pastas');
  if pasta_id is null then
    insert into public.menu_categories(restaurant_id,name_en,name_ar,sort_order)
      select demo_id,'Pasta','باستا',coalesce(max(sort_order),0)+1
      from public.menu_categories where restaurant_id=demo_id returning id into pasta_id;
  end if;
  if (select count(*) from public.menu_items i join public.menu_categories c on c.id=i.category_id
    where i.restaurant_id=demo_id and c.name_en='Manakish' and i.name_en='Fettuccine Alfredo'
      and i.gallery_image_id='55eab2b8-d33b-4d52-bab0-9882cdf9254b')>1 then
    raise exception 'Multiple existing Alfredo dishes need manual review';
  end if;
  select i.id,to_jsonb(i)-array['category_id','price','sort_order','updated_at'] into moved_id,moved_content
    from public.menu_items i join public.menu_categories c on c.id=i.category_id
    where i.restaurant_id=demo_id and c.name_en='Manakish' and i.name_en='Fettuccine Alfredo'
      and i.gallery_image_id='55eab2b8-d33b-4d52-bab0-9882cdf9254b';
  select array_agg(id),jsonb_agg(to_jsonb(i) order by id) into item_ids,saved_items
    from public.menu_items i where restaurant_id=demo_id and id is distinct from moved_id;
  if exists(select 1 from public.menu_items i join public.gallery_images g on g.id=i.gallery_image_id
    where i.restaurant_id=demo_id and g.category_id=folder_id and g.active and i.category_id<>pasta_id and i.id is distinct from moved_id) then
    raise exception 'A pasta photo is already used in another category; no existing items will be moved';
  end if;
  if moved_id is not null then
    if exists(select 1 from public.menu_items where category_id=pasta_id and gallery_image_id='55eab2b8-d33b-4d52-bab0-9882cdf9254b') then
      raise exception 'An Alfredo dish already exists in Pasta';
    end if;
    update public.menu_items set category_id=pasta_id,price=500000,
      sort_order=(select coalesce(max(sort_order),0)+1 from public.menu_items where category_id=pasta_id)
      where id=moved_id;
    if moved_content is distinct from (select to_jsonb(i)-array['category_id','price','sort_order','updated_at'] from public.menu_items i where id=moved_id) then
      raise exception 'Existing Alfredo content changed unexpectedly';
    end if;
  end if;
  select coalesce(max(sort_order),0) into last_rank from public.menu_items where category_id=pasta_id;
  insert into public.menu_items(restaurant_id,category_id,name_en,name_ar,price,image_url,gallery_image_id,available,sort_order)
    select demo_id,pasta_id,g.name_en,g.name_ar,500000,g.image_url,g.id,true,
      last_rank+(row_number() over(order by g.name_en,g.id))::integer
    from public.gallery_images g
    where g.category_id=folder_id and g.active and not exists(
      select 1 from public.menu_items i where i.restaurant_id=demo_id and i.gallery_image_id=g.id);

  if (select count(*) from public.menu_items where restaurant_id=demo_id and category_id=pasta_id)<>13 then
    raise exception 'Expected exactly 13 pasta dishes';
  end if;
  if saved_categories is distinct from (select jsonb_agg(to_jsonb(c) order by id) from public.menu_categories c where id=any(category_ids))
    or saved_items is distinct from (select jsonb_agg(to_jsonb(i) order by id) from public.menu_items i where id=any(item_ids)) then
    raise exception 'Existing demo content changed; roll back';
  end if;
end $pasta$;
