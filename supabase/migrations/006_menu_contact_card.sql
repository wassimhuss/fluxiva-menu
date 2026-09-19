-- Contact details for a menu that is not currently being served.
--
-- Once a subscription or trial lapses, RLS hides the restaurant row entirely,
-- so the public menu page has nothing to show but a dead end — while a customer
-- is standing in front of a printed QR code. This returns just enough to reach
-- the restaurant.
--
-- Deliberately does NOT report why the menu is unavailable. Billing state is
-- between the restaurant and Fluxiva; a diner should never be shown it. The
-- fields returned are ones the restaurant already publishes on its live menu.
create or replace function public.menu_contact_card(slug_input text)
returns table (
  name_en text,
  name_ar text,
  logo_url text,
  primary_color text,
  phone text,
  whatsapp text,
  instagram text,
  default_language text
) language plpgsql security definer stable set search_path = '' as $$
begin
  return query
    select r.name_en, r.name_ar, r.logo_url, r.primary_color,
           r.phone, r.whatsapp, r.instagram, r.default_language
      from public.restaurants r
     where r.slug = slug_input;
end;
$$;

revoke all on function public.menu_contact_card(text) from public;
grant execute on function public.menu_contact_card(text) to anon, authenticated;
