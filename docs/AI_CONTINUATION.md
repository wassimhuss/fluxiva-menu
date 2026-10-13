# AI Continuation Playbook

Use this checklist when starting or handing off work on Fluxiva Menu.

Read the active product backlog in [`../TODO.md`](../TODO.md) before starting a planned feature, and update its status as the work progresses.

## 1. Start safely

```bash
git status --short --branch
git log -5 --oneline --decorate
node --version
npm ci
```

Requirements and expectations:

- Use the Node.js version pinned in `.node-version` (currently `22.22.0`).
- Preserve any unrelated working-tree changes.
- Read `AGENTS.md` and `docs/PROJECT_CONTEXT.md` before editing.
- Copy `.env.example` to `.env.local` only when a real Supabase project is available. Never commit `.env.local`.

## 2. Establish a baseline

```bash
npm run test
npm run lint
npm run build
npm run dev
```

Without Supabase variables, verify these demo paths:

- Landing page: `http://localhost:5173/`
- Brand/branch selector: `http://localhost:5173/b/hilal-oven`
- Public menu: `http://localhost:5173/m/demo`
- Dashboard: submit the form at `http://localhost:5173/login`
- Onboarding: `http://localhost:5173/onboarding`
- Platform preview: `http://localhost:5173/platform`

If the baseline already fails, record the failure before making changes so it is not mistaken for a regression.

## 3. Common change recipes

### Add or change restaurant/menu data

1. Update the shared interface in `src/lib/types.ts`.
2. Add a new numbered SQL migration in `supabase/migrations/`.
3. Update queries and mutations in `src/lib/api.ts`.
4. Update `src/lib/demo.ts` so offline mode covers the new field.
5. Update every relevant form and public rendering path.
6. Verify RLS continues to separate owners and public visitors correctly.

Do not silently depend on a field that is absent from the demo data or existing database rows. Use optional fields or a migration default when appropriate.

### Add an owner-dashboard workflow

For account routing, verify an operator's direct `/dashboard` and `/onboarding` visits return to `/platform`, and an owner's `/platform` visit returns to `/dashboard`. Landing navigation, sign-in and password-recovery completion must use the account's workspace. Role loading must not flash an owner page; a failed lookup must offer Retry/Sign out. Offline demo still supports both route previews. `tests/routes.test.mjs` covers these access decisions.

1. Keep persistence logic in `src/lib/api.ts`.
2. Reuse the domain types from `src/lib/types.ts`.
3. Give asynchronous actions visible loading/error/success feedback.
4. Update local state only in a way that can be rolled back when the remote mutation fails.
5. Verify narrow-screen sidebar, modal, and form behavior.

For item positioning, verify **Menu editor → Move item up / Move item down** moves exactly one position per tap within the current category. Check middle/first/last items, a one-item category, 320/390 px mobile and desktop in English/Arabic, keyboard labels, saving/error feedback, tied ranks, unchanged other categories/branches, public-menu order and newly added/imported items. Migration `025` provides the atomic owner RPC; verify owner access, anonymous/cross-owner denial and rollback on failure. Check preservation of photos, especially cropped/archived gallery references, bilingual content, variants, extras, prices and sold-out/recommendation states. Do not use a full-row item upsert for ordering: its INSERT trigger would revalidate gallery references and replace cropped photos.

For whole-category positioning, verify category-header **Move category up / Move category down** moves exactly one position per tap on desktop and 320/390 px mobile in English/Arabic. Check first/last and single-category disabled states, repeat moves, saving/error feedback, tied ranks, other category relative order, unchanged category items, demo branch isolation, public category-tab order and the initial section, plus adding/importing categories after a move. It uses existing `menu_categories.sort_order` with one atomic batch upsert under owner INSERT/UPDATE RLS; verify a failed batch preserves the entire previous order and cross-owner writes remain denied. No migration is required.

### Change API loading or owner caching

Run `npm run test` as well as lint/build. Tests use the real transpiled API with a controlled client and never write to production. Cache keys must include account and branch IDs, public eligibility must be rechecked on every open, and confirmed item changes must patch only affected fields. Do not persist dashboard form drafts in the cache. Keep the TanStack import lazy so guest entry bundles do not include owner-cache code. Keep both npm and pnpm lockfiles aligned when adding a dependency (Render uses pnpm).

