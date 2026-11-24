import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { User } from '../generated/prisma/client.js';
import type { AuthedRequest, RequestAuth } from './auth.types.js';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route (or controller) out of the global SessionAuthGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

function authOf(ctx: ExecutionContext): RequestAuth {
  const auth = ctx.switchToHttp().getRequest<AuthedRequest>().auth;
  // Only reachable on a @Public() route that asked for the user — a programming error.
  if (!auth) throw new Error('No authenticated user on this request');
  return auth;
}

/** The signed-in user (fresh from the DB for this request). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => authOf(ctx).user,
);

/** The current session's auth context (id, expiry). */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestAuth =>
  authOf(ctx),
);
