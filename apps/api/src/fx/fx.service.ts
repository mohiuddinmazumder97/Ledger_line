import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateTable } from './rate-table.js';

/**
 * Exchange rates. Stored as USD→X only; every other pair is a cross rate through USD.
 * Rates come from the seed for now; a provider can write ExchangeRate rows later.
 */
@Injectable()
export class FxService {
  constructor(private readonly prisma: PrismaService) {}

  /** All rates, loaded once — use for anything that converts more than one row. */
  async table(): Promise<RateTable> {
    const rows = await this.prisma.exchangeRate.findMany({ select: { quote: true, rate: true, date: true } });
    return new RateTable(rows);
  }

  /** Rate `to` per 1 `from` as a decimal string (8 digits), on `onDate` or latest. */
  async rate(from: string, to: string, onDate?: Date): Promise<string> {
    return (await this.table()).rateString(from, to, onDate);
  }

  /** Minor units of `currency` → minor units of `base`, at the rate on `onDate` (or latest). */
  async toBase(minor: bigint, currency: string, base: string, onDate?: Date): Promise<bigint> {
    if (currency === base) return minor;
    return (await this.table()).convert(minor, currency, base, onDate);
  }
}
