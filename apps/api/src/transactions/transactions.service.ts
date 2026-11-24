import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { localDateTime } from '../common/dates.js';
import { apiError } from '../common/errors.js';
import { fromMinor, toMinor } from '../common/money.js';
import { FxService } from '../fx/fx.service.js';
import type { RateTable } from '../fx/rate-table.js';
import type { Prisma, Transaction, User } from '../generated/prisma/client.js';
import type { BudgetMode, TransactionType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { firstNextRun } from '../recurring/schedule.js';
import { CSV_HEADER, csvRow } from './csv.js';
import type {
  CreateTransactionDto,
  ListTransactionsQueryDto,
  TransactionDto,
  TransactionFiltersDto,
  TransactionPageDto,
  TransactionSummaryDto,
  UpdateTransactionDto,
} from './dto/transaction.dto.js';
import { afterCursor, buildWhere, decodeCursor, encodeCursor, TX_ORDER } from './filters.js';
import { toTransactionDto, TX_INCLUDE } from './transaction-mapper.js';

const err = (status: HttpStatus, code: string, message: string) => apiError(status, code, message);
const BAD = HttpStatus.BAD_REQUEST;
const NOT_FOUND = HttpStatus.NOT_FOUND;
const CONFLICT = HttpStatus.CONFLICT;

/** Interactive transactions on a hosted DB need more than Prisma's 5 s default. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

/** A record before validation: everything the drawer can send for one row. */
interface Draft {
  type: TransactionType;
  accountId: string;
  amount: string;
  occurredAt: Date;
  note: string;
  description: string;
  categoryId: string | null;
  subcategoryId: string | null;
  /** 'auto' | null (no budget) | budget id */
  budget: string | null;
  goalId: string | null;
  toAccountId: string | null;
}

/** A validated row, ready to write (no userId / ids / tags yet). */
interface ResolvedRow {
  type: TransactionType;
  accountId: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: Date;
  note: string;
  description: string;
  categoryId: string | null;
  subcategoryId: string | null;
  budgetMode: BudgetMode;
  budgetId: string | null;
  goalId: string | null;
  toAccountId: string | null;
  toAmountMinor: bigint | null;
  fxRate: string | null;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(user: User, dto: CreateTransactionDto): Promise<TransactionDto[]> {
    const isTransfer = dto.type === 'TRANSFER';
    if (isTransfer && (dto.categoryId || dto.subcategoryId)) {
      throw err(BAD, 'CATEGORY_NOT_ALLOWED', 'Transfers have no category');
    }
    if (!isTransfer && dto.toAccountId) {
      throw err(BAD, 'TO_ACCOUNT_NOT_ALLOWED', 'Only transfers have a destination account');
    }
    if (dto.splits) {
      if (dto.type !== 'EXPENSE') throw err(BAD, 'SPLIT_ONLY_FOR_EXPENSE', 'Only expenses can be split');
      if (dto.recurring) {
        throw err(BAD, 'SPLIT_NOT_RECURRING', 'A split expense cannot repeat; save the parts separately');
      }
      if (dto.categoryId || dto.subcategoryId) {
        throw err(BAD, 'SPLIT_REPLACES_CATEGORY', 'With splits, set categories on the splits only');
      }
    }

    const rates = await this.fx.table();
    const base: Omit<Draft, 'amount' | 'categoryId' | 'subcategoryId'> = {
      type: dto.type,
      accountId: dto.accountId,
      occurredAt: new Date(dto.occurredAt),
      note: dto.note ?? '',
      description: dto.description ?? '',
      budget: dto.budgetId === undefined ? 'auto' : dto.budgetId,
      goalId: dto.goalId ?? null,
      toAccountId: dto.toAccountId ?? null,
    };

    let rows: ResolvedRow[];
    let splitGroupId: string | null = null;
    if (dto.splits) {
      rows = await Promise.all(
        dto.splits.map((split) =>
          this.resolve(user, rates, {
            ...base,
            amount: split.amount,
            categoryId: split.categoryId,
            subcategoryId: split.subcategoryId ?? null,
          }),
        ),
      );
      if (dto.amount !== undefined) {
        const total = this.parseAmount(dto.amount, rows[0]!.currency);
        const sum = rows.reduce((s, r) => s + r.amountMinor, 0n);
        if (total !== sum) {
          throw err(BAD, 'SPLIT_AMOUNT_MISMATCH', 'The amount must equal the sum of the splits');
        }
      }
      splitGroupId = randomUUID();
    } else {
      rows = [
        await this.resolve(user, rates, {
          ...base,
          amount: dto.amount!,
          categoryId: dto.categoryId ?? null,
          subcategoryId: dto.subcategoryId ?? null,
        }),
      ];
    }

    const tagNames = normalizeTags(dto.tags ?? []);
    const ids = await this.prisma.$transaction(async (tx) => {
      const tagIds = await upsertTags(tx, user.id, tagNames);
      let recurringRuleId: string | null = null;
      if (dto.recurring) {
        const r = rows[0]!;
        const rule = await tx.recurringRule.create({
          data: {
            userId: user.id,
            type: r.type,
            accountId: r.accountId,
            amountMinor: r.amountMinor,
            currency: r.currency,
            note: r.note,
            description: r.description,
            categoryId: r.categoryId,
            subcategoryId: r.subcategoryId,
            budgetMode: r.budgetMode,
            budgetId: r.budgetId,
            goalId: r.goalId,
            toAccountId: r.toAccountId,
            tagNames,
            frequency: dto.recurring.frequency,
            anchorAt: r.occurredAt,
            nextRunAt: firstNextRun(r.occurredAt, dto.recurring.frequency, user.timezone),
          },
        });
        recurringRuleId = rule.id;
      }
      const created: string[] = [];
      for (const row of rows) {
        const t = await tx.transaction.create({
          data: {
            ...row,
            userId: user.id,
            splitGroupId,
            recurringRuleId,
            tags: { create: tagIds.map((tagId) => ({ tagId })) },
          },
          select: { id: true },
        });
        created.push(t.id);
      }
      return created;
    }, TX_OPTIONS);

    const created = await this.prisma.transaction.findMany({
      where: { id: { in: ids } },
      include: TX_INCLUDE,
    });
    // Return in the order the splits were given.
    return ids.map((id) => toTransactionDto(created.find((c) => c.id === id)!));
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async list(user: User, query: ListTransactionsQueryDto): Promise<TransactionPageDto> {
    const limit = query.limit ?? 50;
    const where = buildWhere(user.id, query, user.timezone);
    const page = await this.prisma.transaction.findMany({
      where: query.cursor ? { AND: [where, afterCursor(decodeCursor(query.cursor))] } : where,
      include: TX_INCLUDE,
      orderBy: TX_ORDER,
      take: limit + 1,
    });
    const items = page.slice(0, limit);
    const last = items.at(-1);
    return {
      items: items.map(toTransactionDto),
      nextCursor: page.length > limit && last ? encodeCursor(last) : null,
    };
  }

  /** Income / expense totals in the base currency, each row at the rate on its own date. */
  async summary(user: User, filters: TransactionFiltersDto): Promise<TransactionSummaryDto> {
    const [rows, rates] = await Promise.all([
      this.prisma.transaction.findMany({
        where: buildWhere(user.id, filters, user.timezone),
        select: { type: true, amountMinor: true, currency: true, occurredAt: true },
      }),
      this.fx.table(),
    ]);
    let income = 0n;
    let expense = 0n;
    for (const r of rows) {
      if (r.type === 'TRANSFER') continue;
      const inBase = rates.convert(r.amountMinor, r.currency, user.baseCurrency, r.occurredAt);
      if (r.type === 'INCOME') income += inBase;
      else expense += inBase;
    }
    return {
      incomeMinor: income,
      expenseMinor: expense,
      netMinor: income - expense,
      currency: user.baseCurrency,
      count: rows.length,
    };
  }

  async get(user: User, id: string): Promise<TransactionDto> {
    const t = await this.prisma.transaction.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      include: TX_INCLUDE,
    });
    if (!t) throw err(NOT_FOUND, 'TRANSACTION_NOT_FOUND', 'transaction not found');
    return toTransactionDto(t);
  }

  // ─── Update / delete ───────────────────────────────────────────────────────

  /**
   * Merges the patch into the row and re-validates the whole record.
   * Split rows change individually (type fixed); recurring rows never touch their rule;
   * a transfer edits as one record (toAmountMinor / fxRate recomputed).
   */
  async update(user: User, id: string, dto: UpdateTransactionDto): Promise<TransactionDto> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });
    if (!existing) throw err(NOT_FOUND, 'TRANSACTION_NOT_FOUND', 'transaction not found');

    const type = dto.type ?? existing.type;
    const typeChanged = type !== existing.type;
    if (existing.splitGroupId && typeChanged) {
      throw err(BAD, 'SPLIT_TYPE_IMMUTABLE', 'A split row stays an expense; delete it instead');
    }
    if (type === 'TRANSFER' && (dto.categoryId || dto.subcategoryId)) {
      throw err(BAD, 'CATEGORY_NOT_ALLOWED', 'Transfers have no category');
    }
    if (type !== 'TRANSFER' && dto.toAccountId) {
      throw err(BAD, 'TO_ACCOUNT_NOT_ALLOWED', 'Only transfers have a destination account');
    }

    const categoryChanged = dto.categoryId !== undefined && dto.categoryId !== existing.categoryId;
    const draft: Draft = {
      type,
      accountId: dto.accountId ?? existing.accountId,
      amount: dto.amount ?? fromMinor(existing.amountMinor, existing.currency),
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : existing.occurredAt,
      note: dto.note ?? existing.note,
      description: dto.description ?? existing.description,
      categoryId: type === 'TRANSFER' ? null : (dto.categoryId ?? (typeChanged ? null : existing.categoryId)),
      subcategoryId:
        type === 'TRANSFER'
          ? null
          : (dto.subcategoryId ?? (categoryChanged || typeChanged ? null : existing.subcategoryId)),
      budget: dto.budgetId !== undefined ? dto.budgetId : type === 'EXPENSE' ? budgetRef(existing) : 'auto',
      goalId: dto.goalId !== undefined ? dto.goalId : existing.goalId,
      toAccountId: type === 'TRANSFER' ? (dto.toAccountId ?? existing.toAccountId) : null,
    };

    const row = await this.resolve(user, await this.fx.table(), draft);
    const tagNames = dto.tags === undefined ? null : normalizeTags(dto.tags);
    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({ where: { id }, data: row });
      if (tagNames) {
        const tagIds = await upsertTags(tx, user.id, tagNames);
        await tx.transactionTag.deleteMany({ where: { transactionId: id } });
        await tx.transactionTag.createMany({ data: tagIds.map((tagId) => ({ transactionId: id, tagId })) });
      }
    }, TX_OPTIONS);
    return this.get(user, id);
  }

  /** Soft delete. `group` deletes every row of the split group. Returns the number of rows deleted. */
  async remove(user: User, id: string, group: boolean): Promise<number> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });
    if (!existing) throw err(NOT_FOUND, 'TRANSACTION_NOT_FOUND', 'transaction not found');
    const where: Prisma.TransactionWhereInput =
      group && existing.splitGroupId
        ? { userId: user.id, splitGroupId: existing.splitGroupId, deletedAt: null }
        : { id, userId: user.id };
    const { count } = await this.prisma.transaction.updateMany({ where, data: { deletedAt: new Date() } });
    return count;
  }

  // ─── CSV ───────────────────────────────────────────────────────────────────

  /** Header + one line per row (SPEC §5), streamed in pages. Dates / times in the user timezone. */
  async *exportCsv(user: User, filters: TransactionFiltersDto): AsyncGenerator<string> {
    // Built before the first yield so bad filters fail as JSON, not mid-download.
    const where = buildWhere(user.id, filters, user.timezone);
    yield csvRow(CSV_HEADER.map((value) => ({ value, text: false })));
    let cursor: { occurredAt: Date; id: string } | null = null;
    for (;;) {
      const page: Awaited<ReturnType<typeof this.csvPage>> = await this.csvPage(where, cursor);
      for (const t of page) {
        const { date, time } = localDateTime(t.occurredAt, user.timezone);
        yield csvRow([
          { value: date, text: false },
          { value: time, text: false },
          { value: t.type.toLowerCase(), text: false },
          { value: fromMinor(t.amountMinor, t.currency), text: false },
          { value: t.currency, text: false },
          { value: t.account.name },
          { value: t.toAccount?.name ?? '' },
          { value: t.category?.name ?? '' },
          { value: t.subcategory?.name ?? '' },
          { value: t.note },
          {
            value: t.tags
              .map((x) => x.tag.name)
              .sort((a, b) => a.localeCompare(b))
              .join(' '),
          },
        ]);
      }
      if (page.length < CSV_PAGE) return;
      cursor = page.at(-1)!;
    }
  }

  private csvPage(where: Prisma.TransactionWhereInput, cursor: { occurredAt: Date; id: string } | null) {
    return this.prisma.transaction.findMany({
      where: cursor ? { AND: [where, afterCursor(cursor)] } : where,
      include: {
        account: { select: { name: true } },
        toAccount: { select: { name: true } },
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
      orderBy: TX_ORDER,
      take: CSV_PAGE,
    });
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  private parseAmount(amount: string, currency: string): bigint {
    let minor: bigint;
    try {
      minor = toMinor(amount, currency);
    } catch (error) {
      throw err(BAD, 'INVALID_AMOUNT', (error as Error).message);
    }
    if (minor <= 0n) throw err(BAD, 'INVALID_AMOUNT', 'Enter an amount greater than zero.');
    return minor;
  }

  /**
   * Every rule from SPEC §3 / phase 3: ownership, types, archive state, FX.
   * All lookups run in parallel (one round trip): this is on the hot path of every save.
   */
  private async resolve(user: User, rates: RateTable, d: Draft): Promise<ResolvedRow> {
    const userId = user.id;
    const isTransfer = d.type === 'TRANSFER';
    if (isTransfer) {
      if (!d.toAccountId) throw err(BAD, 'TO_ACCOUNT_REQUIRED', 'Choose the account receiving the transfer');
      if (d.toAccountId === d.accountId) throw err(BAD, 'SAME_ACCOUNT', 'Choose two different accounts.');
    } else if (!d.categoryId) {
      throw err(BAD, 'CATEGORY_REQUIRED', 'Choose a category');
    }
    const explicitBudget = d.budget !== null && d.budget !== 'auto' ? d.budget : null;
    if (explicitBudget && d.type !== 'EXPENSE') {
      throw err(BAD, 'BUDGET_ONLY_FOR_EXPENSE', 'Only expenses count toward a budget');
    }

    const none = Promise.resolve(null);
    const [account, toAccount, category, sub, budget, goal] = await Promise.all([
      this.prisma.account.findFirst({ where: { id: d.accountId, userId } }),
      isTransfer ? this.prisma.account.findFirst({ where: { id: d.toAccountId!, userId } }) : none,
      !isTransfer
        ? this.prisma.category.findFirst({
            where: { id: d.categoryId!, userId },
            // The first sub-category is the default when none is given.
            include: { subcategories: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], take: 1 } },
          })
        : none,
      !isTransfer && d.subcategoryId
        ? this.prisma.subcategory.findFirst({ where: { id: d.subcategoryId, userId } })
        : none,
      explicitBudget ? this.prisma.budget.findFirst({ where: { id: explicitBudget, userId } }) : none,
      d.goalId ? this.prisma.goal.findFirst({ where: { id: d.goalId, userId } }) : none,
    ]);

    const usable = (a: typeof account) => {
      if (!a) throw err(NOT_FOUND, 'ACCOUNT_NOT_FOUND', 'account not found');
      if (a.archivedAt) throw err(CONFLICT, 'ACCOUNT_ARCHIVED', `${a.name} is archived`);
      return a;
    };
    const from = usable(account);
    const amountMinor = this.parseAmount(d.amount, from.currency);

    let toAccountId: string | null = null;
    let toAmountMinor: bigint | null = null;
    let fxRate: string | null = null;
    let categoryId: string | null = null;
    let subcategoryId: string | null = null;

    if (isTransfer) {
      const to = usable(toAccount);
      toAccountId = to.id;
      if (to.currency === from.currency) {
        toAmountMinor = amountMinor;
      } else {
        // Stored rate (8 digits) is the one used, so toAmountMinor is reproducible from the row.
        fxRate = rates.rateString(from.currency, to.currency, d.occurredAt);
        toAmountMinor = rates.convert(amountMinor, from.currency, to.currency, d.occurredAt);
        if (toAmountMinor <= 0n) throw err(BAD, 'INVALID_AMOUNT', 'The amount is too small to convert');
      }
    } else {
      if (!category) throw err(NOT_FOUND, 'CATEGORY_NOT_FOUND', 'category not found');
      if (category.archivedAt) throw err(CONFLICT, 'CATEGORY_ARCHIVED', `${category.name} is archived`);
      if (category.type !== d.type) {
        throw err(
          BAD,
          'CATEGORY_TYPE_MISMATCH',
          `${category.name} is not an ${d.type.toLowerCase()} category`,
        );
      }
      categoryId = category.id;
      if (d.subcategoryId) {
        if (!sub) throw err(NOT_FOUND, 'SUBCATEGORY_NOT_FOUND', 'subcategory not found');
        if (sub.categoryId !== category.id) {
          throw err(BAD, 'SUBCATEGORY_MISMATCH', `That sub-category is not in ${category.name}`);
        }
        subcategoryId = sub.id;
      } else {
        const first = category.subcategories[0];
        if (!first) throw err(BAD, 'SUBCATEGORY_REQUIRED', `${category.name} has no sub-categories`);
        subcategoryId = first.id;
      }
    }

    let budgetMode: BudgetMode = d.budget === null ? 'NONE' : 'AUTO';
    let budgetId: string | null = null;
    if (explicitBudget) {
      if (!budget) throw err(NOT_FOUND, 'BUDGET_NOT_FOUND', 'budget not found');
      budgetMode = 'EXPLICIT';
      budgetId = budget.id;
    }

    let goalId: string | null = null;
    if (d.goalId) {
      if (!goal) throw err(NOT_FOUND, 'GOAL_NOT_FOUND', 'goal not found');
      if (goal.archivedAt) throw err(CONFLICT, 'GOAL_ARCHIVED', `${goal.name} is archived`);
      goalId = goal.id;
    }

    return {
      type: d.type,
      accountId: from.id,
      amountMinor,
      currency: from.currency,
      occurredAt: d.occurredAt,
      note: d.note,
      description: d.description,
      categoryId,
      subcategoryId,
      budgetMode,
      budgetId,
      goalId,
      toAccountId,
      toAmountMinor,
      fxRate,
    };
  }
}

const CSV_PAGE = 500;

function budgetRef(t: Transaction): string | null {
  if (t.budgetMode === 'NONE') return null;
  if (t.budgetMode === 'EXPLICIT') return t.budgetId;
  return 'auto';
}

/** Trim, drop a leading '#', drop empties, de-duplicate case-insensitively (first spelling wins). */
export function normalizeTags(input: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const name = raw.trim().replace(/^#+/, '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/** Tag ids for `names`, reusing existing tags case-insensitively and creating the rest. */
async function upsertTags(tx: Prisma.TransactionClient, userId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const existing = await tx.tag.findMany({
    where: { userId, OR: names.map((name) => ({ name: { equals: name, mode: 'insensitive' as const } })) },
  });
  const byLower = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  for (const name of names) {
    let id = byLower.get(name.toLowerCase());
    if (!id) {
      id = (await tx.tag.create({ data: { userId, name } })).id;
      byLower.set(name.toLowerCase(), id);
    }
    ids.push(id);
  }
  return ids;
}
