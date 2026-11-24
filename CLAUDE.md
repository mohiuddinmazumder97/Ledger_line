# Ledgerline — project guide for Claude

Ledgerline is a personal finance tracker: multi-currency accounts, expenses / income / transfers,
monthly budgets, savings goals, debts & lending, net worth, and spending reports.

The approved UI prototype lives in `docs/design/`. It is the source of truth for screens, copy,
interactions and look. The product spec is `docs/SPEC.md`; the design rules are `docs/DESIGN.md`.
Work is done in phases — see `docs/phases/`. Progress is tracked in `docs/PROGRESS.md`.

## Stack (do not swap without asking)

- Monorepo: pnpm workspaces + Turborepo
  - `apps/api` — NestJS (latest stable), TypeScript strict. Kept as a separate API because a Flutter mobile app will consume it too.
  - `apps/web` — Next.js (latest stable, App Router), TypeScript strict
  - `packages/api-client` — generated with orval (TanStack Query hooks + zod schemas) from `apps/api/openapi.json`. That file is written by a script that builds the Nest app and calls `SwaggerModule.createDocument` — no running server needed. Never hand-edit generated files.
  - `packages/config` — shared tsconfig / eslint / prettier
- Database: PostgreSQL 16 via Docker Compose; Prisma ORM + Prisma Migrate
- Frontend: Tailwind CSS v4, shadcn/ui, TanStack Query (server state), Zustand (UI-only state), react-hook-form + zod, next-themes, sonner (toasts), nuqs (URL query state). No chart library — charts are plain divs/SVG as in the prototype.
- Auth: email + password (argon2id) and **opaque DB sessions** (no JWTs). On sign-in the API creates a 32-byte random token, stores only its SHA-256 hash in a `Session` table, with a 30-day sliding expiry; sessions are revocable (logout, revoke-all). Web: httpOnly cookie `session` (path `/`, `SameSite=Lax`, `Secure` in production); the web app reaches the API through a Next.js rewrite (`/api/*` → Nest) so the cookie stays first-party. Native clients (Flutter): send the same token as `Authorization: Bearer <token>`. `middleware.ts` only checks that the cookie is present; the API is the one that validates it.
- Tests: Vitest everywhere — API with `unplugin-swc` (decorator metadata) + Supertest against a real test database; web with Testing Library. Playwright for end-to-end and screenshot comparison against the prototype.

## Non-negotiable rules

1. **Money is never a float.** Store amounts as `BigInt` minor units (cents, paisa) plus an ISO-4217 `currency` column. Do arithmetic in minor units; convert to display strings only at the edge (`formatMoney` in web, never in the API). FX rates are `Decimal(18,8)`.
2. **Balances are derived, not stored.** Account balance = opening balance + ledger. Never mutate a stored balance.
3. **Every query is scoped by `userId`.** No endpoint may read or write another user's row. Check ownership of every referenced id (account, category, budget, goal…) on write.
4. **Server state lives in TanStack Query, never in Zustand.** Zustand holds UI state only: drawer open/closed + draft, dashboard layout choice, sidebar state. Transaction filters live in the URL (nuqs) — the URL is their single source of truth; no filters store.
5. **The API contract is OpenAPI.** Every controller has Swagger decorators and DTOs; money fields (BigInt minor units) are declared explicitly as `@ApiProperty({ type: String, pattern: '^-?\\d+$' })` so generated zod says string, not number. After any API change run `pnpm gen:api` (writes `apps/api/openapi.json`, then runs orval) and use the generated hooks in web. No hand-written `fetch` calls to the API in components.
6. **Match the prototype.** Before building a screen, read the matching section in `docs/design/ledgerline-prototype.dc.html` (markup at the top, data/logic in the `<script>` at the bottom). Keep labels, copy, ordering and empty states.
7. Soft-delete transactions (`deletedAt`); hard-delete nothing that has ledger rows pointing at it — archive instead. An account can only be archived when its derived balance is exactly zero (409 `ACCOUNT_BALANCE_NOT_ZERO` otherwise).
8. Dates: store `timestamptz` in UTC; the user's timezone (setting, default from browser) decides month boundaries in reports.

## Conventions

- API modules: one Nest module per domain (`auth`, `users`, `accounts`, `categories`, `transactions`, `budgets`, `goals`, `debts`, `reports`, `fx`, `recurring`, `receipts`). Controller → service → Prisma. Business rules live in services, not controllers.
- DTO validation with `class-validator`; global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Errors: throw Nest HTTP exceptions with a stable `code` field (e.g. `ACCOUNT_NOT_FOUND`), the web maps codes to messages.
- Pagination: cursor-based (`cursor`, `limit`, returns `nextCursor`).
- Web routes: `app/(auth)/…` for sign-in / onboarding, `app/(app)/…` for the signed-in shell.
- Components: shadcn primitives in `components/ui`, app components in `components/<domain>/`.
- Naming: files kebab-case, React components PascalCase, DB tables snake_case via Prisma `@@map`.

## Commands (keep this list updated)

- `docker compose up -d` — Postgres (+ MinIO and Mailpit from phase 9)
- `pnpm dev` — api + web in parallel
- `pnpm db:migrate` (`prisma migrate dev`) / `pnpm db:seed` / `pnpm db:reset` (drop, migrate, seed; seed anchors on `SEED_TODAY`, default `2026-11-22`, and fails unless derived balances equal the prototype)
- `pnpm --filter @ledgerline/api db:deploy` — apply migrations without resetting (CI, prod); `db:generate` — regenerate the Prisma client (also runs on install)
- `pnpm gen:api` — write `apps/api/openapi.json` (no server needed) and regenerate `packages/api-client` from it
- `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm e2e` — API tests need a test DB: `TEST_DATABASE_URL` in `apps/api/.env` (name must end in `_test`), else local `ledgerline_test`
- `pnpm format` — Prettier over the repo

## How to work a phase

1. Read this file, `docs/PROGRESS.md`, and the phase file you were given.
2. Make a short plan and show it before writing code.
3. Build only what the phase lists. If something outside scope is needed, note it in `docs/PROGRESS.md` under "Later".
4. Finish with `pnpm lint && pnpm typecheck && pnpm test` all passing.
5. Update `docs/PROGRESS.md` (what was done, decisions made, known gaps) and propose a commit message. Do not start the next phase.
