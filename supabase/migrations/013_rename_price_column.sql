-- `price_lbp` was named when every menu was priced in Lebanese pounds. Since
-- 012 each restaurant chooses its currency, so the column now holds dollars
-- as often as pounds and the name actively misleads.
--
-- Safe to do as a plain rename rather than a compatibility shim: there is one
-- restaurant in this database and it is the demo. Apply this and deploy the
-- matching build together — between the two, the menu cannot read prices.

alter table public.menu_items rename column price_lbp to price;

-- The check constraint's expression follows the rename on its own; only its
-- name is left pointing at the old column.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'menu_items_price_lbp_check'
      and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      rename constraint menu_items_price_lbp_check to menu_items_price_check;
  end if;
end $$;

-- Variant prices are keys inside a jsonb array, so they need rewriting rather
-- than renaming. `with ordinality` keeps the sizes in the order the owner set
-- them; rebuilding with jsonb_agg alone does not promise that.
update public.menu_items
set variants = (
  select coalesce(
    jsonb_agg(
      (variant - 'price_lbp') || jsonb_build_object('price', variant -> 'price_lbp')
      order by position
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(menu_items.variants) with ordinality as entry(variant, position)
)
where jsonb_path_exists(variants, '$[*].price_lbp');
