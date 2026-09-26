-- Explicit Data API grants.
--
-- Supabase has been granting every role full privileges on each new table in
-- `public` automatically. From 30 October 2026 that stops for new tables: a
-- table created without a grant is simply unreachable through PostgREST, and
-- the API answers "permission denied" no matter how correct its RLS policies
-- are. Grants and row level security are two independent gates — a grant asks
-- whether a role may touch the table at all, a policy asks which rows.
--
-- Two separate problems are settled here.
--
-- 1. These migrations have never granted anything; they inherited the automatic
--    behaviour. Rebuilding this database from them after that date — a
--    `supabase db reset`, a preview branch, a replacement project — would
--    produce four tables the application cannot read. Writing the grants down
--    makes the migrations self-sufficient again.
--
-- 2. The automatic grant was indiscriminate. `anon`, the role an unauthenticated
--    diner uses, holds INSERT, UPDATE, DELETE and TRUNCATE on every table, with
--    row level security as the only thing holding it back. Since the privileges
--    have to be written out by hand now anyway, they are narrowed to what the
--    application actually performs, so RLS becomes the second line of defence
--    rather than the only one. TRUNCATE matters most: it is a table-level
--    operation that RLS does not filter at all.

-- Start from a known state instead of adding to whatever is already present.
revoke all on public.restaurants from anon, authenticated;
revoke all on public.menu_categories from anon, authenticated;
revoke all on public.menu_items from anon, authenticated;
revoke all on public.menu_view_daily from anon, authenticated;

-- Diners read the menu and nothing else. Their visit is counted through
-- record_menu_view(), which is security definer, so they need no write here.
grant select on public.restaurants to anon;
grant select on public.menu_categories to anon;
grant select on public.menu_items to anon;

-- Owners manage their own menu. Every statement is still narrowed to their own
-- rows by the existing policies; this only decides which verbs are possible.
-- No delete on restaurants: nothing in the application removes one.
grant select, insert, update on public.restaurants to authenticated;
grant select, insert, update, delete on public.menu_categories to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;
-- View counts are written by the security definer function and only read here.
grant select on public.menu_view_daily to authenticated;

-- service_role bypasses row level security and is used by trusted server-side
-- tooling, never by the browser.
grant all on public.restaurants to service_role;
grant all on public.menu_categories to service_role;
grant all on public.menu_items to service_role;
grant all on public.menu_view_daily to service_role;
