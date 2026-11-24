import { HttpException } from '@nestjs/common';
import { RateTable } from './rate-table.js';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('RateTable', () => {
  const table = new RateTable([
    { quote: 'EUR', rate: '0.92592593', date: d('2025-11-23') },
    { quote: 'INR', rate: '83.33333333', date: d('2025-11-23') },
    { quote: 'EUR', rate: '0.90000000', date: d('2026-06-01') },
  ]);

  it('is the identity for the same currency and USD→USD', () => {
    expect(table.rateString('EUR', 'EUR')).toBe('1.00000000');
    expect(table.rateString('USD', 'USD')).toBe('1.00000000');
    expect(table.convert(12345n, 'INR', 'INR')).toBe(12345n);
  });

  it('reads USD→X directly', () => {
    expect(table.rateString('USD', 'INR')).toBe('83.33333333');
  });

  it('inverts for X→USD', () => {
    // 1 / 0.92592593 = 1.0799999952… → 1.08000000 at 8 digits
    expect(table.rateString('EUR', 'USD', d('2026-01-01'))).toBe('1.08000000');
    // €2,150 → $2,322.00 (prototype: 2150 × 1.08)
    expect(table.convert(215000n, 'EUR', 'USD', d('2026-01-01'))).toBe(232200n);
  });

  it('computes EUR↔INR as a cross rate through USD', () => {
    // 83.33333333 / 0.92592593 = 89.9999996004…
    expect(table.rateString('EUR', 'INR', d('2026-01-01'))).toBe('89.99999960');
    expect(table.rateString('INR', 'EUR', d('2026-01-01'))).toBe('0.01111111');
    // ₹1,85,000 → €2,055.56 (prototype: 185000 × 0.012 / 1.08 = 2055.555…)
    expect(table.convert(18500000n, 'INR', 'EUR', d('2026-01-01'))).toBe(205556n);
  });

  it('uses the latest rate on or before the date, else the latest overall', () => {
    expect(table.rateString('USD', 'EUR', d('2026-05-31'))).toBe('0.92592593');
    expect(table.rateString('USD', 'EUR', d('2026-06-01'))).toBe('0.90000000');
    expect(table.rateString('USD', 'EUR', d('2027-01-01'))).toBe('0.90000000');
    expect(table.rateString('USD', 'EUR')).toBe('0.90000000');
    // Before any rate exists → latest (SPEC §4 fallback).
    expect(table.rateString('USD', 'EUR', d('2020-01-01'))).toBe('0.90000000');
  });

  it('throws FX_RATE_UNAVAILABLE for an unknown currency', () => {
    try {
      table.rate('USD', 'GBP');
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'FX_RATE_UNAVAILABLE' });
    }
  });
});
