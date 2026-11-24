import { Transform } from 'class-transformer';
import { registerDecorator, type ValidationOptions } from 'class-validator';
import { CURRENCIES } from './money.js';

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES);

export function isTimeZone(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** A valid IANA time zone, e.g. "Asia/Dhaka". */
export function IsTimeZone(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isTimeZone',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: '$property must be a valid IANA time zone', ...options },
      validator: { validate: isTimeZone },
    });
}

/** Trims string input before validation. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Trims and lower-cases (emails). */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
