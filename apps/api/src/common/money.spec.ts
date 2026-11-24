import {
  addMinor,
  convert,
  divRoundHalfEven,
  fromMinor,
  isCurrencyCode,
  minorDigits,
  subMinor,
  toMinor,
} from './money.js';

describe('money', () => {
  describe('toMinor', () => {
    it.each([
      ['0', 'USD', 0n],
      ['12', 'USD', 1200n],
      ['12.5', 'USD', 1250n],
      ['12.50', 'USD', 1250n],
      ['0.01', 'EUR', 1n],
      ['-1240.30', 'USD', -124030n],
      ['185000', 'INR', 18500000n],
      ['83.33', 'INR', 8333n],
      [' 4.2 ', 'USD', 420n],
      ['90071992547409.93', 'USD', 9007199254740993n], // beyond Number.MAX_SAFE_INTEGER
    ])('%s %s → %s', (input, cur, expected) => {
      expect(toMinor(input, cur)).toBe(expected);
    });

    it.each(['', '.5', '1.', '1e3', '1,000', 'abc', '--1', '+1', 'NaN'])('rejects %j', (input) => {
      expect(() => toMinor(input, 'USD')).toThrow(/Invalid amount/);
    });

    it('rejects more decimals than the currency allows instead of rounding', () => {
      expect(() => toMinor('1.005', 'USD')).toThrow(/Too many decimal places/);
    });

    it('rejects unknown currencies', () => {
      expect(() => toMinor('1', 'XYZ')).toThrow(/Unsupported currency/);
    });
  });

  describe('fromMinor', () => {
    it.each([
      [0n, 'USD', '0.00'],
      [1n, 'USD', '0.01'],
      [-5n, 'USD', '-0.05'],
      [1250n, 'EUR', '12.50'],
      [-124030n, 'USD', '-1240.30'],
      [18500000n, 'INR', '185000.00'],
    ])('%s %s → %s', (minor, cur, expected) => {
      expect(fromMinor(minor, cur)).toBe(expected);
    });

    it('round-trips with toMinor', () => {
      for (const s of ['0.00', '0.01', '-99.99', '4820.50', '123456789.12']) {
        expect(fromMinor(toMinor(s, 'USD'), 'USD')).toBe(s);
      }
    });
  });

  describe('add / sub', () => {
    it('0.1 + 0.2 is exactly 0.3 (no float drift)', () => {
      expect(0.1 + 0.2).not.toBe(0.3); // the reason this module exists
      const sum = addMinor(toMinor('0.1', 'USD'), toMinor('0.2', 'USD'));
      expect(sum).toBe(30n);
      expect(fromMinor(sum, 'USD')).toBe('0.30');
    });

    it('sums many small amounts exactly', () => {
      const cents = Array.from({ length: 1000 }, () => toMinor('0.10', 'USD'));
      expect(addMinor(...cents)).toBe(10000n);
    });

    it('subtracts and handles empty sums', () => {
      expect(subMinor(toMinor('0.3', 'USD'), toMinor('0.1', 'USD'))).toBe(20n);
      expect(addMinor()).toBe(0n);
    });
  });

  describe('divRoundHalfEven', () => {
    it.each([
      [5n, 2n, 2n], // 2.5 → 2
      [7n, 2n, 4n], // 3.5 → 4
      [-5n, 2n, -2n],
      [-7n, 2n, -4n],
      [10n, 4n, 2n], // 2.5 → 2
      [11n, 4n, 3n], // 2.75 → 3
      [9n, 4n, 2n], // 2.25 → 2
      [0n, 3n, 0n],
    ])('%s / %s → %s', (n, d, q) => {
      expect(divRoundHalfEven(n, d)).toBe(q);
    });

    it('rejects a non-positive denominator', () => {
      expect(() => divRoundHalfEven(1n, 0n)).toThrow();
    });
  });

  describe('convert', () => {
    it('returns the same amount for the same currency', () => {
      expect(convert(1234n, 'USD', 'USD', '1')).toBe(1234n);
    });

    it('converts EUR → USD at 1.08', () => {
      expect(convert(toMinor('2150', 'EUR'), 'EUR', 'USD', '1.08')).toBe(toMinor('2322', 'USD'));
    });

    it('converts USD → INR at 83.33333333', () => {
      // 10.00 USD × 83.33333333 = 833.3333333 INR → 833.33
      expect(convert(1000n, 'USD', 'INR', '83.33333333')).toBe(83333n);
    });

    it('converts INR → USD at 0.012', () => {
      expect(convert(toMinor('185000', 'INR'), 'INR', 'USD', '0.012')).toBe(toMinor('2220', 'USD'));
    });

    it("uses banker's rounding on exact halves", () => {
      // 0.05 × 0.5 = 0.025 → 0.02 (2 is even); 0.15 × 0.5 = 0.075 → 0.08 (8 is even)
      expect(convert(5n, 'USD', 'EUR', '0.5')).toBe(2n);
      expect(convert(15n, 'USD', 'EUR', '0.5')).toBe(8n);
      expect(convert(-5n, 'USD', 'EUR', '0.5')).toBe(-2n);
    });

    it('accepts Decimal-like rates via toFixed()', () => {
      expect(convert(10000n, 'USD', 'EUR', { toFixed: () => '0.92592593' })).toBe(9259n);
    });

    it.each(['0', '-1', 'abc', '1e2'])('rejects rate %j', (rate) => {
      expect(() => convert(100n, 'USD', 'EUR', rate)).toThrow();
    });
  });

  it('knows currency metadata', () => {
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isCurrencyCode('toString')).toBe(false);
    expect(minorDigits('INR')).toBe(2);
  });
});
