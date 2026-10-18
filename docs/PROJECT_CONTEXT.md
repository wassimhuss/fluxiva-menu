# Fluxiva Menu — Project Context

Last verified: 2026-10-13

## Product summary

Fluxiva Menu is a bilingual QR-menu SaaS aimed at Lebanese restaurants. One owner account can manage multiple places, each with its own menu, settings, public link, and analytics. A shared brand QR opens a bilingual branch selector before the guest enters the selected place's menu. Owners can manage categories and items, add photos and size-based prices, mark products unavailable, import or export a structured Excel workbook, and download a print-ready QR code. Guests need no app and can switch between English and Arabic.

The landing-page offer is **$100 USD per year**, with **$150** shown crossed out as the previous price, after a **14-day trial**. English and Arabic both show the offer with localized numerals/currency. This marketing display does not rewrite existing shop prices or agreements: each place's actual annual USD price is entered by a super admin. Cash is collected in person and recorded manually; there is no online checkout or automatic renewal. Up to three flexible payments may fund one annual agreement, with the third settling its remaining balance.

## Technology

| Area | Choice |
| --- | --- |
| Client | React 18 + TypeScript |
| Build tool | Vite 6 |
| Routing | React Router 7 |
| Backend | Supabase Auth, Postgres, Storage, and RPC |
| Owner data cache | TanStack Query, loaded only for owner-menu requests |
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
| `/b/:slug` | Brand-level bilingual branch selector reached by the shared QR | Public for brands with an eligible place |
| `/m/:slug` | Public restaurant menu | Public for eligible restaurants |
| `/m/demo` | Built-in Hilal Oven sample menu | Public in demo mode |
| `/platform` | Subscribers, cash collections, billing activity and gallery | Operators; protected RPCs enforce read/write roles |

Unknown routes redirect to `/`.

## Runtime modes

### Demo mode

Demo mode is active when `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is missing or still contains the placeholder project URL.

- `src/lib/demo.ts` supplies the Hilal Oven brand, Tripoli and Beirut places, categories, items, variants, extras, and local image paths.
- Authentication forms navigate into the owner experience without remote authentication.
- Restaurant, category and item mutations update the runtime demo menus so branch switching and menu copying retain independent edits within the session. Other API mutations may return local/demo results or no-op. Demo data is not persisted across a full reload.
- The shared demo QR destination is `/b/hilal-oven`; `/m/demo` remains the direct Tripoli menu.

Demo mode is a deliberate development and sales-preview feature. Do not remove it when adding production integrations.

The hosted `/m/demo` uses the real Supabase restaurant `00000000-0000-0000-0000-000000000001` when backend variables are configured; it is separate from the bundled offline sample. On 2026-10-17, the approved content seed `supabase/seeds/demo_pasta.sql` added Pasta / باستا using all 13 existing active photos from the Pastas gallery folder. All dishes cost the user-approved sample price of 500,000 LBP. The pre-existing Fettuccine Alfredo was moved from Manakish and repriced with approval, retaining its ID, photo and other content; 12 dishes were newly inserted. The hosted demo now has 7 categories and 35 items. Restaurant/gallery row checksums and all 331 Storage files remained unchanged. This content-only seed is not a numbered schema migration and does not change the offline fixtures.

### Supabase mode

- `src/lib/supabase.ts` creates the client from the two public Vite environment variables.
- `src/lib/auth.tsx` owns the session lifecycle and exposes `session`, `loading`, `demoMode`, and `signOut`.
- Signed-in operators go directly from authentication to `/platform` after their role resolves. Normal owners go to `/dashboard` (new signups to `/onboarding`); the owner dashboard contains no operator-console link. Demo login continues to open the owner dashboard.
- Owner route guards also redirect operators away from `/dashboard` and `/onboarding`. Signed-in landing navigation uses the account's actual workspace. Role failures show bilingual Retry/Sign out controls instead of treating an unresolved operator as an owner; password recovery returns through the role-aware sign-in destination. Demo mode retains both workspace previews.
- Login, signup, forgot-password, and reset-password screens inherit the landing-page language preference (`fluxiva-landing-language`) and apply a complete English/Arabic RTL layout through `src/lib/authI18n.ts`.
- Signup requires a matching Confirm password field before any Supabase request or demo navigation. Each password has its own visibility toggle; mismatch feedback is localized, announced and linked to the focused confirmation field. Password managers receive new-password autocomplete hints; the confirmation value is never sent to Supabase. Login and password-recovery behavior are unchanged.
- Mandatory email confirmation is disabled in the production Supabase Auth settings as of 2026-10-17, for the personally onboarded restaurant rollout. New email/password signups are auto-confirmed and receive a session immediately, allowing the existing role-aware onboarding redirect without an inbox step. A populated email-confirmation timestamp is therefore not proof of mailbox ownership. Confirm password, email/password authentication, password recovery, RLS and operator guards remain; anonymous sign-ins and manual identity linking stay disabled. The client retains its no-session confirmation fallback for other environments. This is a live Auth setting, not a schema migration or frontend-deployment change.
- `src/lib/api.ts` is the client-side data boundary for restaurant, category, item, asset, and platform operations.
- Public menus query by slug and allow only `trial` or `active` restaurants.
- Owner menus query by the authenticated user's ID.

Required environment variables:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_APP_URL=https://your-deployed-domain.example
VITE_SUPABASE_STORAGE_QUOTA_GB=1
```

