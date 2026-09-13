-- Restaurant-specific cover photography displayed at the top of public menus.
alter table public.restaurants
  add column if not exists cover_image_url text;
