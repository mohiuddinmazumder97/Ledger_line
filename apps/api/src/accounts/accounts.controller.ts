import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators.js';
import { ApiErrorDto } from '../common/errors.js';
import { IdParam } from '../common/params.js';
import type { User } from '../generated/prisma/client.js';
import { AccountsService } from './accounts.service.js';
import { AccountDto, CreateAccountDto, ListAccountsQueryDto, UpdateAccountDto } from './dto/account.dto.js';

@ApiTags('accounts')
@ApiCookieAuth('session')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ operationId: 'listAccounts', summary: 'Accounts with derived balances' })
  @ApiOkResponse({ type: [AccountDto] })
  list(@CurrentUser() user: User, @Query() query: ListAccountsQueryDto): Promise<AccountDto[]> {
    return this.accounts.list(user, query.includeArchived === 'true');
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getAccount', summary: 'One account with its derived balance' })
  @ApiOkResponse({ type: AccountDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'ACCOUNT_NOT_FOUND' })
  get(@CurrentUser() user: User, @IdParam('account') id: string): Promise<AccountDto> {
    return this.accounts.get(user, id);
  }

  @Post()
  @ApiOperation({ operationId: 'createAccount', summary: 'Create an account' })
  @ApiCreatedResponse({ type: AccountDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  create(@CurrentUser() user: User, @Body() dto: CreateAccountDto): Promise<AccountDto> {
    return this.accounts.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateAccount', summary: 'Rename, change kind / visibility / order' })
  @ApiOkResponse({ type: AccountDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'ACCOUNT_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'ACCOUNT_CURRENCY_LOCKED' })
  update(
    @CurrentUser() user: User,
    @IdParam('account') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountDto> {
    return this.accounts.update(user, id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'archiveAccount', summary: 'Archive an account (balance must be exactly 0)' })
  @ApiOkResponse({ type: AccountDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'ACCOUNT_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'ACCOUNT_BALANCE_NOT_ZERO' })
  archive(@CurrentUser() user: User, @IdParam('account') id: string): Promise<AccountDto> {
    return this.accounts.archive(user, id);
  }
}
