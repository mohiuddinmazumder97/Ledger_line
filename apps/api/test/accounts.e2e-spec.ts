import request from 'supertest';
import { ACCOUNTS, SEED_USER } from '../prisma/seed-data.js';
import { seedDemo } from '../prisma/seed-lib.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { registerUser, sessionToken } from './utils/auth.js';
import { truncateAll } from './utils/db.js';
import { client, createTx, type Ledger, setupLedger } from './utils/ledger.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

type AccountBody = {
  id: string;
  name: string;
  currency: string;
  balanceMinor: string;
  balanceInBaseMinor: string;
  archivedAt: string | null;
};

describe('Accounts (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let L: Ledger;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    L = await setupLedger(app, prisma);
  });

  const balances = async () => {
    const res = await L.api.get('/api/accounts').expect(200);
    return Object.fromEntries((res.body as AccountBody[]).map((a) => [a.name, a]));
  };

  it('derives balances across income, expense and transfers (incl. EUR → USD), ignoring deleted rows', async () => {
    const at = '2026-11-10T12:00:00-05:00';
    await createTx(L.api, {
      type: 'INCOME',
      accountId: L.accounts.chk,
      amount: '200.00',
      occurredAt: at,
      categoryId: L.salary.id,
    });
    await createTx(L.api, {
      type: 'EXPENSE',
      accountId: L.accounts.chk,
      amount: '30.25',
      occurredAt: at,
      categoryId: L.food.id,
    });
    await createTx(L.api, {
      type: 'TRANSFER',
      accountId: L.accounts.chk,
      toAccountId: L.accounts.sav,
      amount: '50',
      occurredAt: at,
    });
    await createTx(L.api, {
      type: 'INCOME',
      accountId: L.accounts.eur,
      amount: '100',
      occurredAt: at,
      categoryId: L.salary.id,
    });
    // €40 → USD at 1/0.92592593 → $43.20
    const [fx] = await createTx(L.api, {
      type: 'TRANSFER',
      accountId: L.accounts.eur,
      toAccountId: L.accounts.cc,
      amount: '40',
      occurredAt: at,
    });
    expect(fx).toMatchObject({ toAmountMinor: '4320', fxRate: '1.08000000' });
    const [gone] = await createTx(L.api, {
      type: 'EXPENSE',
      accountId: L.accounts.chk,
      amount: '999',
      occurredAt: at,
      categoryId: L.food.id,
    });
    await L.api.delete(`/api/transactions/${gone!.id}`).expect(204);

    const b = await balances();
    expect(b['Everyday Checking']).toMatchObject({
      balanceMinor: String(100000 + 20000 - 3025 - 5000),
      balanceInBaseMinor: '111975',
    });
    expect(b['High-Yield Savings']).toMatchObject({ balanceMinor: '5000' });
    // €60 left → $64.80 in base at the latest rate
    expect(b['Euro Account']).toMatchObject({
      balanceMinor: '6000',
      currency: 'EUR',
      balanceInBaseMinor: '6480',
    });
    expect(b['Credit Card']).toMatchObject({ balanceMinor: '4320' });
  });

  it('creates an account with an opening balance and appends it to the order', async () => {
    const res = await L.api
      .post('/api/accounts', {
        name: ' Travel Card ',
        kind: 'CREDIT',
        currency: 'INR',
        openingBalance: '-1500.50',
      })
      .expect(201);
    expect(res.body).toMatchObject({
      name: 'Travel Card',
      kind: 'CREDIT',
      currency: 'INR',
      openingBalanceMinor: '-150050',
      balanceMinor: '-150050',
      balanceInBaseMinor: '-1801', // ₹-1,500.50 / 83.33333333 = $-18.006 → -18.01
      sortOrder: 1, // appended after the fixture accounts (all at 0)
      showOnDashboard: true,
    });
    await L.api
      .post('/api/accounts', { name: 'X', kind: 'CASH', currency: 'USD', openingBalance: '1.005' })
      .expect(400);
    await L.api.post('/api/accounts', { name: 'X', kind: 'GOLD', currency: 'USD' }).expect(400);
  });

  it('updates name, kind, visibility and order; currency only before the first transaction', async () => {
    const res = await L.api
      .patch(`/api/accounts/${L.accounts.sav}`, {
        name: 'Rainy Day',
        showOnDashboard: false,
        sortOrder: 9,
        currency: 'EUR',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      name: 'Rainy Day',
      showOnDashboard: false,
      sortOrder: 9,
      currency: 'EUR',
    });

    await createTx(L.api, {
      type: 'EXPENSE',
      accountId: L.accounts.chk,
      amount: '1',
      occurredAt: '2026-11-10T12:00:00Z',
      categoryId: L.food.id,
    });
    const locked = await L.api.patch(`/api/accounts/${L.accounts.chk}`, { currency: 'EUR' }).expect(409);
    expect(locked.body).toMatchObject({ code: 'ACCOUNT_CURRENCY_LOCKED' });
    await L.api.patch(`/api/accounts/${L.accounts.chk}`, { currency: 'USD' }).expect(200);
  });

  it('archives only at a zero balance, then hides the account and refuses new records', async () => {
    const refused = await L.api.post(`/api/accounts/${L.accounts.chk}/archive`).expect(409);
    expect(refused.body).toMatchObject({ code: 'ACCOUNT_BALANCE_NOT_ZERO' });

    // Bring Checking to exactly zero, then archive.
    await createTx(L.api, {
      type: 'TRANSFER',
      accountId: L.accounts.chk,
      toAccountId: L.accounts.sav,
      amount: '1000',
      occurredAt: '2026-11-10T12:00:00Z',
    });
    const archived = await L.api.post(`/api/accounts/${L.accounts.chk}/archive`).expect(200);
    expect((archived.body as AccountBody).archivedAt).not.toBeNull();

    expect(Object.keys(await balances())).not.toContain('Everyday Checking');
    const all = await L.api.get('/api/accounts?includeArchived=true').expect(200);
    expect((all.body as AccountBody[]).map((a) => a.name)).toContain('Everyday Checking');

    const res = await L.api
      .post('/api/transactions', {
        type: 'INCOME',
        accountId: L.accounts.chk,
        amount: '5',
        occurredAt: '2026-11-11T12:00:00Z',
        categoryId: L.salary.id,
      })
      .expect(409);
    expect(res.body).toMatchObject({ code: 'ACCOUNT_ARCHIVED' });
  });

  it('keeps other users out of an account', async () => {
    const other = client(app, (await registerUser(app)).token);
    await other.get(`/api/accounts/${L.accounts.chk}`).expect(404);
    await other.patch(`/api/accounts/${L.accounts.chk}`, { name: 'Mine now' }).expect(404);
    await other.post(`/api/accounts/${L.accounts.chk}/archive`).expect(404);
    expect((await other.get('/api/accounts').expect(200)).body).toEqual([]);
    const res = await other
      .post('/api/transactions', {
        type: 'EXPENSE',
        accountId: L.accounts.chk,
        amount: '5',
        occurredAt: '2026-11-11T12:00:00Z',
        categoryId: L.food.id,
      })
      .expect(404);
    expect(res.body).toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    await other.get('/api/accounts/not-a-uuid').expect(404);
  });
});

describe('Seeded demo balances (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedDemo(prisma, '2026-11-22', () => undefined);
  }, 300_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns Alex's balances exactly as the prototype shows them", async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEED_USER.email, password: SEED_USER.password })
      .expect(200);
    const res = await client(app, sessionToken(login)).get('/api/accounts').expect(200);
    const byName = new Map((res.body as AccountBody[]).map((a) => [a.name, a]));
    for (const a of ACCOUNTS) {
      expect(byName.get(a.name)?.balanceMinor, a.name).toBe(a.baseMinor.toString());
    }
    // €2,150 ≈ $2,322.00 and ₹1,85,000 ≈ $2,220.00 (prototype figures).
    expect(byName.get('Euro Account')?.balanceInBaseMinor).toBe('232200');
    expect(byName.get('India Savings')?.balanceInBaseMinor).toBe('222000');
  });
});
