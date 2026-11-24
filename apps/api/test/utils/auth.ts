import request from 'supertest';
import type { TestApp } from './test-app.js';

export const PASSWORD = 'correct horse battery';

export function setCookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown;
  if (!raw) return [];
  return Array.isArray(raw) ? (raw as string[]) : [raw as string];
}

/** The `session` Set-Cookie header, if any. */
export function sessionCookieHeader(res: request.Response): string | undefined {
  return setCookies(res).find((c) => c.startsWith('session='));
}

/** The raw token from a `session` Set-Cookie header. */
export function sessionToken(res: request.Response): string {
  const header = sessionCookieHeader(res);
  if (!header) throw new Error('No session cookie in response');
  return decodeURIComponent(header.split(';')[0]!.slice('session='.length));
}

let counter = 0;

/** Registers a fresh user (web flow) and returns its cookie token and user id. */
export async function registerUser(
  app: TestApp,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<{ token: string; userId: string; email: string }> {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${Date.now()}@example.com`;
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ name: overrides.name ?? 'Test User', email, password: overrides.password ?? PASSWORD })
    .expect(201);
  return { token: sessionToken(res), userId: (res.body as { user: { id: string } }).user.id, email };
}
