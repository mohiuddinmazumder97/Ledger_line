import { HttpStatus, Injectable } from '@nestjs/common';
import { apiError } from '../common/errors.js';
import { toMinor } from '../common/money.js';
import { FxService } from '../fx/fx.service.js';
import type { Account, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccountDto, CreateAccountDto, UpdateAccountDto } from './dto/account.dto.js';

const notFound = () => apiError(HttpStatus.NOT_FOUND, 'ACCOUNT_NOT_FOUND', 'account not found');

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  /**
   * Derived balances (opening + income − expense − transfers out + transfers in), one query.
   * Soft-deleted rows are ignored. Keyed by account id; every account of the user is present.
   */
  async balances(userId: string): Promise<Map<string, bigint>> {
    const rows = await this.prisma.$queryRaw<{ id: string; balance: bigint }[]>`
      WITH flows AS (
        SELECT account_id AS id,
               CASE type WHEN 'INCOME' THEN amount_minor ELSE -amount_minor END AS delta
          FROM transactions
         WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
        UNION ALL
        SELECT to_account_id, to_amount_minor
          FROM transactions
         WHERE user_id = ${userId}::uuid AND deleted_at IS NULL AND type = 'TRANSFER'
      )
      SELECT a.id::text AS id, (a.opening_balance_minor + COALESCE(SUM(f.delta), 0))::bigint AS balance
        FROM accounts a
        LEFT JOIN flows f ON f.id = a.id
       WHERE a.user_id = ${userId}::uuid
       GROUP BY a.id`;
    return new Map(rows.map((r) => [r.id, BigInt(r.balance)]));
  }

  async list(user: User, includeArchived: boolean): Promise<AccountDto[]> {
    const [accounts, balances, rates] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId: user.id, ...(includeArchived ? {} : { archivedAt: null }) },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.balances(user.id),
      this.fx.table(),
    ]);
    return accounts.map((a) => {
      const balance = balances.get(a.id) ?? a.openingBalanceMinor;
      return this.toDto(a, balance, rates.convert(balance, a.currency, user.baseCurrency), user.baseCurrency);
    });
  }

  async get(user: User, id: string): Promise<AccountDto> {
    const account = await this.prisma.account.findFirst({ where: { id, userId: user.id } });
    if (!account) throw notFound();
    const balance = (await this.balances(user.id)).get(id) ?? account.openingBalanceMinor;
    const inBase = await this.fx.toBase(balance, account.currency, user.baseCurrency);
    return this.toDto(account, balance, inBase, user.baseCurrency);
  }

  async create(user: User, dto: CreateAccountDto): Promise<AccountDto> {
    let openingBalanceMinor = 0n;
    if (dto.openingBalance !== undefined) {
      try {
        openingBalanceMinor = toMinor(dto.openingBalance, dto.currency);
      } catch (error) {
        throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_AMOUNT', (error as Error).message);
      }
    }
    const last = await this.prisma.account.aggregate({
      where: { userId: user.id },
      _max: { sortOrder: true },
    });
    const created = await this.prisma.account.create({
      data: {
        userId: user.id,
        name: dto.name,
        kind: dto.kind,
        currency: dto.currency,
        openingBalanceMinor,
        showOnDashboard: dto.showOnDashboard ?? true,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
    // A new account has no ledger yet: balance = opening.
    const inBase = await this.fx.toBase(openingBalanceMinor, created.currency, user.baseCurrency);
    return this.toDto(created, openingBalanceMinor, inBase, user.baseCurrency);
  }

  async update(user: User, id: string, dto: UpdateAccountDto): Promise<AccountDto> {
    const account = await this.prisma.account.findFirst({ where: { id, userId: user.id } });
    if (!account) throw notFound();
    if (dto.currency !== undefined && dto.currency !== account.currency) {
      const used = await this.prisma.transaction.count({
        where: { userId: user.id, OR: [{ accountId: id }, { toAccountId: id }] },
      });
      if (used > 0) {
        throw apiError(
          HttpStatus.CONFLICT,
          'ACCOUNT_CURRENCY_LOCKED',
          'Currency cannot change once the account has transactions',
        );
      }
    }
    await this.prisma.account.update({
      where: { id },
      data: {
        name: dto.name,
        kind: dto.kind,
        currency: dto.currency,
        showOnDashboard: dto.showOnDashboard,
        sortOrder: dto.sortOrder,
      },
    });
    return this.get(user, id);
  }

  /** Only at a derived balance of exactly zero, so archived accounts never affect net worth. */
  async archive(user: User, id: string): Promise<AccountDto> {
    const account = await this.prisma.account.findFirst({ where: { id, userId: user.id } });
    if (!account) throw notFound();
    if (!account.archivedAt) {
      const balance = (await this.balances(user.id)).get(id) ?? account.openingBalanceMinor;
      if (balance !== 0n) {
        throw apiError(
          HttpStatus.CONFLICT,
          'ACCOUNT_BALANCE_NOT_ZERO',
          'Move the remaining balance out before archiving this account',
        );
      }
      await this.prisma.account.update({ where: { id }, data: { archivedAt: new Date() } });
    }
    return this.get(user, id);
  }

  private toDto(a: Account, balance: bigint, inBase: bigint, baseCurrency: string): AccountDto {
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      currency: a.currency,
      openingBalanceMinor: a.openingBalanceMinor,
      balanceMinor: balance,
      balanceInBaseMinor: inBase,
      baseCurrency,
      showOnDashboard: a.showOnDashboard,
      sortOrder: a.sortOrder,
      archivedAt: a.archivedAt,
      createdAt: a.createdAt,
    };
  }
}
