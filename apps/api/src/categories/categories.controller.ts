import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators.js';
import { ApiErrorDto } from '../common/errors.js';
import { IdParam } from '../common/params.js';
import type { User } from '../generated/prisma/client.js';
import { CategoriesService } from './categories.service.js';
import {
  CategoryDto,
  CreateCategoryDto,
  CreateSubcategoryDto,
  ListCategoriesQueryDto,
  SubcategoryDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './dto/category.dto.js';

@ApiTags('categories')
@ApiCookieAuth('session')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ operationId: 'listCategories', summary: 'Categories with their sub-categories' })
  @ApiOkResponse({ type: [CategoryDto] })
  list(@CurrentUser() user: User, @Query() query: ListCategoriesQueryDto): Promise<CategoryDto[]> {
    return this.categories.list(user.id, query.type, query.includeArchived === 'true');
  }

  @Post()
  @ApiOperation({
    operationId: 'createCategory',
    summary: 'Create a category (with a "General" sub-category)',
  })
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'CATEGORY_NAME_TAKEN' })
  create(@CurrentUser() user: User, @Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateCategory', summary: 'Rename or reorder a category' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'CATEGORY_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'CATEGORY_NAME_TAKEN' })
  update(
    @CurrentUser() user: User,
    @IdParam('category') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(user.id, id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'archiveCategory', summary: 'Archive a category (history is kept)' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'CATEGORY_NOT_FOUND' })
  archive(@CurrentUser() user: User, @IdParam('category') id: string): Promise<CategoryDto> {
    return this.categories.archive(user.id, id);
  }

  @Post(':id/subcategories')
  @ApiOperation({ operationId: 'createSubcategory', summary: 'Add a sub-category' })
  @ApiCreatedResponse({ type: SubcategoryDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'CATEGORY_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'SUBCATEGORY_NAME_TAKEN' })
  createSubcategory(
    @CurrentUser() user: User,
    @IdParam('category') id: string,
    @Body() dto: CreateSubcategoryDto,
  ): Promise<SubcategoryDto> {
    return this.categories.createSubcategory(user.id, id, dto);
  }

  @Patch(':id/subcategories/:subId')
  @ApiOperation({
    operationId: 'updateSubcategory',
    summary: 'Rename a sub-category or toggle excludeFromInsights',
  })
  @ApiOkResponse({ type: SubcategoryDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'CATEGORY_NOT_FOUND / SUBCATEGORY_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'SUBCATEGORY_NAME_TAKEN' })
  updateSubcategory(
    @CurrentUser() user: User,
    @IdParam('category') id: string,
    @IdParam('subcategory', 'subId') subId: string,
    @Body() dto: UpdateSubcategoryDto,
  ): Promise<SubcategoryDto> {
    return this.categories.updateSubcategory(user.id, id, subId, dto);
  }

  @Delete(':id/subcategories/:subId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteSubcategory', summary: 'Delete an unused sub-category' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'CATEGORY_NOT_FOUND / SUBCATEGORY_NOT_FOUND' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'SUBCATEGORY_IN_USE / SUBCATEGORY_LAST' })
  deleteSubcategory(
    @CurrentUser() user: User,
    @IdParam('category') id: string,
    @IdParam('subcategory', 'subId') subId: string,
  ): Promise<void> {
    return this.categories.deleteSubcategory(user.id, id, subId);
  }
}
