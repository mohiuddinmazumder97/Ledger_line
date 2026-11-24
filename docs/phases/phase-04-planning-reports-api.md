# Phase 4 — Budgets, goals, debts & reports API, then the typed client

Goal: everything the dashboard and planning screens need, computed server-side, the recurring scheduler, plus the generated `packages/api-client`.

## Build

1. `budgets` module:
   - `GET /api/budgets?month=YYYY-MM` → per budget, all in the current base currency (limit converted from the budget's own currency at the latest rate): category name, `limitMinor`, `spentMinor` (expenses in the month counted by explicit `budgetId` else by category — "Auto"), `pctUsed`, `leftMinor` (negative when over), `over`, `daysRemaining` (from today in the user's timezone, incl. today; full month length for future months, 0 for past), `perDayMinor` (0 when over), `nextMonthStart`. Plus a summary `{ usedMinor, totalLimitMinor }`. The web builds the copy from SPEC §4.
   - `POST` (categoryId, limit) — stores `currency` = user's current base; upsert per category (prototype replaces an existing budget for the same category); `PATCH`; `DELETE`.
2. `goals` module:
   - `GET /api/goals` → saved = initial + linked transactions, target, remaining — all converted to the current base — plus pct, `reached`, `targetMonth` (`YYYY-MM` or null).
   - `POST` (name, target, targetMonth? `YYYY-MM` → stored as the 1st) — `currency` = current base; `PATCH`, `POST /:id/archive`.
3. `debts` module:
   - `GET /api/debts` (open first, then settled; each row in its own currency) + summary `{ owedToYouMinor, youOweMinor }` over open debts, converted to base.
   - `POST` (person, direction, amount, currency (default base), note, dueDate? `YYYY-MM-DD`), `PATCH`, `POST /:id/settle`, `POST /:id/reopen`, `DELETE`.
4. `reports` module (all in base currency, month boundaries in the user's timezone):
   - `GET /api/reports/net-worth` → total, assets, liabilities, netThisMonth, currency mix `[{ currency, shareOfAssets }]`.
   - `GET /api/reports/spending-by-month?months=6` → `[{ month: 'YYYY-MM', expenseMinor }]`.
   - `GET /api/reports/spending-by-category?month=` → top categories sorted desc.
   - `GET /api/reports/insights?month=` → spentSoFar + % vs same day-range of previous month, topCategory (+share), largestPurchase (excluding sub-categories with `excludeFromInsights`; original amount & currency, note, date), savingsRate, incomeThisMonth.
   - `GET /api/reports/heatmap?days=365` → `[{ date, expenseMinor }]` excluding sub-categories with `excludeFromInsights` (bucketing into levels is done by the web).
   - Use SQL aggregation (Prisma `$queryRaw` with tagged templates) — no loading every transaction into memory. Add a short comment over each query explaining it.
5. Recurring scheduler (moved here from phase 9) — `recurring` module:
   - `@nestjs/schedule` cron every 15 minutes: find active `RecurringRule`s with `nextRunAt <= now`, create the transaction(s) in a DB transaction, advance `nextRunAt` (month-end clamping: Jan 31 → Feb 28/29 → Mar 31; catch up multiple missed periods), idempotent across instances (`SELECT … FOR UPDATE SKIP LOCKED`).
   - `GET /api/recurring`, `PATCH /:id` (frequency, active), `DELETE /:id`.
   - Tests with a fake clock: date advancement, catch-up, idempotency with two concurrent runs.
6. Typed client:
   - `orval.config.ts` in `packages/api-client` reading the file `apps/api/openapi.json` (no running server); output TanStack Query v5 hooks (split by tag) + zod schemas; custom fetch mutator with `credentials: 'include'`, base `/api`; on 401 redirect to `/signin` (no refresh flow).
   - Verify every money field comes out as a string in the zod schemas.
   - Root `pnpm gen:api` script (write-openapi → orval). Commit `openapi.json` and the generated output.
7. Tests: budget auto vs explicit attribution; budget in EUR shown in USD base; over-budget numbers and `daysRemaining`; goal progress with a EUR contribution; debt summaries convert currencies and ignore settled; insights against a small hand-built fixture; heatmap honours `excludeFromInsights`.
8. Timezone fixtures (shared test helpers) run against budgets, insights, spending-by-month and the heatmap:
   - month-end: an expense at 23:30 local on the 31st lands in that month, not the next;
   - DST zone (`America/New_York`, around the March and November switches);
   - `Asia/Dhaka` (UTC+6, no DST): an expense at 02:00 local on the 1st is UTC the previous day but belongs to the new month.

## Done when

- Calling the report endpoints for seeded Alex returns sensible numbers (record them in PROGRESS for later UI comparison).
- `pnpm gen:api` produces a client that typechecks, without the API running.
- Recurring and timezone tests pass.
