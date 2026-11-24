import { dateRange, localDateTime, monthRange } from '../common/dates.js';
import { occurrenceAt } from './schedule.js';

describe('occurrenceAt', () => {
  const NY = 'America/New_York';

  it('clamps month ends against the anchor day (Jan 31 → Feb 28 → Mar 31 → Apr 30)', () => {
    const anchor = new Date('2026-01-31T15:00:00Z'); // 10:00 New York
    const got = [1, 2, 3].map((n) => localDateTime(occurrenceAt(anchor, n, 'MONTHLY', NY), NY));
    expect(got).toEqual([
      { date: '2026-02-28', time: '10:00' },
      { date: '2026-03-31', time: '10:00' }, // across the DST switch, still 10:00 local
      { date: '2026-04-30', time: '10:00' },
    ]);
  });

  it('handles leap years for Feb 29 anchors', () => {
    const anchor = new Date('2028-02-29T12:00:00Z');
    expect(localDateTime(occurrenceAt(anchor, 1, 'YEARLY', 'UTC'), 'UTC').date).toBe('2029-02-28');
    expect(localDateTime(occurrenceAt(anchor, 4, 'YEARLY', 'UTC'), 'UTC').date).toBe('2032-02-29');
  });

  it('rolls months into the next year', () => {
    const anchor = new Date('2026-11-15T08:00:00Z');
    expect(localDateTime(occurrenceAt(anchor, 3, 'MONTHLY', 'UTC'), 'UTC').date).toBe('2027-02-15');
  });

  it('keeps wall-clock time for daily and weekly across DST', () => {
    const anchor = new Date('2026-03-07T14:30:00Z'); // 09:30 EST, day before the US switch
    expect(localDateTime(occurrenceAt(anchor, 1, 'DAILY', NY), NY)).toEqual({
      date: '2026-03-08',
      time: '09:30',
    });
    expect(localDateTime(occurrenceAt(anchor, 1, 'WEEKLY', NY), NY)).toEqual({
      date: '2026-03-14',
      time: '09:30',
    });
  });

  it('n = 0 is the anchor', () => {
    const anchor = new Date('2026-05-05T05:05:00Z');
    expect(occurrenceAt(anchor, 0, 'MONTHLY', 'Asia/Dhaka')).toEqual(anchor);
  });
});

describe('date ranges in the user timezone', () => {
  it('month boundaries follow the zone (Asia/Dhaka, UTC+6)', () => {
    const r = monthRange('2026-11', 'Asia/Dhaka');
    expect(r.start.toISOString()).toBe('2026-10-31T18:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-11-30T18:00:00.000Z');
  });

  it('inclusive from/to dates', () => {
    const r = dateRange('2026-11-01', '2026-11-22', 'America/New_York');
    expect(r.start!.toISOString()).toBe('2026-11-01T04:00:00.000Z'); // EDT
    expect(r.end!.toISOString()).toBe('2026-11-23T05:00:00.000Z'); // EST
  });
});
