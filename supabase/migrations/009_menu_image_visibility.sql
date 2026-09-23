-- Lets a restaurant hide food-item photos without deleting the uploaded files.
-- Existing restaurants keep their current photo-led menus.

alter table public.restaurants
  add column if not exists show_item_images boolean not null default true;
