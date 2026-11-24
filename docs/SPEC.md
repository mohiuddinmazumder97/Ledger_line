# Ledgerline — product spec

Derived from the approved prototype (`docs/design/ledgerline-prototype.dc.html`). Where this
spec and the prototype disagree on look or copy, the prototype wins; on data rules, this spec wins.

## 1. Screens

| Screen                   | Route           | Summary                                                                                                                                                                                                                                                               |
| ------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in / Create account | `/signin`       | Split layout: brand panel left ("Every account, every expense, one ledger."), form right with Sign in / Create account tabs. Sign-up asks full name, email, password.                                                                                                 |
| Onboarding (3 steps)     | `/onboarding`   | 1) base currency, 2) first account name + current balance, 3) starter categories (multi-select; each comes with sub-categories). Progress bars, Back / Continue / Go to dashboard.                                                                                    |
| Dashboard                | `/`             | Greeting + date, layout switcher (A Overview / B Split / C Calendar), cards: Net worth, Accounts, Spending (6-month bars + current-month by category), Insights, Spending calendar (365-day heatmap, excludes rent), Goals, Budgets.                                  |
| Transactions             | `/transactions` | Month stepper or custom date range; filters: type, category, sub-category, account, free-text search (notes, tags, merchants); Clear; totals (Income / Expenses / Net); list grouped by day with daily net; Export CSV; + New record.                                 |
| Accounts                 | `/accounts`     | Header with net worth / assets / liabilities; account cards (kind, currency, balance, base-currency equivalent, "Hidden on dashboard" tag, Transactions button → filtered list); Transfer between accounts; Add account form (name, type, currency, opening balance). |
| Budgets                  | `/budgets`      | Monthly limit per expense category; cards show spent / limit, % used, left or "Over by", days remaining, per-day allowance (see §4 for over-budget copy). New budget form (category, monthly limit in the current base currency). One budget per category.            |
| Goals                    | `/goals`        | Cards: target date ("Aug 2027"), % , saved of target, amount to go / "Goal reached", Add money (opens drawer as transfer linked to goal). New goal form (name, target, target month via a month picker).                                                              |
| Debts & lending          | `/debts`        | "You're owed" / "You owe" totals (open only); rows: person, note, due date or Settled, direction tag, amount, Mark settled / Reopen. Record a debt form (person, direction, amount, currency picker defaulting to base, note, optional due date via a date picker).   |
| Categories               | `/categories`   | Category cards with type tag and sub-category chips; type a sub-category + Enter to add; add category (name, type).                                                                                                                                                   |
| Settings                 | `/settings`     | Appearance (light/dark), base currency, dashboard card visibility per account (hidden accounts still count toward net worth), export all transactions CSV, account email + sign out.                                                                                  |
| New record drawer        | global          | Right-side sheet, opened from sidebar button, header button, FAB, goal "Add money", Accounts "Transfer". Details in §3.                                                                                                                                               |

## 2. Domain model

- **User**: name, email, password hash, `baseCurrency` (USD/EUR/INR at launch, extendable), `theme`, `dashboardLayout`, `timezone`, `drawerStyle` (FORM / KEYPAD, **nullable**: null = client default — web Form, mobile Keypad), `onboardedAt`.
- **Session**: `userId`, `tokenHash` (SHA-256 of a 32-byte random token, unique), `expiresAt` (30-day sliding: extended on use), `lastUsedAt`, `revokedAt`, `userAgent`, `ip`. Web sends the token as the `session` cookie; native clients as `Authorization: Bearer`.
- **Account**: name, `kind` (BANK, SAVINGS, CASH, CREDIT, INVESTMENT), currency, opening balance, `showOnDashboard`, sort order, `archivedAt`. Credit accounts usually carry a negative balance ("Balance owed"). Archiving is only allowed when the derived balance is exactly zero, so archived accounts never affect net worth.
- **Category**: name, `type` (EXPENSE, INCOME), sort order, `archivedAt`; has many **Subcategory** (name, `excludeFromInsights` boolean default false — true for the Rent template, editable by the user). Default templates seeded per user at onboarding:
  - Expense: Food & Drink (Groceries, Restaurants, Coffee), Transport (Fuel, Transit, Taxi), Housing (Rent, Utilities, Internet), Shopping (Clothes, Electronics, Home), Health (Pharmacy, Gym, Doctor), Entertainment (Streaming, Movies, Events)
  - Income: Salary (Monthly pay, Bonus), Freelance (Design, Consulting), Interest (Savings, Dividends)
- **Transaction**: `type` (EXPENSE, INCOME, TRANSFER), `accountId`, `amountMinor` (always positive), `currency` (= account currency), `occurredAt`, `note` (short title / merchant), `description`, tags, optional `categoryId` + `subcategoryId` (required for expense/income), optional `budgetId` override, optional `goalId`, optional `receiptKey`, optional `recurringRuleId`, optional `splitGroupId`.
  - Transfer adds `toAccountId`, `toAmountMinor`, `fxRate` (when currencies differ the receiving amount is converted; the drawer shows "X receives ≈ …").
  - Split expense: one save creates N expense rows sharing a `splitGroupId`; the amount field becomes read-only and equals the sum of splits. No tag is added; the UI shows a "Split" flag derived from `splitGroupId`.
