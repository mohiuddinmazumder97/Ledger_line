import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { truncateAll } from './utils/db.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

// The real production limit. Set before the app (and ConfigModule) is created; this file runs in
// its own module graph, so other specs keep their relaxed limit.
process.env.AUTH_THROTTLE_LIMIT = '5';

describe('Auth throttling (e2e)', () => {
  let app: TestApp;
  const http = () => request(app.getHttpServer());
  const attempt = (ip?: string) => {
    const req = http().post('/api/auth/login');
    if (ip) void req.set('X-Forwarded-For', ip);
    return req.send({ email: 'nobody@example.com', password: 'wrong password' });
  };

  beforeAll(async () => {
    app = await createTestApp();
    await truncateAll(app.get(PrismaService));
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows 5 login attempts per minute per IP, then answers 429', async () => {
    for (let i = 0; i < 5; i++) await attempt('203.0.113.7').expect(401);
    const res = await attempt('203.0.113.7').expect(429);
    expect(res.body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' });
  });

  it('counts per client IP (X-Forwarded-For from the trusted local proxy)', async () => {
    await attempt('203.0.113.8').expect(401);
  });

  it('limits register separately', async () => {
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/api/auth/register')
        .set('X-Forwarded-For', '203.0.113.9')
        .send({ name: 'x', email: 'bad', password: 'x' })
        .expect(400);
    }
    await http()
      .post('/api/auth/register')
      .set('X-Forwarded-For', '203.0.113.9')
      .send({ name: 'x', email: 'bad', password: 'x' })
      .expect(429);
  });
});
