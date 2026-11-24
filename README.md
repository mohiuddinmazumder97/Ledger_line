# Ledgerline

Personal finance tracker: multi-currency accounts, expenses / income / transfers, budgets, goals, debts, net worth and reports.

- Product spec: [`docs/SPEC.md`](docs/SPEC.md) · Design rules: [`docs/DESIGN.md`](docs/DESIGN.md) · Prototype: [`docs/design/`](docs/design/)
- Work plan: [`docs/phases/`](docs/phases/) · Progress and decisions: [`docs/PROGRESS.md`](docs/PROGRESS.md)
- Working agreement for Claude Code: [`CLAUDE.md`](CLAUDE.md)

## Layout

| Path                  | What                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| `apps/api`            | NestJS API (ESM, TypeScript strict), served under `/api`, Swagger at `/api/docs`     |
| `apps/web`            | Next.js App Router app; `/api/*` is rewritten to the API so cookies stay first-party |
| `packages/api-client` | Generated TanStack Query hooks + zod schemas (from phase 4)                          |
| `packages/config`     | Shared tsconfig, ESLint and Prettier config                                          |

## Prerequisites

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm 11 (`corepack enable` picks the version pinned in `package.json`)
- Docker with Compose, for Postgres. A local PostgreSQL 16+ works too: create the `ledgerline` and `ledgerline_test` databases yourself and point `DATABASE_URL` at them.

## Setup

```bash
cp .env.example .env                        # optional: compose credentials
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d                        # Postgres 16 on :5432 (+ ledgerline_test)
pnpm install
pnpm dev                                    # API on :4000, web on :3000
```

Open http://localhost:3000 — it should say **API status: ok**.
API docs: http://localhost:4000/api/docs (also reachable through the web origin at http://localhost:3000/api/docs).

## Commands

| Command                                              | What                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`                                           | API + web in watch mode                                                            |
| `pnpm build`                                         | Build everything                                                                   |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`         | Checks (Vitest everywhere)                                                         |
| `pnpm e2e`                                           | Playwright (specs arrive in phase 5)                                               |
| `pnpm gen:api`                                       | Write `apps/api/openapi.json` without a running server (orval client from phase 4) |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:reset` | Database (from phase 1)                                                            |
| `pnpm format`                                        | Prettier                                                                           |
