import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { BigIntSerializerInterceptor } from './common/serialization/bigint-serializer.interceptor.js';
import type { Env } from './config/env.js';

/**
 * Everything that must be identical in main.ts, tests and the OpenAPI writer.
 * Keep app-wide wiring here, not in main.ts.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Money (bigint minor units) and FX rates (Decimal) leave the API as strings.
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true });
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const options = new DocumentBuilder()
    .setTitle('Ledgerline API')
    .setDescription(
      'Personal finance tracker API. Money amounts are strings of integer minor units (e.g. "125050" = 1,250.50 in a 2-decimal currency), never JSON numbers; FX rates are decimal strings.',
    )
    .setVersion('0.1.0')
    .build();
  return SwaggerModule.createDocument(app, options, {
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: 'api/docs-json',
  });
}
