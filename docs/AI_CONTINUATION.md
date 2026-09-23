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

- Use Node.js 22 or newer.
- Preserve any unrelated working-tree changes.
- Read `AGENTS.md` and `docs/PROJECT_CONTEXT.md` before editing.
- Copy `.env.example` to `.env.local` only when a real Supabase project is available. Never commit `.env.local`.

## 2. Establish a baseline

```bash
npm run lint
npm run build
npm run dev
```

Without Supabase variables, verify these demo paths:

- Landing page: `http://localhost:5173/`
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

1. Keep persistence logic in `src/lib/api.ts`.
2. Reuse the domain types from `src/lib/types.ts`.
3. Give asynchronous actions visible loading/error/success feedback.
4. Update local state only in a way that can be rolled back when the remote mutation fails.
5. Verify narrow-screen sidebar, modal, and form behavior.

### Change the public menu

1. Test English and Arabic.
2. Verify `dir="rtl"` behavior rather than only translated text.
3. Test items with and without photos, descriptions, and variants.
4. Keep sold-out items visible but clearly unavailable.
5. Check long restaurant/item names at 390 px width.
6. Preserve the restaurant `primary_color` theming and readable contrast.

### Change the landing page

1. Work inside `LandingPage.tsx` and the `/* Landing page v2 */` section of `styles.css`.
2. Prefer `lp-` selectors to generic class names.
3. Reuse demo photography from `public/menu/` before adding new assets.
4. Test the hero after entrance animations finish.
5. Verify 1280 px desktop, 768 px tablet, and 390 px mobile.
6. Check with reduced motion enabled.

### Add a Supabase migration

1. Create the next numbered file; do not edit already-applied migrations.
2. Make repeated-safe changes where practical (`if exists` / `if not exists`).
3. Revisit RLS for every new table or column involved in client queries.
4. Use explicit `search_path` settings for security-definer functions.
5. Document manual rollout steps in the PR/commit description and this playbook if the procedure changes.

## 4. Verification by risk

### Documentation-only

```bash
git diff --check
```

Check internal links and command accuracy.

### UI or client-logic changes

```bash
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

1. Add unit tests for formatting, slugging, CSV parsing, and variant cleaning.
2. Add route-level integration tests for demo-mode onboarding, dashboard editing, and public-menu language switching.
3. Split `DashboardPage.tsx` into focused panels/hooks.
4. Split the central stylesheet into page or feature boundaries.
5. Lazy-load owner and platform routes to reduce the production bundle.
6. Make CSV import transactional or provide a row-level failure report.
7. Add a documented Supabase migration/deployment pipeline.
