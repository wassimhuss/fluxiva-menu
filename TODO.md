# Fluxiva Menu — Product TODO

This file is the working product backlog for developers and AI agents. Keep it updated when an item is started, completed, postponed, or materially redesigned.

## Status guide

- `[ ]` Planned
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked or waiting for a prerequisite

## Next planned feature: shared image gallery

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

## Engineering backlog

- [ ] Add unit tests for formatting, slugging, CSV parsing, and variant cleaning.
- [ ] Add integration tests for demo onboarding, dashboard editing, and public-menu language switching.
- [ ] Split `DashboardPage.tsx` into focused components and hooks.
- [ ] Split the central stylesheet into page or feature boundaries.
- [ ] Lazy-load owner and platform routes to reduce the production JavaScript bundle.
- [ ] Make CSV import transactional or provide a row-level failure report.
- [ ] Add a documented Supabase migration and deployment pipeline.

## Completed product improvements

- [x] Add a drag-and-zoom cropper that produces exact `1200 × 1500` 4:5 portrait super-admin gallery uploads (2026-09-29).
- [x] Reuse the `1200 × 1500` portrait cropper for owners replacing personal item photos, including an immediate cropped preview (2026-09-29).
- [x] Show immediate loading feedback while switching templates in the public demo menu (2026-09-25).
- [x] Let owners show or hide all food-item photos without deleting uploaded files (2026-09-23).
