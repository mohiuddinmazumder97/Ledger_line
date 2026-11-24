import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Trim } from '../../common/validators.js';
import { CategoryType } from '../../generated/prisma/enums.js';

export class SubcategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Groceries' })
  name!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: false, description: 'Excluded from the heatmap and largest purchase.' })
  excludeFromInsights!: boolean;
}

export class CategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Food & Drink' })
  name!: string;

  @ApiProperty({ enum: CategoryType, enumName: 'CategoryType', example: 'EXPENSE' })
  type!: CategoryType;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  archivedAt!: Date | null;

  @ApiProperty({ type: [SubcategoryDto] })
  subcategories!: SubcategoryDto[];
}

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({ enum: CategoryType, enumName: 'CategoryType' })
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @ApiPropertyOptional({ description: 'Include archived categories', default: false })
  @IsOptional()
  @IsIn(['true', 'false'])
  includeArchived?: 'true' | 'false';
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'Pets', maxLength: 40 })
  @Trim()
  @IsString()
  @Length(1, 40)
  name!: string;

  @ApiProperty({ enum: CategoryType, enumName: 'CategoryType', example: 'EXPENSE' })
  @IsEnum(CategoryType)
  type!: CategoryType;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Pets & Vet', maxLength: 40 })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 40)
  name?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class CreateSubcategoryDto {
  @ApiProperty({ example: 'Vet', maxLength: 40 })
  @Trim()
  @IsString()
  @Length(1, 40)
  name!: string;
}

export class UpdateSubcategoryDto {
  @ApiPropertyOptional({ example: 'Veterinary', maxLength: 40 })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 40)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  excludeFromInsights?: boolean;
}
