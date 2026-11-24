# Phase 7b — Transactions list, edit & delete

Goal: the full Transactions screen with URL-driven filters, plus editing and deleting records through the drawer.

Read the transactions section of the prototype markup and the transactions part of `renderVals()`.

## Build

1. Transactions `/transactions`:
   - Header: "Transactions", "{n} records", Export CSV (calls the export endpoint with current filters, triggers download, toast "Exported {n} transactions"), + New record.
   - Filters: the **URL is the single source of truth**, read/written with nuqs (`useQueryStates` with typed parsers): `mode` (month/custom), `month`, `from`, `to`, `type`, `categoryId`, `subcategoryId`, `accountId`, `q`. Shareable and back-button friendly; no Zustand store. Controls: Month / Custom range segmented, month stepper ‹ November 2026 ›, date inputs for custom, type select, category select (resets sub-category), sub-category select, account select, search input (debounced 300 ms before writing to the URL), Clear when any filter is set.
   - Totals row: Income / Expenses / Net from `/transactions/summary`.
   - List: infinite query (cursor), grouped by day client-side with headers "Sun, Nov 22" and the day's net; rows with 36px mark (first two letters of category or ⇄), title (note or sub-category or "Transfer"), meta ("Food & Drink › Groceries · Everyday Checking" or "A → B"), flags as tags (recurring frequency, "Split" when `splitGroupId` is set, #tags, goal name, Receipt), amount (+ income in accent-700, − expense), time.
   - Empty state: "No transactions match these filters."
2. Edit / delete (our addition) — clicking a row opens the 7a drawer in edit mode: same form, "Save changes" + Delete (with confirm). Rules from SPEC §3:
   - split rows edit individually (split editor hidden; the row behaves like a plain expense); Delete offers "Delete this row" or "Delete whole split";
   - a recurring-generated row edits without touching its rule (show a hint "Changes apply to this record only");
   - a transfer edits as one record (both accounts, amount; FX recomputed by the API).
   - On save/delete: toast, invalidate the same queries as create.
3. Tests: URL ↔ filter round-trip (load a URL, controls reflect it; change a control, URL updates); Clear resets the URL; split row delete options; transfer edit payload.

## Done when

- Filters, search and CSV export match API results; the URL fully reflects filters and reloading restores them.
- Editing and deleting each record type updates balances, dashboard, budgets and goals without a page reload.
- Transactions screenshot diff (light and dark) reviewed against the prototype.
