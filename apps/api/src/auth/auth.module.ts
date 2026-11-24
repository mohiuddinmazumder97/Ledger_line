import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Env } from '../config/env.js';
import { AuthThrottlerGuard } from './auth-throttler.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SessionService } from './session.service.js';

@Module({
  imports: [
    // In-memory store: fine for one API instance; a shared store is listed under "Later".
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        { name: 'auth', ttl: 60_000, limit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }) },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    AuthThrottlerGuard,
    // Every route requires a session unless marked @Public().
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
