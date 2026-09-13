# Fluxiva Menu

A bilingual QR menu SaaS for Lebanese restaurants. Owners can create a restaurant, manage categories and items, add size-based prices, control availability, and download a QR code for their public menu.

## Product routes

- `/` — marketing site and pricing
- `/signup` and `/login` — restaurant owner accounts
- `/onboarding` — restaurant setup
- `/dashboard` — menu and QR management
- `/m/:slug` — public bilingual menu
- `/platform` — private subscription controls for the Fluxiva operator

Without Supabase environment variables, the application starts in demo mode. Visit `/m/demo` for the public menu or submit the login form to preview the owner dashboard.

## Local setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_fluxiva_menu.sql` in its SQL editor.
3. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable key.
4. Run `npm install`, then `npm run dev`.
5. Create an account in the app. To make that account the Fluxiva platform admin, run the final commented SQL statement in the migration with your email.

## Render deployment

Create a new Static Site from this repository. Render reads `render.yaml`. Add these environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_URL` — the final public Render URL

The rewrite rule keeps restaurant URLs such as `/m/cedar-oven` working when opened directly or from a QR code.

## Current MVP scope

The service has one `$60/year` plan after a 14-day trial. It includes Arabic and English menus, unlimited menu edits, restaurant branding, size variants, item availability and QR download. Subscriptions are activated manually after cash, Whish Money or bank transfer payment.
