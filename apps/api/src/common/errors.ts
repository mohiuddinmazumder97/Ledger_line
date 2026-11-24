import { BadRequestException, HttpException, type HttpStatus, type ValidationError } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/** Every error body carries a stable `code`; the web maps codes to messages. */
export class ApiErrorDto {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({ example: 'UNAUTHENTICATED' })
  code!: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Sign in to continue.',
  })
  message!: string | string[];
}

export function apiError(status: HttpStatus, code: string, message: string | string[]): HttpException {
  return new HttpException({ statusCode: status, code, message } satisfies ApiErrorDto, status);
}

function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((e) => {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((m) => (parent ? `${path}: ${m}` : m));
    return [...own, ...flatten(e.children ?? [], path)];
  });
}

/** ValidationPipe exceptionFactory: same shape as every other error, code VALIDATION_FAILED. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: flatten(errors),
  } satisfies ApiErrorDto);
}
