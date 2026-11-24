import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp, setupSwagger } from '../src/app.setup.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows CORS only for WEB_ORIGIN, with credentials', async () => {
    const ok = await request(app.getHttpServer()).get('/api/health').set('Origin', 'http://localhost:3000');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    // A fixed origin is always echoed as-is, so a foreign origin never sees itself allowed.
    const bad = await request(app.getHttpServer()).get('/api/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('serves the OpenAPI document with the health operation', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const body = res.body as { paths: Record<string, { get?: { operationId?: string } }> };
    expect(body.paths['/api/health']?.get?.operationId).toBe('getHealth');
  });

  it('returns 404 for unknown routes', async () => {
    await request(app.getHttpServer()).get('/api/nope').expect(404);
  });
});
