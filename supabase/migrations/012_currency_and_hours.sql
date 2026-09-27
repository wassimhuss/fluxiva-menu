-- Prices in the currency the restaurant actually charges in, and opening hours
-- the menu can show.
--
-- Lebanese menus are widely priced in dollars now, so the amount a restaurant
-- types is no longer necessarily Lebanese pounds. Two consequences:
--
--   * `menu_items.price_lbp` was `bigint`, which cannot hold 3.50. Widened to
--     numeric so a dollar price keeps its cents. Existing whole-pound values
--     convert exactly.
--   * The column name is now a misnomer — it holds the price in whichever
--     currency the restaurant selected. Renaming it reaches the public menu,
--     the dashboard, the order basket and every template, so it is left alone
--     here deliberately rather than churned mid-feature.
--
-- Switching currency does not convert existing prices: there is no honest rate
-- to apply, and silently rewriting every price would be far worse than asking
-- the owner to check them. The dashboard says so at the point of change.

alter table public.restaurants
  add column if not exists currency text not null default 'LBP'
  check (currency in ('LBP', 'USD'));

-- Hours are shown to diners in both menu languages, like every other field.
alter table public.restaurants
  add column if not exists opening_hours_ar text;

alter table public.menu_items
  alter column price_lbp type numeric(12, 2);

-- Variant prices live in a jsonb array and already carry decimals.
