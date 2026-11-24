import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsObject,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CATEGORY_TEMPLATE_IDS } from '../../categories/category-templates.js';
import { SUPPORTED_CURRENCIES, Trim } from '../../common/validators.js';
import { CategoryType } from '../../generated/prisma/enums.js';

export class OnboardingAccountDto {
  @ApiProperty({ example: 'Everyday Checking', maxLength: 60 })
  @Trim()
  @IsString()
  @Length(1, 60)
  name!: string;

  @ApiProperty({
    example: '2500',
    pattern: '^-?\\d+(\\.\\d+)?$',
    description: 'Current balance as a decimal string in the base currency (at most its minor digits).',
  })
  @Trim()
  @IsString()
  @Matches(/^-?\d{1,15}(\.\d+)?$/, {
    message: 'openingBalance must be a decimal number like 2500 or 2500.50',
  })
  openingBalance!: string;
}

export class OnboardingDto {
  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'USD' })
  @IsIn(SUPPORTED_CURRENCIES)
  baseCurrency!: string;

  @ApiProperty({ type: OnboardingAccountDto })
  // ValidateNested alone skips a missing object.
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => OnboardingAccountDto)
  account!: OnboardingAccountDto;

  @ApiProperty({
    type: [String],
    enum: CATEGORY_TEMPLATE_IDS,
    example: ['food', 'transport', 'housing', 'shopping', 'salary'],
  })
  @IsArray()
  @ArrayUnique()
  @IsIn(CATEGORY_TEMPLATE_IDS, { each: true })
  categoryTemplateIds!: string[];
}

export class CategoryTemplateDto {
  @ApiProperty({ enum: CATEGORY_TEMPLATE_IDS, example: 'food' })
  id!: string;

  @ApiProperty({ example: 'Food & Drink' })
  name!: string;

  @ApiProperty({ enum: CategoryType, enumName: 'CategoryType' })
  type!: CategoryType;

  @ApiProperty({ type: [String], example: ['Groceries', 'Restaurants', 'Coffee'] })
  subs!: string[];
}