Verify login → dashboard in demo mode, save an item/recommendation/order change, switch branches and return, and confirm edits persist independently. Also check English/Arabic at 390 and 1280 px, connection failure → bilingual Retry → successful recovery, sign-out/account isolation, overlapping saves, and late branch/analytics responses. Same-account auth refresh and returning browser focus must preserve unsaved drafts. Public menus and branch lists each use one data request; analytics is separate. Query retries remain disabled to avoid stacking them with SDK retries. No migration is needed for the initial API/cache enhancement phase.

### Change the public menu

1. Test English and Arabic.
2. Verify `dir="rtl"` behavior rather than only translated text.
3. Test items with and without photos, descriptions, and variants.
4. Keep sold-out items visible but clearly unavailable.
5. Check long restaurant/item names at 390 px width.
6. Preserve the restaurant `primary_color` theming and readable contrast.
7. For Reel, verify fast native touch/wheel gestures and immediate reverse/repeated scrolling, clean snap landing, matching captions/progress, category reset, keyboard navigation, and reduced motion. Do not reattach `useSnapLock` or `scroll-snap-stop: always`: those intentionally prevent the fast multi-item browsing required here. The horizontal Carousel keeps its own gesture lock.

### Change the landing page

1. Work inside `LandingPage.tsx` and the `/* Landing page v2 */` section of `styles.css`.
2. Prefer `lp-` selectors to generic class names.
3. Reuse demo photography from `public/menu/` before adding new assets.
4. Test the hero after entrance animations finish.
5. Verify 1280 px desktop, 768 px tablet, and 390 px mobile.
6. Check with reduced motion enabled.
7. Keep new landing copy in the typed English/Arabic dictionary. Verify Arabic currency, statistics, accessible labels, header alignment, and the complete phone preview at 390 px; do not rely on an English fallback for missing translations.

### Add a Supabase migration

1. Create the next numbered file; do not edit already-applied migrations.
2. Make repeated-safe changes where practical (`if exists` / `if not exists`).
3. Revisit RLS for every new table or column involved in client queries.
4. Use explicit `search_path` settings for security-definer functions.
5. Document manual rollout steps in the PR/commit description and this playbook if the procedure changes.

Migration `014_shared_gallery.sql` adds the shared gallery table, the `gallery_image_id` menu-item reference, protected owner/admin RPCs, and the `gallery-assets` Storage bucket. Apply it before using the gallery with a configured Supabase project. The frontend remains fully demonstrable without it in demo mode.

Migration `015_gallery_categories.sql` upgrades the gallery's repeated category text into real bilingual folders. It backfills a folder for every existing category pair, preserves all images, updates the RPC contracts, and changes new upload paths to `{category-id}/{image-id}`. Apply it after `014`; do not rewrite the already-applied gallery migration.

Migration `016_clear_gallery_images.sql` adds a protected bulk-reset RPC for deliberate database maintenance. It clears shared-gallery references and image URLs from every menu item before deleting all gallery records; the client previously removed the matching `gallery-assets` files. The platform console no longer exposes a bulk **Clear gallery** action, to prevent accidental loss of important photos. It deliberately preserves the bilingual folders for replacement photos. Apply it after `015` only where controlled maintenance access is required.

Migration `017_drop_opening_hours.sql` removes the unused English and Arabic opening-hours columns from restaurants. Apply it after `016`; the frontend no longer reads or writes either field.

Migration `018_single_language_variants.sql` removes legacy Arabic labels from every stored size variant and adds a constraint preventing `name_ar` from being written back. Apply it after `017`; variant labels now use the single English `name_en` value in both public-menu languages.

Migration `019_platform_gallery_folder_loading.sql` adds the super-admin RPC overload used by `/platform` to fetch gallery images for one folder at a time. Apply it after `018`; the original no-argument RPC remains available only for deliberate bulk operations such as **Clear gallery**.

Migration `020_item_extras.sql` adds the `menu_items.extras` JSON array used for optional bilingual add-ons and constrains it to an array value. It was applied to the configured production project on 2026-10-08. Apply it after `019` on any other Supabase environment before saving extras. RLS is unchanged because the data remains on the owner-protected `menu_items` row; demo mode includes sample extras without requiring the migration.

Migration `021_multi_place_brands.sql` creates the owner-level brand used by the shared QR destination, backfills every existing restaurant into a brand, adds `restaurants.brand_id`, and then removes the old unique owner constraint so one account can create multiple places. It was applied to the configured production project on 2026-10-11. Apply it after `020` on any other environment. The migration also adds explicit grants and RLS for public brand reads and owner mutations; a restaurant can only reference a brand owned by the same authenticated user.

