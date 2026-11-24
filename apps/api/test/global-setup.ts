import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';

/** Throws unless the URL points at a database whose name ends in `_test` and isn't the dev DB. */
export function assertTestDatabase(url: string, devUrl = ''): void {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run tests against database "${name}": the name must end with "_test".`);
  }
  if (
    devUrl &&
    new URL(devUrl).host === new URL(url).host &&
    new URL(devUrl).pathname === new URL(url).pathname
  ) {
    throw new Error('TEST_DATABASE_URL points at the same database as DATABASE_URL.');
  }
}

/** Once per run: apply migrations to the test database. */
export default function setup(project: TestProject): void {
  const env = project.config.env as Record<string, string>;
  const url = env.DATABASE_URL!;
  assertTestDatabase(url, env.DEV_DATABASE_URL);
  execFileSync(resolve(import.meta.dirname, '../node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'pipe',
  });
}
