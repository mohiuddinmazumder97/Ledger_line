import { type CallHandler, Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { lastValueFrom, of } from 'rxjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BigIntSerializerInterceptor, serializeBigInts } from './bigint-serializer.interceptor.js';

describe('serializeBigInts', () => {
  it('turns bigints into strings at any depth and keeps everything else', () => {
    const date = new Date('2026-11-22T14:30:00Z');
    const input = {
      amountMinor: 9007199254740993n,
      negative: -124030n,
      rate: new Prisma.Decimal('0.92592593'),
      nested: [{ toAmountMinor: 1n, note: 'x', none: null, n: 3, ok: true }],
      occurredAt: date,
    };
    expect(serializeBigInts(input)).toEqual({
      amountMinor: '9007199254740993',
      negative: '-124030',
      rate: '0.92592593',
      nested: [{ toAmountMinor: '1', note: 'x', none: null, n: 3, ok: true }],
      occurredAt: date,
    });
  });

  it('works through the interceptor', async () => {
    const handler: CallHandler = { handle: () => of({ a: 5n }) };
    const result = new BigIntSerializerInterceptor().intercept({} as never, handler);
    expect(await lastValueFrom(result)).toEqual({ a: '5' });
  });
});

@Controller('money-probe')
class ProbeController {
  @Get()
  get() {
    return { balanceMinor: 482050n, rate: new Prisma.Decimal('83.33333333') };
  }
}

describe('BigIntSerializerInterceptor (HTTP)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    app.useGlobalInterceptors(new BigIntSerializerInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds with money as strings instead of throwing on bigint', async () => {
    const res = await request(app.getHttpServer()).get('/money-probe').expect(200);
    expect(res.body).toEqual({ balanceMinor: '482050', rate: '83.33333333' });
  });
});
