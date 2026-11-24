# Phase 7a — New record drawer (create)

Goal: the global New record drawer creating every record type, behaving exactly like the prototype (SPEC §3). Edit/delete comes in 7b.

Read the drawer section of the prototype markup and the drawer part of `renderVals()` / `save()`.

## Build

1. API: small `GET /api/fx/rate?from&to` endpoint (latest rate, cross through USD) for the FX hint; regenerate the client.
2. `components/drawer/new-record-sheet.tsx`, mounted once in the app layout, controlled by `useDrawerStore`:
   - Everything in SPEC §3: Form/Keypad toggle (saved to settings; `drawerStyle` null → Form on web), type tabs with carried-over fields, big amount input with currency symbol, keypad, account chips with balances, To-account chips + FX hint ("X receives ≈ …"), category grid + sub-category chips, split editor (amount becomes read-only sum), budget select with the "Auto · …" label logic, goal select, date + time defaulting to now, note with per-type placeholder, description, tags, repeat switch + frequency (saved record is occurrence #1), receipt picker (keep the File in state; upload arrives in phase 9 — show the filename now).
   - Structure the form so 7b can reuse it in edit mode (`mode: 'create' | 'edit'`, initial values prop) — but build only create here.
3. react-hook-form + zod schema (reuse orval's generated zod where it fits) with the exact validation messages from the prototype shown in the footer.
4. On save: call create, close, toast "{Type} of {amount} saved", invalidate transactions, summary, accounts, net-worth, reports, budgets, goals.
5. Keyboard: Esc closes, Enter in amount moves focus forward, Cmd/Ctrl+Enter saves.
6. Entry points: sidebar button, dashboard header, FAB, Accounts "Transfer between accounts", Goal "Add money" (transfer to savings, goal preselected, note "Saving for {goal}").
7. Component tests (Vitest + Testing Library) for: split sum behaviour, tab switching keeps shared fields, transfer same-account error, keypad decimals limit, FX hint for EUR→USD.

## Done when

- Creating each record type (expense, income, transfer incl. EUR→USD, split, recurring) updates balances, dashboard, budgets and goals without a page reload.
- Drawer screenshot (Form and Keypad, light and dark) diff reviewed against the prototype.

## Don't

- No Transactions screen, no edit/delete — that is 7b.
