/**
 * Money helpers. Amounts are bigint minor units (cents, paisa) + an ISO-4217 code.
 * Never use floats for money: parse decimal strings directly into bigint.
 * Display formatting belongs to the web (`formatMoney`), not here.
 */

export const CURRENCIES = {
  USD: { minorDigits: 2 },
  EUR: { minorDigits: 2 },
  // INR is stored with 2 minor digits (paisa); the web rounds to whole rupees for display.
  INR: { minorDigits: 2 },
} as const satisfies Record<string, { minorDigits: number }>;

export type CurrencyCode = keyof typeof CURRENCIES;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}

export function minorDigits(currency: string): number {
  if (!isCurrencyCode(currency)) throw new Error(`Unsupported currency: ${currency}`);
  return CURRENCIES[currency].minorDigits;
}

const DECIMAL_RE = /^(-)?(\d+)(?:\.(\d+))?$/;

/**
 * "12.5" USD → 1250n. Rejects more fraction digits than the currency allows
 * (no silent rounding of user input), exponents, blanks and separators.
 */
export function toMinor(value: string, currency: string): bigint {
  const digits = minorDigits(currency);
  const match = DECIMAL_RE.exec(value.trim());
  if (!match) throw new Error(`Invalid amount: "${value}"`);
  const [, sign, whole = '0', frac = ''] = match;
  if (frac.length > digits) {
    throw new Error(`Too many decimal places for ${currency}: "${value}" (max ${digits})`);
  }
  const minor = BigInt(whole + frac.padEnd(digits, '0'));
  return sign ? -minor : minor;
}

/** 1250n USD → "12.50". Plain decimal string, no symbol or grouping. */
export function fromMinor(minor: bigint, currency: string): string {
  const digits = minorDigits(currency);
  const negative = minor < 0n;
  const abs = (negative ? -minor : minor).toString().padStart(digits + 1, '0');
  const whole = abs.slice(0, abs.length - digits);
  const frac = abs.slice(abs.length - digits);
  return (negative ? '-' : '') + whole + (digits > 0 ? '.' + frac : '');
}

/** Sum of minor amounts. Typed as bigint so a stray number fails at compile time. */
export function addMinor(...amounts: bigint[]): bigint {
  return amounts.reduce((sum, x) => sum + x, 0n);
}

export function subMinor(a: bigint, b: bigint): bigint {
  return a - b;
}

/** Integer division of num/den rounded half-to-even (banker's rounding). den must be > 0. */
export function divRoundHalfEven(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new Error('Denominator must be positive');
  const negative = num < 0n;
  const n = negative ? -num : num;
  let q = n / den;
  const r = n % den;
  const twice = r * 2n;
  if (twice > den || (twice === den && q % 2n === 1n)) q += 1n;
  return negative ? -q : q;
}

/** A rate as a plain decimal string, or anything with toFixed() (Prisma Decimal). */
export type RateLike = string | { toFixed(): string };

function parseRate(rate: RateLike): { scaled: bigint; scale: bigint } {
  const text = typeof rate === 'string' ? rate.trim() : rate.toFixed();
  const match = DECIMAL_RE.exec(text);
  if (!match || match[1]) throw new Error(`Invalid rate: "${text}"`);
  const [, , whole = '0', frac = ''] = match;
  const scaled = BigInt(whole + frac);
  if (scaled === 0n) throw new Error('Rate must be greater than zero');
  return { scaled, scale: 10n ** BigInt(frac.length) };
}

/**
 * Converts `minor` units of `from` into minor units of `to`.
 * `rate` = units of `to` per 1 unit of `from`. Exact decimal arithmetic, banker's rounding.
 */
export function convert(minor: bigint, from: string, to: string, rate: RateLike): bigint {
  const fromDigits = BigInt(minorDigits(from));
  const toDigits = BigInt(minorDigits(to));
  if (from === to) return minor;
  const { scaled, scale } = parseRate(rate);
  return divRoundHalfEven(minor * scaled * 10n ** toDigits, scale * 10n ** fromDigits);
}
