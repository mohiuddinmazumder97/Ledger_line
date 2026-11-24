import { PrismaService } from '../src/prisma/prisma.service.js';
import { registerUser } from './utils/auth.js';
import { truncateAll } from './utils/db.js';
import { client, createTx, type Ledger, setupLedger } from './utils/ledger.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

type CategoryBody = {
  id: string;
  name: string;
  type: string;
  archivedAt: string | null;
  subcategories: { id: string; name: string; excludeFromInsights: boolean }[];
};

describe('Categories (e2e)', () => {
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

  it('lists categories with sub-categories, filtered by type', async () => {
    const all = (await L.api.get('/api/categories').expect(200)).body as CategoryBody[];
    expect(all.map((c) => c.name)).toEqual(['Food & Drink', 'Housing', 'Shopping', 'Salary']);
    expect(all[1]!.subcategories.map((s) => [s.name, s.excludeFromInsights])).toEqual([
      ['Rent', true],
      ['Utilities', false],
      ['Internet', false],
    ]);
    const income = (await L.api.get('/api/categories?type=INCOME').expect(200)).body as CategoryBody[];
    expect(income.map((c) => c.name)).toEqual(['Salary']);
  });

  it('creates a category with a "General" sub-category; names are unique per type, case-insensitive', async () => {
    const res = await L.api.post('/api/categories', { name: ' Pets ', type: 'EXPENSE' }).expect(201);
    expect(res.body).toMatchObject({ name: 'Pets', type: 'EXPENSE', subcategories: [{ name: 'General' }] });
    const taken = await L.api.post('/api/categories', { name: 'pets', type: 'EXPENSE' }).expect(409);
    expect(taken.body).toMatchObject({ code: 'CATEGORY_NAME_TAKEN' });
    await L.api.post('/api/categories', { name: 'Pets', type: 'INCOME' }).expect(201);
  });

  it('renames and archives; archived categories leave the list and refuse new records', async () => {
    await L.api.patch(`/api/categories/${L.shopping.id}`, { name: 'Stuff' }).expect(200);
    await L.api.patch(`/api/categories/${L.shopping.id}`, { name: 'housing' }).expect(409);
    await L.api.post(`/api/categories/${L.shopping.id}/archive`).expect(200);

    const list = (await L.api.get('/api/categories').expect(200)).body as CategoryBody[];
    expect(list.map((c) => c.name)).not.toContain('Stuff');
    const withArchived = (await L.api.get('/api/categories?includeArchived=true').expect(200))
      .body as CategoryBody[];
    expect(withArchived.find((c) => c.name === 'Stuff')?.archivedAt).not.toBeNull();

    const res = await L.api
      .post('/api/transactions', {
        type: 'EXPENSE',
        accountId: L.accounts.chk,
        amount: '5',
        occurredAt: '2026-11-11T12:00:00Z',
        categoryId: L.shopping.id,
      })
      .expect(409);
    expect(res.body).toMatchObject({ code: 'CATEGORY_ARCHIVED' });
  });

  it('manages sub-categories: unique names, excludeFromInsights, delete only when unused', async () => {
    const base = `/api/categories/${L.food.id}/subcategories`;
    const created = await L.api.post(base, { name: 'Bakery' }).expect(201);
    const bakeryId = (created.body as { id: string }).id;
    const dupe = await L.api.post(base, { name: '  bakery ' }).expect(409);
    expect(dupe.body).toMatchObject({ code: 'SUBCATEGORY_NAME_TAKEN' });

    const patched = await L.api
      .patch(`${base}/${bakeryId}`, { name: 'Bakeries', excludeFromInsights: true })
      .expect(200);
    expect(patched.body).toMatchObject({ name: 'Bakeries', excludeFromInsights: true });

    await createTx(L.api, {
      type: 'EXPENSE',
      accountId: L.accounts.chk,
      amount: '4',
      occurredAt: '2026-11-11T12:00:00Z',
      categoryId: L.food.id,
      subcategoryId: L.food.subs.Coffee,
    });
    const inUse = await L.api.delete(`${base}/${L.food.subs.Coffee}`).expect(409);
    expect(inUse.body).toMatchObject({ code: 'SUBCATEGORY_IN_USE' });

    await L.api.delete(`${base}/${bakeryId}`).expect(204);
    // A sub-category id must belong to the category in the path.
    await L.api.delete(`/api/categories/${L.housing.id}/subcategories/${L.food.subs.Groceries}`).expect(404);
  });

  it('never deletes the last sub-category', async () => {
    const res = await L.api.post('/api/categories', { name: 'Pets', type: 'EXPENSE' }).expect(201);
    const pets = res.body as CategoryBody;
    const last = await L.api
      .delete(`/api/categories/${pets.id}/subcategories/${pets.subcategories[0]!.id}`)
      .expect(409);
    expect(last.body).toMatchObject({ code: 'SUBCATEGORY_LAST' });
  });

  it('keeps other users out of a category', async () => {
    const other = client(app, (await registerUser(app)).token);
    await other.patch(`/api/categories/${L.food.id}`, { name: 'Mine' }).expect(404);
    await other.post(`/api/categories/${L.food.id}/archive`).expect(404);
    await other.post(`/api/categories/${L.food.id}/subcategories`, { name: 'X' }).expect(404);
    expect((await other.get('/api/categories').expect(200)).body).toEqual([]);
  });
});
