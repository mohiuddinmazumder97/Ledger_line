/**
 * Writes apps/api/openapi.json without starting an HTTP server or touching the database.
 * Run via `pnpm gen:api` (root) or `pnpm --filter @ledgerline/api openapi:write`.
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';

// The document doesn't depend on these values; defaults let the script run in CI without a .env.
process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi';
process.env.WEB_ORIGIN ??= 'http://localhost:3000';
process.env.LOG_LEVEL ??= 'silent';

// Imported after the env defaults so ConfigModule validation sees them.
const { AppModule } = await import('../src/app.module.js');
const { buildOpenApiDocument, configureApp } = await import('../src/app.setup.js');

const app = await NestFactory.create(AppModule, { logger: false });
configureApp(app);
await app.init();
const document = buildOpenApiDocument(app);
await app.close();

const out = resolve(import.meta.dirname, '../../openapi.json');
writeFileSync(out, JSON.stringify(document, null, 2) + '\n');
console.log(`OpenAPI spec written to ${out}`);