`VITE_APP_URL` is used when generating public-menu QR links. It falls back to `window.location.origin`.

The platform console's **Storage** view uses the protected `platform_storage_usage()` RPC (migration 029) to inventory Storage object metadata. It reports live bytes/files for every bucket, attributes `menu-assets` files to the owning restaurant and account, and keeps shared `gallery-assets` separate as platform-owned. The `VITE_SUPABASE_STORAGE_QUOTA_GB` value controls the remaining-space meter (`1` for Free, `100` for Pro); it is a public display setting, not a credential. Supabase's billable Storage Size is an average GB-hour measure, so the view is an operational file inventory rather than an invoice mirror. No service-role or Management API token is exposed in the frontend.

Migration 029 is applied to production as of 2026-10-13. Verification returned 331 files using 36,993,398 bytes, confirmed admin-only access, and preserved 2 restaurants, 6 categories, 23 items and all restaurant settings/access dates. The organization currently uses the Free plan; the display uses a 1 GB quota.

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
    demo.ts               Complete offline/demo brand and place menus
    format.ts             LBP formatting, bilingual text selection, slug creation
    menuWorkbook.ts       Excel template, export, parsing, and pre-import validation
    supabase.ts           Environment detection and Supabase client
    types.ts              Shared domain types
  pages/
    LandingPage.tsx       Marketing site and animated product mockups
    AuthPage.tsx          Shared login/signup page
    OnboardingPage.tsx    Three-step restaurant setup
    DashboardPage.tsx     Owner operations and QR generation
    BranchSelectorPage.tsx Public brand/branch chooser
    PublicMenuPage.tsx    Customer-facing bilingual menu
    PlatformPage.tsx      Operator subscription controls
