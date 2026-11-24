# Progress

| Phase                                          | Status      | Date       | Notes                                                                                                                                                                                                              |
| ---------------------------------------------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 Foundations                                  | done        | 2026-11-24 | Monorepo, Nest + Next wired, health + Swagger, CI. Docker compose written but not run locally (no Docker on dev machine).                                                                                          |
| 1 Database & seed                              | done        | 2026-11-24 | Prisma 7 schema + migrations, money utils, BigInt→string, seed + golden test. Seeded on Neon; derived balances match the prototype.                                                                                |
| 2 Auth & onboarding API                        | done        | 2026-11-24 | Opaque DB sessions (cookie + bearer), register/login/logout(-all), throttling, me/settings, onboarding, assertOwned. 132 API tests on a Neon test DB.                                                              |
| 3 Ledger API                                   | done        | 2026-11-24 | FX (cross rates via USD), accounts with derived balances + archive, categories/sub-categories, transactions (splits, transfers, recurring #1, filters, cursor, summary, CSV). Alex's balances via API = prototype. |
| 4 Planning, reports & recurring API            | not started |            |                                                                                                                                                                                                                    |
| 5 Web foundation & auth UI                     | not started |            |                                                                                                                                                                                                                    |
| 6 Dashboard & Accounts                         | not started |            |                                                                                                                                                                                                                    |
| 7a New record drawer (create)                  | not started |            |                                                                                                                                                                                                                    |
| 7b Transactions list, edit & delete            | not started |            |                                                                                                                                                                                                                    |
| 8 Budgets, Goals, Debts, Categories, Settings  | not started |            |                                                                                                                                                                                                                    |
| 9 Receipts, password reset, hardening & deploy | not started |            |                                                                                                                                                                                                                    |

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

Phase 2 (2026-11-24):

- Test DB is a separate Neon database `ledgerline_test` on the same project (user's choice over local Postgres), reached via the direct host. `TEST_DATABASE_URL` in `apps/api/.env`; falls back to local `ledgerline_test` (CI). A global setup runs `prisma migrate deploy` and refuses any DB not named `*_test` or equal to the dev `DATABASE_URL`; vitest pins `DIRECT_URL` to the test URL too so the CLI can never pick up the dev one. Tables are truncated before each test; files run serially. Full suite ≈ 3.5 min against Neon (fast locally/CI).
- Every API test run now needs the test DB (the global setup migrates it), including the pure unit specs.
- Responses for register/login share one schema `{ user, token?, expiresAt? }`; token fields only with `X-Client: native` (then no cookie).
- Error bodies are `{ statusCode, code, message }` everywhere — `apiError()` helper; ValidationPipe uses code `VALIDATION_FAILED`; throttling `TOO_MANY_REQUESTS`; guard `UNAUTHENTICATED` (no token) vs `SESSION_INVALID` (unknown / expired / revoked).
- `EMAIL_IN_USE` (409) on register reveals that an account exists — unavoidable without email verification (see Later).
- Category templates live in `src/categories/category-templates.ts` (prototype ids `food` … `interest`); the seed imports them — one source. Onboarding creates categories in template order regardless of request order; an empty template list is allowed (prototype lets you deselect all).
- Onboarding claims `onboardedAt` with a conditional `updateMany` inside the transaction, so a double submit yields one 201 and one 409 (tested).
- `assertOwned(prisma | tx, model, id, userId)` → 404 `<MODEL>_NOT_FOUND`; another user's row is indistinguishable from a missing one; malformed ids are 404, not a DB error; soft-deleted transactions count as missing.
- `PrismaService` imports the Node connect-timeout default too (tests and any entry point get it).
- `@nestjs/throttler` 6.8 with an in-memory store, applied only to login/register via `AuthThrottlerGuard`.

### Security notes (phase 2)

- **Tokens:** 32 bytes from `crypto.randomBytes`, base64url (43 chars). Only `sha256(token)` (hex) is stored, unique-indexed; the raw token exists only in the response that issues it and on the client. SHA-256 (not argon2) is right for 256-bit random tokens. Tokens longer than 128 chars are rejected before hashing.
- **Passwords:** argon2id (library defaults: m=64 MiB, t=3, p=4), 8–256 chars. Unknown emails are verified against a dummy hash so both failure paths cost one argon2 verify and return the same 401 `INVALID_CREDENTIALS` "Email or password is incorrect".
- **Cookie `session`:** `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `NODE_ENV=production`, `Max-Age` = remaining session lifetime (≈30 days), re-issued when the expiry slides. Cleared on logout, logout-all, and when a cookie's session is invalid. CSRF: `SameSite=Lax` means cross-site POST/PATCH never carry the cookie; all state changes are non-GET JSON endpoints.
- **Sliding expiry:** 30 days from last use; the DB write (`expiresAt`, `lastUsedAt`) happens at most once per hour per session, so `lastUsedAt` has 1-hour granularity.
- **Revocation:** logout revokes the current session; logout-all revokes every session of the user. Revoked/expired sessions are rejected immediately (checked on every request).
- **Guard:** global; every route needs a session unless `@Public()` (health, register, login). Cookie first, then `Authorization: Bearer`.
- **Throttling:** 5/min per client IP on login and on register (separate buckets), 429 `TOO_MANY_REQUESTS`. Client IP = `req.ip` with Express `trust proxy` = `TRUST_PROXY` (default `loopback`, i.e. the Next.js rewrite on the same host). If the API is deployed behind another proxy, set `TRUST_PROXY` accordingly or all clients share one bucket / IPs can be spoofed.
- **Validation:** whitelist + forbidNonWhitelisted (unknown fields → 400), emails trimmed + lower-cased, names trimmed.
- **Verified:** besides the e2e suite, a manual HTTP run against the built API (dev DB, Alex): 401 → login sets the cookie → `/me`, `PATCH /me/settings` with the cookie → second onboarding 409 → logout 204 → 401. This is the same same-origin cookie flow Swagger UI at `/api/docs` uses; Swagger UI itself was not clicked through in a browser.

Phase 3 (2026-11-24):

- FX: `RateTable` loads all USD→X rows once per request; lookups by binary search (latest on/before the date, else latest). Cross rates are exact fractions (`rate(USD→B) / rate(USD→A)`), so conversions don't compound rounding. Rate "date" = the instant's UTC calendar day. Missing currency → 422 `FX_RATE_UNAVAILABLE`.
- Transfers between currencies store `fxRate` rounded to 8 digits (Decimal(18,8)), and `toAmountMinor` uses the exact cross rate at the transaction date. €→$ at the seed rate shows `1.08000000`.
- Balances: one SQL CTE (opening + income − expense − transfers out + `toAmountMinor` in), soft-deleted rows ignored. `balanceInBaseMinor` uses the latest rate. Archived accounts are hidden unless `?includeArchived=true`; archiving needs a derived balance of exactly 0; archived accounts/categories/goals refuse new or edited records (409 `*_ARCHIVED`).
- Account `currency` is editable only until the account has any transaction (incl. soft-deleted, which still point at it): 409 `ACCOUNT_CURRENCY_LOCKED`. Opening balance isn't editable after creation (not in scope).
- Categories: type is fixed after creation; names unique per (user, type) among non-archived, case-insensitive; new categories get a "General" sub-category. Sub-categories: unique per category (case-insensitive), deletable only when no transaction (even soft-deleted) or rule uses them (`SUBCATEGORY_IN_USE`) and never the last one (`SUBCATEGORY_LAST`). Sub-category routes are nested: `/api/categories/:id/subcategories/:subId`.
- Transactions: one validator (`resolve`) for create and edit; its lookups (account, destination, category + first sub-category, sub-category, budget, goal) run in parallel — one round trip.
  - `budgetId`: omitted / `'auto'` → AUTO; `null` → NONE; id → EXPLICIT (expenses only). Non-expense rows store AUTO (harmless; reports count expenses only).
  - Splits: expense only; amount optional (must equal the sum if sent); not combinable with `recurring` (400 `SPLIT_NOT_RECURRING`, agreed) or a top-level category; note/tags/budget/goal/date apply to every row; returned in request order.
  - Recurring: the rule stores the full template (incl. `tagNames`); `nextRunAt` = occurrence #1 + 1 period via `occurrenceAt(anchor, n)` in the user's timezone (month-end clamped from the anchor day, DST-safe) — `src/recurring/schedule.ts`, ready for the phase 4 scheduler.
  - Edit = merge + full re-validation. Type can switch (agreed) except on split rows (`SPLIT_TYPE_IMMUTABLE`); switching clears what no longer applies (category on transfer, destination on expense/income, explicit budget off expenses). Tags are replaced only when sent. The recurring rule is never touched.
  - Tags: trimmed, leading `#` dropped, de-duplicated case-insensitively; existing tags reused case-insensitively.
  - Filters: `from`/`to` are inclusive calendar dates and `month` a calendar month, all in the user's timezone; `month` with `from`/`to` → 400. `accountId` matches source or destination. `q` = case-insensitive contains over note, description, category, sub-category, tag names. Cursor = opaque base64url of `[occurredAt, id]`; `limit` 1–200, default 50.
  - Summary: each row converted at the rate on its own date, then summed; transfers count in `count` only.
  - CSV: streamed in 500-row pages with backpressure; filters validated before the first byte (bad filters → JSON 400). Every field quoted, quotes doubled, CRLF line ends; dates/times in the user timezone; amounts in the row's currency; type lower-case (prototype); tags space-joined, sorted. Free-text cells starting with `= + - @` get a leading `'` (CSV-injection guard).
- Malformed ids in paths → 404 with the model's code (`IdParam`), never a DB error.
- Prisma `relationJoins` preview feature on: includes load in one SQL query (lists were ~7 queries per page).
- Seed split into `prisma/seed-lib.ts` (`seedDemo(prisma, today)`) + CLI `prisma/seed.ts`; an e2e test seeds the test DB and checks Alex's API balances against the prototype.
- Vitest `testTimeout` 90 s: from the dev machine each Neon round trip is ~300 ms and a new connection ~2.2 s, so the full API suite takes ~20 min there (local Postgres / CI: seconds).

## Known gaps

- `docker compose up -d` is untested: Docker isn't installed on the dev machine. Phase 0 was verified against a local PostgreSQL 17 install (phase 0 doesn't touch the DB). Compose + the `ledgerline_test` init script still need a run on a machine with Docker.
- CI workflow is written but has not run yet (no remote configured).
- `pnpm e2e` passes with no specs (`--pass-with-no-tests`) until the phase 5 smoke test.
- `pnpm db:reset` needs explicit user consent when run by an AI agent (Prisma 7 guard). Ran it on 2026-11-24 with the user's consent: drop, both migrations, seed — balances check passed.
- Full API suite is slow against Neon from the dev machine (~300 ms per round trip). Consider a local Postgres for `TEST_DATABASE_URL` once Docker or a local role is available.
- `pg` warns that `sslmode=require` will change meaning in pg v9; Neon URLs can switch to `sslmode=verify-full` to keep today's behaviour.

## Later

- Email verification on sign-up (phase 2 scope excluded it); until then register's `EMAIL_IN_USE` reveals existing accounts.
- Shared throttler store (Redis) when the API runs as more than one instance.
- Periodic cleanup of expired / revoked `sessions` rows.
- Editing an account's opening balance; un-archiving accounts / categories.
- A "sessions" list in Settings (user agent, IP, last used) using the stored metadata.
