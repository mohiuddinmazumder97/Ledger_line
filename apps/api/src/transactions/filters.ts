import { HttpStatus } from '@nestjs/common';
import { dateRange, monthRange } from '../common/dates.js';
import { apiError } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { TransactionFiltersDto } from './dto/transaction.dto.js';

/** True when no filter is set (CSV export names the file all-transactions.csv). */
export function hasFilters(f: TransactionFiltersDto): boolean {
  return Boolean(
    f.from || f.to || f.month || f.type || f.categoryId || f.subcategoryId || f.accountId || f.q,
  );
}

/** Prisma where for the list / summary / export filters. Always user-scoped, never deleted rows. */
export function buildWhere(
  userId: string,
  f: TransactionFiltersDto,
  tz: string,
): Prisma.TransactionWhereInput {
  if (f.month && (f.from || f.to)) {
    throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', ['Use either month or from/to, not both']);
  }
  const range = f.month ? monthRange(f.month, tz) : dateRange(f.from, f.to, tz);
  if (range.start && range.end && range.start >= range.end) {
    throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', ['from must not be after to']);
  }

  const and: Prisma.TransactionWhereInput[] = [];
  if (f.accountId) and.push({ OR: [{ accountId: f.accountId }, { toAccountId: f.accountId }] });
  if (f.q) {
    const contains = { contains: f.q, mode: 'insensitive' as const };
    and.push({
      OR: [
        { note: contains },
        { description: contains },
        { category: { name: contains } },
        { subcategory: { name: contains } },
        { tags: { some: { tag: { name: contains } } } },
      ],
    });
  }

  return {
    userId,
    deletedAt: null,
    ...(range.start || range.end
      ? {
          occurredAt: {
            ...(range.start ? { gte: range.start } : {}),
            ...(range.end ? { lt: range.end } : {}),
          },
        }
      : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.subcategoryId ? { subcategoryId: f.subcategoryId } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

// ─── Cursor: opaque base64url of [occurredAt ISO, id] ────────────────────────

export interface Cursor {
  occurredAt: Date;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.occurredAt.toISOString(), c.id])).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  const invalid = () => apiError(HttpStatus.BAD_REQUEST, 'INVALID_CURSOR', 'The cursor is not valid');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) throw invalid();
  const [at, id] = parsed as [unknown, unknown];
  const occurredAt = typeof at === 'string' ? new Date(at) : new Date(NaN);
  if (Number.isNaN(occurredAt.getTime()) || typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw invalid();
  }
  return { occurredAt, id };
}

/** Rows strictly after the cursor in `occurredAt desc, id desc` order. */
export function afterCursor(c: Cursor): Prisma.TransactionWhereInput {
  return { OR: [{ occurredAt: { lt: c.occurredAt } }, { occurredAt: c.occurredAt, id: { lt: c.id } }] };
}

export const TX_ORDER: Prisma.TransactionOrderByWithRelationInput[] = [
  { occurredAt: 'desc' },
  { id: 'desc' },
];