public/
  hilal-oven-*             Demo restaurant brand assets
  menu/*                   Demo food photography
supabase/migrations/
  001_fluxiva_menu.sql     Core schema, RLS, storage, and platform RPCs
  002_restaurant_details.sql
  003_restaurant_cover_image.sql
  ...
  009_menu_image_visibility.sql
```

## Data model

### `brands`

One brand per owner. It owns the shared public branch-selector slug plus bilingual brand identity, logo, color, and default language. Anonymous reads are allowed only when the brand has at least one place with a live trial or subscription.

### `restaurants`

Additional places require a branch request and a super-admin decision (migration 033). Owners submit paired names/addresses, WhatsApp and a proposed menu slug from Add place, then monitor pending/approved/rejected requests in that screen. The platform Requests tab lets operators read requests and super admins approve/reject with an optional note. Approval permits the owner to create one additional place with that exact slug, including through menu copying. First-place onboarding is unchanged. Private request rows are accessible only through guarded RPCs; a restaurant INSERT trigger consumes approvals transactionally and serializes on the owner's brand. Failed unfinished-menu-copy cleanup restores the approval. Existing branches and access/expiry restrictions are preserved.

Migration 033 is applied to production as of 2026-10-17 (`20261017130000`). Existing restaurants, menus, gallery photos/files and billing records were verified unchanged. The new RPC grants, RLS, enabled triggers and admin/owner/anonymous boundaries passed verification without creating production request data. The branch-request frontend still requires deployment.

Migration 034 adds super-admin-only editing of a pending request's menu slug before approval. The Requests card opens a bilingual link editor, validates format and conflicts with existing menus or the same owner's open requests, and saves without approving. Updates record the previous/new slug in subscriber activity. Edit and decision RPCs lock the request and compare the displayed slug to reject stale admin actions. The owner sees the corrected link and creates the approved branch with that exact slug; approved/rejected/created requests cannot be edited. Existing restaurant links, names, photos and access dates are untouched. Migration 034 was applied transactionally to production on 2026-10-17 (`20261017131000`, `branch_request_links`), with matching source checksum, unchanged restaurant/request snapshots and menu/gallery/billing counts, and verified admin/owner/anonymous boundaries. Frontend deployment is still pending.

### In-app owner notifications (035)

The owner header bell and Notifications navigation open Messages / Branch requests. Below 600 px this replaces the large Overview request card; desktop retains it. The badge combines unread broadcasts, pending requests and approved requests awaiting creation. Request status/actions remain owner-scoped and keep existing expiry restrictions. Opening notifications preserves design/settings save-or-discard warnings. Notifications and billing remain readable when editing is locked; the lock dialog offers both destinations.

The platform Messages screen lets super admins compose paired English/Arabic titles (200 characters) and bodies (5,000 characters), preview both languages, confirm sending, and review paginated sent messages with recipient/read counts. Support can read history but cannot send. Delivery is in-app only: no email, WhatsApp, browser push or background delivery service. Owners explicitly mark messages as read. The inbox refreshes on focus and every minute; demo broadcasts/read receipts are browser-runtime-only.

Migration `035_owner_notifications.sql` is prepared but **not applied to production**. It adds private, RLS-enabled announcement/recipient tables and guarded RPCs; no frontend service key or direct table grants. Sending snapshots all current non-operator Auth accounts (including accounts with no shop and suspended owners); later accounts do not receive older messages. Accounts without a restaurant retain the message for when they reach the dashboard after onboarding. Deleted accounts lose their recipient rows, while historical recipient totals remain. A stable client send UUID, transaction lock and exact-payload retry check prevent repeated requests from sending duplicates; fan-out and audit logging roll back together. This is not a persistent offline send queue: after an uncertain send followed by navigation/reload, check Sent messages before starting a fresh send. Applying the migration sends no messages and does not rewrite restaurant, gallery or billing data. Apply 035 after 034 before deploying this UI.

Each row is an independently managed place attached to the owner's brand through `brand_id`. An owner may have many places. Important fields include the unique direct-menu `slug`, bilingual identity and address fields, logo/cover URLs, contact links, color, default language, opening state, the `show_item_images` food-photo preference, subscription status, and trial/subscription expiry timestamps. Subscription eligibility remains per place. `is_published` (default true) independently controls public visibility: hidden branches disappear from the brand selector and cannot serve a direct public menu, contact-card RPC, or view-count RPC. Owners can still edit them; hiding does not change billing or the temporarily-closed setting.

`menu_copy_pending` marks a newly cloned branch whose personal photos are still being duplicated. A database constraint prevents a pending copy from becoming published. Existing and empty-created branches default to false.

### `menu_categories`

Belongs to a restaurant and contains paired English/Arabic names plus `sort_order`.

### `menu_items`

Belongs to both a restaurant and category. Contains paired English/Arabic names and descriptions, a base price in the restaurant's currency, optional image, JSON variants, JSON extras, availability, the `highlighted` boolean (default false), and `sort_order`.

### `variants`

Variants are stored as a JSON array on each menu item, shaped as `{ id?, name_en, price }`. Size labels intentionally use one English value in both menu languages. `cleanVariants` removes empty or zero-price draft variants and strips the legacy `name_ar` key before persistence.

### Manual dual menu pricing (036–037)

Item/size/extra editors show LBP and USD together, and the owner enters both prices manually. The 2026-10-18 product decision removes automatic conversion entirely, including on first creation, and removes Recalculate USD and exchange-rate hints. Editing or clearing one currency never changes the other. Both inputs are required for a priced item/size/extra (the unused base price remains optional when sizes exist).

The existing `price` remains in `Restaurant.currency` for compatibility. Optional nullable `price_secondary` stores the manually entered alternate amount (USD for LBP-primary menus, LBP for USD-primary menus), including on variant/extra JSON. Null/missing means not entered, not zero and not automatic conversion; explicit zero is preserved. Legacy rows are not backfilled and show only their entered currency until the owner supplies the other. All eight designs share this formatting. Basket/customization/WhatsApp alternate totals appear only when every selected item/size/extra has that price; partial totals must not imply a complete dollar quote. Dollar arithmetic rounds sums to cents; LBP display remains whole pounds. Menu pricing is separate from subscription billing.

`036_dual_menu_prices.sql` was applied transactionally to production on 2026-10-17 (`20261017155000`, `dual_menu_prices`; source MD5 `1af88d170ee207ecb4d2bb7b9bb89296`). It adds the alternate column/validation and preserves it in protected branch copying. The follow-up `037_manual_menu_prices.sql` was applied transactionally on 2026-10-18 (`20261018110256`, `manual_menu_prices`; source MD5 `ba5f7b57264e2c0677b688964bca51ee`): it changes the nullable-column comment and replaces the currency-swap helper's conversion fallback with a clear missing-price error. Explicit primary-currency changes swap complete entered pairs only; any missing base/size/extra alternate rejects the whole settings transaction. Frontend validation and demo/cache use the same rule. Neither migration application rewrites existing prices, restaurant settings, photos or access policies. Excel retains optional `price_secondary` columns for backwards compatibility; blank means not entered, and Read me explains manual pricing in both languages. Blank templates use the selected restaurant's primary currency. Noir price text uses a readable brand-derived light shade on its dark surface; two-line price labels prevent mobile name/price collisions.

Production before/after checksums matched for all 3 restaurants/brands, 7 categories, 35 items (excluding only the newly added null column), 159 gallery images, 15 folders, 331 Storage files, 4 Auth account identities/statuses, the branch request, operator/audit records, empty billing tables and existing RLS policies. Post-commit checks confirmed the source checksum, validated constraints, enabled currency/approval/expiry triggers, authenticated-only copying, protected trigger execution, 895,000 LBP → $10.00, manual/zero overrides and invalid-price rejection. An anonymous REST read returned all 35 demo items with the new column null. No production prices, branches or broadcasts were changed for QA. Matching frontend deployment remains pending; unrelated migration 035 is still unapplied and must be applied before deploying the notifications UI.

Migration 037 separately preserved full checksums for all existing items (including `price_secondary`), restaurants/categories/brands, gallery/Storage, account identities/statuses, branch requests and billing/audit records. All public function permissions/search paths/definer flags, restaurant/item triggers, table RLS flags and access policies matched before/after. Read-only post-commit checks verified the recorded source, unchanged manual/zero values and rejection of missing alternates for both LBP- and USD-primary menus. All 35 existing alternate prices remain unset; no guessed amounts were written. All 80 tests, lint/build and diff checks passed again. Frontend deployment remains a separate step.

### `extras`

Extras are optional bilingual add-ons stored as a JSON array on each menu item, shaped as `{ id, name_en, name_ar, price }`. A size replaces the base item price; every selected extra is then added to that price. Diners may choose multiple extras, and each distinct size/extra combination remains a separate order line. `cleanExtras` trims paired labels and preserves a stable ID for order matching.

### Platform administrators

Platform admins are stored in `private.platform_admins`. Support operators may read subscriber and billing details; only `super_admin` may set prices, record/void receipts, review undated legacy access, suspend/restore menus, or suspend/delete subscriber accounts. Account suspension applies to every owned place. Account deletion removes the Auth account and cascaded menu data after an exact email confirmation while retaining the private billing ledger as archived history. The console groups all non-operator Auth accounts and their places, including accounts with no place. Search and collections use server pagination (25 rows/accounts per page). Owners see only their selected place's read-only billing, refreshed independently of menu drafts.

Each subscriber email and eye action opens `/platform?subscriber=<owner-id>`. The bilingual profile has Account, Shops & payments, and Activity views. It shows registration/update/sign-in/confirmation dates, optional Auth phone and sign-in restriction, brand identity, live and archived shops, exact subscription dates, contacts, paired descriptions/addresses, menu settings/counts, 30-day opens and menu-file inventory. Billing drills into the existing cash ledger and returns to the same selected shop; directory search/pagination remain intact. Trial access is kept separate from paid access, unknown historical cash remains unknown, and archived accounts never invent original registration dates.

Migration 031 adds the read-only `platform_subscriber_details(owner_input, activity_page_input)` RPC. It calls the existing operator guard and whitelists Auth fields; passwords, tokens, identities and raw metadata are excluded. Shop records reuse the shared Restaurant/BrandGroup types. Activity is paginated by 25 and scoped by retained restaurant/receipt/owner UUIDs, not possibly reused public slugs. Existing admin actions retain super-admin guards and confirmations. The demo profile includes populated/empty accounts, stable sample dates and current billing/activity changes. No schema/data rows are rewritten.

Migration 032 adds `platform_search_subscribers(search_input, filters_input, page_input)` while retaining the older directory RPC. The operator-only query applies subscription state (including access ending within 168 hours), publication visibility, payment records, current/archived account state, current-shop presence and inclusive Asia/Beirut registration-date filters before 25-owner pagination. Status, visibility, payment and shop-name/phone searches must match the same current shop; every branch of a matching owner is still returned, with matching branches tagged. No recorded payments is a ledger condition, not proof of no historical cash. Archived registration dates remain unknown. Sorting supports registration, email and earliest matching shop expiry with stable UUID tie breaks. Search treats wildcard characters literally and normalizes English, Arabic and Persian phone digits. English/Arabic controls support removable applied filters, clear-all and preserved state when returning from a profile. Demo visibility follows live menu publication.

### Cash billing (migrations 026–028)

The owner's Subscription & payments view uses a separate, read-only `OwnerBillingSummary`, while `ShopBillingPanel` retains billing fetching, account/shop isolation, retry and dashboard access updates. It leads with subscription state and the exact Beirut access end, followed by Annual price / Paid so far / Left to pay. Payment amount never implies duration, hidden publication remains separate, and missing historical amounts are labelled unknown rather than zero debt. Cash collection has one configured support action (or a representative-contact explanation when unavailable). Current receipts expand to show references and manually agreed dates; earlier agreements and the three-payment explanation use native disclosure controls. Owner English/Arabic mobile/desktop layouts are scoped to `owner-billing`; admin forms and server rules are unchanged. No migration is required for this presentation update.

The manual-date update (028) and frontend release `8658383` are live as of 2026-10-13. Both access dates are entered by the admin, independent of the amount paid. Secondary dashboard actions use 44 px Lucide icon buttons with English/Arabic tooltips and keyboard labels.

`private.shop_billing_prices` holds each place's price for future agreements. `private.cash_agreements` snapshots the agreed annual USD cents, original access date, owner and bilingual place identity when its first receipt is recorded. Later price changes cannot alter that agreement. `private.cash_receipts` retains immutable cash amounts, actual collection timestamps, references, private notes, recording admins and granted periods. `private.cash_receipt_voids` adds a reasoned correction rather than deleting or rewriting the original. Only the latest agreement of a live place can be corrected. Agreements and receipts survive place deletion through nullable live references and archived snapshots.

Access start and expiry are required, manually entered by the super admin in Asia/Beirut time. Cash amounts never determine subscription duration: an $80 receipt may have any explicitly agreed expiry, and a settlement may retain the current expiry. Dates start blank in the form. Expiry must follow the start and collection time, cannot shorten existing trial/paid access, and the entered start cannot leave a future gap after existing access or collection. Corrections remove a receipt’s cash credit and expiry while retaining the greatest remaining recorded expiry or the original baseline; other receipts keep their literal periods. Backdated collections cannot precede the latest original receipt, even if voided. Zero/negative, future-dated, over-balance and incomplete third payments remain rejected.

Authoritative previews include a billing version. Receipt/void RPCs lock the place row, check that version, and update the ledger, access and audit log in one transaction. Caller-generated UUIDs make retries idempotent. The client retains an uncertain receipt request in session storage and reconciles its history before permitting another payment. Owners and anonymous users cannot directly access private tables; owner summaries omit staff notes and recording identities. A restaurant trigger protects subscription fields against direct authenticated writes and forces direct new-place inserts to a server-dated 14-day trial. The legacy subscription RPC supports only suspension/restoration, preserving dates; cash receipts are required to purchase extra time.

Migration 026 does not change existing expiry dates or invent historical receipts. Legacy access is labelled accordingly; an undated legacy subscription requires an explicit, audited review of its actual agreed end before billing. Cash payments preserve hidden/suspended states, and restoration adds no time. Existing public RLS stops service at expiry without a grace period while owners retain dashboard access.

`billingDemo.ts` provides working pricing, previews, receipts, voids, collections and activity without Supabase, including owner-safe summaries. Demo changes reset on full reload. `npm run test` also applies all 001–035 migrations to isolated PGlite PostgreSQL and tests manual dates, independence from payment amounts, pre-existing receipt preservation, validation, transaction rollback, stale/duplicate requests, corrections, role isolation, public expiry, subscriber profiles/filters, branch approval/link editing, broadcasts/read receipts, archived history and repeat-safe migration application. PGlite is a development dependency and is not shipped in frontend bundles.

### Expiry warnings and editing lock (030)

Public menus become unavailable immediately at the actual trial/paid expiry. Owners retain editing for exactly seven elapsed days (168 hours) after expiry, with a warning showing the deadline in Asia/Beirut. At that deadline a non-dismissible bilingual dialog blocks editing; suspended shops lock immediately. Owners can still inspect read-only billing, arrange cash collection when support is configured, switch to another existing shop, refresh access and sign out. A renewed shop restores editing without replacing menu drafts. Access refreshes also update branch summaries and reject older responses.

Migration 030 adds owner mutation triggers to restaurants, categories and items, including protected copy/delete RPC paths, and restrictive menu-assets write policies. Owners retain reads. Super-admin billing/restoration and trusted maintenance remain usable. Owners cannot create another trial while any owned shop is expired or suspended; deleting an expired shop is blocked from expiry to prevent removing the row and resetting its trial. Existing shop expiry dates, visibility and financial history are not rewritten. Active branches remain usable independently.

Direct public menu links and brand links with no eligible branch show a neutral English/Arabic unavailable-menu dialog. Menu items are not rendered behind it and billing/debt details are never disclosed to guests. Local expiry clocks update open tabs at boundaries and on returning to the page; background eligibility checks detect server changes. Offline failures retain the last confirmed view while its known expiry is still enforced.

Migration 026 was applied to the configured production project as of 2026-10-12. Both existing shops retained their exact trial/paid dates and publication state, with 6 categories and 23 items unchanged. Their annual prices are configured separately by the admin. The rollout's 26 tests, clean install, lint and build passed; desktop and 390 px English/Arabic admin/owner demo flows were checked, including payment previews, third-payment enforcement, corrections, audit activity, daily totals and owner-safe receipts.

The shared Fluxiva Gallery uses `public.gallery_categories` as real bilingual folders and stores its photos in `public.gallery_images`; direct client access to both tables is revoked. Authenticated owners receive only active, owner-safe folder and image fields through protected RPCs, while source and license notes are returned only to the super-admin console. The platform console loads folder metadata first and requests a folder's image records only when its modal is opened, avoiding an all-gallery image fetch during the initial `/platform` load. New files use `gallery-assets/{category-id}/{image-id}/...`, so visible folder names can be renamed without breaking URLs. Choosing a new gallery photo opens a drag-and-zoom 4:5 portrait cropper; clear source photos at least 900 px on each side are accepted, and the client produces an exact `1200 × 1500` optimized original plus a `320 × 320` browsing thumbnail before upload. Gallery mutations and Storage writes require the exact `super_admin` role. Menu items keep both the shared URL and a nullable `gallery_image_id`; a database trigger validates active selections and makes the gallery URL authoritative. Referenced images and non-empty folders cannot be permanently deleted individually. A separate, super-admin-only **Clear gallery** action is the intentional reset path: it clears every shared-gallery reference and image URL from menu items, deletes all gallery records and their `gallery-assets` files, and preserves the folders for replacement uploads.

## Security model

- Supabase RLS is enabled on brands, restaurants, categories, and items.
- Owners may mutate only rows connected to their own `auth.uid()`.
- A place may only be created or reassigned under a brand owned by the same authenticated owner.
- The public may read restaurants/categories/items only when the restaurant is in a valid trial or active state.
- Sold-out items remain publicly readable so the UI can show an unavailable state.
- The `menu-assets` bucket is public for reads, but authenticated writes are allowed only under a folder whose name is the owner's restaurant UUID.
- Platform RPCs use `security definer`, an empty `search_path`, and explicit admin checks.

## API loading and owner cache

Public menus load the restaurant, categories and items together in one nested Supabase SELECT. Public branch choosers likewise load the brand and eligible branch-card fields together. Both retain existing RLS and client publication/subscription checks, and order categories/items by `sort_order`, then ID. Public data is not retained in the owner cache; every guest open rechecks eligibility. Sold-out items remain readable. These changes need no migration.

Owner menus use the same single-request shape with an explicit `owner_id` filter. `src/lib/queryClient.ts` lazily imports TanStack Query so the cache library stays out of the initial guest bundle. Menu keys include account and restaurant IDs. Saved menus are fresh for 30 seconds and retained in memory for five minutes; concurrent reads share one request, and callers receive independent clones. Successful item/category/restaurant writes reconcile saved cache data. Item field mutations and reorder results patch only the changed fields, preserving independent saves. Failed or zero-row updates do not change the cache. Deleted branches are removed from the cache; sign-out/account changes cancel pending reads and clear all owner data, including loads waiting for the cache library.

Returning to a cached branch displays it immediately and refreshes stale data in the background. Request sequence IDs keep late menu/analytics responses on their originating branch. A menu revision check prevents background refreshes from replacing drafts or newer saves. Same-account token/session refreshes do not reload the workspace or operator-role lookup. There is deliberately no automatic focus refresh of owner drafts. Existing image preloading and design-preview iframe behavior remain unchanged in this phase.

Public menu/branch requests are aborted on route changes or retry, with a 15-second deadline. Workspace metadata, owner menu, analytics and role reads also have deadlines. Network failures show bilingual retry controls separately from genuinely unavailable menus. Availability changes disable repeated taps and merge/restore only the affected item's availability; they cannot restore an obsolete whole-menu snapshot. Query-level retries are disabled because the installed Supabase SDK already retries eligible reads; writes are not automatically retried.

`npm run test` uses Node's test runner and the real transpiled API with a controlled client. It covers request counts, public eligibility, ordering, cache deduplication/account isolation, confirmed and failed saves, cancellation and availability rollback. The new nested queries were also verified read-only against production on 2026-10-12: each used one request and returned the existing 2 eligible branches, 6 categories and 23 items. Production data was not modified. Frontend deployed with release `79fa2d6` on 2026-10-12.

## Main workflows

### Owner onboarding

1. Enter bilingual restaurant names, WhatsApp number, and slug.
2. Select a primary brand color and default language.
3. Enter bilingual addresses and create the restaurant.

The first restaurant also creates the owner's brand. Creating any place sets `subscription_status` to `trial` and the trial end to 14 days from creation.

### Dashboard

The owner dashboard supports:

- Branch requests are accessible through **Notifications → Branch requests**, with a header badge and mobile Overview shortcut. Desktop also retains its Overview card. Requests show the account-wide pending count, state/menu link/admin note and **Create now** after approval. The action opens the approved-branch form with the corrected link and empty/copy choices; creation refreshes the consumed request to Created. Existing requests remain visible in Add place to discourage duplicate submissions. The paginated loader refreshes each minute/on focus and unmounts while the form is open. Expired/suspended-shop restrictions still disable creation. Notifications/broadcasts require migration 035 before frontend deployment.
- Switching between all places without leaving the dashboard and adding another bilingual place under the same brand. The mobile overview exposes a visible **Your places / Add place** row; the current restaurant name also opens the place switcher on every dashboard panel.
- Adding a place defaults to **Copy menu from…** the selected branch, with an explicit **Start with an empty menu** alternative. A copy includes bilingual categories/items/descriptions, base and size prices, extras, availability, ordering, currency, design, descriptions and branding. New branch names, addresses, slug and WhatsApp come from the form; location links, closed state, subscription payments and analytics are not copied. The new place receives its own 14-day trial and category/item IDs. Copies start hidden and open directly in the menu editor so prices can be reviewed before **Show branch**; future edits never sync between branches.
  - The owner-only `owner_create_place_with_menu` RPC creates the hidden branch and menu records in one database transaction. The client duplicates personal photos/logo/cover into the new restaurant UUID's `menu-assets` folder using existing Storage permissions, copying each repeated URL once. Active gallery references remain shared. An archived gallery photo already used by the source becomes a personal file in the copy rather than attaching a new inactive gallery reference. External URLs and bundled demo assets remain unchanged; demo uploaded blob photos receive independent blob URLs.
  - `owner_finish_place_menu_copy` validates that copied files exist under the target UUID, rewrites the saved URLs together, and clears the pending flag without publishing. On failure, the client attempts to remove the new files before deleting only the new branch. A tab closure or failed cleanup can leave a hidden **Copy incomplete** branch; the owner must delete it and retry. Incomplete branches cannot be shown or selected as a copy source.
- The place switcher offers **Hide / Show branch** and **Delete branch**. Hiding requires confirmation and showing is reversible in one tap. Deleting requires the exact menu slug and permanently removes that branch's categories, items and analytics, without changing the brand QR or other places. The protected `owner_delete_place` RPC validates ownership and serializes deletions on the owner's brand; the last remaining place cannot be deleted, but can be hidden. Deleting the selected place switches to another place.
- Overview counts and trial/subscription state.
- Whole-category **Move up / Move down** arrows move a section exactly one position per tap by swapping it with its neighbor. This is the owner's intended behavior; category controls must retain single-step movement. They remain visible on desktop/mobile with bilingual labels, 36 px desktop and 44 px mobile icon buttons. An atomic batch saves the category ranks through existing owner INSERT/UPDATE RLS, normalizing tied or sparse ranks while preserving category membership, item order, prices and recommendation badges. First/last category buttons disable appropriately, pending moves show a spinner, and errors preserve the previous order. New/manual/Excel-created categories append after the highest saved category rank. Public category tabs and the first category on a fresh menu open follow this saved order. Demo branches retain independent changes during the same runtime; no migration is needed.
- Category/item creation, editing, deletion, and ordering. Each item has **Move up / Move down** arrows that move exactly one position per tap within its category, matching category controls. They remain visible on desktop and in a separate row of 44 px touch controls on phones, with bilingual tooltips and accessible labels. The first/last item disables the corresponding button; a one-item category disables both. The owner-only, security-invoker `owner_move_menu_item` RPC swaps neighboring items and normalizes sibling ranks atomically, updating only `sort_order` under existing RLS. This preserves photos (including cropped/archived gallery references), bilingual content, prices, variants, extras, recommendation and availability states. The dashboard updates after saving succeeds, shows a spinner while saving, and preserves the old order on failure. New/manual/Excel-imported items append after the category's highest existing rank. Demo public reads and branch switching retain moves during the same runtime. Migration `025_item_single_step_order.sql` installs the RPC.
- Item availability toggles and sold-out presentation.
- One-tap star highlights beside menu items. Filled stars identify the owner's recommendations; saving disables the star and failures preserve its previous state. Public menus show a **Recommended / مننصحك فيه** badge on highlighted items across all eight designs. Toggling the star never adds a category, changes category membership or item order, or changes the initial category selection. Items retain their prices, variants/extras and sold-out state. Highlights belong to each branch, are preserved on branch copy, and can be changed independently. Excel imports create ordinary unhighlighted items; workbook export does not carry the highlight flag.
- Item variants, optional priced extras, and photos.
- A bilingual searchable Fluxiva Gallery alongside personal uploads. Owners browse curated folders such as Cold Mezza or Hot Mezza before selecting a shared photo. Shared photos are reused by URL, while personal uploads stay in the restaurant's own Storage folder.
  - Selecting a gallery photo fills any empty English and Arabic item-name fields from the photo's curated bilingual metadata. Names the owner already entered are never overwritten and remain editable.
- Restaurant logo, cover, theme, contact details, opening state, and default language.
  - A restaurant-wide food-photo visibility switch. Hiding photos preserves the uploaded files, limits the design picker to the photo-optional Classic, Noir, and Maison templates, and safely falls back to Classic when a photo-based design had been selected. Maison adds editorial thumbnails when photos are enabled and collapses cleanly to a text-only layout when they are hidden.
- The owner dashboard has an English/Arabic UI switch in the header. It persists in local storage, applies RTL layout, and translates the dashboard panels, analytics card, subscription warning, forms, dialogs, and action feedback without changing the restaurant's public-menu language setting.
- Excel import/export through a styled `.xlsx` workbook. `Items` contains bilingual categories and item copy, `Variants` contains English-only size labels, and `Extras` contains bilingual add-ons. `item_key` links the sheets. The whole workbook is validated before owner-scoped batch inserts begin, and owners can download either a blank template or their current menu.
- One brand-level PNG/SVG QR download and browser printing. It points to `/b/:brandSlug`, where guests choose a place; direct `/m/:placeSlug` links remain available for place-specific sharing.

Image files are validated as JPG, PNG, or WebP and limited to 8 MB. A personal item photo selected in the owner editor only needs to be a clear image at least 900 px wide and high; it opens the same drag-and-zoom 4:5 portrait cropper as the shared gallery and is previewed as an exact 1200×1500 WebP before the item is saved. One optimized item image is stored and reused across menu templates. Reel preserves that full 4:5 foreground photo, using a blurred and darkened rendering of the same URL to fill the remaining 9:16 canvas; it does not store a second Reel asset. Covers fit within 1600×1200 and logos within 512×512 through high-quality resizing and adaptive WebP compression. Replaced item, cover, and logo files—and item files removed with an item or category—are deleted from the restaurant's Storage folder on a best-effort basis so unused assets do not consume the quota. Cleanup checks remaining visible/owned menu, restaurant and brand references first, preserving repeated copied photos and brand QR logos; a failed reference check never deletes a file.

### Public branch selector and menu

The brand page loads eligible places by brand slug, applies the brand color, supports English/Arabic direction changes, and links each branch card to its direct menu. The public menu then loads one place by slug, applies its color as a CSS variable, supports English/Arabic direction changes, groups ordered items by category, presents size variants, shows sold-out states, and exposes configured contact/location links. In takeaway mode, items with extras open one shared bilingual customization sheet across every template. Selected extras update the displayed total and are included in the basket and WhatsApp message.

Reel uses native vertical touch/wheel momentum with CSS snapping at the end of a scroll, not the shared one-slide gesture lock. Fast flicks and repeated swipes may pass multiple dishes without a cooldown or a forced jump back. The active-slide observer keeps the caption and progress in sync; the current dish and its two neighbours on either side load eagerly with asynchronous image decoding, while distant images remain lazy. Its bilingual focusable menu region also supports native keyboard scrolling. Carousel deliberately retains its separate one-card-per-gesture behaviour.

## Design system and recent landing-page work

The visual language uses forest green, warm cream, and terracotta/orange with DM Sans, Playfair Display, and Tajawal. Shared colors live in `:root` in `src/styles.css`.

The current landing page was redesigned on 2026-09-18. Its implementation uses:

- `landing-v2` as the page scope and `lp-` prefixed selectors.
- A complete English/Arabic language switch stored under `fluxiva-landing-language`, with translated marketing copy, product mockups, accessible labels, and a dedicated RTL layout.
- Landing copy keys are checked against the Arabic dictionary at build time. Arabic uses Lebanese Arabic number formatting, localized currency/preview labels, and script-specific spacing and contrast. Storage errors do not disable the language switch.
- An animated phone/menu preview built with HTML and CSS using existing demo photography.
- A dashboard product mockup, feature grid, three-step workflow, pricing, CTA, and expanded footer.
- Intersection Observer reveal states through `[data-reveal]` and `.is-visible`.
- Responsive layouts at 1050, 900, 680, and 420 px breakpoints.
- `prefers-reduced-motion` fallbacks.

The 2026-10-09 mobile conversion pass keeps the full desktop product mockup but replaces it below 680 px with a readable, task-focused menu editor preview. Mobile also uses a sticky action bar with language, sign-in, and trial access; concise local trust and payment copy; compact feature and setup cards; and a centered RTL-safe phone mockup. Marketing copy remains paired through `landingI18n.ts`, including the Lebanon-specific setup and payment details.

Keep landing-page work scoped to the `lp-` namespace unless intentionally refactoring the global system.

## Deployment

Render is pinned to Node `22.22.0` through both `.node-version` and the Blueprint's `NODE_VERSION`. The Blueprint sets `SKIP_INSTALL_DEPS=true` to prevent Render from running an extra implicit install. Render uses the committed `pnpm-lock.yaml` with pnpm `10.18.3` for deployment because npm's installer has repeatedly crashed inside Render with `Exit handler never called`; local development remains on the supported `npm ci` workflow. The static build publishes `dist/`, and the catch-all rewrite in `render.yaml` sends every route to `index.html`, which is required for direct visits to React Router URLs such as `/b/cedar-oven` and `/m/cedar-oven-downtown`.

Supabase migrations are currently expected to be run manually in sequence in the Supabase SQL editor.

## Known constraints and technical debt

- On wide desktop Carousel layouts, multiple fully visible cards can keep the active caption on the previous dish after a navigation step. Centre-aware tracking is recorded in `TODO.md`; Reel's vertical native-scrolling change does not alter the shared observer or Carousel gesture lock.
- API/cache and isolated PostgreSQL billing/security regression tests run with `npm run test`; focused browser checks remain manual through the connected browser.
- Vite currently reports a JavaScript chunk slightly over 500 kB after minification. Consider route-based lazy loading before the application grows substantially.
- All styling is in one large file. Page-level CSS modules or organized stylesheet splits would lower regression risk.
- `DashboardPage.tsx` owns many workflows and is a strong candidate for component/hook extraction.
- Excel import batches categories and items separately. A failed item insert can leave newly created empty categories, although no partial set of items is inserted.
- Demo-mode mutations are not persisted across reloads.
- Branch deletion removes database menu records, not Storage objects. Previously uploaded `menu-assets` files may remain at their existing public URLs; cleanup needs a trusted backend job. The owner cannot delete that folder after its restaurant row is gone because Storage RLS correctly requires an existing owned restaurant. Shared gallery assets and brand logos must not be removed by branch deletion.
- Menu copying spans a database transaction and Storage requests, not one cross-service transaction. Interrupted copies stay hidden and must be deleted/retried; cleanup is best-effort and the backend orphan-asset cleanup follow-up still applies. Automated copy resume is not implemented.
- The landing page imports Google Fonts over the network; provide a fallback/self-hosting plan if offline or privacy requirements change.
- Owner/operator routes have separate guards that wait for role resolution; protected server RPCs remain the security boundary.
- Keep `.node-version`, `package.json` engines, and Render's `NODE_VERSION` aligned on Node 22. The app deliberately does not inherit Render's moving default Node version.
