import { TZDate } from '@date-fns/tz';
import type { Frequency } from '../generated/prisma/enums.js';

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * The n-th occurrence after `anchor` (n = 0 is the anchor itself), keeping the anchor's
 * wall-clock time in `tz`. Months and years are counted from the anchor, so day-of-month
 * clamping never drifts: Jan 31 → Feb 28/29 → Mar 31 → Apr 30.
 */
export function occurrenceAt(anchor: Date, n: number, frequency: Frequency, tz: string): Date {
  const a = new TZDate(anchor.getTime(), tz);
  const [y, mo, d, h, mi, s, ms] = [
    a.getFullYear(),
    a.getMonth(),
    a.getDate(),
    a.getHours(),
    a.getMinutes(),
    a.getSeconds(),
    a.getMilliseconds(),
  ];
  const at = (year: number, month: number, day: number) =>
    new Date(new TZDate(year, month, day, h, mi, s, ms, tz).getTime());

  switch (frequency) {
    case 'DAILY':
      return at(y, mo, d + n);
    case 'WEEKLY':
      return at(y, mo, d + 7 * n);
    case 'MONTHLY': {
      const total = mo + n;
      const year = y + Math.floor(total / 12);
      const month = ((total % 12) + 12) % 12;
      return at(year, month, Math.min(d, daysInMonth(year, month)));
    }
    case 'YEARLY': {
      const year = y + n;
      return at(year, mo, Math.min(d, daysInMonth(year, mo)));
    }
  }
}

/** nextRunAt for a rule whose occurrence #1 happened at `anchor`. */
export function firstNextRun(anchor: Date, frequency: Frequency, tz: string): Date {
  return occurrenceAt(anchor, 1, frequency, tz);
}
