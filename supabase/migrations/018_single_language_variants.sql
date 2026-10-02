-- Size labels such as S, M, L, 250 ml, and Family are intentionally shared
-- between the English and Arabic menus. Remove the redundant Arabic value
-- from existing JSON and prevent older clients from adding it again.

update public.menu_items
set variants = (
  select coalesce(
    jsonb_agg(variant - 'name_ar' order by position),
    '[]'::jsonb
  )
  from jsonb_array_elements(menu_items.variants) with ordinality as entry(variant, position)
)
where jsonb_path_exists(variants, '$[*].name_ar');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_items_variants_no_arabic_name'
      and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_variants_no_arabic_name
      check (not jsonb_path_exists(variants, '$[*].name_ar'));
  end if;
end $$;
