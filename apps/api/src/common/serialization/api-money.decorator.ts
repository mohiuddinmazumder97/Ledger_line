import { ApiProperty, type ApiPropertyOptions } from '@nestjs/swagger';

/**
 * A money field: bigint minor units serialised as a string of digits (e.g. "125050" = 1,250.50).
 * Explicit string schema so orval/zod generate `string`, never `number`.
 */
export function ApiMoney(options: ApiPropertyOptions = {}): PropertyDecorator {
  return ApiProperty({
    type: String,
    pattern: '^-?\\d+$',
    example: '125050',
    description: 'Integer minor units (e.g. cents) as a string.',
    ...options,
  });
}

/** A Decimal(18,8) value such as an FX rate, serialised as a plain decimal string. */
export function ApiDecimal(options: ApiPropertyOptions = {}): PropertyDecorator {
  return ApiProperty({
    type: String,
    pattern: '^-?\\d+(\\.\\d+)?$',
    example: '0.92592593',
    ...options,
  });
}
