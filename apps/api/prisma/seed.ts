/**
 * CLI: `pnpm db:seed` (or `pnpm db:reset`). Seeds DATABASE_URL; anchors on SEED_TODAY.
 */
import '../src/common/net-defaults.js';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedDemo } from './seed-lib.js';
import { DEFAULT_SEED_TODAY } from './seed-data.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set (apps/api/.env)');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

seedDemo(prisma, process.env.SEED_TODAY ?? DEFAULT_SEED_TODAY)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
