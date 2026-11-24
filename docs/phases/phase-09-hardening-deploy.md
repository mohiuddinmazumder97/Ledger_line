# Phase 9 — Receipts, password reset, hardening & deploy

Goal: finish receipts and password reset, then make the app production-ready. (The recurring scheduler moved to phase 4.)

## Build

1. Password reset by email (must land before deploy):
   - Add Mailpit to docker-compose (SMTP 1025, UI 8025); mailer env `SMTP_URL`, `MAIL_FROM`, `APP_URL`.
   - `POST /api/auth/password/forgot` (email) → always 204 (no account enumeration); creates a single-use reset token (32 random bytes, SHA-256 hashed, 1-hour expiry) and emails a link `/reset-password?token=…`. Throttled like login.
   - `POST /api/auth/password/reset` (token, new password ≥ 8) → sets the password, consumes the token, revokes all sessions.
   - Web: "Forgot password?" link on `/signin`, `/forgot-password` and `/reset-password` pages in the sign-in visual style.
   - Tests: happy path, expired/used token, unknown email still 204, sessions revoked; e2e reads the email from Mailpit's API.
2. Receipts:
   - Add MinIO to docker-compose (S3-compatible); `receipts` module with `POST /api/receipts/presign` (content type image/* or application/pdf, max 10 MB) → presigned PUT URL + key; `GET /api/transactions/:id/receipt` → short-lived presigned GET.
   - Drawer uploads the file after choosing it, stores `receiptKey` on save; transaction rows show the Receipt tag and open it.
   - Env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`.
3. Quality:
   - Extend the Playwright e2e suite (set up in phase 5): sign up → onboarding → add expense → appears in list and budget; password reset via Mailpit; transfer EUR→USD; split expense; export CSV; dark mode persists after reload.
   - Accessibility pass: labels on every input, focus-visible rings, drawer focus trap, keyboard nav for chips and segmented controls, color contrast check in both themes.
   - Error boundaries + `not-found` pages; API global exception filter with request id in logs.
   - Performance: check the transactions and report queries with `EXPLAIN ANALYZE` on seeded data; add indexes if needed.
4. Deploy:
   - Multi-stage Dockerfiles for api and web (Next standalone output); `docker-compose.prod.yml` (api, web, postgres, minio or real S3) and a `migrate` one-shot service.
   - `DEPLOY.md` with two documented paths: (a) single VPS with Docker Compose + Caddy for TLS, (b) managed: web on Vercel, API on Render/Fly/Railway, Postgres on Neon/Supabase, receipts on S3/R2 — including the cookie/domain setup (API under the same parent domain, `SameSite`, `Secure`).
   - CI: add Playwright job and Docker image build.

## Done when

- Password reset works end to end locally via Mailpit.
- Receipts upload and open.
- All tests (unit, API e2e, Playwright) pass in CI; production compose boots from a clean machine using DEPLOY.md.
