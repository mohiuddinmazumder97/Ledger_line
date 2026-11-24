# Progress

| Phase                                          | Status      | Date       | Notes                                                                                                                               |
| ---------------------------------------------- | ----------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0 Foundations                                  | done        | 2026-11-24 | Monorepo, Nest + Next wired, health + Swagger, CI. Docker compose written but not run locally (no Docker on dev machine).           |
| 1 Database & seed                              | done        | 2026-11-24 | Prisma 7 schema + migrations, money utils, BigInt→string, seed + golden test. Seeded on Neon; derived balances match the prototype. |
| 2 Auth & onboarding API                        | not started |            |                                                                                                                                     |
| 3 Ledger API                                   | not started |            |                                                                                                                                     |
| 4 Planning, reports & recurring API            | not started |            |                                                                                                                                     |
| 5 Web foundation & auth UI                     | not started |            |                                                                                                                                     |
| 6 Dashboard & Accounts                         | not started |            |                                                                                                                                     |
| 7a New record drawer (create)                  | not started |            |                                                                                                                                     |
| 7b Transactions list, edit & delete            | not started |            |                                                                                                                                     |
| 8 Budgets, Goals, Debts, Categories, Settings  | not started |            |                                                                                                                                     |
| 9 Receipts, password reset, hardening & deploy | not started |            |                                                                                                                                     |

## Decisions

<!-- Claude: append decisions with a one-line reason, e.g. "Cursor pagination on occurredAt+id — stable under inserts." -->

Pre-build decisions (2026-11-24, from the kickoff review):

- Seed opening balances are back-solved (prototype `base` − seeded ledger net) — derived balances must equal the prototype exactly.
- Seed `Goal.initialSavedMinor` = prototype `saved` − linked seed transfers — avoids double-counting the monthly $500 into Emergency fund.
- Budgets and Goals store their own currency (= base at creation) and convert to the current base for display — base switches don't reinterpret stored numbers.
- Debts get a currency picker (default base); totals convert to base — mixed-currency totals were undefined.
- Over-budget: days remaining computed from today; copy "Over by {x} · {n} days left" / "No allowance left. Pause {category} spending until {Next month} 1." — prototype hardcoded "8 days" and had no sane per-day value when over.
- `Subcategory.excludeFromInsights` (true for Rent template, editable) drives heatmap + largest purchase — matching by name breaks on rename.
- Goal `targetDate` is month precision (1st of month, shown "Aug 2027"); Debt `dueDate` optional date; real pickers — prototype used free text.
- No `#split` tag; a "Split" flag is derived from `splitGroupId` — avoids polluting user tags.
- `User.drawerStyle` nullable: null = web Form, mobile Keypad — each client gets a sensible default until the user chooses.
- `ExchangeRate` stores USD→X only; cross rates go through USD — matches the prototype and keeps one rate per currency per date.
- Seed `RecurringRule`s for the monthly items; a saved record is occurrence #1, `nextRunAt` = occurredAt + 1 period — removes ambiguity about the first run.
- `SEED_TODAY` env (default 2026-11-22) anchors the seed and screenshot tests — keeps figures comparable to the prototype over time.
- Accounts can only be archived at zero balance — archived accounts never affect net worth.
- Edit rules: split rows edit individually (delete offers whole group); editing a recurring row never touches its rule; a transfer edits as one record.
- Auth: opaque DB sessions (32-byte token, SHA-256 hashed, 30-day sliding expiry, revocable) instead of JWT + refresh; web cookie `session` (path /), native `Authorization: Bearer` — fixes the middleware/refresh-path bug and serves the Flutter app with one mechanism.
- Transaction filters live in the URL via nuqs; `useTxFiltersStore` removed — one source of truth.
- `apps/api/openapi.json` is written by a script (`SwaggerModule.createDocument`, no server) and orval reads the file; money fields get explicit string schema decorators — CI-safe generation, correct zod types.
- Keep NestJS + Next.js — the Flutter app will consume the API.
- No Recharts; charts are plain divs as in the prototype. Vitest everywhere (unplugin-swc for Nest) — one test runner.
- Phase 7 split into 7a (drawer create) and 7b (transactions list + edit/delete) — 7 was the largest, riskiest phase.
- Recurring scheduler moved from phase 9 to phase 4, plus timezone fixtures (month-end, DST zone, Asia/Dhaka) — rules no longer sit idle for five phases.
- Playwright smoke test from phase 5; prototype-vs-app screenshot comparison at `SEED_TODAY` in phases 5, 6, 8 (and 7a/7b) — objective check for "matches the prototype".
- Password reset by email (Mailpit locally) added to phase 9, before deploy.
- Phase 1 golden test pins seed-11 transaction count and totals — catches drift in the `genTx()` port.