- **Tag**: per-user name; many-to-many with transactions.
- **RecurringRule**: template of a transaction + `frequency` (DAILY, WEEKLY, MONTHLY, YEARLY), `nextRunAt`, `active`. A scheduler materialises due transactions. The record saved with "Repeat" on is occurrence #1; `nextRunAt` = its `occurredAt` + 1 period (month-end clamps: Jan 31 → Feb 28/29 → Mar 31).
- **Budget**: category, `limitMinor` + its own `currency` (= the user's base at creation), period MONTHLY. Shown and compared in the current base currency, converted at the latest rate. Unique per (user, category). Spending counts an expense toward its explicit `budgetId`, else toward the budget of its category ("Auto").
- **Goal**: name, `targetMinor` + its own `currency` (= base at creation), `initialSavedMinor` (same currency), `targetDate` (month precision: stored as the 1st of the month, shown "Aug 2027"; optional). Saved = initial + sum of linked transactions; all shown converted to the current base.
- **Debt**: person, `direction` (LENT, BORROWED), amount, `currency` (picker, default base), note, `dueDate` (optional date), `settledAt`. Totals convert to base.
- **ExchangeRate**: stores **USD→X only** (`quote`, `rate` = units of X per 1 USD, `date`). Any other pair is a cross rate through USD: rate(A→B) = rate(USD→B) / rate(USD→A). Seed static rates matching the prototype (EUR 1/1.08, INR 1/0.012); a provider can be plugged in later.

## 3. New record drawer

- Header: "New record", Form / Keypad toggle (persisted as user preference; when unset, web defaults to Form), close.
- Tabs: Expense / Income / Transfer (switching keeps amount, account, date, time, note, description, tags).
- Amount in the selected account's currency, big input; Keypad mode shows a 3×4 keypad (1–9, ., 0, ⌫), max 2 decimals.
- Account chips show name · balance. Label: "Paid from" / "Receiving account" / "From account". Transfer adds "To account" chips (excluding source) + FX hint.
- Category grid (filtered by type) + sub-category chips; hidden for transfers and for split expenses.
- Expense only: "Split across categories" switch → rows (category select, amount, remove) + "Add split".
- Budget select: "Auto · <category>" / "Auto · none for this category" / No budget / specific budget (disabled unless expense). Goal select.
- Date + time (defaults to now), Note (placeholder varies by type), Description, Tags (comma-separated).
- "Repeat this record" switch → Daily / Weekly / Monthly / Yearly.
- Attach receipt (image or PDF).
- Footer: inline error, Cancel, "Save expense|income|transfer". Validation: amount > 0; transfer accounts must differ; split needs ≥1 positive row.
- After save: close, toast "Expense of $12.50 saved", invalidate affected queries.

### Editing and deleting (our addition)

- Split rows edit individually (only that row changes). Delete asks: this row, or the whole split group.
- Editing a row generated by a recurring rule changes that row only, never the rule; the rule is managed separately.
- A transfer edits as one record (both legs: source, destination, amount, FX recomputed).

## 4. Calculations

- **Net worth** (base currency): assets = sum of positive account balances, liabilities = sum of negative; total = assets + liabilities. Currency mix bar = share of assets per currency. "Net this month" = income − expense this month.
- **Spending (6 months)**: expense totals per month in base currency; current month highlighted.
- **By category**: current-month expense per category, top 6, bars relative to the largest.
- **Insights**: Spent so far (and % vs the same day-range last month), Top category (amount, % of spending), Largest purchase (excluding sub-categories with `excludeFromInsights`), Savings rate ((income − expense) / income).
- **Heatmap**: daily expense totals for the last 365 days excluding sub-categories with `excludeFromInsights` (never by name); 5 levels (0, <30, <80, <160, ≥160 in base currency); weeks as columns starting Sunday; month labels; tooltip "Mon Nov 3: $42.10".
- **Budgets**: spent this month, % used, left or over, days remaining in month computed from today in the user's timezone (n, including today), per-day allowance = left / days remaining.
  - Under budget: "{left} left · {n} days remaining" / "About {perDay} per day for the rest of the month".
  - Over budget: "Over by {x} · {n} days left" / "No allowance left. Pause {category} spending until {Next month} 1." (e.g. "December 1").
- **Transactions totals**: income, expenses, net for the current filter, in base currency.
- Conversions use the latest rate for balances / net worth / budget limits / goal targets / debt totals, and the rate on the transaction date for reports (fallback to latest). All cross rates go through USD.

## 5. CSV export

Columns: Date, Time, Type, Amount, Currency, Account, To account, Category, Sub-category, Note, Tags. Filtered export uses the current Transactions filters; Settings exports everything. Streamed from the API.

## 6. Seed / demo data

Port `genTx()` and the constants from the prototype script into `apps/api/prisma/seed.ts`: user Alex Moreno (`alex@example.com` / `password123`), the 6 accounts (incl. hidden India Savings in INR), categories, 5 budgets, 3 goals, 3 debts, and 365 days of generated transactions ending at `SEED_TODAY` (env, default `2026-11-22`; deterministic PRNG, seed 11). Screenshot tests use the same `SEED_TODAY`.

- **Opening balances are back-solved**: opening = prototype `ACCOUNTS[].base` − net effect of the seeded ledger on that account, so derived balances equal the prototype figures exactly.
- **Goal saved is back-solved**: `initialSavedMinor` = prototype `saved` − sum of seed transfers linked to that goal (e.g. the monthly $500 → Emergency fund).
- **Recurring rules**: seed a `RecurringRule` for each monthly item (salary, savings transfer, rent, gym, internet, streaming) and link the generated rows to it; `nextRunAt` = last occurrence + 1 month.
- Rent sub-category has `excludeFromInsights = true`. Alex's `drawerStyle` = KEYPAD (prototype default).

## 7. Out of scope for v1

Bank sync, shared/household ledgers, mobile apps, investments pricing, multi-period budgets, notifications. Note requests for these in `docs/PROGRESS.md` → Later.
