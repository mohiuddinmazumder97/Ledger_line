import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { registerUser } from './utils/auth.js';
import { truncateAll } from './utils/db.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('Me & settings (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let token: string;
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
    ({ token } = await registerUser(app, { email: 'me@example.com', name: 'Me' }));
  });

  const patch = (body: object) =>
    http().patch('/api/me/settings').set('Cookie', `session=${token}`).send(body);

  it('GET /me returns the profile without secrets', async () => {
    const res = await http().get('/api/me').set('Cookie', `session=${token}`).expect(200);
    expect(Object.keys(res.body as object).sort()).toEqual(
      [
        'id',
        'name',
        'email',
        'baseCurrency',
        'theme',
        'dashboardLayout',
        'drawerStyle',
        'timezone',
        'onboardedAt',
      ].sort(),
    );
    expect(JSON.stringify(res.body)).not.toMatch(/argon2|passwordHash/);
  });

  it('updates any subset of settings', async () => {
    const res = await patch({
      baseCurrency: 'EUR',
      theme: 'DARK',
      dashboardLayout: 'CALENDAR',
      drawerStyle: 'KEYPAD',
      timezone: 'Asia/Dhaka',
    }).expect(200);
    expect(res.body).toMatchObject({
      baseCurrency: 'EUR',
      theme: 'DARK',
      dashboardLayout: 'CALENDAR',
      drawerStyle: 'KEYPAD',
      timezone: 'Asia/Dhaka',
    });

    const partial = await patch({ theme: 'LIGHT' }).expect(200);
    expect(partial.body).toMatchObject({ theme: 'LIGHT', baseCurrency: 'EUR', drawerStyle: 'KEYPAD' });
  });

  it('resets drawerStyle to the client default with null', async () => {
    await patch({ drawerStyle: 'FORM' }).expect(200);
    const res = await patch({ drawerStyle: null }).expect(200);
    expect(res.body).toMatchObject({ drawerStyle: null });
  });

  it.each([
    [{ baseCurrency: 'GBP' }],
    [{ baseCurrency: 'usd' }],
    [{ theme: 'BLUE' }],
    [{ dashboardLayout: 'GRID' }],
    [{ drawerStyle: 'WHEEL' }],
    [{ timezone: 'Mars/Olympus' }],
    [{ timezone: '' }],
    [{ email: 'evil@example.com' }],
  ])('rejects %j', async (body) => {
    const res = await patch(body).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
