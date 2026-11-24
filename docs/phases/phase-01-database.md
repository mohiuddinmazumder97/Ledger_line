# Phase 1 — Database schema & seed

Goal: the complete Prisma schema from `docs/SPEC.md` §2, migrations, money utilities, and a seed that reproduces the prototype's demo data.

## Build

1. Add Prisma to `apps/api`; `PrismaService` (global module) with graceful shutdown.
2. Schema (`apps/api/prisma/schema.prisma`) — all models from SPEC §2:
   `User` (`drawerStyle` nullable), `Session` (SHA-256 `tokenHash` unique, expiresAt, lastUsedAt, revokedAt, userAgent, ip), `Account`, `Category`, `Subcategory`, `Transaction`, `Tag`, `TransactionTag`, `RecurringRule`, `Budget`, `Goal`, `Debt`, `ExchangeRate`.
   - Money: `BigInt` minor units, `currency` as `Char(3)`. FX: `Decimal(18,8)`. `Budget`, `Goal` and `Debt` each carry their own `currency`.
   - `Subcategory.excludeFromInsights Boolean @default(false)`. `Goal.targetDate` nullable `Date` (always the 1st of a month). `Debt.dueDate` nullable `Date`.
   - `ExchangeRate` stores USD→X only: `quote`, `rate`, `date`.
   - Enums for account kind, category type, transaction type, frequency, debt direction, theme, dashboard layout, drawer style.
   - `@@map` to snake_case tables; `createdAt` / `updatedAt` everywhere.
   - Indexes: `transaction(userId, occurredAt desc, id)`, `transaction(userId, accountId)`, `transaction(userId, toAccountId)`, `transaction(userId, categoryId)`, `transaction(splitGroupId)`, unique `budget(userId, categoryId)`, unique `exchangeRate(quote, date)`, unique `session(tokenHash)`, `session(userId)`, unique `tag(userId, name)`, unique `user(email)`.
   - Check constraints via a raw SQL migration: `amount_minor > 0`; transfer rows must have `to_account_id` and `to_amount_minor`; expense/income rows must have `category_id`.
   - Enable `pg_trgm` and add a trigram GIN index on `transaction.note` + `description` for search (raw SQL migration).
3. `src/common/money.ts`: currency metadata (minor digits: USD 2, EUR 2, INR 2 stored — display rounding is the web's job), `toMinor(decimalString, currency)`, `fromMinor`, safe add/sub on bigint, `convert(minor, from, to, rate)` with banker's rounding. Unit tests, including 0.1 + 0.2 cases and INR.
4. BigInt JSON: serialise money as **strings** in API responses (add a global interceptor or class-transformer setup) and document it in Swagger.
5. `prisma/seed.ts` (see SPEC §6): port the constants and `genTx()` from the prototype script exactly (seed 11, 365 days ending at `SEED_TODAY`, default 2026-11-22, ~10% EUR restaurants, monthly salary/transfer/rent/gym/internet/streaming, utilities on the 20th, occasional freelance income). Also: default categories (Rent sub-category with `excludeFromInsights = true`); accounts with **back-solved** opening balances (prototype `base` − seeded ledger net) so derived balances equal the prototype exactly; budgets; goals with back-solved `initialSavedMinor` (prototype `saved` − linked seed transfers); debts; USD→X exchange rates; a `RecurringRule` per monthly item linked to its generated rows; user preferences (dark theme, Overview layout, KEYPAD drawer).
6. Scripts: `db:migrate`, `db:seed`, `db:reset` (drop, migrate, seed). Test DB uses `ledgerline_test`.
7. **Golden test** for the seed generator (pure function, no DB): with seed 11 and `SEED_TODAY=2026-11-22`, pin the exact transaction count, per-type totals in minor units, and per-account ledger nets. Any drift in the port fails the test.

## Done when

- `pnpm db:reset` runs cleanly; derived balances for Alex equal the prototype `ACCOUNTS[].base` to the cent.
- Money unit tests and the golden test pass.

## Don't

- No controllers yet beyond health.
