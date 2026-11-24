/**
 * Demo seed: Alex Moreno + 365 days of prototype data ending at SEED_TODAY (default 2026-11-22).
 * Idempotent: removes Alex's previous data first. Run with `pnpm db:seed` (or `pnpm db:reset`).
 * Ends by checking that derived balances equal the prototype figures to the cent.
 */
import '../src/common/net-defaults.js';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { TZDate } from '@date-fns/tz';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { type Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  ACCOUNTS,
  type AccountKey,
  BUDGETS,
  CATEGORIES,
  type CategoryKey,
  DEBTS,
  DEFAULT_SEED_TODAY,
  EXCLUDE_FROM_INSIGHTS,
  genTx,
  GOALS,
  type GoalKey,
  goalInitialSaved,
  type LocalDateTime,
  openingBalances,
  RECURRING,
  type RecurringKey,
  SEED_USER,
  type SeedTx,
  USD_RATES,
} from './seed-data.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set (apps/api/.env)');
const seedToday = process.env.SEED_TODAY ?? DEFAULT_SEED_TODAY;
if (!/^\d{4}-\d{2}-\d{2}$/.test(seedToday))
  throw new Error(`SEED_TODAY must be YYYY-MM-DD, got "${seedToday}"`);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const tz = SEED_USER.timezone;

/** Wall-clock time in the seed user's timezone → UTC instant. */
function zoned(l: LocalDateTime): Date {
  return new Date(new TZDate(l.year, l.month - 1, l.day, l.hour, l.minute, tz).getTime());
}

/** Same wall-clock time one month later (seed anchors are days 1–15, so no month-end clamping). */
function plusOneMonth(l: LocalDateTime): Date {
  return new Date(new TZDate(l.year, l.month, l.day, l.hour, l.minute, tz).getTime());
}

