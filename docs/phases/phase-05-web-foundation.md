# Phase 5 — Web foundation, theme, shell, sign-in & onboarding

Goal: the Ledgerline look implemented as a shadcn theme, the signed-in app shell, and working auth + onboarding screens.

Read `docs/DESIGN.md` fully and the auth / onboarding / sidebar parts of the prototype first.

## Build

1. Theme (`app/globals.css`): tokens from `docs/design/industry.css` + dark overrides from the prototype's `DARK` constant, mapped to shadcn variables as described in DESIGN.md; radius 0; Barlow + Barlow Condensed via `next/font`; `next-themes` with class strategy, default from the user's saved `theme`.
2. Install the shadcn components you need: button, input, label, select, textarea, sheet, dialog, toggle-group, switch, tooltip, dropdown-menu, form, sonner, skeleton (no `chart` — no chart library). Restyle variants to match `.btn-primary / .btn-secondary / .btn-ghost / .btn-icon` and `.input` from industry.css.
3. Ledger components from DESIGN.md: `BlueprintFrame`, `Segmented`, `Chip`, `Kicker`, `BigNumber`, `ProgressBar`, `MoneyText`, `IconSwitch`. Add a dev-only `/_styleguide` page rendering all of them in light and dark.
4. `lib/money.ts`: `formatMoney(minorString, currency, { decimals? })` matching the prototype's `fmt()` (symbol, U+2212 minus, en-IN grouping + 0 decimals for INR, 2 elsewhere). Vitest tests.
5. Data layer: `QueryClientProvider` with sensible defaults (staleTime 30s, no refetch on focus for reports), `@tanstack/react-query-devtools` in dev. Use the generated hooks only. Add the nuqs adapter (`NuqsAdapter`) in the root layout for URL state.
6. Zustand stores (UI only): `useDrawerStore` (open, initial values: type, toAccountId, goalId, note), `useUiStore` (dashboard layout override). Persist nothing that the server already stores. No filters store — transaction filters live in the URL via nuqs (phase 7b); add a typed `transactionsHref(filters)` helper now so other screens can link to filtered lists.
7. Auth:
   - `middleware.ts`: redirect to `/signin` when the `session` cookie is absent on `(app)` routes; redirect users with the cookie away from `/signin`. Presence only — the API validates; a 401 from any query sends the user to `/signin`.
   - `/signin`: split layout from the prototype; tabs; react-hook-form + zod; error states; on success → `/` or `/onboarding` if `onboardedAt` is null.
   - `/onboarding`: 3 steps exactly as the prototype (currency chips, account name + balance, category chips from `/api/onboarding/templates`), progress bars, Back/Continue/Go to dashboard → POST onboarding.
8. App shell `app/(app)/layout.tsx`: sidebar (brand, New record button, 8 nav items with active style from the prototype, theme toggle "☾ Dark mode / ☀ Light mode" that also PATCHes settings, user block with initials), main scroll area, floating + button, `<Toaster/>` bottom-center. Placeholder pages for all 8 routes with the correct H1.
9. Below 900px: sidebar collapses into a top bar with a menu sheet (our responsive addition).
10. Playwright set-up (`apps/web/e2e`) with a **smoke test**: register → onboarding → dashboard shell → sign out → `/signin`. Runs in CI against the dev stack.
11. Screenshot comparison: Playwright opens the prototype (`docs/design/ledgerline-prototype.dc.html`, pinned to the matching screen and theme) and the app (seeded Alex, `SEED_TODAY=2026-11-22`, clock frozen at the prototype's 14:30) at 1440×900, in light and dark; store both images and a pixel diff under `apps/web/e2e/__screenshots__/`, and review every diff above a small threshold. Cover `/signin`, `/onboarding` (each step) and the shell/sidebar.

## Done when

- Register → onboarding → empty dashboard shell works end to end; sign out returns to `/signin`; the Playwright smoke test passes.
- `/_styleguide` matches the prototype's look in both themes; sign-in / onboarding / shell screenshot diffs reviewed.
- Lint, typecheck, unit tests pass.
