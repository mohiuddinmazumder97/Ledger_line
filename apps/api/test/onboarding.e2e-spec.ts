import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { registerUser } from './utils/auth.js';
import { truncateAll } from './utils/db.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('Onboarding (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const http = () => request(app.getHttpServer());
  const onboard = (body: object) =>
    http().post('/api/onboarding').set('Cookie', `session=${token}`).send(body);

  const valid = {
    baseCurrency: 'EUR',
    account: { name: ' Everyday Checking ', openingBalance: '2500.50' },
    categoryTemplateIds: ['salary', 'food', 'housing'],
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    ({ token, userId } = await registerUser(app));
  });

  it('lists the 9 default category templates', async () => {
    const res = await http().get('/api/onboarding/templates').set('Cookie', `session=${token}`).expect(200);
    const body = res.body as { id: string; name: string; type: string; subs: string[] }[];
    expect(body.map((t) => t.id)).toEqual([
      'food',
      'transport',
      'housing',
      'shopping',
      'health',
      'fun',
      'salary',
      'side',
      'interest',
    ]);
    expect(body[0]).toEqual({
      id: 'food',
      name: 'Food & Drink',
      type: 'EXPENSE',
      subs: ['Groceries', 'Restaurants', 'Coffee'],
    });
  });

  it('sets currency, creates the account and chosen categories, marks onboarded', async () => {
    const res = await onboard(valid).expect(201);
    expect(res.body).toMatchObject({ baseCurrency: 'EUR', onboardedAt: expect.any(String) as string });

    const accounts = await prisma.account.findMany({ where: { userId } });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      name: 'Everyday Checking',
      kind: 'BANK',
      currency: 'EUR',
      openingBalanceMinor: 250050n,
      showOnDashboard: true,
      archivedAt: null,
    });

    const categories = await prisma.category.findMany({
      where: { userId },
      include: { subcategories: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    // Template order, not request order.
    expect(categories.map((c) => [c.name, c.type, c.sortOrder])).toEqual([
      ['Food & Drink', 'EXPENSE', 0],
      ['Housing', 'EXPENSE', 1],
      ['Salary', 'INCOME', 2],
    ]);
    const housing = categories.find((c) => c.name === 'Housing')!;
    expect(housing.subcategories.map((s) => [s.name, s.excludeFromInsights, s.userId])).toEqual([
      ['Rent', true, userId],
      ['Utilities', false, userId],
      ['Internet', false, userId],
    ]);
  });

  it('accepts no categories and a negative balance', async () => {
    await onboard({
      ...valid,
      account: { name: 'Card', openingBalance: '-120' },
      categoryTemplateIds: [],
    }).expect(201);
    const account = await prisma.account.findFirstOrThrow({ where: { userId } });
    expect(account.openingBalanceMinor).toBe(-12000n);
    expect(await prisma.category.count({ where: { userId } })).toBe(0);
  });

  it('can only be completed once', async () => {
    await onboard(valid).expect(201);
    const res = await onboard(valid).expect(409);
    expect(res.body).toMatchObject({ code: 'ALREADY_ONBOARDED' });
    expect(await prisma.account.count({ where: { userId } })).toBe(1);
  });

  it('is safe against a double submit', async () => {
    const results = await Promise.all([onboard(valid), onboard(valid)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.account.count({ where: { userId } })).toBe(1);
    expect(await prisma.category.count({ where: { userId } })).toBe(3);
  });

  it('rejects more decimals than the currency allows, and changes nothing', async () => {
    const res = await onboard({ ...valid, account: { name: 'A', openingBalance: '10.005' } }).expect(400);
    expect(res.body).toMatchObject({ code: 'INVALID_AMOUNT' });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.onboardedAt).toBeNull();
    expect(user.baseCurrency).toBe('USD');
  });

  it.each([
    [{ ...valid, baseCurrency: 'GBP' }],
    [{ ...valid, categoryTemplateIds: ['food', 'pets'] }],
    [{ ...valid, categoryTemplateIds: ['food', 'food'] }],
    [{ ...valid, account: { name: '', openingBalance: '1' } }],
    [{ ...valid, account: { name: 'A', openingBalance: '1e5' } }],
    [{ ...valid, account: { name: 'A', openingBalance: 100 } }],
    [{ ...valid, account: { name: 'A', openingBalance: '1', kind: 'CREDIT' } }],
    [{ baseCurrency: 'USD', categoryTemplateIds: [] }],
  ])('validates %j', async (body) => {
    const res = await onboard(body).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
