import { HttpStatus } from '@nestjs/common';
import { apiError } from '../common/errors.js';
import { convertByFraction, decimalToFraction, type Fraction, fractionToDecimal } from '../common/money.js';

export interface RateRow {
  quote: string;
  /** Units of `quote` per 1 USD (Prisma Decimal or decimal string). */
  rate: string | { toFixed(): string };
  date: Date;
}

/** Digits stored for a transfer's fxRate (Decimal(18,8)). */
export const FX_RATE_DIGITS = 8;

const ONE: Fraction = { num: 1n, den: 1n };

/** 'YYYY-MM-DD' of an instant in UTC — rate rows are dated in UTC calendar days. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * In-memory view of the USD→X rates. Load once per request (`FxService.table()`) and look up
 * as many rows as needed. Every pair goes through USD: rate(A→B) = rate(USD→B) / rate(USD→A).
 */
export class RateTable {
  /** quote → rows sorted by date ascending. */
  private readonly byQuote = new Map<string, { day: string; rate: Fraction }[]>();

  constructor(rows: readonly RateRow[]) {
    for (const r of rows) {
      const list = this.byQuote.get(r.quote) ?? [];
      list.push({ day: dayKey(r.date), rate: decimalToFraction(r.rate) });
      this.byQuote.set(r.quote, list);
    }
    for (const list of this.byQuote.values()) list.sort((a, b) => a.day.localeCompare(b.day));
  }

  /** USD→X: latest on or before `onDate`, else the latest overall (or earliest if all are later). */
  usdTo(currency: string, onDate?: Date): Fraction {
    if (currency === 'USD') return ONE;
    const list = this.byQuote.get(currency);
    if (!list?.length) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FX_RATE_UNAVAILABLE',
        `No exchange rate for ${currency}`,
      );
    }
    if (!onDate) return list.at(-1)!.rate;
    const key = dayKey(onDate);
    // Binary search for the last row with day <= key.
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.day <= key) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    // Nothing on/before the date: fall back to the latest rate (SPEC §4).
    return found >= 0 ? list[found]!.rate : list.at(-1)!.rate;
  }

  /** Exact rate `to` per 1 `from`. */
  rate(from: string, to: string, onDate?: Date): Fraction {
    if (from === to) return ONE;
    const usdFrom = this.usdTo(from, onDate);
    const usdTo = this.usdTo(to, onDate);
    // (usdTo.num/usdTo.den) / (usdFrom.num/usdFrom.den)
    return { num: usdTo.num * usdFrom.den, den: usdTo.den * usdFrom.num };
  }

  /** The rate as stored on a transfer: decimal string with 8 fraction digits. */
  rateString(from: string, to: string, onDate?: Date): string {
    return fractionToDecimal(this.rate(from, to, onDate), FX_RATE_DIGITS);
  }

  /** Converts minor units exactly, banker's rounding. */
  convert(minor: bigint, from: string, to: string, onDate?: Date): bigint {
    return convertByFraction(minor, from, to, this.rate(from, to, onDate));
  }
}
