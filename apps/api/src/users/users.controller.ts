import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators.js';
import { ApiErrorDto } from '../common/errors.js';
import type { User } from '../generated/prisma/client.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { MeDto, toMe } from './dto/me.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiCookieAuth('session')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ operationId: 'getMe', summary: 'The signed-in user and their preferences' })
  @ApiOkResponse({ type: MeDto })
  getMe(@CurrentUser() user: User): MeDto {
    return toMe(user);
  }

  @Patch('settings')
  @ApiOperation({
    operationId: 'updateSettings',
    summary: 'Update base currency, theme, layout, drawer style, timezone',
  })
  @ApiOkResponse({ type: MeDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  updateSettings(@CurrentUser() user: User, @Body() dto: UpdateSettingsDto): Promise<MeDto> {
    return this.users.updateSettings(user.id, dto);
  }
}