Migration `022_branch_visibility_and_deletion.sql` adds `restaurants.is_published` (default true), tightens public restaurant/category/item/brand reads and contact/view RPCs for hidden branches, and adds the authenticated owner-scoped `owner_delete_place` RPC. It was tested in an isolated PostgreSQL instance and applied to the configured production project on 2026-10-11, preserving both existing branches. Apply it after `021` on other environments before deploying the new branch controls. No broad restaurant DELETE grant is added. The RPC requires the exact menu slug and retains at least one place, locking the brand to serialize concurrent deletes. Storage files are deliberately retained (including any brand-logo references); production asset garbage collection remains a backend follow-up.

Migration `023_copy_place_menu.sql` adds the hidden pending-copy constraint and the authenticated owner-only `owner_create_place_with_menu` / `owner_finish_place_menu_copy` RPCs. It was applied to the configured production project on 2026-10-11, preserving its 2 places, 6 categories and 22 items. Apply it after `022` on other environments before deploying the copying UI. Creating the branch/menu is atomic in Postgres; personal Storage files are then copied into the new UUID folder before the completion RPC validates/replaces URLs. Copies remain hidden for price review. No service-role key or new Storage/RLS policy is needed. A closed tab or failed rollback may leave a hidden **Copy incomplete** place that cannot be published; delete that place and retry (automatic resume is not implemented).

Migration `024_item_highlights.sql` adds `menu_items.highlighted` (non-null, default false) and replaces the branch-copy RPC to preserve that flag. Apply it after `023` before deploying the highlight toggle to a configured Supabase environment. Existing item grants and owner/public RLS remain unchanged. The new migration has been verified with all migrations in isolated PostgreSQL, including owner updates, cross-owner/anonymous denials, suspended public access, default values, repeated application, and independent highlights on copied branches. It was applied transactionally through the Supabase SQL editor to the configured production project on 2026-10-12, preserving 2 branches, 6 categories and 23 items. Production verification confirmed a non-null boolean defaulting to false, all 23 existing items unhighlighted, the branch-copy function preserving the flag, item RLS still enabled, authenticated copy access allowed and anonymous copy access denied. Frontend deployed with release `79fa2d6` on 2026-10-12.

Migration `025_item_single_step_order.sql` adds `owner_move_menu_item`, an authenticated security-invoker RPC that moves an item one position within an owned category. It locks the category and sibling items, swaps neighboring IDs, normalizes ranks and updates only `sort_order` in one transaction; existing RLS remains enforced. Apply it after `024` before deploying the new item controls. Isolated PostgreSQL verification covers repeated application, one-step/tied-rank ordering, boundaries, category scope, owner/anonymous/cross-owner access, rollback on a failed sibling write, and preservation of all item content including cropped archived gallery photos. It was applied transactionally through the Supabase SQL editor to the configured production project on 2026-10-12, preserving 2 branches, 6 categories and 23 items. Production verification confirmed security-invoker execution, authenticated access and anonymous denial. Frontend deployed with release `79fa2d6` on 2026-10-12.

For highlights, verify the star on/off in the owner editor at 390 px and desktop in English/Arabic, badge/ordering/sold-out rendering across all eight designs, unchanged category tabs and initial category, and unchanged category membership and item order before/after star toggles. Recommendations are badges only: never create a Recommended section or move items when highlighted. Demo state resets on full navigation/reload; navigate within the SPA when verifying that owner edits reach the public menu.

The existing npm lockfile contains some resolved tarball URLs on `nexus.eulerts.cloud`, which was unreachable during 2026-10-12 verification. `npm ci` succeeded with only those URL prefixes temporarily replaced by `https://registry.npmjs.org/`; the committed lockfile was restored unchanged. If clean installation fails with `ENOTFOUND` / `Exit handler never called`, check these resolved URLs before attributing it to Node or the feature change.

For changes to copying, verify **Add place → Copy menu from… → create → edit copied prices → switch back → unchanged original → Show branch** in English/Arabic at 390 px and desktop. Also test the empty-menu alternative, duplicate-slug errors, sizes/extras, currency, sold-out/order preservation, shared-gallery and personal-photo lifetimes, copy failure cleanup, and owner/anonymous/cross-owner RPC access. Demo mutations now retain category/item edits during branch switches within the same runtime, but still reset on full reload.

### Cash billing rollout (026)

Apply `026_cash_subscriptions.sql` after 025 and before deploying the cash console. It adds private pricing/agreements/immutable receipts/voids, guarded RPCs, and protects restaurant subscription columns against direct owner writes. Do not replay 001–025 against the configured production project: those migrations were previously applied through the SQL editor. For another environment, apply all numbered migrations in order.

