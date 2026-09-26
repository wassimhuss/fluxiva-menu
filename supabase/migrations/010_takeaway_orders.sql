-- Lets a restaurant collect takeaway orders as a WhatsApp message.
--
-- Off by default: the order button sends the diner to the owner's WhatsApp, so
-- a restaurant that has not agreed to answer those messages must not advertise
-- the option. The public menu additionally hides it whenever `whatsapp` is
-- blank, since there would be nowhere for the order to go.

alter table public.restaurants
  add column if not exists takeaway_enabled boolean not null default false;
