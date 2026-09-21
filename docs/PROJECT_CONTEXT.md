# Fluxiva Menu — Project Context

Last verified: 2026-09-21

## Product summary

Fluxiva Menu is a bilingual QR-menu SaaS aimed at Lebanese restaurants. A restaurant owner can create a branded public menu, manage categories and items, add photos and size-based prices, mark products unavailable, import items from CSV, and download a print-ready QR code. Guests open the menu without installing an app and can switch between English and Arabic.

The current commercial model is one plan at **$60 USD per year** after a **14-day trial**. Subscription activation is handled manually by the Fluxiva operator.

## Technology

| Area | Choice |
| --- | --- |
| Client | React 18 + TypeScript |
| Build tool | Vite 6 |
| Routing | React Router 7 |
| Backend | Supabase Auth, Postgres, Storage, and RPC |
| Icons | Lucide React |
| QR generation | `qrcode` |
| Styling | A central responsive stylesheet in `src/styles.css` |
| Hosting | Render static site via `render.yaml` |

Use Node.js 22+. The lockfile currently resolves Supabase packages that declare Node 22 or newer.

## Routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Marketing landing page and pricing | Public |
| `/signup` | Owner registration | Public |
| `/login` | Owner sign-in | Public |
| `/onboarding` | Three-step restaurant creation | Authenticated owner, or demo mode |
| `/dashboard` | Owner overview, menu editor, branding, QR tools | Authenticated owner, or demo mode |
| `/m/:slug` | Public restaurant menu | Public for eligible restaurants |
| `/m/demo` | Built-in Hilal Oven sample menu | Public in demo mode |
| `/platform` | Restaurant subscription controls | UI uses owner guard; RPCs enforce platform admin |

Unknown routes redirect to `/`.

## Runtime modes

### Demo mode

Demo mode is active when `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is missing or still contains the placeholder project URL.

- `src/lib/demo.ts` supplies the Hilal Oven restaurant, categories, items, variants, and local image paths.
- Authentication forms navigate into the owner experience without remote authentication.
- API mutations generally return local/demo results or no-op; the dashboard maintains the interactive state in memory.
- The public demo is always `/m/demo`.

Demo mode is a deliberate development and sales-preview feature. Do not remove it when adding production integrations.

### Supabase mode

- `src/lib/supabase.ts` creates the client from the two public Vite environment variables.
- `src/lib/auth.tsx` owns the session lifecycle and exposes `session`, `loading`, `demoMode`, and `signOut`.
- `src/lib/api.ts` is the client-side data boundary for restaurant, category, item, asset, and platform operations.
- Public menus query by slug and allow only `trial` or `active` restaurants.
- Owner menus query by the authenticated user's ID.

Required environment variables:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_APP_URL=https://your-deployed-domain.example
```

`VITE_APP_URL` is used when generating public-menu QR links. It falls back to `window.location.origin`.

## Code map

```text
src/
  App.tsx                 Route table and owner-route guard
  main.tsx                React entry point
  styles.css              Shared styles, responsive rules, and animations
  components/
    Brand.tsx             Reusable Fluxiva wordmark
    Status.tsx            Loading and notice states
  lib/
    api.ts                Supabase queries, mutations, RPCs, and image optimization
    auth.tsx              Authentication context
    demo.ts               Complete offline/demo restaurant menu
    format.ts             LBP formatting, bilingual text selection, slug creation
    supabase.ts           Environment detection and Supabase client
    types.ts              Shared domain types
  pages/
    LandingPage.tsx       Marketing site and animated product mockups
    AuthPage.tsx          Shared login/signup page
    OnboardingPage.tsx    Three-step restaurant setup
    DashboardPage.tsx     Owner operations and QR generation
    PublicMenuPage.tsx    Customer-facing bilingual menu
    PlatformPage.tsx      Operator subscription controls
public/
  hilal-oven-*             Demo restaurant brand assets
  menu/*                   Demo food photography
supabase/migrations/
  001_fluxiva_menu.sql     Core schema, RLS, storage, and platform RPCs
  002_restaurant_details.sql
  003_restaurant_cover_image.sql
```

## Data model

### `restaurants`

One restaurant per owner. Important fields include the unique public `slug`, bilingual identity and address fields, logo/cover URLs, contact links, brand color, default language, opening state, subscription status, and trial/subscription expiry timestamps.

### `menu_categories`

Belongs to a restaurant and contains paired English/Arabic names plus `sort_order`.