Before rollout, save restaurant status, trial/paid expiry and publication snapshots plus menu counts. After migration, confirm those values are unchanged and the new price/receipt tables are empty. No historical cash import or automatic price assignment is performed. The admin must enter each shop's actual annual price before taking its first cash receipt; published $60 marketing pricing is unchanged. Check protected reads as an owner/admin and anonymous denial. Review Supabase security/performance advisors; private tables deliberately have RLS and no direct policies, and authenticated definer RPCs deliberately enforce authorization inside each function.

`npm run test` now includes real isolated PostgreSQL through the exact PGlite development dependency, in addition to API/cache tests. Financial tests never write production receipts. Exercise full/split/unequal payments, admin-entered coverage dates independent of cash amounts, settlements without extensions, stale previews, duplicate retries, corrections, rollback, archived places and role boundaries. Keep cash collection dates in Beirut time. Verify `/platform` Subscribers, Collections and Activity plus `/dashboard` Subscription & payments in English/Arabic and demo mode. Billing refresh must not reset menu drafts. Do not submit fabricated receipts to production for QA.

Migration 026 was applied with the Supabase migration tool on 2026-10-12 after all 001–026 migrations and repeated 026 application passed in isolated PostgreSQL. Production retained 2 places, 6 categories, 23 items and identical trial/paid dates, publication flags and admin roles. Protected admin directory/collections and owner billing reads succeeded; the regular owner still has no operator role. All new billing RPCs deny anonymous execution and use an empty search path. New cash and price tables contain no assumed historical records. Advisors reported no new billing foreign-key/index issues; the private-table no-policy and authenticated-definer notices are intentional guarded access, while existing gallery/RLS/index and leaked-password-protection notices remain separate follow-ups.

### Platform account controls (027)

Apply `027_platform_account_controls.sql` after 026. It adds super-admin-only account actions for suspending/restoring every shop owned by a subscriber and deleting a subscriber after exact email confirmation. Deletion cascades the Auth account and active menu data while preserving cash agreements and receipts as archived billing history. The frontend includes explicit confirmation dialogs and demo-mode equivalents. It was applied successfully to the configured production project on 2026-10-12; both RPCs were verified in `pg_proc` afterward.

### Platform storage usage (029)

Apply `029_platform_storage_usage.sql` after 028. It adds the protected `platform_storage_usage()` RPC for the `/platform` Storage view. The function reads file sizes from `storage.objects.metadata`, attributes `menu-assets/{restaurant-id}/...` to the current owner and restaurant, and reports shared `gallery-assets` separately. It requires a platform-admin role and is executable only by authenticated callers; no direct Storage metadata policy or service-role key is added. Set `VITE_SUPABASE_STORAGE_QUOTA_GB` to `1` for the Free quota or `100` for the Pro quota in local/Render environments. The UI's remaining-space meter compares this configured quota with the live object inventory; Supabase's invoice usage is averaged in GB-hours and remains authoritative.

Migration 030 was applied transactionally through the production SQL editor on 2026-10-13. Authenticated super-admin reads returned the exact inventory: 331 files, 36,993,398 bytes. Regular-owner calls were rejected and anonymous execution was denied; the function has an empty search path. Production retained 2 restaurants, 6 categories and 23 items, and a restaurant-row checksum confirmed the existing settings, access dates and publication state were unchanged. Support read access is covered by the isolated PostgreSQL test. Clean installation, the full test suite, lint and build passed on Node 22.22.0; `/platform` Storage was checked in English/Arabic at 1280 and 390 px with no console errors or mobile overflow. The configured Supabase organization is Free, so the deployed quota defaults to 1 GB.

The Storage frontend release `e17cb20` was pushed and confirmed live on Render on 2026-10-13. The release integrates the concurrent `f3cff2b` manual-billing changes and uses migration number 029 because manual cash access dates occupy 028. All 37 tests, lint/build and merged Storage UI checks passed. Hosted assets include the Storage view, `platform_storage_usage` call and the 1 GB quota fallback. Hosted admin verification stopped at the sign-in screen; production RPC security/inventory and local bilingual UI were verified separately.

Deployment is a normal fast-forward release on the configured GitHub/Render branch. Verify the new console on the hosted site; a successful push alone does not confirm Render deployed it. If Render sign-in is unavailable or auto-deployment does not occur, report the concrete deployment blocker and keep the tested source/migration ready.

