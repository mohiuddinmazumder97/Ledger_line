import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApiErrorDto } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { toMe } from '../users/dto/me.dto.js';
import { AuthThrottlerGuard } from './auth-throttler.guard.js';
import { AuthService, type SignedIn } from './auth.service.js';
import { NATIVE_CLIENT_HEADER, type RequestAuth } from './auth.types.js';
import { CurrentAuth, Public } from './decorators.js';
import { AuthResponseDto, LoginDto, RegisterDto } from './dto/auth.dto.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';
import type { SessionMeta } from './session.service.js';

const NativeClientHeader = () =>
  ApiHeader({
    name: 'X-Client',
    required: false,
    description: 'Send `native` to receive the token in the body instead of a `session` cookie.',
  });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Post('register')
  @ApiOperation({ operationId: 'register', summary: 'Create an account and sign in' })
  @NativeClientHeader()
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'EMAIL_IN_USE' })
  @ApiTooManyRequestsResponse({ type: ApiErrorDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers(NATIVE_CLIENT_HEADER) client?: string,
  ): Promise<AuthResponseDto> {
    return this.respond(await this.auth.register(dto, sessionMeta(req)), res, client);
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'login', summary: 'Sign in with email and password' })
  @NativeClientHeader()
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'INVALID_CREDENTIALS' })
  @ApiTooManyRequestsResponse({ type: ApiErrorDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers(NATIVE_CLIENT_HEADER) client?: string,
  ): Promise<AuthResponseDto> {
    return this.respond(await this.auth.login(dto, sessionMeta(req)), res, client);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('session')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'logout', summary: 'Revoke the current session' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async logout(@CurrentAuth() auth: RequestAuth, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(auth.sessionId);
    clearSessionCookie(res, this.secureCookies);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('session')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'logoutAll', summary: 'Revoke every session of the signed-in user' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async logoutAll(
    @CurrentAuth() auth: RequestAuth,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(auth.user.id);
    clearSessionCookie(res, this.secureCookies);
  }

  private respond({ user, token, session }: SignedIn, res: Response, client?: string): AuthResponseDto {
    if (client?.toLowerCase() === 'native') {
      return { user: toMe(user), token, expiresAt: session.expiresAt };
    }
    setSessionCookie(res, token, session.expiresAt, this.secureCookies);
    return { user: toMe(user) };
  }
}

function sessionMeta(req: Request): SessionMeta {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}
