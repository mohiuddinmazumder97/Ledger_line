# Phase 6 — Dashboard & Accounts

Goal: pixel-faithful Dashboard (all three layouts) and Accounts screens on real data.

Read the dashboard and accounts sections of the prototype markup and the matching parts of `renderVals()`.

## Build

1. Dashboard `/`:
   - Header: date line ("Sunday, November 22, 2026" in user timezone), "Good morning/afternoon/evening, {firstName}", layout `Segmented` (A · Overview / B · Split / C · Calendar) saved via `PATCH /me/settings`, "+ New record".
   - Grid with `grid-template-areas` from the prototype's `LAYOUTS`.
   - Cards (one component each, each with its own query, skeleton and empty state):
     - `NetWorthCard` — kicker, 52px total, assets / liabilities / net this month, currency mix bar + labels.
     - `AccountsStrip` — "Accounts", "{n} hidden in Settings" note, Manage → `/accounts`; cards for accounts with `showOnDashboard`; clicking navigates to `transactionsHref({ accountId, month: current })`.
     - `SpendingCard` — 6 bars (current month accent, others accent-300) with values above and month labels below (plain divs exactly like the prototype — no chart library), plus "{Month} by category" list with bars.
     - `InsightsCard` — four insights with exact copy patterns from the prototype.
     - `SpendingCalendar` — 53×7 heatmap, weeks start Sunday, Mon/Wed/Fri labels, month labels, 5-level legend "Less … More", tooltips, summary "{n} days with spending in the last year · excludes rent".
     - `GoalsCard` (top 3) and `BudgetsCard` (current month) with "All goals" / "All budgets" links.
2. Accounts `/accounts`:
   - Header summary line, "Transfer between accounts" (opens drawer with type transfer — drawer itself is phase 7a; for now wire the store call).
   - Account cards (kind, currency, balance, sub line "≈ $X USD" for foreign currency / "Balance owed" for credit / "Available"), Transactions button, "Hidden on dashboard" tag.
   - "Add an account" inline form (name, type, currency, opening balance) → POST, invalidate accounts + net worth, toast "Account added".
   - Add an edit/archive menu per card (our addition; keep it subtle). Archive is disabled with the hint "Bring the balance to zero to archive" unless the balance is 0 (the API enforces it too).
3. Base-currency changes in Settings must re-render all of this correctly (queries keyed by base currency or invalidated on change).

## Done when

- Screenshot comparison: Playwright opens the prototype (`docs/design/ledgerline-prototype.dc.html`, pinned to the matching screen and theme) and the app (seeded Alex, `SEED_TODAY=2026-11-22`, clock frozen at the prototype's 14:30) at 1440×900, in light and dark; store both images and a pixel diff under `apps/web/e2e/__screenshots__/`, and review every diff above a small threshold. Cover the dashboard in all three layouts and `/accounts`.
- With seeded Alex, the dashboard matches the prototype in all three layouts, light and dark (diffs reviewed), and figures match the API and the prototype (balances are exact after the phase 1 back-solve).
- Loading and empty states exist for a brand-new user.
