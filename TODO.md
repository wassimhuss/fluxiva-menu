# Fluxiva Menu — Product TODO

This file is the working product backlog for developers and AI agents. Keep it updated when an item is started, completed, postponed, or materially redesigned.

## Status guide

- `[ ]` Planned
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked or waiting for a prerequisite

## Shared image gallery

**Status:** `[x]` Local implementation complete; migration and the first production image collection still need deployment/content work.

Build a curated **Fluxiva Gallery** that lets every restaurant owner either select a ready-made food image or upload their own photo while editing a menu item.

### Product rules

- Show two clear image choices in the item editor: **Fluxiva Gallery** and **Upload your photo**.
- Gallery images are curated by Fluxiva. Owner uploads must never be published to the shared gallery automatically.
- Store each gallery image once and let restaurants reuse its public URL. Do not create a separate copy for every restaurant.
- Keep uploaded restaurant assets inside that restaurant's existing Storage folder and ownership rules.
- Support English and Arabic names, categories, and search tags for gallery entries.
- Use only images that Fluxiva owns, generated images whose terms allow this use, or properly licensed images. Record the source and license internally.

### Image preparation prerequisite

- [ ] Collect the initial set of food images.
- [ ] Confirm ownership/licensing and record the source for every image.
- [x] Open a 4:5 portrait cropper for every new gallery photo, produce an exact `1200 × 1500` optimized original, and generate a `320 × 320` thumbnail during upload.
- [ ] Frame the full plate near the center with generous space around it so the same image survives portrait, square, and landscape crops.
- [ ] Avoid text, logos, watermarks, hands, and important details near the edges.
- [ ] Prepare a `320 × 320` thumbnail for fast gallery browsing.
- [ ] Give every image paired English/Arabic names, a food category, and searchable tags.

### MVP implementation

- [x] Store typed gallery records in Supabase with bilingual metadata, URLs, active state, usage counts, and private provenance/license notes.
- [x] Store optimized full images and thumbnails once in the dedicated public `gallery-assets` bucket.
- [x] Add a responsive gallery picker with bilingual search and category filtering.
- [x] Show the selected image and let the owner remove, replace, or switch it to a personal upload.
- [x] Save a gallery image by URL and ID without uploading or duplicating it per restaurant.
- [x] Delete replaced owner assets only after a successful item update, while never deleting shared gallery files from owner workflows.
- [x] Preserve upload validation, optimization, rollback, and cleanup for owner photos.
- [x] Keep the complete workflow usable in demo mode without Supabase.
- [x] Add a super-admin-only console to upload, edit, archive, restore, and safely delete gallery images.
- [x] Organize the gallery into real bilingual folders that the super admin can create, rename, order, archive, and delete when empty.
- [x] Make owners browse folders before selecting an image, while keeping cross-folder search available.
- [x] Store new gallery files under stable category and image IDs rather than visible folder names.

### Verification and acceptance criteria

- [x] An owner can choose a gallery image and persist its URL and ID on the item.
- [x] Multiple restaurants can reference the same gallery URL without duplicate uploads.
- [x] An owner can switch between a gallery image and a personal upload safely.
- [x] Deleting an item never deletes a shared gallery image.
- [x] Search, filtering, selection, empty states, and errors are implemented responsively.
- [x] English and Arabic labels, search data, and RTL layout work correctly.
- [ ] Gallery images crop acceptably in every supported public-menu template.
- [x] Keyboard labels, focusable controls, contrast, and motion-free gallery behavior are implemented.
- [x] `npm run lint`, `npm run build`, and `git diff --check` pass.

### Later phase, after the MVP proves useful

- [x] Move gallery metadata into Supabase for non-code management.
- [x] Add an internal admin workflow to add, edit, archive, and safely remove gallery images.
- [ ] Add popularity/recent filters without exposing restaurant-specific information.
- [ ] Consider an owner contribution flow: **Submit → Review → Approve**. Never allow direct unreviewed publishing.
- [x] Track image usage so a gallery file cannot be removed while menu items still reference it.
- [x] Give super admins a confirmed bulk reset that clears all gallery references before replacing the curated photo set.

## Engineering backlog

- [ ] Add unit tests for formatting, slugging, Excel workbook parsing, and variant cleaning.
- [ ] Add integration tests for demo onboarding, dashboard editing, and public-menu language switching.
- [ ] Split `DashboardPage.tsx` into focused components and hooks.
- [ ] Split the central stylesheet into page or feature boundaries.
- [x] Lazy-load owner and platform routes to reduce the production JavaScript bundle (completed 2026-09-19).
- [ ] Make Excel category/item import fully transactional so a failed item batch cannot leave empty categories.
- [ ] Add a documented Supabase migration and deployment pipeline.

## Multi-place accounts and one brand QR

**Status:** `[x]` Complete; migration `021_multi_place_brands.sql` was applied to the configured production Supabase project on 2026-10-11.

