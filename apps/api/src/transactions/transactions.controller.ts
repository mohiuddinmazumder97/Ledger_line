import { once } from 'node:events';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators.js';
import { ApiErrorDto } from '../common/errors.js';
import { IdParam } from '../common/params.js';
import type { User } from '../generated/prisma/client.js';
import {
  CreateTransactionDto,
  DeleteTransactionQueryDto,
  ListTransactionsQueryDto,
  TransactionDto,
  TransactionFiltersDto,
  TransactionPageDto,
  TransactionSummaryDto,
  UpdateTransactionDto,
} from './dto/transaction.dto.js';
import { hasFilters } from './filters.js';
import { TransactionsService } from './transactions.service.js';

@ApiTags('transactions')
@ApiCookieAuth('session')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post()
  @ApiOperation({
    operationId: 'createTransaction',
    summary: 'Save an expense, income or transfer (a split creates one row per split)',
  })
  @ApiCreatedResponse({ type: [TransactionDto] })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'ACCOUNT_ / CATEGORY_ / SUBCATEGORY_ / BUDGET_ / GOAL_NOT_FOUND',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'ACCOUNT_ARCHIVED / CATEGORY_ARCHIVED / GOAL_ARCHIVED',
  })
  create(@CurrentUser() user: User, @Body() dto: CreateTransactionDto): Promise<TransactionDto[]> {
    return this.transactions.create(user, dto);
  }

  @Get()
  @ApiOperation({ operationId: 'listTransactions', summary: 'Filtered, newest first, cursor-paginated' })
  @ApiOkResponse({ type: TransactionPageDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  list(@CurrentUser() user: User, @Query() query: ListTransactionsQueryDto): Promise<TransactionPageDto> {
    return this.transactions.list(user, query);
  }

  @Get('summary')
  @ApiOperation({
    operationId: 'getTransactionSummary',
    summary: 'Income, expenses and net for the filters, in base currency',
  })
  @ApiOkResponse({ type: TransactionSummaryDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  summary(
    @CurrentUser() user: User,
    @Query() filters: TransactionFiltersDto,
  ): Promise<TransactionSummaryDto> {
    return this.transactions.summary(user, filters);
  }

  @Get('export.csv')
  @ApiOperation({
    operationId: 'exportTransactionsCsv',
    summary: 'CSV of the filtered transactions (streamed)',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description:
      'Date, Time, Type, Amount, Currency, Account, To account, Category, Sub-category, Note, Tags',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  async exportCsv(
    @CurrentUser() user: User,
    @Query() filters: TransactionFiltersDto,
    @Res() res: Response,
  ): Promise<void> {
    // Validate filters (and fail with JSON) before any CSV bytes are sent.
    const rows = this.transactions.exportCsv(user, filters);
    const first = await rows.next();
    const filename = hasFilters(filters) ? 'transactions.csv' : 'all-transactions.csv';
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    if (!first.done) res.write(first.value);
    for await (const chunk of rows) {
      if (!res.write(chunk)) await once(res, 'drain');
    }
    res.end();
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getTransaction', summary: 'One transaction' })
  @ApiOkResponse({ type: TransactionDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'TRANSACTION_NOT_FOUND' })
  get(@CurrentUser() user: User, @IdParam('transaction') id: string): Promise<TransactionDto> {
    return this.transactions.get(user, id);
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'updateTransaction',
    summary: 'Edit one row (split rows individually; recurring rules untouched; transfers as one record)',
  })
  @ApiOkResponse({ type: TransactionDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'TRANSACTION_NOT_FOUND and referenced ids' })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'ACCOUNT_ARCHIVED / CATEGORY_ARCHIVED / GOAL_ARCHIVED',
  })
  update(
    @CurrentUser() user: User,
    @IdParam('transaction') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactions.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteTransaction', summary: 'Soft-delete a row (or its whole split group)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'TRANSACTION_NOT_FOUND' })
  async remove(
    @CurrentUser() user: User,
    @IdParam('transaction') id: string,
    @Query() query: DeleteTransactionQueryDto,
  ): Promise<void> {
    await this.transactions.remove(user, id, query.group === 'true');
  }
}
