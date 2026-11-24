# Phase 8 — Budgets, Goals, Debts, Categories, Settings

Goal: the remaining five screens, faithful to the prototype.

## Build

1. Budgets `/budgets`: subtitle "Monthly limits per category · {Month YYYY} · {used} of {total} used"; cards (name, "% used", "spent of limit", bar — over-budget bar uses text color, "{left} left · {n} days remaining" + "About {perDay} per day for the rest of the month", or when over "Over by {x} · {n} days left" + "No allowance left. Pause {category} spending until {Next month} 1."; amounts in current base); month switcher (our addition, defaults to current month); New monthly budget form (expense category select, limit in base currency) → upsert; edit limit / delete via card menu.
2. Goals `/goals`: subtitle "Link a transfer or income to a goal when you add a record."; cards (Target {date}, %, name, saved of target, bar, "{x} to go" / "Goal reached", Add money → drawer); New goal form (name, target, target **month** picker → stored as the 1st, shown "Aug 2027"); edit / archive menu.
3. Debts `/debts`: two total cards ("You're owed", "You owe"); rows (initials, person, "{note} · Due {date}" / "· Settled", direction tag "Owes you"/"You owe", amount, Mark settled / Reopen; settled rows at 50% opacity); Record a debt form (person, I lent / I borrowed, amount, currency picker defaulting to base, note, optional due date picker); rows show their own currency, totals in base; delete via menu.
4. Categories `/categories`: header with new-category name + type + Add category; cards (2-letter mark, name, Income/Expense tag, sub-category chips, "+ Add sub-category" input that adds on Enter); rename / archive category, remove unused sub-category (show the API's 409 message when in use); per sub-category "Exclude from insights" toggle (heatmap + largest purchase), on for Rent by default.
5. Settings `/settings`: Appearance (Light/Dark segmented), Base currency (USD/EUR/INR segmented → PATCH, then invalidate every money query), Dashboard cards (per-account switches, "Shown/Hidden"), Timezone select (our addition), Recurring (list rules with pause/delete — our addition, API from phase 4), Data (Export all transactions CSV), Account (email, Sign out, "Sign out everywhere" → logout-all).
6. Optimistic updates for toggles (settle/reopen, show on dashboard, theme) with rollback on error.

## Done when

- Every action in these screens persists and is reflected on the dashboard.
- Each screen has loading skeletons and a sensible empty state for a new user.
- Screenshot comparison: Playwright opens the prototype (`docs/design/ledgerline-prototype.dc.html`, pinned to the matching screen and theme) and the app (seeded Alex, `SEED_TODAY=2026-11-22`, clock frozen at the prototype's 14:30) at 1440×900, in light and dark; store both images and a pixel diff under `apps/web/e2e/__screenshots__/`, and review every diff above a small threshold. Cover budgets, goals, debts, categories and settings.
