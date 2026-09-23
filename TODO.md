# Fluxiva Menu — Product TODO

This file is the working product backlog for developers and AI agents. Keep it updated when an item is started, completed, postponed, or materially redesigned.

## Status guide

- `[ ]` Planned
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked or waiting for a prerequisite

## Next planned feature: shared image gallery

**Status:** `[!]` Waiting for the first curated food-image collection.

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
- [ ] Prepare one square `1200 × 1200` WebP per image, ideally below `280 KB`.
- [ ] Frame the full plate near the center with generous space around it so the same image survives portrait, square, and landscape crops.
- [ ] Avoid text, logos, watermarks, hands, and important details near the edges.
- [ ] Prepare a `320 × 320` thumbnail for fast gallery browsing.
- [ ] Give every image paired English/Arabic names, a food category, and searchable tags.

### MVP implementation

- [ ] Add a typed gallery manifest containing image ID, English/Arabic names, category, tags, thumbnail URL, full image URL, and internal provenance/license notes.
- [ ] Add the curated image and thumbnail files under a dedicated `public/gallery/` directory.
- [ ] Add a responsive gallery picker to the dashboard item editor.
- [ ] Add search and category filtering with bilingual labels.
- [ ] Show which image is currently selected and allow the owner to remove or replace it.
- [ ] Save a gallery image by URL without uploading or duplicating the file.
- [ ] When replacing an owner-uploaded image with a gallery image, delete the old owned asset only after the item update succeeds.
- [ ] Never delete a shared gallery file when an owner changes or deletes a menu item.
- [ ] Preserve the existing upload validation, optimization, rollback, and cleanup behavior for owner photos.
- [ ] Keep the complete workflow usable in demo mode without Supabase.

### Verification and acceptance criteria

- [ ] An owner can choose a gallery image, save the item, reload, and still see the selection.
- [ ] Multiple restaurants can reference the same gallery URL without duplicate uploads.
- [ ] An owner can switch between a gallery image and a personal upload safely.
- [ ] Deleting an item never deletes a shared gallery image.
- [ ] Search, filtering, selection, empty states, and errors work at desktop and mobile widths.
- [ ] English and Arabic labels, search data, and RTL layout work correctly.
- [ ] Gallery images crop acceptably in every supported public-menu template.
- [ ] Keyboard focus, labels, contrast, and reduced-motion behavior are verified.
- [ ] `npm run lint`, `npm run build`, and `git diff --check` pass.

### Later phase, after the MVP proves useful

- [ ] Move gallery metadata into Supabase when non-code management is needed.
- [ ] Add an internal admin workflow to add, edit, archive, and replace gallery images.
- [ ] Add popularity/recent filters without exposing restaurant-specific information.
- [ ] Consider an owner contribution flow: **Submit → Review → Approve**. Never allow direct unreviewed publishing.
- [ ] Track image usage so a gallery file cannot be removed while menu items still reference it.

## Engineering backlog

- [ ] Add unit tests for formatting, slugging, CSV parsing, and variant cleaning.
- [ ] Add integration tests for demo onboarding, dashboard editing, and public-menu language switching.
- [ ] Split `DashboardPage.tsx` into focused components and hooks.
- [ ] Split the central stylesheet into page or feature boundaries.
- [ ] Lazy-load owner and platform routes to reduce the production JavaScript bundle.
- [ ] Make CSV import transactional or provide a row-level failure report.
- [ ] Add a documented Supabase migration and deployment pipeline.

## Completed product improvements

- [x] Let owners show or hide all food-item photos without deleting uploaded files (2026-09-23).
