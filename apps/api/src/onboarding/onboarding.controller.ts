import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators.js';
import { ApiErrorDto } from '../common/errors.js';
import type { User } from '../generated/prisma/client.js';
import { MeDto } from '../users/dto/me.dto.js';
import { CategoryTemplateDto, OnboardingDto } from './dto/onboarding.dto.js';
import { OnboardingService } from './onboarding.service.js';

@ApiTags('onboarding')
@ApiCookieAuth('session')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('templates')
  @ApiOperation({
    operationId: 'getCategoryTemplates',
    summary: 'The default categories offered at onboarding',
  })
  @ApiOkResponse({ type: [CategoryTemplateDto] })
  templates(): CategoryTemplateDto[] {
    return this.onboarding.templates();
  }

  @Post()
  @ApiOperation({
    operationId: 'completeOnboarding',
    summary: 'Set base currency, create the first account and the chosen categories (once)',
  })
  @ApiCreatedResponse({ type: MeDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'ALREADY_ONBOARDED' })
  complete(@CurrentUser() user: User, @Body() dto: OnboardingDto): Promise<MeDto> {
    return this.onboarding.complete(user.id, dto);
  }
}
