import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiDecimal, ApiMoney } from '../../common/serialization/api-money.decorator.js';
import { BudgetMode, Frequency, TransactionType } from '../../generated/prisma/enums.js';

const AMOUNT_RE = /^\d{1,15}(\.\d+)?$/;
const AMOUNT_MESSAGE = '$property must be a positive decimal string like 12.50';
/** 'auto' or a budget uuid. */
const BUDGET_REF_RE = /^(auto|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const trimString = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

// ─── Input ───────────────────────────────────────────────────────────────────

export class SplitDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Defaults to the category's first sub-category." })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiProperty({ example: '18.40', pattern: AMOUNT_RE.source })
  @IsString()
  @Matches(AMOUNT_RE, { message: AMOUNT_MESSAGE })
  amount!: string;
}

export class RecurringDto {
  @ApiProperty({ enum: Frequency, enumName: 'Frequency', example: 'MONTHLY' })
  @IsEnum(Frequency)
  frequency!: Frequency;
}

/** Fields shared by create and edit. */
class TransactionFieldsDto {
  @ApiPropertyOptional({
    example: 'Green Basket Market',
    maxLength: 120,
    description: 'Short title / merchant',
  })
  @IsOptional()
  @trimString()
  @IsString()
  @MaxLength(120)
  note?: string;

  @ApiPropertyOptional({ example: 'Weekly shop', maxLength: 2000 })
  @IsOptional()
  @trimString()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['work'], description: 'Tag names; created on first use.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    oneOf: [
      { type: 'string', enum: ['auto'] },
      { type: 'string', format: 'uuid' },
    ],
    nullable: true,
    example: 'auto',
    description:
      "'auto' (default) = the budget of the category; null = no budget; a budget id = that budget. Expenses only.",
  })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @Matches(BUDGET_REF_RE, { message: "budgetId must be 'auto', null or a budget id" })
  budgetId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsUUID()
  goalId?: string | null;
}

export class CreateTransactionDto extends TransactionFieldsDto {
  @ApiProperty({ enum: TransactionType, enumName: 'TransactionType', example: 'EXPENSE' })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({ format: 'uuid', description: 'Paid from / receiving / from account' })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({
    example: '42.10',
    pattern: AMOUNT_RE.source,
    description:
      'Decimal string in the account currency. Optional with splits (then it must equal their sum).',
  })
  @ValidateIf((o: CreateTransactionDto) => o.amount !== undefined || !o.splits)
  @IsString()
  @Matches(AMOUNT_RE, { message: AMOUNT_MESSAGE })
  amount?: string;

  @ApiProperty({ example: '2026-11-22T14:30:00-05:00', description: 'ISO 8601 with offset' })
  @IsISO8601({ strict: true, strictSeparator: true })
  occurredAt!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for expense / income' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Defaults to the category's first sub-category" })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Transfers only' })
  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  @ApiPropertyOptional({
    type: [SplitDto],
    description: 'Expense only: one row per split, sharing a splitGroupId. Replaces categoryId.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SplitDto)
  splits?: SplitDto[];

  @ApiPropertyOptional({ type: RecurringDto, description: 'Creates a rule; this record is occurrence #1.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurringDto)
  recurring?: RecurringDto;
}

export class UpdateTransactionDto extends TransactionFieldsDto {
  @ApiPropertyOptional({ enum: TransactionType, enumName: 'TransactionType' })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ example: '45.00', pattern: AMOUNT_RE.source })
  @IsOptional()
  @IsString()
  @Matches(AMOUNT_RE, { message: AMOUNT_MESSAGE })
  amount?: string;

  @ApiPropertyOptional({ example: '2026-11-21T09:00:00-05:00' })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  occurredAt?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  toAccountId?: string;
}

const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class TransactionFiltersDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Inclusive, calendar date in the user timezone',
  })
  @IsOptional()
  @Matches(YMD, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-22',
    description: 'Inclusive, calendar date in the user timezone',
  })
  @IsOptional()
  @Matches(YMD, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({
    example: '2026-11',
    description: 'Calendar month in the user timezone (instead of from/to)',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month?: string;

  @ApiPropertyOptional({ enum: TransactionType, enumName: 'TransactionType' })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Matches the source or the destination account' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    example: 'groceries',
    description: 'Case-insensitive search in note, description, category, sub-category and tag names',
  })
  @IsOptional()
  @trimString()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ListTransactionsQueryDto extends TransactionFiltersDto {
  @ApiPropertyOptional({ description: 'nextCursor from the previous page' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({ example: 50, default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class DeleteTransactionQueryDto {
  @ApiPropertyOptional({ description: "true: delete the row's whole split group", default: false })
  @IsOptional()
  @IsIn(['true', 'false'])
  group?: 'true' | 'false';
}

// ─── Output ──────────────────────────────────────────────────────────────────

export class AccountRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Everyday Checking' })
  name!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;
}

export class NamedRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Food & Drink' })
  name!: string;
}

export class TransactionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: TransactionType, enumName: 'TransactionType', example: 'EXPENSE' })
  type!: TransactionType;

  @ApiProperty({ type: AccountRefDto })
  account!: AccountRefDto;

  @ApiMoney({ example: '4210', description: 'Always positive; minor units of `currency`.' })
  amountMinor!: bigint;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ type: AccountRefDto, nullable: true })
  toAccount!: AccountRefDto | null;

  @ApiMoney({
    nullable: true,
    example: null,
    description: 'Transfers: amount received, in the destination currency.',
  })
  toAmountMinor!: bigint | null;

  @ApiDecimal({
    nullable: true,
    example: null,
    description: 'Transfers between currencies: destination per source unit.',
  })
  fxRate!: string | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-22T19:30:00.000Z' })
  occurredAt!: Date;

  @ApiProperty({ example: 'Green Basket Market' })
  note!: string;

  @ApiProperty({ example: '' })
  description!: string;

  @ApiProperty({ type: NamedRefDto, nullable: true })
  category!: NamedRefDto | null;

  @ApiProperty({ type: NamedRefDto, nullable: true })
  subcategory!: NamedRefDto | null;

  @ApiProperty({ enum: BudgetMode, enumName: 'BudgetMode', example: 'AUTO' })
  budgetMode!: BudgetMode;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  budgetId!: string | null;

  @ApiProperty({ type: NamedRefDto, nullable: true })
  goal!: NamedRefDto | null;

  @ApiProperty({ type: [String], example: ['work'] })
  tags!: string[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  recurringRuleId!: string | null;

  @ApiProperty({ enum: Frequency, enumName: 'Frequency', nullable: true, type: String, example: null })
  recurringFrequency!: Frequency | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Set on split rows ("Split" flag)',
  })
  splitGroupId!: string | null;

  @ApiProperty({ example: false })
  hasReceipt!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class TransactionPageDto {
  @ApiProperty({ type: [TransactionDto] })
  items!: TransactionDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `cursor` for the next page; null at the end.',
  })
  nextCursor!: string | null;
}

export class TransactionSummaryDto {
  @ApiMoney({ example: '520000' })
  incomeMinor!: bigint;

  @ApiMoney({ example: '312055' })
  expenseMinor!: bigint;

  @ApiMoney({ example: '207945' })
  netMinor!: bigint;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: 37, description: 'Rows matching the filters, transfers included' })
  count!: number;
}
