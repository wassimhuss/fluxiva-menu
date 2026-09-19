-- The menu design each restaurant shows on its public page.
--
-- Deliberately a plain text column with no check constraint: the set of
-- templates ships with the frontend, so pinning the valid values here would
-- mean a migration every time a design is added. Unknown or missing values
-- fall back to the default template in the app.
alter table public.restaurants
  add column if not exists template_id text not null default 'classic';
