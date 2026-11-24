import type { Request } from 'express';
import type { User } from '../generated/prisma/client.js';

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Sliding expiry writes at most once per hour per session. */
export const SESSION_SLIDE_INTERVAL_MS = 60 * 60 * 1000;
/** Native clients send this header to receive the token in the body instead of a cookie. */
export const NATIVE_CLIENT_HEADER = 'x-client';

export interface RequestAuth {
  user: User;
  sessionId: string;
  expiresAt: Date;
}

export type AuthedRequest = Request & { auth?: RequestAuth };