The cash frontend release `79fa2d6` was pushed to the sole/default branch `codex/fluxiva-menu` and deployed automatically by Render on 2026-10-12. Hosted admin and regular-owner authentication, read-only owner billing, subscriber accounts including an owner with no shop, shop billing/legacy carryover, Arabic navigation and preserved expiry dates were verified read-only. The admin must still enter each actual shop price before recording its first cash receipt. No production test receipts were recorded. The temporary phone QA frame and server were removed; proof images remain outside the repository.

## 4. Verification by risk

### Documentation-only

```bash
git diff --check
```

Check internal links and command accuracy.

### UI or client-logic changes

```bash
npm run test
npm run lint
npm run build
```

Then perform focused browser verification on every affected route, desktop/mobile breakpoints, and the browser console.

### Database/security changes

In addition to lint/build:

- Apply migrations to a non-production Supabase project.
- Test as an anonymous visitor, a restaurant owner, a different restaurant owner, and a platform admin when relevant.
- Confirm public access closes correctly for suspended/expired restaurants.
- Confirm storage paths cannot be written across restaurant ownership boundaries.

## 5. Definition of done

A change is ready only when:

- The requested behavior is implemented, not merely scaffolded.
- Demo mode still works unless the task explicitly replaces it.
- English and Arabic behavior remain coherent.
- Responsive UI is verified at the affected breakpoints.
- Keyboard focus, labels, contrast, and reduced-motion behavior are considered.
- `npm run lint` passes.
- `npm run build` passes, with any remaining warning reported.
- `git diff --check` passes.
- No secrets, `.env.local`, `dist/`, or `node_modules/` are included.
- Durable architectural or operational changes are reflected in the documentation.

## 6. Handoff template

Use this compact structure when another agent or developer will continue:

```text
Outcome:
- What now works.

Changed:
- Important files and decisions.

Verified:
- Commands and browser routes/viewports checked.

Remaining:
- Known gaps, warnings, migration/deployment steps, or user decisions.
```

## 7. Sensible next improvements

These are opportunities, not committed roadmap items:

1. Add unit tests for formatting, slugging, Excel workbook parsing, and variant cleaning.
2. Add route-level integration tests for demo-mode onboarding, dashboard editing, and public-menu language switching.
3. Split `DashboardPage.tsx` into focused panels/hooks.
4. Split the central stylesheet into page or feature boundaries.
5. Lazy-load owner and platform routes to reduce the production bundle.
6. Make Excel category/item import fully transactional so a failed item batch cannot leave empty categories.
7. Add a documented Supabase migration/deployment pipeline.

### Subscriber profiles (031)

Apply `031_subscriber_details.sql` after 030. It is a read-only operator RPC, not a grant of direct Auth-table access. Test both operator roles, owner/anonymous denial, omitted credential/raw metadata fields, empty accounts, archived owners/shops, stable 25-entry activity pagination and repeat application in isolated PostgreSQL. Archive registration/sign-in dates are unknown; never substitute receipt dates. Trial expiry is not paid time, and zero recorded receipts are not proof of zero historical cash.

Check `/platform` → subscriber email/eye → Account / Shops & payments / Activity in English/Arabic at 1280 and 390 px. Verify billing/back preserves the chosen shop, directory/back preserves search/page, deep-link reload, missing-subscriber recovery and console errors. Profile activity identifies shop suspension/restoration explicitly. The retained profile stays mounted while billing is shown, with aborted reads on account/query changes. Existing super-admin confirmations and support read-only behavior remain. Production checks must compare real shop dates/settings/menu counts and ledger records before/after and must not fabricate receipts or delete real subscribers.

Migration 031 was applied to production on 2026-10-13 as `20261013124932`. Full restaurant snapshots, account/menu counts, ledger/audit and stored-file counts matched before/after. The protected real-owner profile returned its September 13 registration/shop dates, exact paid-through timestamp, 6 categories, 23 items and 13 menu files without Auth secrets. Owner and anonymous access were denied. Security advisors were reviewed: the new RPC is intentionally executable by authenticated users with an internal operator guard and empty search path; no anonymous grant was added. Isolated tests cover both operator roles, empty/archived records and repeat application. All 43 tests, lint, build and diff checks passed; existing main/Excel bundle warnings remain. English/Arabic desktop and 390 px demo account/shop views, trial/payment separation and billing/back navigation were checked, with no console errors in the clean profile tab. QA files and images remain outside Git.

