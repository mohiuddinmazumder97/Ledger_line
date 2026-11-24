import { HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { apiError } from './errors.js';
import { notFoundCode, type OwnedModel } from './ownership.js';

/** `@IdParam('account')` — the `:id` route param; a malformed id is a 404 with the model's code. */
export function IdParam(model: OwnedModel, name = 'id'): ParameterDecorator {
  return Param(
    name,
    new ParseUUIDPipe({
      exceptionFactory: () => apiError(HttpStatus.NOT_FOUND, notFoundCode(model), `${model} not found`),
    }),
  );
}
