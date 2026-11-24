import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { apiError } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { type AuthedRequest, SESSION_COOKIE } from './auth.types.js';
import { IS_PUBLIC_KEY } from './decorators.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';
import { SessionService } from './session.service.js';

/**
 * Global guard: every route needs a valid session unless marked @Public().
 * Token from the `session` cookie (web), else `Authorization: Bearer` (native).
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly secureCookies: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const cookieToken = cookies?.[SESSION_COOKIE];
    const token = cookieToken ?? bearerToken(req.headers.authorization);
    if (!token) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sign in to continue.');

    const result = await this.sessions.validate(token);
    if (!result) {
      if (cookieToken) clearSessionCookie(res, this.secureCookies);
      throw apiError(HttpStatus.UNAUTHORIZED, 'SESSION_INVALID', 'Your session has expired. Sign in again.');
    }

    req.auth = { user: result.user, sessionId: result.session.id, expiresAt: result.session.expiresAt };
    if (result.refreshed && cookieToken) {
      setSessionCookie(res, cookieToken, result.session.expiresAt, this.secureCookies);
    }
    return true;
  }
}

function bearerToken(header: string | undefined): string | undefined {
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match?.[1];
}