/** 'YYYY-MM-DD' → Date at UTC midnight, for @db.Date columns. */
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function removeExistingDemoUser(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: SEED_USER.email }, select: { id: true } });
  if (!existing) return;
  const userId = existing.id;
  // Explicit order: ledger rows RESTRICT deletes of the accounts / categories they point at.
  await prisma.$transaction([
    prisma.transactionTag.deleteMany({ where: { transaction: { userId } } }),
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.recurringRule.deleteMany({ where: { userId } }),
    prisma.budget.deleteMany({ where: { userId } }),
    prisma.goal.deleteMany({ where: { userId } }),
    prisma.debt.deleteMany({ where: { userId } }),
    prisma.tag.deleteMany({ where: { userId } }),
    prisma.subcategory.deleteMany({ where: { userId } }),
    prisma.category.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}

async function main(): Promise<void> {
  const txs = genTx(seedToday);
  const opening = openingBalances(txs);
  const initialSaved = goalInitialSaved(txs);

  await removeExistingDemoUser();

  const user = await prisma.user.create({
    data: {
      name: SEED_USER.name,
      email: SEED_USER.email,
      passwordHash: await argon2.hash(SEED_USER.password, { type: argon2.argon2id }),
      baseCurrency: SEED_USER.baseCurrency,
      timezone: tz,
      theme: 'DARK',
      dashboardLayout: 'OVERVIEW',
      drawerStyle: 'KEYPAD',
      onboardedAt: zoned(txs[0]!.local),
    },
  });
  const userId = user.id;

  // Categories + sub-categories
  const categoryIds = {} as Record<CategoryKey, string>;
  const subcategoryIds = new Map<string, string>(); // "categoryKey/Sub" → id
  for (const [i, c] of CATEGORIES.entries()) {
    const category = await prisma.category.create({
      data: {
        userId,
        name: c.name,
        type: c.type,
        sortOrder: i,
        subcategories: {
          create: c.subs.map((name, j) => ({
            userId,
            name,
            sortOrder: j,
            excludeFromInsights: EXCLUDE_FROM_INSIGHTS.has(`${c.name}/${name}`),
          })),
        },
      },
      include: { subcategories: true },
    });
    categoryIds[c.key] = category.id;
    for (const s of category.subcategories) subcategoryIds.set(`${c.key}/${s.name}`, s.id);
  }
  const subId = (category: CategoryKey, name: string) => {
    const id = subcategoryIds.get(`${category}/${name}`);
    if (!id) throw new Error(`Unknown sub-category ${category}/${name}`);
    return id;
  };

  // Accounts with back-solved opening balances
  const accountIds = {} as Record<AccountKey, string>;
  for (const [i, a] of ACCOUNTS.entries()) {
    const account = await prisma.account.create({
      data: {
        userId,
        name: a.name,
        kind: a.kind,
        currency: a.currency,
        openingBalanceMinor: opening[a.key],
        showOnDashboard: a.showOnDashboard,
        sortOrder: i,
      },
    });
    accountIds[a.key] = account.id;
  }

  await prisma.budget.createMany({
    data: BUDGETS.map((b) => ({
      userId,
      categoryId: categoryIds[b.category],
      limitMinor: b.limitMinor,
      currency: SEED_USER.baseCurrency,
    })),
  });

  const goalIds = {} as Record<GoalKey, string>;
  for (const g of GOALS) {
    const goal = await prisma.goal.create({
      data: {
        userId,
        name: g.name,
        targetMinor: g.targetMinor,
        currency: SEED_USER.baseCurrency,
        initialSavedMinor: initialSaved[g.key],
        targetDate: dateOnly(g.targetDate),
      },
    });
    goalIds[g.key] = goal.id;
  }

  await prisma.debt.createMany({
    data: DEBTS.map((d) => ({
      userId,
      person: d.person,
      direction: d.direction,
      amountMinor: d.amountMinor,
      currency: SEED_USER.baseCurrency,
      note: d.note,
      dueDate: dateOnly(d.dueDate),
      settledAt: d.settled ? zoned({ ...parseIso(d.dueDate), hour: 18, minute: 0 }) : null,
    })),
  });

  // Recurring rules: occurrence #1 is the first generated row; nextRunAt = last + 1 month.
  const byRule = new Map<RecurringKey, SeedTx[]>();
  for (const t of txs) if (t.recurring) byRule.set(t.recurring, [...(byRule.get(t.recurring) ?? []), t]);
  const ruleIds = {} as Record<RecurringKey, string>;
  for (const key of Object.keys(RECURRING) as RecurringKey[]) {
    const rows = byRule.get(key);
    if (!rows?.length) continue;
    const first = rows[0]!;
    const last = rows.at(-1)!;
    const rule = await prisma.recurringRule.create({
      data: {
        userId,
        type: first.type,
        accountId: accountIds[first.account],
        amountMinor: first.amountMinor,
        currency: first.currency,
        note: first.note,
        categoryId: first.category ? categoryIds[first.category] : null,
        subcategoryId: first.category && first.subcategory ? subId(first.category, first.subcategory) : null,
        goalId: first.goal ? goalIds[first.goal] : null,
        toAccountId: first.toAccount ? accountIds[first.toAccount] : null,
        frequency: 'MONTHLY',
        anchorAt: zoned(first.local),
        nextRunAt: plusOneMonth(last.local),
      },
    });
    ruleIds[key] = rule.id;
  }

  // Tags
  const tagNames = [...new Set(txs.flatMap((t) => t.tags))];
  const tagIds = new Map<string, string>();
  for (const name of tagNames) {
    const tag = await prisma.tag.create({ data: { userId, name } });
    tagIds.set(name, tag.id);
  }

  // Transactions
  const rows: Prisma.TransactionCreateManyInput[] = [];
  const links: Prisma.TransactionTagCreateManyInput[] = [];
  for (const t of txs) {
    const id = randomUUID();
    rows.push({
      id,
      userId,
      type: t.type,
      accountId: accountIds[t.account],
      amountMinor: t.amountMinor,
      currency: t.currency,
      occurredAt: zoned(t.local),
      note: t.note,
      categoryId: t.category ? categoryIds[t.category] : null,
      subcategoryId: t.category && t.subcategory ? subId(t.category, t.subcategory) : null,
      goalId: t.goal ? goalIds[t.goal] : null,
      recurringRuleId: t.recurring ? ruleIds[t.recurring] : null,
      toAccountId: t.toAccount ? accountIds[t.toAccount] : null,
      toAmountMinor: t.toAmountMinor ?? null,
    });
    for (const name of t.tags) links.push({ transactionId: id, tagId: tagIds.get(name)! });
  }
  await prisma.transaction.createMany({ data: rows });
  await prisma.transactionTag.createMany({ data: links });

  // USD→X rates, dated on the first seed day so every seeded transaction has a rate.
  const rateDate = dateOnly(isoOf(txs[0]!.local));
  for (const r of USD_RATES) {
    await prisma.exchangeRate.upsert({
      where: { quote_date: { quote: r.quote, date: rateDate } },
      create: { quote: r.quote, rate: r.rate, date: rateDate },
      update: { rate: r.rate },
    });
  }

  await verifyBalances(userId);
  console.log(
    `Seeded ${SEED_USER.email} (password: ${SEED_USER.password}) — ${rows.length} transactions ending ${seedToday} (${tz}).`,
  );
}

/** Derived balance = opening + ledger, computed by the database. Must equal the prototype. */
async function verifyBalances(userId: string): Promise<void> {
  const balances = await prisma.$queryRaw<{ name: string; balance: bigint }[]>`
    SELECT a.name,
           a.opening_balance_minor
           + COALESCE((SELECT SUM(CASE t.type WHEN 'INCOME' THEN t.amount_minor ELSE -t.amount_minor END)
                         FROM transactions t
                        WHERE t.account_id = a.id AND t.deleted_at IS NULL), 0)
           + COALESCE((SELECT SUM(t.to_amount_minor)
                         FROM transactions t
                        WHERE t.to_account_id = a.id AND t.type = 'TRANSFER' AND t.deleted_at IS NULL), 0)
           AS balance
      FROM accounts a
     WHERE a.user_id = ${userId}::uuid`;
  const byName = new Map(balances.map((b) => [b.name, BigInt(b.balance)]));
  const wrong = ACCOUNTS.filter((a) => byName.get(a.name) !== a.baseMinor);
  if (wrong.length) {
    throw new Error(
      `Derived balances differ from the prototype: ${wrong.map((a) => `${a.name} ${byName.get(a.name)} ≠ ${a.baseMinor}`).join(', ')}`,
    );
  }
  console.log('Derived balances match the prototype to the cent.');
}

function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

function isoOf(l: LocalDateTime): string {
  return `${l.year}-${String(l.month).padStart(2, '0')}-${String(l.day).padStart(2, '0')}`;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