Frontend release `08e7d51` was verified on Render: clicking the real subscriber email opened the profile, correct Beirut dates and shop statistics loaded, and the scoped Activity view showed its three retained events without runtime errors. Historical `subscription.active`/`trial` entries name the resulting activated state; their stored expiry changes remain visible without assuming that a legacy grant was a restoration or inventing a cash payment.

### Owner expiry lock (030)

Apply `030_owner_expiry_lock.sql` after 029. Validate all migrations in isolated PostgreSQL and repeat 030 application before production. Compare live shop status, exact trial/paid dates, publication flags, menu counts and billing records before/after; this migration changes functions, triggers and restrictive Storage policies only. Public access stops at expiry, owner editing locks exactly 168 hours later, and suspension locks immediately. Do not fabricate cash receipts or alter real expiry dates for QA. Test isolated/demo recent-expired and week-expired shops, then check a hosted unavailable link and the existing active owner after deployment.

Native owner/guest dialogs use direct cancel/close listeners to keep the required gate open, including browser keyboard dismissal. Billing remains reachable, and switching to an active shop removes the gate. Owner billing/access refreshes must patch only subscription fields in both the selected menu and branch summaries, leaving drafts intact; latest-request guards prevent older reads from reversing renewal or receipt/correction results. Avoid starting overlapping access sources while the billing panel owns its read. A locked branch switcher offers switching only; mutation controls are disabled. Owners cannot delete expired places or create replacement trials until their access is resolved.

Migration 030 was applied on 2026-10-13 as `20261013121512` after isolated/repeated migration tests and read-only review. Before/after production snapshots matched exactly: one active published shop paid through `2027-09-27T12:08:02.803184+00:00`, 6 categories, 23 items and no agreements/receipts/prices. No real expiry was modified for testing. Production boundary queries confirmed editing closed at exactly 168 hours, open one second before, public access closed at expiry and suspension closed immediately. Existing owner billing reads and asset permission remained available. Advisors add only the intended authenticated owner-asset boolean helper to their security-definer inventory; it checks `auth.uid()`, ownership and editing eligibility, denies anonymous execution and has an empty search path. Existing advisory categories remain. English/Arabic desktop and 390 px demo owner/guest flows, billing escape, live branch switching and Escape-key persistence passed; a clean owner tab logged no runtime errors. All 40 tests, lint, build and diff checks passed. Build warnings remain for Excel and the main bundle slightly above 500 kB. No QA fixtures, proof images, environments or generated output belong in the commit.

### Manual cash access dates (028)

Apply `028_manual_cash_access_dates.sql` after 027. New `platform_preview_manual_cash_payment` and `platform_record_manual_cash_payment` RPCs require `starts_input` and `ends_input`; the older amount-based RPCs explicitly reject automatic grants; the old record RPC permits only locked, exact-match reconciliation of existing receipt IDs. Both new RPCs require super admin, use an empty search path and deny anonymous execution. Receipt retries compare the exact dates as part of their idempotency check. No existing rows are rewritten. Voids use stored receipt expiries instead of calculating calendar months; remaining receipts retain their periods. The admin form leaves both dates blank, shows the server-validated agreed expiry before confirmation, and preserves uncertain requests with their exact dates. Selecting the displayed current expiry retains the original seconds/microseconds, avoiding accidental shortening or extension. Old interrupted requests remain locked and reconcile through their original ID; unrecorded old requests receive a definitive rejection before new manual dates are entered. Secondary dashboard actions are Lucide icon buttons with bilingual labels/tooltips and 44 px targets; consequential confirmations retain explicit wording.

Migration 028 was applied to production on 2026-10-13 (version `20261013111943`) after all migrations and repeated 028 application passed in isolated PostgreSQL. A protected production preview returned the explicitly chosen November 20 expiry for an $80 payment. Both shops retained their exact trial/paid timestamps, status and publication flags; the existing $120 price, 6 categories and 23 items were unchanged. Production still contains no fabricated cash receipts. New RPCs deny anonymous execution and retain super-admin write guards. Security advisors were reviewed after application.

Frontend source release `8658383` is deployed and verified on Render (2026-10-13). Hosted admin icon navigation and the English/Arabic $80 preview returned the manually entered November 20 expiry; the preview was discarded without recording a receipt. Real owner billing remained read-only with unchanged access. English/Arabic desktop and 390 px admin/owner demo flows passed, including required blank dates, manual receipts and corrections. All 36 tests, lint, build and diff checks passed; the existing Excel bundle warning remains. Temporary QA files/tabs were removed, and no environment, generated output or proof images were committed.
