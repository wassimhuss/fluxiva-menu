-- Opening hours are intentionally no longer part of the restaurant setup or
-- public menu. Dropping both language columns keeps the database contract in
-- sync with the smaller owner workflow.

alter table public.restaurants
  drop column if exists opening_hours,
  drop column if exists opening_hours_ar;
