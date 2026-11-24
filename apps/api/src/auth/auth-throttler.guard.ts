import { HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { apiError } from '../common/errors.js';

/**
 * Per-IP rate limit for login / register (AUTH_THROTTLE_LIMIT per minute).
 * The client IP is `req.ip`, which honours TRUST_PROXY (X-Forwarded-For from the Next.js rewrite).
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(): Promise<void> {
    return Promise.reject(
      apiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_REQUESTS',
        'Too many attempts. Try again in a minute.',
      ),
    );
  }
}
