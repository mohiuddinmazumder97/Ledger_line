import { HttpException } from '@nestjs/common';
import { assertOwned, notFoundCode } from '../src/common/ownership.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { truncateAll } from './utils/db.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('assertOwned (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;

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

  async function rejection(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
    try {
      await promise;
    } catch (error) {
      if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() };
      throw error;
    }
    throw new Error('Expected a rejection');
  }

  async function userWithAccount(email: string) {
    const user = await prisma.user.create({ data: { name: email, email, passwordHash: 'x' } });
    const account = await prisma.account.create({
      data: { userId: user.id, name: 'Cash', kind: 'CASH', currency: 'USD' },
    });
    return { userId: user.id, accountId: account.id };
  }

  it('passes for the owner', async () => {
    const a = await userWithAccount('a@example.com');
    await expect(assertOwned(prisma, 'account', a.accountId, a.userId)).resolves.toBeUndefined();
  });

  it("treats another user's row as not found", async () => {
    const a = await userWithAccount('a@example.com');
    const b = await userWithAccount('b@example.com');
    expect(await rejection(assertOwned(prisma, 'account', a.accountId, b.userId))).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'ACCOUNT_NOT_FOUND', message: 'account not found' },
    });
  });

  it('404s on unknown and malformed ids without a database error', async () => {
    const a = await userWithAccount('a@example.com');
    expect(
      (await rejection(assertOwned(prisma, 'goal', '0193a000-0000-7000-8000-000000000000', a.userId))).status,
    ).toBe(404);
    expect((await rejection(assertOwned(prisma, 'goal', "'; DROP TABLE goals; --", a.userId))).status).toBe(
      404,
    );
  });

  it('works inside an interactive transaction', async () => {
    const a = await userWithAccount('a@example.com');
    await prisma.$transaction(async (tx) => {
      await assertOwned(tx, 'account', a.accountId, a.userId);
    });
  });

  it('derives stable codes', () => {
    expect(notFoundCode('recurringRule')).toBe('RECURRING_RULE_NOT_FOUND');
    expect(notFoundCode('subcategory')).toBe('SUBCATEGORY_NOT_FOUND');
  });
});
