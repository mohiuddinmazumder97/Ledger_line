import '../common/net-defaults.js';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * The app's single Prisma client (pg driver adapter, pooled DATABASE_URL).
 * Connects lazily on the first query, so modules that never touch the DB
 * (health, OpenAPI generation) don't need one. Disconnects on shutdown.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({ adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
