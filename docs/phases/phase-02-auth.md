# Phase 2 — Auth, users & onboarding API

Goal: secure sign-up / sign-in with opaque DB sessions (cookie for web, bearer for native), user settings, and the onboarding endpoint.

## Build

1. `auth` module:
   - `SessionService`: create (32 random bytes → base64url token; store only `sha256(token)`, `expiresAt` = now + 30 days), validate (lookup by hash, reject revoked/expired, slide `expiresAt` to now + 30 days — at most once per hour to limit writes — and update `lastUsedAt`), revoke, revokeAllForUser.
   - `POST /api/auth/register` (name, email, password ≥ 8) → creates user (argon2id), creates a session, returns `me`.
   - `POST /api/auth/login` → creates a session. Web: sets httpOnly cookie `session` (path `/`, `SameSite=Lax`, `Secure` in production, 30-day max-age refreshed on slide). Native: when the request sends `X-Client: native`, return `{ token, expiresAt }` in the body instead of a cookie.
   - `POST /api/auth/logout` → revokes the current session, clears the cookie. `POST /api/auth/logout-all` → revokes every session of the user.
   - `SessionAuthGuard` global by default: reads the `session` cookie, else `Authorization: Bearer <token>`; `@Public()` decorator for open routes; `@CurrentUser()` param decorator.
   - Throttling (`@nestjs/throttler`) on login/register: 5/min per IP.
   - Generic "Email or password is incorrect" on failure.
2. `users` module:
   - `GET /api/me` → id, name, email, baseCurrency, theme, dashboardLayout, drawerStyle, timezone, onboardedAt.
   - `PATCH /api/me/settings` → any of baseCurrency, theme, dashboardLayout, drawerStyle, timezone.
3. `POST /api/onboarding` (only when `onboardedAt` is null): `{ baseCurrency, account: { name, openingBalance }, categoryTemplateIds: string[] }` → in one DB transaction: set currency, create the account (kind BANK, currency = base), create the chosen default categories with their sub-categories, set `onboardedAt`. Expose `GET /api/onboarding/templates` listing the 9 default categories (id, name, type, subs).
4. A shared `ownership` helper used by later services: `assertOwned(model, id, userId)` throwing 404 with a code.
5. Tests (Vitest + Supertest, real test DB, truncate between tests): register → me; login wrong password; cookie and bearer both authenticate the same session; sliding expiry extends `expiresAt`; expired and revoked tokens → 401; logout and logout-all; DB holds only the hash; onboarding happy path + second call rejected; unauthenticated access returns 401.

## Done when

- All auth flows work from Swagger UI with cookies.
- Tests pass. Security notes added to `docs/PROGRESS.md` (cookie flags, hashing, sliding expiry, throttling).

## Don't

- No password reset yet (phase 9); no email verification (add to Later).
