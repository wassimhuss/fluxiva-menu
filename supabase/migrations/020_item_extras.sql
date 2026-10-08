-- Optional, bilingual add-ons for menu items. Each extra is stored as
-- { id, name_en, name_ar, price } and adds to the base or selected size price.
alter table public.menu_items
  add column if not exists extras jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_items_extras_is_array'
      and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_extras_is_array
      check (jsonb_typeof(extras) = 'array');
  end if;
end $$;
