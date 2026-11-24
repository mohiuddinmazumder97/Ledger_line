import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * JSON has no bigint, and money must never round-trip through a JS number.
 * Every bigint in a response (minor units) becomes a decimal-digit string; Prisma Decimals
 * (FX rates) become plain decimal strings. Declare such fields with `@ApiMoney()` /
 * `@ApiDecimal()` so the OpenAPI schema (and the generated zod) says string.
 */
export function serializeBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (Prisma.Decimal.isDecimal(value)) return value.toFixed();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  // Leave Dates, Buffers, class instances with toJSON etc. to JSON.stringify.
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) out[key] = serializeBigInts(inner);
  return out;
}

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(serializeBigInts));
  }
}
