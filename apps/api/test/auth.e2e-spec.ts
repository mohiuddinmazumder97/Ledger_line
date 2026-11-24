import request from 'supertest';
import { hashToken } from '../src/auth/session.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PASSWORD, registerUser, sessionCookieHeader, sessionToken, setCookies } from './utils/auth.js';
import { truncateAll } from './utils/db.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const DAY = 24 * 60 * 60 * 1000;

describe('Auth (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  describe('register', () => {
    it('creates the user, sets the session cookie and returns me', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ name: '  Alex Moreno ', email: ' Alex@Example.COM ', password: PASSWORD })
        .expect(201);

      expect(res.body).toEqual({
        user: {
          id: expect.any(String) as string,
          name: 'Alex Moreno',
          email: 'alex@example.com',
          baseCurrency: 'USD',
          theme: 'SYSTEM',
          dashboardLayout: 'OVERVIEW',
          drawerStyle: null,
          timezone: 'UTC',
          onboardedAt: null,
        },
      });

      const cookie = sessionCookieHeader(res)!;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/Max-Age=259\d{4}/); // ~30 days
      expect(cookie).not.toMatch(/Secure/); // only in production

      const me = await http()
        .get('/api/me')
        .set('Cookie', `session=${sessionToken(res)}`)
        .expect(200);
      expect(me.body).toEqual((res.body as { user: unknown }).user);
    });

    it('stores an argon2id hash, never the password', async () => {
      await registerUser(app, { email: 'hash@example.com' });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'hash@example.com' } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(PASSWORD);
    });

    it('rejects a taken email case-insensitively', async () => {
      await registerUser(app, { email: 'taken@example.com' });
      const res = await http()
        .post('/api/auth/register')
        .send({ name: 'Other', email: 'TAKEN@example.com', password: PASSWORD })
        .expect(409);
      expect(res.body).toMatchObject({ code: 'EMAIL_IN_USE' });
    });

    it('validates input with a stable code', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ name: '', email: 'not-an-email', password: 'short' })
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
      expect((res.body as { message: string[] }).message.join(' ')).toMatch(
        /email.*password|password.*email/s,
      );
    });

    it('rejects unknown fields', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ name: 'A', email: 'a@example.com', password: PASSWORD, isAdmin: true })
        .expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('login', () => {
    it('signs in with the right password (cookie)', async () => {
      await registerUser(app, { email: 'login@example.com' });
      const res = await http()
        .post('/api/auth/login')
        .send({ email: 'LOGIN@example.com', password: PASSWORD })
        .expect(200);
      expect(res.body).toMatchObject({ user: { email: 'login@example.com' } });
      expect(res.body).not.toHaveProperty('token');
      await http()
        .get('/api/me')
        .set('Cookie', `session=${sessionToken(res)}`)
        .expect(200);
    });

    it('gives the same generic error for a wrong password and an unknown email', async () => {
      await registerUser(app, { email: 'known@example.com' });
      const wrong = await http()
        .post('/api/auth/login')
        .send({ email: 'known@example.com', password: 'wrong password' })
        .expect(401);
      const unknown = await http()
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong password' })
        .expect(401);
      const expected = {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      };
      expect(wrong.body).toEqual(expected);
      expect(unknown.body).toEqual(expected);
      expect(setCookies(wrong)).toEqual([]);
    });

    it('returns the token in the body for native clients, without a cookie', async () => {
      await registerUser(app, { email: 'native@example.com' });
      const res = await http()
        .post('/api/auth/login')
        .set('X-Client', 'native')
        .send({ email: 'native@example.com', password: PASSWORD })
        .expect(200);
      const body = res.body as { token: string; expiresAt: string; user: { email: string } };
      expect(body.user.email).toBe('native@example.com');
      expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
      expect(sessionCookieHeader(res)).toBeUndefined();
      await http().get('/api/me').set('Authorization', `Bearer ${body.token}`).expect(200);
    });

    it('records user agent and IP on the session', async () => {
      await registerUser(app, { email: 'meta@example.com' });
      await http()
        .post('/api/auth/login')
        .set('User-Agent', 'LedgerlineTest/1.0')
        .send({ email: 'meta@example.com', password: PASSWORD })
        .expect(200);
      const session = await prisma.session.findFirstOrThrow({ where: { userAgent: 'LedgerlineTest/1.0' } });
      expect(session.ip).toBeTruthy();
    });
  });

  describe('sessions', () => {
    it('cookie and bearer authenticate the same session', async () => {
      const { token, userId } = await registerUser(app);
      const viaCookie = await http().get('/api/me').set('Cookie', `session=${token}`).expect(200);
      const viaBearer = await http().get('/api/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(viaCookie.body).toEqual(viaBearer.body);
      expect(await prisma.session.count({ where: { userId } })).toBe(1);
    });

    it('stores only the SHA-256 of the token', async () => {
      const { token, userId } = await registerUser(app);
      const session = await prisma.session.findFirstOrThrow({ where: { userId } });
      expect(session.tokenHash).toBe(hashToken(token));
      expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      const rows = await prisma.$queryRaw<unknown[]>`SELECT * FROM sessions`;
      expect(JSON.stringify(rows)).not.toContain(token);
    });

    it('slides the expiry when the session was last used over an hour ago', async () => {
      const { token, userId } = await registerUser(app);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await prisma.session.updateMany({
        where: { userId },
        data: { lastUsedAt: twoHoursAgo, expiresAt: new Date(Date.now() + 5 * DAY) },
      });

      const res = await http().get('/api/me').set('Cookie', `session=${token}`).expect(200);

      const session = await prisma.session.findFirstOrThrow({ where: { userId } });
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
      expect(session.lastUsedAt.getTime()).toBeGreaterThan(twoHoursAgo.getTime());
      // The cookie is re-issued with a fresh max-age.
      expect(sessionCookieHeader(res)).toMatch(/Max-Age=259\d{4}/);
    });

    it('does not write on every request (at most once per hour)', async () => {
      const { token, userId } = await registerUser(app);
      const before = await prisma.session.findFirstOrThrow({ where: { userId } });
      const res = await http().get('/api/me').set('Cookie', `session=${token}`).expect(200);
      const after = await prisma.session.findFirstOrThrow({ where: { userId } });
      expect(after.updatedAt).toEqual(before.updatedAt);
      expect(sessionCookieHeader(res)).toBeUndefined();
    });

    it('rejects an expired session and clears the cookie', async () => {
      const { token, userId } = await registerUser(app);
      await prisma.session.updateMany({
        where: { userId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await http().get('/api/me').set('Cookie', `session=${token}`).expect(401);
      expect(res.body).toMatchObject({ code: 'SESSION_INVALID' });
      expect(sessionCookieHeader(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
      await http().get('/api/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('rejects a revoked session', async () => {
      const { token, userId } = await registerUser(app);
      await prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
      await http().get('/api/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('rejects garbage tokens', async () => {
      await http().get('/api/me').set('Authorization', 'Bearer nope').expect(401);
      await http()
        .get('/api/me')
        .set('Authorization', `Bearer ${'x'.repeat(5000)}`)
        .expect(401);
      await http().get('/api/me').set('Cookie', 'session=nope').expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the current session only and clears the cookie', async () => {
      const { token, userId, email } = await registerUser(app);
      const other = await http()
        .post('/api/auth/login')
        .set('X-Client', 'native')
        .send({ email, password: PASSWORD })
        .expect(200);
      const otherToken = (other.body as { token: string }).token;

      const res = await http().post('/api/auth/logout').set('Cookie', `session=${token}`).expect(204);
      expect(sessionCookieHeader(res)).toMatch(/Expires=Thu, 01 Jan 1970/);

      await http().get('/api/me').set('Cookie', `session=${token}`).expect(401);
      await http().get('/api/me').set('Authorization', `Bearer ${otherToken}`).expect(200);
      const revoked = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
      expect(revoked.revokedAt).not.toBeNull();
      expect(await prisma.session.count({ where: { userId, revokedAt: null } })).toBe(1);
    });

    it('logout-all revokes every session of the user, and nobody else’s', async () => {
      const a = await registerUser(app);
      const b = await registerUser(app);
      const second = await http()
        .post('/api/auth/login')
        .set('X-Client', 'native')
        .send({ email: a.email, password: PASSWORD })
        .expect(200);
      const nativeToken = (second.body as { token: string }).token;

      await http().post('/api/auth/logout-all').set('Authorization', `Bearer ${nativeToken}`).expect(204);

      await http().get('/api/me').set('Cookie', `session=${a.token}`).expect(401);
      await http().get('/api/me').set('Authorization', `Bearer ${nativeToken}`).expect(401);
      await http().get('/api/me').set('Cookie', `session=${b.token}`).expect(200);
      expect(await prisma.session.count({ where: { userId: a.userId, revokedAt: null } })).toBe(0);
    });
  });

  describe('unauthenticated access', () => {
    it.each([
      ['get', '/api/me'],
      ['patch', '/api/me/settings'],
      ['get', '/api/onboarding/templates'],
      ['post', '/api/onboarding'],
      ['post', '/api/auth/logout'],
      ['post', '/api/auth/logout-all'],
    ] as const)('%s %s → 401', async (method, path) => {
      const res = await http()[method](path).expect(401);
      expect(res.body).toEqual({ statusCode: 401, code: 'UNAUTHENTICATED', message: 'Sign in to continue.' });
    });

    it('keeps health public', async () => {
      await http().get('/api/health').expect(200);
    });
  });
});
