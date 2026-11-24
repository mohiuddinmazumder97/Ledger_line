import type { Prisma } from '../generated/prisma/client.js';
import type { TransactionDto } from './dto/transaction.dto.js';

/** Everything a transaction row needs for display, in one query. */
export const TX_INCLUDE = {
  account: { select: { id: true, name: true, currency: true } },
  toAccount: { select: { id: true, name: true, currency: true } },
  category: { select: { id: true, name: true } },
  subcategory: { select: { id: true, name: true } },
  goal: { select: { id: true, name: true } },
  recurringRule: { select: { frequency: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.TransactionInclude;

export type TransactionRow = Prisma.TransactionGetPayload<{ include: typeof TX_INCLUDE }>;

export function toTransactionDto(t: TransactionRow): TransactionDto {
  return {
    id: t.id,
    type: t.type,
    account: t.account,
    amountMinor: t.amountMinor,
    currency: t.currency,
    toAccount: t.toAccount,
    toAmountMinor: t.toAmountMinor,
    fxRate: t.fxRate ? t.fxRate.toFixed(8) : null,
    occurredAt: t.occurredAt,
    note: t.note,
    description: t.description,
    category: t.category,
    subcategory: t.subcategory,
    budgetMode: t.budgetMode,
    budgetId: t.budgetId,
    goal: t.goal,
    tags: t.tags.map((x) => x.tag.name).sort((a, b) => a.localeCompare(b)),
    recurringRuleId: t.recurringRuleId,
    recurringFrequency: t.recurringRule?.frequency ?? null,
    splitGroupId: t.splitGroupId,
    hasReceipt: t.receiptKey !== null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
