-- Prices in both currencies are entered manually. Preserve every existing
-- amount, including missing alternates, and all existing access policies.
comment on column public.menu_items.price_secondary is 'Manual alternate currency price: USD for LBP menus, LBP for USD menus; null means not entered. No automatic conversion.';

-- Keep the signature used by migration 036's currency-swap trigger. A primary
-- currency switch may swap entered pairs, but must never invent missing prices.
create or replace function public.menu_price_other(amount numeric, alternate numeric, from_currency text)
returns numeric language plpgsql immutable parallel safe set search_path='' as $$
begin
  if alternate is null then
    raise exception 'Enter both LBP and USD prices for every item, size and extra before changing currency.';
  end if;
  return alternate;
end;
$$;

notify pgrst,'reload schema';
