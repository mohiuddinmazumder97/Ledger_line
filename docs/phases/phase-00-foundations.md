# Phase 0 — Foundations

Goal: an empty but fully wired monorepo where `pnpm dev` runs a NestJS API and a Next.js app that talk to each other, and Postgres runs in Docker.

## Build

1. pnpm workspace + Turborepo at the root. Workspaces: `apps/api`, `apps/web`, `packages/api-client`, `packages/config`.
   - Root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `db:migrate`, `db:seed`, `db:reset`, `gen:api` (stub for now).
   - Vitest in both apps; the API uses `unplugin-swc` so Nest decorators/metadata work. No Jest.
   - `.nvmrc` with the current Node LTS, `packageManager` field pinned.
2. `packages/config`: shared `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), ESLint flat config, Prettier config. Both apps extend them.
3. `docker-compose.yml`: `postgres:16` with a named volume, healthcheck, port 5432; a second database `ledgerline_test` created by an init script.
4. `apps/api` (NestJS):
   - `@nestjs/config` with env validation (zod or Joi): `DATABASE_URL`, `WEB_ORIGIN`, `PORT`, `SEED_TODAY` (optional, default `2026-11-22`). No JWT secrets — auth uses opaque DB sessions (phase 2).
   - Global prefix `api`, global `ValidationPipe` (see CLAUDE.md), Helmet, CORS limited to `WEB_ORIGIN`, cookie-parser.
   - `@nestjs/swagger` serving `/api/docs` and `/api/docs-json`, plus a `scripts/write-openapi.ts` that creates the Nest app without listening, calls `SwaggerModule.createDocument` and writes `apps/api/openapi.json` (wired into `gen:api`).
   - `GET /api/health` → `{ status: 'ok' }`, with an e2e test.
   - Structured logging (nestjs-pino).
5. `apps/web` (Next.js App Router, src dir, TypeScript):
   - `next.config` rewrite `/api/:path*` → `${API_URL}/api/:path*`.
   - Tailwind v4 installed; shadcn initialised (no theme work yet — that is phase 5).
   - Home page that calls `/api/health` server-side and prints the status.
6. `.env.example` files for root/api/web, `.gitignore`, `.editorconfig`.
7. GitHub Actions workflow: install, lint, typecheck, test (with a Postgres service).
8. Root `README.md`: prerequisites, setup steps, commands.

## Done when

- `docker compose up -d && pnpm i && pnpm dev` shows the web page reporting `ok` from the API.
- `/api/docs` loads.
- `pnpm lint && pnpm typecheck && pnpm test` pass.

## Don't

- No Prisma schema, auth, or UI theming yet.
