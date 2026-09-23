# Fluxiva Menu

A bilingual QR menu SaaS for Lebanese restaurants. Owners can create a restaurant, manage categories and items, add size-based prices, upload photos, control availability and opening status, import items from CSV, and download a QR code for their public menu.

## Product routes

- `/` — marketing site and pricing
- `/signup` and `/login` — restaurant owner accounts
- `/forgot-password` and `/reset-password` — password recovery by email
- `/onboarding` — restaurant setup
- `/dashboard` — menu, design and QR management
- `/m/:slug` — public bilingual menu
- `/platform` — private operator console for the Fluxiva team

The menu editor supports item/category editing and ordering, item photos, sold-out labels, quick theme presets, WhatsApp and Google Maps links, opening hours, and a bilingual preview.

Owners choose a public menu design under **Menu design** in the dashboard, previewing each one against their own items before saving. The choice is stored as `restaurants.template_id`; unknown or missing values fall back to `classic`, so the column can be added without touching existing rows. Designs differ in scroll behaviour as much as in looks — a full-screen vertical feed, a horizontal deck, scrollytelling with a sticky image pane, and four page-scroll layouts. Appending `?template=<id>` to a menu URL previews a design without saving it. CSV imports use columns such as `category_en`, `category_ar`, `name_en`, `name_ar`, `description_en`, `description_ar`, `price_lbp`, and `available`.

Without Supabase environment variables, the application starts in demo mode. Visit `/m/demo` for the public menu or submit the login form to preview the owner dashboard.

## Local setup

1. Create a Supabase project.
2. Run every file in `supabase/migrations/` in its SQL editor, in numerical order.
3. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable key.
4. Run `npm install`, then `npm run dev`.
5. Create an account in the app. To make that account the Fluxiva platform admin, run the final commented SQL statement in the migration with your email.

## Render deployment

Create a new Static Site from this repository. Render reads `render.yaml`. Add these environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_URL` — the final public Render URL

The rewrite rule keeps restaurant URLs such as `/m/cedar-oven` working when opened directly or from a QR code.

## Menu analytics

Each menu open is counted once per browser session in `menu_view_daily`, aggregated per day rather than one row per scan. The owner's own visits and the dashboard's embedded preview are excluded, so the number a renewal conversation leans on is not inflated by the owner checking their own menu.

Owners see the last 30 days against the 30 before on their dashboard; the operator console shows a 30-day count per restaurant. Writes go only through `public.record_menu_view`, which adds one and ignores restaurants that are not currently being served — there is no insert policy on the table, so a visitor cannot set counts to anything they choose.

## Password recovery

Owners who forget their password request a link from `/forgot-password`. The request always reports the same thing whether or not the address has an account, so the form cannot be used to discover who is registered. The emailed link lands on `/reset-password`, where Supabase has already signed the visitor in from the token in the URL fragment, and they choose a new password. Links that have expired or been used show the reason and offer a fresh one.

The reset email returns to whichever origin requested it, so **every origin you use must be listed under Authentication → URL Configuration → Redirect URLs** in Supabase — including `http://localhost:5173/reset-password` for local work. A redirect that is not on that list silently falls back to the project's Site URL.

## Operator console

`/platform` lists every restaurant with its owner, menu size, subscription state and whether its public menu is currently being served, ordered so lapsed and soon-to-lapse accounts come first. Subscription changes are recorded in an audit trail with the operator's email.

Access is controlled by `private.platform_admins`, a table in a schema revoked from `anon` and `authenticated`. Two roles exist: `super_admin` may change subscriptions, `support` is read-only. `public.platform_admin_role()` reports the caller's role so the app can hide the console, and the privileged functions re-check the role themselves — a non-operator who reaches the route is redirected, and the database would reject them regardless.

Grant yourself access after creating your account:

```sql
insert into private.platform_admins (user_id, role)
select id, 'super_admin' from auth.users where email = 'your@email.com'
on conflict (user_id) do update set role = 'super_admin';
```

Because expiry is enforced, both sides are warned rather than finding out from a dead QR code. Owners see a countdown banner in their dashboard from 7 days before a trial ends or 14 days before a renewal, and a plain "your menu is offline" notice once it has lapsed — set `VITE_SUPPORT_WHATSAPP` to put a renewal button on it. Customers who scan a QR code for a menu that is not being served get the restaurant's name and contact details instead of a dead end, and are never shown the billing reason.

Paid subscriptions expire: a menu is served while the status is `active` **and** `subscription_ends_at` is null or in the future, or while an unexpired trial runs. A null end date means no expiry, so activating without a date keeps a restaurant online indefinitely. Activating through the console extends a year from the existing renewal date rather than from today, so renewing early never discards time already paid for.

## Current MVP scope

The service has one `$60/year` plan after a 14-day trial. It includes Arabic and English menus, unlimited menu edits, restaurant branding, size variants, item availability and QR download. Subscriptions are activated manually after cash, Whish Money or bank transfer payment.

## Project documentation

- [`AGENTS.md`](AGENTS.md) — repository-wide rules and validation expectations for AI agents and contributors.
- [`TODO.md`](TODO.md) — product backlog, including the planned shared Fluxiva image gallery.
- [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) — product, architecture, routes, data model, security, deployment, design system and current constraints.
- [`docs/AI_CONTINUATION.md`](docs/AI_CONTINUATION.md) — startup checklist, common change recipes, verification matrix and handoff template.
