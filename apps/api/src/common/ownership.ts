import { HttpStatus } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client.js';
import { apiError } from './errors.js';

/** Models that carry a userId and can be referenced by id from a request. */
export type OwnedModel =
  | 'account'
  | 'category'
  | 'subcategory'
  | 'transaction'
  | 'tag'
  | 'recurringRule'
  | 'budget'
  | 'goal'
  | 'debt';

/** A PrismaClient or the client inside `$transaction(async (tx) => …)`. */
export type PrismaLike = Pick<PrismaClient, OwnedModel>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "recurringRule" → "RECURRING_RULE_NOT_FOUND". */
export function notFoundCode(model: OwnedModel): string {
  return `${model.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_NOT_FOUND`;
}

type FindOwned = (args: {
  where: { id: string; userId: string; deletedAt?: null };
  select: { id: true };
}) => Promise<{ id: string } | null>;

/**
 * Throws 404 `<MODEL>_NOT_FOUND` unless `id` exists and belongs to `userId`.
 * Another user's row is indistinguishable from a missing one. Soft-deleted transactions count
 * as missing. Malformed ids are a 404 too, never a database error.
 */
export async function assertOwned(
  prisma: PrismaLike,
  model: OwnedModel,
  id: string,
  userId: string,
): Promise<void> {
  const notFound = () => apiError(HttpStatus.NOT_FOUND, notFoundCode(model), `${model} not found`);
  if (!UUID_RE.test(id)) throw notFound();
  const findFirst = (prisma[model] as unknown as { findFirst: FindOwned }).findFirst.bind(prisma[model]);
  const where = model === 'transaction' ? { id, userId, deletedAt: null } : { id, userId };
  const row = await findFirst({ where, select: { id: true } });
  if (!row) throw notFound();
}