Phase 0 (2026-11-24):

- TypeScript pinned to 6.0.3 repo-wide, not 7.0 — typescript-eslint supports `<6.1` only (TS 7 itself emits Nest decorator metadata fine; revisit when typescript-eslint catches up).
- ESLint pinned to 9.39 — `eslint-config-next`'s react / jsx-a11y / import plugins don't support ESLint 10 yet (npm flags 9 as deprecated; upgrade when they do).
- API is ESM (`"type": "module"`, NodeNext, `.js` import suffixes) — NestJS 12 ships as ESM only.
- Dev runs via `nest start --watch` (tsc), not tsx/esbuild — esbuild drops `emitDecoratorMetadata`, which Nest DI needs. Vitest uses unplugin-swc for the same reason.
- `app.setup.ts` holds all app-wide wiring (prefix, ValidationPipe, Helmet, cookie-parser, CORS, Swagger) — main.ts, tests and the OpenAPI writer configure the app identically.
- Env validated with zod 4 at boot (`DATABASE_URL`, `WEB_ORIGIN`, `PORT`, `SEED_TODAY`, `LOG_LEVEL`, `NODE_ENV`) — fail fast with a readable list.
- `write-openapi` fills placeholder env values when unset — CI can generate the spec without a database or .env. CI fails if the committed `openapi.json` is stale.
- Logging: nestjs-pino, pretty in development, JSON otherwise; cookie / authorization / set-cookie headers redacted; `/api/health` not auto-logged.
- CORS: single fixed origin `WEB_ORIGIN` with credentials (the `cors` package always echoes that origin, so foreign origins are rejected by the browser).
- Web server components call the API directly via `API_URL`; browser code goes through the `/api/*` rewrite.
- shadcn initialised with the Radix base, `nova` preset (Geist font, neutral palette) — placeholder until the phase 5 theme. It uses shadcn's own `cn` package instead of clsx + tailwind-merge.
- pnpm 11 build-script allowlist in `pnpm-workspace.yaml`: `@swc/core` allowed (native binary), `@scarf/scarf` denied (install telemetry).
- Package names `@ledgerline/{api,web,api-client,config}`; api on :4000, web on :3000.

Phase 1 (2026-11-24):

