import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { assertTestDatabase } from '../global-setup.js';

export type TestApp = INestApplication<App>;

/** The real AppModule, wired exactly like main.ts (configureApp + Swagger). */
export async function createTestApp(): Promise<TestApp> {
  assertTestDatabase(process.env.DATABASE_URL!, process.env.DEV_DATABASE_URL);
  // Imported lazily so a spec can adjust process.env before ConfigModule validates it.
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp, setupSwagger } = await import('../../src/app.setup.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<TestApp>();
  configureApp(app);
  setupSwagger(app);
  await app.init();
  return app;
}
