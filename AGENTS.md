# Fluxiva Menu — Agent Guide

This file applies to the entire repository. Read it before making changes, then read:

- [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) for the product, architecture, data model, and current state.
- [`docs/AI_CONTINUATION.md`](docs/AI_CONTINUATION.md) for the startup workflow, change recipes, and definition of done.

## Non-negotiable product behavior

- Fluxiva Menu is a bilingual English/Arabic QR-menu SaaS for Lebanese restaurants.
- Keep English and Arabic fields paired. New customer-facing restaurant, category, or item data should support both languages.
- Preserve demo mode. When Supabase variables are absent, `/m/demo`, authentication, onboarding, the dashboard, and platform preview must remain usable without a backend.
- Keep public menus mobile-first and readable in both left-to-right and right-to-left layouts.
- Do not expose a Supabase service-role key in this frontend. The app must use only the publishable key and rely on row-level security and protected RPC functions.
- Existing database migrations may already be applied. Add a new numbered migration instead of rewriting migration history for schema changes.

## Supported toolchain

- Use Node.js 22 or newer. The current lockfile resolves Supabase packages that require Node 22+.
- Install reproducibly with `npm ci`.
- Run locally with `npm run dev`.
- Required checks before handoff:

```bash
npm run lint
npm run build
```

There is currently no automated test runner. Compensate with focused browser verification of the affected route and viewport.

## Repository conventions

- Application code lives in `src/`; do not edit `dist/` or `node_modules/`.
- Keep backend access in `src/lib/api.ts`, shared domain types in `src/lib/types.ts`, and authentication state in `src/lib/auth.tsx`.
- Reuse the existing `Restaurant`, `Category`, `MenuItem`, `Variant`, and `RestaurantMenu` types instead of creating parallel shapes.
- Keep route composition in `src/App.tsx` and page-level UI in `src/pages/`.
- The UI currently uses one central stylesheet, `src/styles.css`. Scope new page-specific selectors carefully. Landing-page v2 selectors use the `lp-` prefix to avoid regressions elsewhere.
- Reuse the shared palette and typography variables before adding new one-off colors. Preserve `prefers-reduced-motion` fallbacks for animation work.
- Use `lucide-react` for interface icons instead of adding a second icon library.
- Preserve the existing image optimization path in `uploadRestaurantAsset`: JPG/PNG/WebP input, 8 MB maximum, browser-side resize, and WebP output when beneficial.

## Validation matrix

Choose the smallest matrix that covers the change, but UI changes normally require:

- `/` at approximately 1280 px desktop and 390 px mobile.
- `/m/demo` at desktop and mobile, including language switching and sold-out states when affected.
- `/login` followed by `/dashboard` in demo mode for owner-workflow changes.
- `/onboarding` for restaurant-creation changes.
- `/platform` for subscription-management changes.
- A console check for runtime errors.
- `npm run lint` and `npm run build`.

## Database and security rules

- Tables are protected by Supabase row-level security. Owner mutations must remain limited to restaurants owned by `auth.uid()`.
- Public reads are allowed only for trial or active restaurants. Suspended restaurants must not become publicly queryable.
- Platform subscription operations belong behind `security definer` RPC functions that call `public.is_platform_admin()`.
- Menu assets belong in the public `menu-assets` bucket under a first path segment matching the restaurant UUID.
- Never weaken an RLS policy merely to make a client query pass. Fix the ownership/query design instead.

## Git and handoff hygiene

- Preserve unrelated user changes in a dirty worktree.
- Do not commit generated output, local environment files, or secrets.
- Keep `.env.local` untracked.
- Explain material design or data-model decisions in `docs/PROJECT_CONTEXT.md` when they change the assumptions future agents need.
- Update `docs/AI_CONTINUATION.md` when setup, verification, deployment, or known limitations change.

