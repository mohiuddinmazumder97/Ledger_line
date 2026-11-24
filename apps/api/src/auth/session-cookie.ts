import type { CookieOptions, Response } from 'express';
import { SESSION_COOKIE } from './auth.types.js';

function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}

/** httpOnly, SameSite=Lax, path /, Secure in production; max-age follows the session's expiry. */
export function setSessionCookie(res: Response, token: string, expiresAt: Date, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, {
    ...baseOptions(secure),
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE, baseOptions(secure));
}