### `menu_items`

Belongs to both a restaurant and category. Contains paired English/Arabic names and descriptions, an LBP base price, optional image, JSON variants, availability, and `sort_order`.

### `variants`

Variants are stored as a JSON array on each menu item, shaped as `{ id?, name_en, name_ar, price_lbp }`. `cleanVariants` removes empty or zero-price draft variants before persistence.

### Platform administrators

Platform admins are stored in the private `private.platform_admins` table. The frontend calls protected RPC functions to list restaurants and update subscriptions. The SQL migration contains an example statement for adding an authenticated user as an admin.

## Security model

- Supabase RLS is enabled on restaurants, categories, and items.
- Owners may mutate only rows connected to their own `auth.uid()`.
- The public may read restaurants/categories/items only when the restaurant is in a valid trial or active state.
- Sold-out items remain publicly readable so the UI can show an unavailable state.
- The `menu-assets` bucket is public for reads, but authenticated writes are allowed only under a folder whose name is the owner's restaurant UUID.
- Platform RPCs use `security definer`, an empty `search_path`, and explicit admin checks.

## Main workflows

### Owner onboarding

1. Enter bilingual restaurant names, WhatsApp number, and slug.
2. Select a primary brand color and default language.
3. Enter bilingual addresses and create the restaurant.

Creating a restaurant sets `subscription_status` to `trial` and the trial end to 14 days from creation.

### Dashboard

The owner dashboard supports:

- Overview counts and trial/subscription state.
- Category/item creation, editing, deletion, and ordering.
- Item availability toggles and sold-out presentation.
- Item variants and photos.
- Restaurant logo, cover, theme, contact details, opening state, and default language.
- CSV import using fields such as `category_en`, `category_ar`, `name_en`, `name_ar`, `description_en`, `description_ar`, `price_lbp`, and `available`.
- PNG/SVG QR downloads and browser printing.

Image files are validated as JPG, PNG, or WebP and limited to 8 MB. Before upload, the browser applies high-quality resizing and adaptive WebP compression: items fit within 1200×1200, covers within 1600×1200, and logos within 512×512. Replaced item, cover, and logo files—and item files removed with an item or category—are deleted from the restaurant's Storage folder on a best-effort basis so unused assets do not consume the quota.

### Public menu

The public page loads restaurant data by slug, applies the restaurant color as a CSS variable, supports English/Arabic direction changes, groups ordered items by category, presents size variants, shows sold-out states, and exposes configured contact/location links.

## Design system and recent landing-page work

The visual language uses forest green, warm cream, and terracotta/orange with DM Sans, Playfair Display, and Tajawal. Shared colors live in `:root` in `src/styles.css`.

The current landing page was redesigned on 2026-09-18. Its implementation uses:

- `landing-v2` as the page scope and `lp-` prefixed selectors.
- An animated phone/menu preview built with HTML and CSS using existing demo photography.
- A dashboard product mockup, feature grid, three-step workflow, pricing, CTA, and expanded footer.
- Intersection Observer reveal states through `[data-reveal]` and `.is-visible`.
- Responsive layouts at 1050, 900, 680, and 420 px breakpoints.
- `prefers-reduced-motion` fallbacks.

Keep landing-page work scoped to the `lp-` namespace unless intentionally refactoring the global system.

## Deployment

Render builds the static app with `npm ci && npm run build` and publishes `dist/`. The catch-all rewrite in `render.yaml` sends every route to `index.html`, which is required for direct visits to React Router URLs such as `/m/cedar-oven`.

Supabase migrations are currently expected to be run manually in sequence in the Supabase SQL editor.

## Known constraints and technical debt

- There is no automated test suite yet.
- Vite currently reports a JavaScript chunk slightly over 500 kB after minification. Consider route-based lazy loading before the application grows substantially.
- All styling is in one large file. Page-level CSS modules or organized stylesheet splits would lower regression risk.
- `DashboardPage.tsx` owns many workflows and is a strong candidate for component/hook extraction.
- CSV import performs sequential inserts and minimal validation; partial imports are possible if a later row fails.
- Demo-mode mutations are not persisted across reloads.
- The landing page imports Google Fonts over the network; provide a fallback/self-hosting plan if offline or privacy requirements change.
- The `/platform` route shares the owner UI route guard. Server-side RPC authorization is the actual security boundary.
- The Render production build inherits the Node version configured by Render; ensure it remains Node 22+.
