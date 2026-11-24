import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Tests never use DATABASE_URL from .env (that's dev data). They use TEST_DATABASE_URL, falling
// back to the local / CI test database. test/global-setup.ts refuses anything not named *_test.
const envFile = resolve(import.meta.dirname, '.env');
const dotenv = existsSync(envFile) ? parse(readFileSync(envFile)) : {};
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  dotenv.TEST_DATABASE_URL ??
  'postgresql://ledgerline:ledgerline@localhost:5432/ledgerline_test';

export default defineConfig({
  // SWC instead of esbuild so Nest's decorator metadata (constructor injection) is emitted.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    include: ['src/**/*.spec.ts', 'prisma/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    // DB tests share one database and truncate it between tests.
    fileParallelism: false,
    // Generous: the test DB may be a hosted Postgres (Neon) with ~200 ms round trips.
    testTimeout: 90_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: testDatabaseUrl,
      // Prisma CLI prefers DIRECT_URL; pin it so .env's dev DIRECT_URL can never be used.
      DIRECT_URL: testDatabaseUrl,
      DEV_DATABASE_URL: dotenv.DATABASE_URL ?? '',
      WEB_ORIGIN: 'http://localhost:3000',
      // Throttling has its own spec with the real limit.
      AUTH_THROTTLE_LIMIT: '1000',
    },
  },
});
