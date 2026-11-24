# Phase 3 — Ledger API (accounts, categories, transactions)

Goal: the core money-moving endpoints with correct balances, transfers, splits, filtering and CSV export.

## Build

1. `fx` module: `FxService.rate(from, to, onDate?)` reading USD→X `ExchangeRate` rows (latest on/before the date, fallback latest, identity for same currency, USD→USD = 1); every non-USD pair is a cross rate `rate(USD→to) / rate(USD→from)`. Plus `toBase(minor, currency, userBase, date?)`. Admin-free; rates come from the seed for now. Unit tests incl. EUR↔INR cross rate.
2. `accounts` module:
   - `GET /api/accounts` → each account with `balanceMinor` (derived in one SQL query: opening + income − expense − transfers out + transfers in via `toAmountMinor`, ignoring soft-deleted rows) and `balanceInBaseMinor`.
   - `POST`, `PATCH` (name, kind, showOnDashboard, sortOrder), `POST /:id/archive` — only when the derived balance is exactly 0, else 409 `ACCOUNT_BALANCE_NOT_ZERO`. Currency is immutable once the account has transactions.
3. `categories` module:
   - `GET /api/categories?type=` with sub-categories; `POST` (name, type → creates sub-category "General"); `PATCH`; `POST /:id/archive`.
   - `POST /api/categories/:id/subcategories` (name, trimmed, unique per category, case-insensitive); `PATCH` subcategory (name, `excludeFromInsights`); `DELETE` subcategory only if unused, else 409 with code.
4. `transactions` module:
   - `POST /api/transactions` — body mirrors the drawer (SPEC §3): `type`, `accountId`, `amount` (decimal string), `occurredAt`, `note`, `description`, `tags: string[]`, `categoryId`, `subcategoryId`, `budgetId | 'auto' | null`, `goalId`, `toAccountId`, `splits?: [{ categoryId, subcategoryId?, amount }]`, `recurring?: { frequency }`.
     - Currency comes from the account. Transfers compute `toAmountMinor` + `fxRate` when currencies differ. Splits create one row per split sharing `splitGroupId` (sub-category defaults to the category's first). Tags are upserted. `recurring` creates a `RecurringRule` and links the row as occurrence #1; `nextRunAt` = `occurredAt` + 1 period (month-end clamped).
     - Validation: amount > 0, transfer accounts differ and are both owned, category type matches transaction type, subcategory belongs to category, budget only for expenses.
     - Returns created rows (array).
   - `GET /api/transactions` — filters: `from`, `to` (or `month=YYYY-MM` in user timezone), `type`, `categoryId`, `subcategoryId`, `accountId` (matches source or destination), `q` (note, description, sub-category name, category name, tag names; case-insensitive), cursor pagination ordered by `occurredAt desc, id desc`. Each row includes account, toAccount, category, subcategory names, tags, goal name, recurring frequency, `splitGroupId` (the web shows a "Split" flag from it — no `split` tag is written), `hasReceipt`.
   - `GET /api/transactions/summary` — same filters → `{ incomeMinor, expenseMinor, netMinor, count }` in base currency.
   - `GET /api/transactions/:id`, `PATCH /:id`, `DELETE /:id` (soft; `?group=true` deletes the whole split group). Edit rules (SPEC §3): a split row edits individually; a recurring-generated row edits without touching its rule; a transfer edits as one record (source, destination, amount; `toAmountMinor`/`fxRate` recomputed).
   - `GET /api/transactions/export.csv` — same filters, streamed, columns per SPEC §5, proper CSV escaping, `Content-Disposition` filename `transactions.csv` (or `all-transactions.csv` when no filters).
5. Tests: balance math across all three types incl. EUR→USD transfer; archive refused at non-zero balance; split creation, single-row edit and group delete; transfer edit recomputes FX; editing a recurring row leaves the rule unchanged; every filter; search by tag and category name; ownership (user B cannot read or reference user A's account/category); CSV escaping of quotes and commas.

## Done when

- Seeded Alex's account balances returned by the API match what the seed intended.
- Tests pass; Swagger documents every endpoint with examples.
