import { PrismaService } from '../src/prisma/prisma.service.js';
import { registerUser } from './utils/auth.js';
import { truncateAll } from './utils/db.js';
import { client, createTx, type Ledger, setupLedger } from './utils/ledger.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

type Tx = Record<string, unknown> & {
  id: string;
  amountMinor: string;
  tags: string[];
  splitGroupId: string | null;
  recurringRuleId: string | null;
};
type Page = { items: Tx[]; nextCursor: string | null };

describe('Transactions (e2e)', () => {
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

  const AT = '2026-11-20T12:30:00-05:00';
  const expense = (extra: object = {}) => ({
    type: 'EXPENSE',
    accountId: L.accounts.chk,
    amount: '42.10',
    occurredAt: AT,
    categoryId: L.food.id,
    ...extra,
  });
  const code = async (body: object, status: number) =>
    ((await L.api.post('/api/transactions', body).expect(status)).body as { code: string }).code;

  describe('create', () => {
    it('saves an expense with defaults and returns the full row', async () => {
      const [t] = await createTx(
        L.api,
        expense({ note: ' Green Basket ', tags: ['#Work', 'work', ' groceries '] }),
      );
      expect(t).toMatchObject({
        type: 'EXPENSE',
        amountMinor: '4210',
        currency: 'USD',
        account: { id: L.accounts.chk, name: 'Everyday Checking', currency: 'USD' },
        category: { id: L.food.id, name: 'Food & Drink' },
        subcategory: { id: L.food.subs.Groceries, name: 'Groceries' }, // first sub-category
        note: 'Green Basket',
        budgetMode: 'AUTO',
        budgetId: null,
        tags: ['groceries', 'Work'],
        toAccount: null,
        toAmountMinor: null,
        fxRate: null,
        splitGroupId: null,
        recurringFrequency: null,
        hasReceipt: false,
        occurredAt: '2026-11-20T17:30:00.000Z',
      });
      // Tags are reused case-insensitively.
      const [again] = await createTx(L.api, expense({ tags: ['WORK'] }));
      expect(again!.tags).toEqual(['Work']);
      expect(await prisma.tag.count({ where: { userId: L.userId } })).toBe(2);
    });

    it('stores the budget choice: auto, none or a specific budget', async () => {
      const [none] = await createTx(L.api, expense({ budgetId: null }));
      const [explicit] = await createTx(L.api, expense({ budgetId: L.budgetId, goalId: L.goalId }));
      expect(none).toMatchObject({ budgetMode: 'NONE', budgetId: null });
      expect(explicit).toMatchObject({
        budgetMode: 'EXPLICIT',
        budgetId: L.budgetId,
        goal: { name: 'Japan trip' },
      });
      expect(
        await code(expense({ type: 'INCOME', categoryId: L.salary.id, budgetId: L.budgetId }), 400),
      ).toBe('BUDGET_ONLY_FOR_EXPENSE');
      expect(await code(expense({ budgetId: 'monthly' }), 400)).toBe('VALIDATION_FAILED');
    });

    it.each([
      [{ amount: '0' }, 'INVALID_AMOUNT'],
      [{ amount: '12.345' }, 'INVALID_AMOUNT'],
      [{ amount: '-5' }, 'VALIDATION_FAILED'],
      [{ amount: 12 }, 'VALIDATION_FAILED'],
      [{ occurredAt: 'yesterday' }, 'VALIDATION_FAILED'],
      [{ categoryId: undefined }, 'CATEGORY_REQUIRED'],
    ])('rejects %j with %s', async (patch, expected) => {
      expect(await code(expense(patch), 400)).toBe(expected);
    });

    it('checks category type, sub-category and transfer rules', async () => {
      expect(await code(expense({ categoryId: L.salary.id }), 400)).toBe('CATEGORY_TYPE_MISMATCH');
      expect(await code(expense({ subcategoryId: L.housing.subs.Rent }), 400)).toBe('SUBCATEGORY_MISMATCH');
      expect(await code(expense({ toAccountId: L.accounts.sav }), 400)).toBe('TO_ACCOUNT_NOT_ALLOWED');
      const transfer = { type: 'TRANSFER', accountId: L.accounts.chk, amount: '10', occurredAt: AT };
      expect(await code(transfer, 400)).toBe('TO_ACCOUNT_REQUIRED');
      expect(await code({ ...transfer, toAccountId: L.accounts.chk }, 400)).toBe('SAME_ACCOUNT');
      expect(await code({ ...transfer, toAccountId: L.accounts.sav, categoryId: L.food.id }, 400)).toBe(
        'CATEGORY_NOT_ALLOWED',
      );
    });

    it('converts a transfer between currencies at the rate on its date', async () => {
      const [t] = await createTx(L.api, {
        type: 'TRANSFER',
        accountId: L.accounts.chk,
        toAccountId: L.accounts.eur,
        amount: '100',
        occurredAt: AT,
        goalId: L.goalId,
      });
      expect(t).toMatchObject({
        amountMinor: '10000',
        currency: 'USD',
        toAccount: { id: L.accounts.eur, currency: 'EUR' },
        toAmountMinor: '9259', // $100 × 0.92592593
        fxRate: '0.92592593',
        category: null,
        goal: { name: 'Japan trip' },
      });
    });
  });

  describe('splits', () => {
    const split = (extra: object = {}) => ({
      type: 'EXPENSE',
      accountId: L.accounts.cc,
      occurredAt: AT,
      note: 'Target run',
      tags: ['home'],
      splits: [
        { categoryId: L.food.id, amount: '18.40' },
        { categoryId: L.shopping.id, subcategoryId: L.shopping.subs.Home, amount: '31.60' },
      ],
      ...extra,
    });

    it('creates one row per split sharing a group id, no "split" tag', async () => {
      const rows = await createTx(L.api, split({ amount: '50.00' }));
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => [r.amountMinor, (r.subcategory as { name: string }).name])).toEqual([
        ['1840', 'Groceries'],
        ['3160', 'Home'],
      ]);
      expect(rows[0]!.splitGroupId).toBeTruthy();
      expect(rows[1]!.splitGroupId).toBe(rows[0]!.splitGroupId);
      expect(rows.every((r) => JSON.stringify(r.tags) === '["home"]')).toBe(true);
    });

    it('validates splits', async () => {
      expect(await code(split({ amount: '49.99' }), 400)).toBe('SPLIT_AMOUNT_MISMATCH');
      expect(await code(split({ recurring: { frequency: 'MONTHLY' } }), 400)).toBe('SPLIT_NOT_RECURRING');
      expect(await code(split({ type: 'INCOME' }), 400)).toBe('SPLIT_ONLY_FOR_EXPENSE');
      expect(await code(split({ categoryId: L.food.id }), 400)).toBe('SPLIT_REPLACES_CATEGORY');
      expect(await code(split({ splits: [] }), 400)).toBe('VALIDATION_FAILED');
    });

    it('edits a split row individually and deletes the whole group on request', async () => {
      const [a, b] = await createTx(L.api, split());
      const edited = await L.api
        .patch(`/api/transactions/${a!.id}`, { amount: '20.00', note: 'Groceries part' })
        .expect(200);
      expect(edited.body).toMatchObject({
        amountMinor: '2000',
        note: 'Groceries part',
        splitGroupId: a!.splitGroupId,
      });
      expect((await L.api.get(`/api/transactions/${b!.id}`).expect(200)).body).toMatchObject({
        amountMinor: '3160',
        note: 'Target run',
      });

      const res = await L.api
        .patch(`/api/transactions/${a!.id}`, { type: 'INCOME', categoryId: L.salary.id })
        .expect(400);
      expect(res.body).toMatchObject({ code: 'SPLIT_TYPE_IMMUTABLE' });

      await L.api.delete(`/api/transactions/${a!.id}?group=true`).expect(204);
      await L.api.get(`/api/transactions/${b!.id}`).expect(404);
      expect(
        await prisma.transaction.count({
          where: { splitGroupId: a!.splitGroupId!, deletedAt: { not: null } },
        }),
      ).toBe(2);
    });

    it('deletes a single split row by default', async () => {
      const [a, b] = await createTx(L.api, split());
      await L.api.delete(`/api/transactions/${a!.id}`).expect(204);
      await L.api.get(`/api/transactions/${b!.id}`).expect(200);
    });
  });

  describe('recurring', () => {
    it('creates the rule with month-end clamping in the user timezone and links occurrence #1', async () => {
      const [t] = await createTx(L.api, {
        type: 'EXPENSE',
        accountId: L.accounts.chk,
        amount: '1650',
        occurredAt: '2026-01-31T10:00:00-05:00',
        categoryId: L.housing.id,
        subcategoryId: L.housing.subs.Rent,
        note: 'Rent',
        tags: ['home'],
        recurring: { frequency: 'MONTHLY' },
      });
      expect(t).toMatchObject({ recurringFrequency: 'MONTHLY' });
      const rule = await prisma.recurringRule.findUniqueOrThrow({ where: { id: t!.recurringRuleId! } });
      expect(rule).toMatchObject({
        amountMinor: 165000n,
        note: 'Rent',
        tagNames: ['home'],
        frequency: 'MONTHLY',
        active: true,
        anchorAt: new Date('2026-01-31T15:00:00Z'),
        nextRunAt: new Date('2026-02-28T15:00:00Z'), // Feb 28, 10:00 New York
      });
    });

    it('editing a recurring row leaves the rule unchanged', async () => {
      const [t] = await createTx(L.api, expense({ recurring: { frequency: 'WEEKLY' } }));
      const before = await prisma.recurringRule.findUniqueOrThrow({ where: { id: t!.recurringRuleId! } });
      await L.api.patch(`/api/transactions/${t!.id}`, { amount: '99.00', note: 'One-off price' }).expect(200);
      const after = await prisma.recurringRule.findUniqueOrThrow({ where: { id: t!.recurringRuleId! } });
      expect(after).toEqual(before);
      expect((await L.api.get(`/api/transactions/${t!.id}`).expect(200)).body).toMatchObject({
        amountMinor: '9900',
        recurringRuleId: before.id,
      });
    });
  });

  describe('edit', () => {
    it('recomputes FX when a transfer changes amount and destination', async () => {
      const [t] = await createTx(L.api, {
        type: 'TRANSFER',
        accountId: L.accounts.chk,
        toAccountId: L.accounts.sav,
        amount: '50',
        occurredAt: AT,
      });
      expect(t).toMatchObject({ toAmountMinor: '5000', fxRate: null });
      const res = await L.api
        .patch(`/api/transactions/${t!.id}`, { amount: '200', toAccountId: L.accounts.eur })
        .expect(200);
      expect(res.body).toMatchObject({
        amountMinor: '20000',
        toAmountMinor: '18519',
        fxRate: '0.92592593',
        toAccount: { id: L.accounts.eur },
      });
      expect(await prisma.transaction.count({ where: { userId: L.userId } })).toBe(1);
    });

    it('switches type, clearing fields that no longer apply', async () => {
      const [t] = await createTx(L.api, expense({ budgetId: L.budgetId }));
      const income = await L.api
        .patch(`/api/transactions/${t!.id}`, { type: 'INCOME', categoryId: L.salary.id })
        .expect(200);
      expect(income.body).toMatchObject({
        type: 'INCOME',
        category: { name: 'Salary' },
        subcategory: { name: 'Monthly pay' },
        budgetMode: 'AUTO',
        budgetId: null,
      });

      const missing = await L.api.patch(`/api/transactions/${t!.id}`, { type: 'EXPENSE' }).expect(400);
      expect(missing.body).toMatchObject({ code: 'CATEGORY_REQUIRED' });

      const transfer = await L.api
        .patch(`/api/transactions/${t!.id}`, { type: 'TRANSFER', toAccountId: L.accounts.sav })
        .expect(200);
      expect(transfer.body).toMatchObject({
        type: 'TRANSFER',
        category: null,
        subcategory: null,
        toAmountMinor: '4210',
      });
    });

    it('replaces tags only when sent, and keeps the rest of the row', async () => {
      const [t] = await createTx(L.api, expense({ tags: ['a', 'b'], description: 'keep me' }));
      const noTags = await L.api.patch(`/api/transactions/${t!.id}`, { note: 'x' }).expect(200);
      expect(noTags.body).toMatchObject({ tags: ['a', 'b'], description: 'keep me' });
      const newTags = await L.api.patch(`/api/transactions/${t!.id}`, { tags: ['c'] }).expect(200);
      expect(newTags.body).toMatchObject({ tags: ['c'] });
    });
  });

  describe('list, filters and summary', () => {
    async function fixture() {
      const rows = {
        // Oct 31 23:30 New York = Nov 1 03:30 UTC: belongs to October in the user's timezone.
        lateOct: (
          await createTx(
            L.api,
            expense({ occurredAt: '2026-10-31T23:30:00-04:00', note: 'Halloween snacks', amount: '10' }),
          )
        )[0]!,
        coffee: (
          await createTx(
            L.api,
            expense({
              occurredAt: '2026-11-02T08:00:00-05:00',
              subcategoryId: L.food.subs.Coffee,
              note: 'Morning Brew',
              amount: '4.50',
            }),
          )
        )[0]!,
        rent: (
          await createTx(
            L.api,
            expense({
              occurredAt: '2026-11-03T10:00:00-05:00',
              categoryId: L.housing.id,
              subcategoryId: L.housing.subs.Rent,
              note: 'Rent',
              amount: '1650',
            }),
          )
        )[0]!,
        pay: (
          await createTx(L.api, {
            type: 'INCOME',
            accountId: L.accounts.chk,
            amount: '5200',
            occurredAt: '2026-11-01T09:00:00-05:00',
            categoryId: L.salary.id,
            note: 'Payroll',
            description: 'Northwind Studio',
          })
        )[0]!,
        eurDinner: (
          await createTx(
            L.api,
            expense({
              accountId: L.accounts.eur,
              occurredAt: '2026-11-05T20:00:00-05:00',
              subcategoryId: L.food.subs.Restaurants,
              note: 'Bistro',
              amount: '54.00',
              tags: ['travel'],
            }),
          )
        )[0]!,
        save: (
          await createTx(L.api, {
            type: 'TRANSFER',
            accountId: L.accounts.chk,
            toAccountId: L.accounts.sav,
            amount: '500',
            occurredAt: '2026-11-02T09:30:00-05:00',
            note: 'Monthly savings',
          })
        )[0]!,
      };
      return rows;
    }

    const ids = async (query: string) =>
      ((await L.api.get(`/api/transactions?${query}`).expect(200)).body as Page).items.map((t) => t.id);

    it('filters by month and dates in the user timezone, type, category, sub-category and account', async () => {
      const r = await fixture();
      const nov = await ids('month=2026-11');
      expect(nov).not.toContain(r.lateOct.id);
      expect(nov).toHaveLength(5);
      expect(await ids('month=2026-10')).toEqual([r.lateOct.id]);
      expect(await ids('from=2026-11-02&to=2026-11-03')).toEqual([r.rent.id, r.save.id, r.coffee.id]);
      expect(await ids('type=INCOME')).toEqual([r.pay.id]);
      expect(await ids(`categoryId=${L.housing.id}`)).toEqual([r.rent.id]);
      expect(await ids(`subcategoryId=${L.food.subs.Coffee}`)).toEqual([r.coffee.id]);
      // Source or destination.
      expect(await ids(`accountId=${L.accounts.sav}`)).toEqual([r.save.id]);
      expect(await ids(`accountId=${L.accounts.eur}`)).toEqual([r.eurDinner.id]);
    });

    it('searches note, description, category, sub-category and tag names, case-insensitively', async () => {
      const r = await fixture();
      expect(await ids('q=morning')).toEqual([r.coffee.id]);
      expect(await ids('q=northwind')).toEqual([r.pay.id]);
      expect(await ids('q=HOUSING')).toEqual([r.rent.id]);
      expect(await ids('q=restaurants')).toEqual([r.eurDinner.id]);
      expect(await ids('q=travel')).toEqual([r.eurDinner.id]);
      expect(await ids('q=nothing-matches')).toEqual([]);
    });

    it('paginates newest first with a stable cursor', async () => {
      await fixture();
      const all = await ids('limit=200');
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res = await L.api
          .get(`/api/transactions?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
          .expect(200);
        const page = res.body as Page;
        seen.push(...page.items.map((t) => t.id));
        cursor = page.nextCursor;
      } while (cursor);
      expect(seen).toEqual(all);
      expect(all).toHaveLength(6);
      const bad = await L.api.get('/api/transactions?cursor=garbage').expect(400);
      expect(bad.body).toMatchObject({ code: 'INVALID_CURSOR' });
      await L.api.get('/api/transactions?limit=500').expect(400);
      await L.api.get('/api/transactions?month=2026-11&from=2026-11-01').expect(400);
    });

    it('summarises income, expenses and net in the base currency', async () => {
      await fixture();
      const res = await L.api.get('/api/transactions/summary?month=2026-11').expect(200);
      // Expenses: 4.50 + 1650 + €54 (= $58.32) ; income 5200 ; transfer counted only in count.
      expect(res.body).toEqual({
        incomeMinor: '520000',
        expenseMinor: String(450 + 165000 + 5832),
        netMinor: String(520000 - (450 + 165000 + 5832)),
        currency: 'USD',
        count: 5,
      });
    });

    it('excludes soft-deleted rows everywhere', async () => {
      const r = await fixture();
      await L.api.delete(`/api/transactions/${r.rent.id}`).expect(204);
      expect(await ids('month=2026-11')).not.toContain(r.rent.id);
      await L.api.get(`/api/transactions/${r.rent.id}`).expect(404);
      await L.api.patch(`/api/transactions/${r.rent.id}`, { note: 'x' }).expect(404);
      await L.api.delete(`/api/transactions/${r.rent.id}`).expect(404);
    });
  });

  describe('CSV export', () => {
    it('streams SPEC §5 columns with escaping, local dates and the right filename', async () => {
      await createTx(
        L.api,
        expense({
          occurredAt: '2026-11-02T08:05:00-05:00',
          note: 'Say "cheese", please',
          tags: ['work', 'team lunch'],
        }),
      );
      await createTx(L.api, expense({ occurredAt: '2026-11-03T09:00:00-05:00', note: '=SUM(A1:A9)' }));
      await createTx(L.api, {
        type: 'TRANSFER',
        accountId: L.accounts.chk,
        toAccountId: L.accounts.eur,
        amount: '100',
        occurredAt: '2026-11-04T23:30:00-05:00',
      });

      const res = await L.api.get('/api/transactions/export.csv').expect(200);
      expect(res.headers['content-type']).toMatch(/^text\/csv/);
      expect(res.headers['content-disposition']).toBe('attachment; filename="all-transactions.csv"');
      const lines = res.text.trimEnd().split('\r\n');
      expect(lines[0]).toBe(
        '"Date","Time","Type","Amount","Currency","Account","To account","Category","Sub-category","Note","Tags"',
      );
      expect(lines).toHaveLength(4);
      // Newest first; 23:30 New York stays Nov 4 (UTC would say Nov 5).
      expect(lines[1]).toBe(
        '"2026-11-04","23:30","transfer","100.00","USD","Everyday Checking","Euro Account","","","",""',
      );
      expect(lines[2]).toBe(
        `"2026-11-03","09:00","expense","42.10","USD","Everyday Checking","","Food & Drink","Groceries","'=SUM(A1:A9)",""`,
      );
      expect(lines[3]).toBe(
        '"2026-11-02","08:05","expense","42.10","USD","Everyday Checking","","Food & Drink","Groceries","Say ""cheese"", please","team lunch work"',
      );

      const filtered = await L.api.get('/api/transactions/export.csv?type=TRANSFER').expect(200);
      expect(filtered.headers['content-disposition']).toBe('attachment; filename="transactions.csv"');
      expect(filtered.text.trimEnd().split('\r\n')).toHaveLength(2);

      const bad = await L.api.get('/api/transactions/export.csv?month=2026-13').expect(400);
      expect(bad.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('ownership', () => {
    it("user B can neither read nor reference user A's rows", async () => {
      const [t] = await createTx(L.api, expense());
      const { token, userId: bId } = await registerUser(app);
      const B = client(app, token);
      const bAccount = await prisma.account.create({
        data: { userId: bId, name: 'B', kind: 'BANK', currency: 'USD' },
      });

      await B.get(`/api/transactions/${t!.id}`).expect(404);
      await B.patch(`/api/transactions/${t!.id}`, { note: 'mine' }).expect(404);
      await B.delete(`/api/transactions/${t!.id}`).expect(404);
      expect(((await B.get('/api/transactions').expect(200)).body as Page).items).toEqual([]);
      expect(
        ((await B.get(`/api/transactions?accountId=${L.accounts.chk}`).expect(200)).body as Page).items,
      ).toEqual([]);

      // Referencing A's category / budget / goal / accounts from B's own account.
      const base = { type: 'EXPENSE', accountId: bAccount.id, amount: '1', occurredAt: AT };
      const post = async (body: object) =>
        ((await B.post('/api/transactions', body).expect(404)).body as { code: string }).code;
      expect(await post({ ...base, categoryId: L.food.id })).toBe('CATEGORY_NOT_FOUND');
      expect(await post({ ...base, type: 'TRANSFER', toAccountId: L.accounts.sav })).toBe(
        'ACCOUNT_NOT_FOUND',
      );
      // A's transaction is untouched.
      expect((await L.api.get(`/api/transactions/${t!.id}`).expect(200)).body).toMatchObject({ note: '' });
    });
  });
});