- [x] Let one owner account manage multiple places, with an independent menu, settings, public slug, images, and analytics for each place.
- [x] Add a persistent place switcher and an in-dashboard bilingual **Add another place** workflow.
- [x] Make mobile place management discoverable with a visible **Your places / Add place** row on the overview.
- [x] Add a public bilingual `/b/:slug` branch selector for the brand-level QR code.
- [x] Keep direct `/m/:slug` menu links for a specific place.
- [x] Backfill every existing restaurant into its own brand before removing the one-restaurant-per-owner database constraint.
- [x] Keep owner and public access protected by RLS, including validation that a place can only join its owner's brand.
- [x] Preserve the complete branch selection, switching, and creation flow in demo mode.
- [x] Apply migration `021_multi_place_brands.sql` to the configured Supabase project and verify the backfill, schema constraints, policies, and anonymous branch-selector access (2026-10-11).

## Copy a menu into a new branch

**Status:** `[x]` Implementation verified; migration `023_copy_place_menu.sql` applied to the configured production project on 2026-10-11. Frontend deployment remains pending.

- [x] Add bilingual **Copy menu from…** / **Start with an empty menu** choices when adding a branch.
- [x] Copy categories, items, bilingual copy, prices, sizes, extras, availability, ordering and menu design into independently editable records.
- [x] Duplicate personal photos into the new branch's Storage folder while safely reusing active shared-gallery photos and protecting repeated-photo references.
- [x] Start copied branches hidden for price review; preserve the original menu, brand QR, subscriptions and analytics.
- [x] Verify demo workflows, responsive English/Arabic forms at 320/390/600/1280 px, secure owner-only RPCs (all migrations in isolated PostgreSQL), and client copy/failure-cleanup paths.
- [x] Apply migration `023_copy_place_menu.sql` to the configured Supabase project, preserving existing menu records.
- [ ] Add automatic resume/cleanup for interrupted hidden menu copies.

## Branch visibility and deletion

**Status:** `[x]` Core workflow verified; migration `022_branch_visibility_and_deletion.sql` applied to the configured production project on 2026-10-11. Frontend deployment and asset garbage collection remain follow-ups.

- [x] Add bilingual Hide / Show and confirmed Delete controls to the owner place switcher.
- [x] Keep hidden branch menus editable while excluding them from shared QR selection and direct public links.
- [x] Protect deletion with server-side ownership, exact-slug confirmation, cascading menu cleanup, and a concurrent-safe last-place guard.
- [x] Verify mobile/desktop English/Arabic flows, demo behavior, public reads, and cross-owner access (isolated PostgreSQL migration/RLS tests plus browser checks at 320/390/600/1280 px).
- [x] Apply migration `022` to the configured Supabase project, preserving existing branches and verifying RPC privileges.
- [ ] Add a trusted backend cleanup job for unreferenced restaurant Storage assets after branch deletion.

## Item extras

**Status:** `[x]` Complete; migration `020_item_extras.sql` was applied to the configured production project on 2026-10-08.

- [x] Let owners add paired English/Arabic extras with an added price to any item.
- [x] Keep extras separate from sizes: one size may be selected, then multiple extras may be added.
- [x] Use one bilingual customization sheet across all eight order-enabled menu templates.
- [x] Keep differently customized copies of the same item as separate basket lines.
- [x] Include selected extras in totals, the basket, restored session orders, and WhatsApp messages.
- [x] Preserve the complete workflow in demo mode.
- [x] Verify English and Arabic customer flows, distinct customized lines, lint, and production build.

## Completed product improvements

- [x] Connect the Reel closing/footer card to the dashboard palette in saved menus and live previews, including contrast-aware text/icons and contact surfaces; verify English/Arabic at 390/1280 px with all presets and light/dark custom colors (2026-10-11).
- [x] Replace the generic footer chat icon with the WhatsApp brand icon across all eight menu templates, preserving theme colors, contact links, and bilingual responsive layouts (2026-10-11).
- [x] Confirm before hiding a visible menu item while keeping restoration a one-tap action (2026-10-09).
- [x] Add persistent English/Arabic translations and RTL layouts to login, signup, and password-recovery screens (2026-10-09).
- [x] Refine the landing page for mobile conversion with clearer bilingual copy, sticky navigation, readable product previews, local trust/payment details, compact sections, and RTL-safe layouts (2026-10-09).
- [x] Autofill empty English and Arabic item names from a selected Fluxiva Gallery photo without overwriting owner-entered names (2026-10-08).
- [x] Add a drag-and-zoom cropper that produces exact `1200 × 1500` 4:5 portrait super-admin gallery uploads (2026-09-29).
- [x] Reuse the `1200 × 1500` portrait cropper for owners replacing personal item photos, including an immediate cropped preview (2026-09-29).
- [x] Show immediate loading feedback while switching templates in the public demo menu (2026-09-25).
- [x] Let owners show or hide all food-item photos without deleting uploaded files (2026-09-23).