- Prisma 7.10 (8 is RC) with the `prisma-client` generator → `apps/api/src/generated/prisma` (gitignored, generated on install / build / typecheck) and the `@prisma/adapter-pg` driver adapter — Prisma 7's ESM-native path, matches the ESM API.
- Dev DB is Neon (user's choice). App uses the pooled `DATABASE_URL`; `prisma.config.ts` uses optional `DIRECT_URL` (no `-pooler`) for Migrate — PgBouncer breaks Migrate's advisory locks.
- `setDefaultAutoSelectFamilyAttemptTimeout(2000)` in `main.ts` and the seed (`src/common/net-defaults.ts`) — Node's 250 ms happy-eyeballs per-address timeout made every connect to Neon us-east-2 fail with ETIMEDOUT from the dev machine.
- `PrismaService` connects lazily (first query) and disconnects on shutdown — health, tests and the OpenAPI writer run without a database.
- IDs are UUIDv7 (`@default(uuid(7)) @db.Uuid`) — time-ordered, good for the `(occurredAt, id)` cursor. Seeded transactions use v4 ids (set client-side to link tags); harmless.
- `Transaction.budgetMode` enum (AUTO / NONE / EXPLICIT) + `budgetId` — the API takes `budgetId | 'auto' | null`, and "No budget" vs "Auto" can't both be a null `budgetId`. A CHECK ties EXPLICIT ⇔ `budgetId`.
- `Subcategory.userId` denormalised — every query can be scoped by `userId` without a join (rule 3).
- `RecurringRule` stores the full template (`tagNames String[]` instead of a join table) plus `anchorAt` (occurrence #1) so month-end clamping can return to the 31st after February.
- Trigram GIN indexes declared in the schema (`ops: raw("gin_trgm_ops")`) so Migrate sees no drift; `CREATE EXTENSION pg_trgm` is the first line of the init migration. CHECKs (positive amounts, transfer fields, category required, budget mode, positive FX rate) are a hand-written second migration; the same rules apply to `recurring_rules`. Migrations authored with `prisma migrate diff` (no shadow DB needed on Neon).
- Money: `toMinor` rejects more decimals than the currency allows instead of rounding user input; `convert()` is exact decimal-string × bigint with banker's rounding; rates accept strings or Prisma `Decimal`.
- Responses: global `BigIntSerializerInterceptor` (in `configureApp`) turns bigint → digit string and Prisma `Decimal` → decimal string; `@ApiMoney()` / `@ApiDecimal()` give the explicit string schema for DTOs from phase 2 on.
- Seed: pure `prisma/seed-data.ts` (verified field-for-field against the prototype's own `genTx()` — 340 rows) + `prisma/seed.ts` writer. Alex's timezone `America/New_York`; prototype wall-clock times are converted to UTC in that zone. Seed is idempotent (deletes Alex's rows first) and ends by computing derived balances in SQL and failing unless they equal the prototype `base` to the cent.
- Back-solved openings are odd-looking but correct by construction: Everyday Checking opens at −$35,819.42 and Credit Card at +$3,533.72, because the prototype's 12-month ledger nets +$40,639.92 into checking. Emergency fund `initialSavedMinor` = $200 ($6,200 − 12 × $500).
- Rates: USD→EUR 0.92592593, USD→INR 83.33333333, dated the first seed day (2025-11-23) so every seeded row has a rate on/before its date. Debt due dates resolved relative to 2026-11-22 (Dec 1 → 2026-12-01, Jan 15 → 2027-01-15, Nov 10 → 2026-11-10; Leo's settled that evening).
- CI applies migrations (`db:deploy`) and runs the seed against its Postgres service — the balance check runs on every push.
- pnpm build allowlist extended: `@prisma/engines`, `prisma`, `argon2` (native), `esbuild` (tsx).

## Known gaps

- `docker compose up -d` is untested: Docker isn't installed on the dev machine. Phase 0 was verified against a local PostgreSQL 17 install (phase 0 doesn't touch the DB). Compose + the `ledgerline_test` init script still need a run on a machine with Docker.
- CI workflow is written but has not run yet (no remote configured).
- `pnpm e2e` passes with no specs (`--pass-with-no-tests`) until the phase 5 smoke test.
- `pnpm db:reset` needs explicit user consent when run by an AI agent (Prisma 7 guard). Ran it on 2026-11-24 with the user's consent: drop, both migrations, seed — balances check passed.
- No test database yet. Phase 2 needs `TEST_DATABASE_URL` (a separate Neon database/branch or local `ledgerline_test`) — must never point at dev data. `apps/api/vitest.config.ts` still hardcodes a localhost URL.
- `pg` warns that `sslmode=require` will change meaning in pg v9; Neon URLs can switch to `sslmode=verify-full` to keep today's behaviour.

## Later
