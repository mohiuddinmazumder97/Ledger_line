import request from 'supertest';
import { templateCategoryCreates } from '../../src/categories/category-templates.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { registerUser } from './auth.js';
import type { TestApp } from './test-app.js';

/** Supertest bound to one user's session cookie. */
export function client(app: TestApp, token: string) {
  const http = () => request(app.getHttpServer());
  const cookie = `session=${token}`;
  return {
    get: (path: string) => http().get(path).set('Cookie', cookie),
    post: (path: string, body?: object) => http().post(path).set('Cookie', cookie).send(body),
    patch: (path: string, body: object) => http().patch(path).set('Cookie', cookie).send(body),
    delete: (path: string) => http().delete(path).set('Cookie', cookie),
  };
}

export type Client = ReturnType<typeof client>;

export async function seedRates(prisma: PrismaService): Promise<void> {
  const date = new Date('2025-01-01T00:00:00Z');
  await prisma.exchangeRate.createMany({
    data: [
      { quote: 'EUR', rate: '0.92592593', date },
      { quote: 'INR', rate: '83.33333333', date },
    ],
    skipDuplicates: true,
  });
}

/**
 * A signed-in user (timezone America/New_York, base USD) with:
 * accounts chk (USD, opening 1,000.00), sav (USD), eur (EUR), cc (USD credit);
 * categories Food & Drink, Housing, Shopping (expense), Salary (income); a Food budget; a goal.
 */
export async function setupLedger(app: TestApp, prisma: PrismaService) {
  const { token, userId, email } = await registerUser(app);
  await prisma.user.update({ where: { id: userId }, data: { timezone: 'America/New_York' } });
  await seedRates(prisma);

  const account = (name: string, kind: 'BANK' | 'SAVINGS' | 'CREDIT', currency: string, opening = 0n) =>
    prisma.account.create({ data: { userId, name, kind, currency, openingBalanceMinor: opening } });
  const [chk, sav, eur, cc] = await Promise.all([
    account('Everyday Checking', 'BANK', 'USD', 100000n),
    account('High-Yield Savings', 'SAVINGS', 'USD'),
    account('Euro Account', 'BANK', 'EUR'),
    account('Credit Card', 'CREDIT', 'USD'),
  ]);

  const cats: Record<string, { id: string; subs: Record<string, string> }> = {};
  for (const data of templateCategoryCreates(userId, ['food', 'housing', 'shopping', 'salary'])) {
    const c = await prisma.category.create({ data, include: { subcategories: true } });
    cats[c.name] = { id: c.id, subs: Object.fromEntries(c.subcategories.map((s) => [s.name, s.id])) };
  }
  const food = cats['Food & Drink']!;
  const housing = cats.Housing!;
  const shopping = cats.Shopping!;
  const salary = cats.Salary!;

  const budget = await prisma.budget.create({
    data: { userId, categoryId: food.id, limitMinor: 60000n, currency: 'USD' },
  });
  const goal = await prisma.goal.create({
    data: { userId, name: 'Japan trip', targetMinor: 400000n, currency: 'USD' },
  });

  return {
    token,
    userId,
    email,
    api: client(app, token),
    accounts: { chk: chk.id, sav: sav.id, eur: eur.id, cc: cc.id },
    food,
    housing,
    shopping,
    salary,
    budgetId: budget.id,
    goalId: goal.id,
  };
}

export type Ledger = Awaited<ReturnType<typeof setupLedger>>;

/** Shorthand for POST /api/transactions returning the created rows. */
export async function createTx(api: Client, body: object, status = 201) {
  const res = await api.post('/api/transactions', body).expect(status);
  return res.body as Array<
    Record<string, unknown> & {
      id: string;
      amountMinor: string;
      tags: string[];
      splitGroupId: string | null;
      recurringRuleId: string | null;
    }
  >;
}
