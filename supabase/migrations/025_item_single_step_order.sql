-- Swap adjacent items atomically without rewriting their content or gallery selection.
create or replace function public.owner_move_menu_item(
  restaurant_id_input uuid, category_id_input uuid, item_id_input uuid, direction_input text
) returns setof public.menu_items
language plpgsql security invoker set search_path = '' as $$
declare
  ordered_ids uuid[];
  item_position integer;
  neighbor_position integer;
  neighbor_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if direction_input is null or direction_input not in ('up', 'down') then
    raise exception 'Invalid move direction';
  end if;
  -- Serialize reorders in this category and retain existing owner RLS on all writes.
  perform c.id from public.menu_categories c
    join public.restaurants r on r.id = c.restaurant_id
    where c.id = category_id_input and c.restaurant_id = restaurant_id_input
      and r.owner_id = auth.uid() for update of c;
  if not found then raise exception 'Category not found or not owned by you'; end if;
  perform i.id from public.menu_items i
    where i.restaurant_id = restaurant_id_input and i.category_id = category_id_input
    order by i.id for update;
  select array_agg(i.id order by i.sort_order, i.id) into ordered_ids
    from public.menu_items i
    where i.restaurant_id = restaurant_id_input and i.category_id = category_id_input;
  item_position := array_position(ordered_ids, item_id_input);
  if item_position is null then raise exception 'Item not found in this category'; end if;
  neighbor_position := item_position + case when direction_input = 'up' then -1 else 1 end;
  if neighbor_position < 1 or neighbor_position > cardinality(ordered_ids) then return; end if;
  neighbor_id := ordered_ids[neighbor_position];
  ordered_ids[neighbor_position] := item_id_input;
  ordered_ids[item_position] := neighbor_id;
  return query
    update public.menu_items i set sort_order = ordering.position::integer
    from unnest(ordered_ids) with ordinality as ordering(id, position)
    where i.id = ordering.id and i.restaurant_id = restaurant_id_input
      and i.category_id = category_id_input and i.sort_order <> ordering.position
    returning i.*;
end;
$$;

revoke all on function public.owner_move_menu_item(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.owner_move_menu_item(uuid,uuid,uuid,text) to authenticated;
