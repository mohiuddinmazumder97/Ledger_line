import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { SUPPORTED_CURRENCIES, Trim } from '../../common/validators.js';
import { ApiMoney } from '../../common/serialization/api-money.decorator.js';
import { AccountKind } from '../../generated/prisma/enums.js';

export const DECIMAL_AMOUNT_RE = /^-?\d{1,15}(\.\d+)?$/;

export class AccountDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Everyday Checking' })
  name!: string;

  @ApiProperty({ enum: AccountKind, enumName: 'AccountKind', example: 'BANK' })
  kind!: AccountKind;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiMoney({ example: '-3581942', description: 'Balance before the first ledger row, minor units.' })
  openingBalanceMinor!: bigint;

  @ApiMoney({ example: '482050', description: 'Derived: opening + ledger, in the account currency.' })
  balanceMinor!: bigint;

  @ApiMoney({ example: '482050', description: 'balanceMinor in the user base currency at the latest rate.' })
  balanceInBaseMinor!: bigint;

  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiProperty({ example: true })
  showOnDashboard!: boolean;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  archivedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class CreateAccountDto {
  @ApiProperty({ example: 'Travel Card', maxLength: 60 })
  @Trim()
  @IsString()
  @Length(1, 60)
  name!: string;

  @ApiProperty({ enum: AccountKind, enumName: 'AccountKind', example: 'CREDIT' })
  @IsEnum(AccountKind)
  kind!: AccountKind;

  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'EUR' })
  @IsIn(SUPPORTED_CURRENCIES)
  currency!: string;

  @ApiPropertyOptional({
    example: '-250.00',
    default: '0',
    description: 'Current balance as a decimal string; negative for money owed.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Matches(DECIMAL_AMOUNT_RE, { message: 'openingBalance must be a decimal number like 2500 or -12.50' })
  openingBalance?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  showOnDashboard?: boolean;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Main Checking', maxLength: 60 })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 60)
  name?: string;

  @ApiPropertyOptional({ enum: AccountKind, enumName: 'AccountKind' })
  @IsOptional()
  @IsEnum(AccountKind)
  kind?: AccountKind;

  @ApiPropertyOptional({
    enum: SUPPORTED_CURRENCIES,
    description: 'Only while the account has no transactions (else 409 ACCOUNT_CURRENCY_LOCKED).',
  })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  currency?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  showOnDashboard?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class ListAccountsQueryDto {
  @ApiPropertyOptional({ description: 'Include archived accounts', default: false })
  @IsOptional()
  @IsIn(['true', 'false'])
  includeArchived?: 'true' | 'false';
}
