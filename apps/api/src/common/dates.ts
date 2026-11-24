import { TZDate } from '@date-fns/tz';

/** Half-open UTC range [start, end). */
export interface InstantRange {
  start: Date;
  end: Date;
}

function parseYmd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return [y, m, d];
}

/** Local midnight of a calendar date in `tz`, as an instant. */
export function startOfLocalDay(isoDate: string, tz: string): Date {
  const [y, m, d] = parseYmd(isoDate);
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, tz).getTime());
}

/** The calendar month `YYYY-MM` in `tz`. */
export function monthRange(month: string, tz: string): InstantRange {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return {
    start: new Date(new TZDate(y, m - 1, 1, 0, 0, 0, tz).getTime()),
    end: new Date(new TZDate(y, m, 1, 0, 0, 0, tz).getTime()),
  };
}

/** Inclusive calendar dates `from`..`to` in `tz` → [from 00:00, day after `to` 00:00). Either may be open. */
export function dateRange(
  from: string | undefined,
  to: string | undefined,
  tz: string,
): Partial<InstantRange> {
  const range: Partial<InstantRange> = {};
  if (from) range.start = startOfLocalDay(from, tz);
  if (to) {
    const [y, m, d] = parseYmd(to);
    range.end = new Date(new TZDate(y, m - 1, d + 1, 0, 0, 0, tz).getTime());
  }
  return range;
}

/** `YYYY-MM-DD` and `HH:mm` of an instant in `tz`. */
export function localDateTime(instant: Date, tz: string): { date: string; time: string } {
  const z = new TZDate(instant.getTime(), tz);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${z.getFullYear()}-${p(z.getMonth() + 1)}-${p(z.getDate())}`,
    time: `${p(z.getHours())}:${p(z.getMinutes())}`,
  };
}
