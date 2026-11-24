import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI config (migrate, generate, seed). The running app does not read this file —
 * it connects through the pg driver adapter in PrismaService using DATABASE_URL.
 *
 * Migrations use DIRECT_URL when set: poolers such as Neon's PgBouncer endpoint
 * break Prisma Migrate's advisory locks.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // A placeholder keeps `prisma generate` working without a .env (CI, fresh clones).
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
