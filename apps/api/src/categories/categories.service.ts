import { HttpStatus, Injectable } from '@nestjs/common';
import { apiError } from '../common/errors.js';
import type { Category, Subcategory } from '../generated/prisma/client.js';
import type { CategoryType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CategoryDto,
  CreateCategoryDto,
  CreateSubcategoryDto,
  SubcategoryDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './dto/category.dto.js';

const categoryNotFound = () => apiError(HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND', 'category not found');
const subcategoryNotFound = () =>
  apiError(HttpStatus.NOT_FOUND, 'SUBCATEGORY_NOT_FOUND', 'subcategory not found');

const SUBS = { subcategories: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] } };

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    type: CategoryType | undefined,
    includeArchived: boolean,
  ): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId, ...(type ? { type } : {}), ...(includeArchived ? {} : { archivedAt: null }) },
      include: SUBS,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return categories.map(toCategoryDto);
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    await this.assertCategoryNameFree(userId, dto.type, dto.name);
    const last = await this.prisma.category.aggregate({
      where: { userId, type: dto.type },
      _max: { sortOrder: true },
    });
    const category = await this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        subcategories: { create: [{ userId, name: 'General', sortOrder: 0 }] },
      },
      include: SUBS,
    });
    return toCategoryDto(category);
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const category = await this.findOwned(userId, id);
    if (dto.name !== undefined && dto.name.toLowerCase() !== category.name.toLowerCase()) {
      await this.assertCategoryNameFree(userId, category.type, dto.name, id);
    }
    const updated = await this.prisma.category.update({
      where: { id },
      data: { name: dto.name, sortOrder: dto.sortOrder },
      include: SUBS,
    });
    return toCategoryDto(updated);
  }

  /** Archived categories disappear from pickers; their history stays. */
  async archive(userId: string, id: string): Promise<CategoryDto> {
    const category = await this.findOwned(userId, id);
    const updated = await this.prisma.category.update({
      where: { id },
      data: { archivedAt: category.archivedAt ?? new Date() },
      include: SUBS,
    });
    return toCategoryDto(updated);
  }

  async createSubcategory(
    userId: string,
    categoryId: string,
    dto: CreateSubcategoryDto,
  ): Promise<SubcategoryDto> {
    await this.findOwned(userId, categoryId);
    await this.assertSubcategoryNameFree(categoryId, dto.name);
    const last = await this.prisma.subcategory.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    });
    const sub = await this.prisma.subcategory.create({
      data: { userId, categoryId, name: dto.name, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    return toSubcategoryDto(sub);
  }

  async updateSubcategory(
    userId: string,
    categoryId: string,
    subId: string,
    dto: UpdateSubcategoryDto,
  ): Promise<SubcategoryDto> {
    const sub = await this.findOwnedSub(userId, categoryId, subId);
    if (dto.name !== undefined && dto.name.toLowerCase() !== sub.name.toLowerCase()) {
      await this.assertSubcategoryNameFree(categoryId, dto.name, subId);
    }
    const updated = await this.prisma.subcategory.update({
      where: { id: subId },
      data: { name: dto.name, excludeFromInsights: dto.excludeFromInsights },
    });
    return toSubcategoryDto(updated);
  }

  /** Only unused sub-categories can be deleted (ledger rows, even soft-deleted ones, point at them). */
  async deleteSubcategory(userId: string, categoryId: string, subId: string): Promise<void> {
    await this.findOwnedSub(userId, categoryId, subId);
    const [txCount, ruleCount, siblings] = await Promise.all([
      this.prisma.transaction.count({ where: { subcategoryId: subId } }),
      this.prisma.recurringRule.count({ where: { subcategoryId: subId } }),
      this.prisma.subcategory.count({ where: { categoryId } }),
    ]);
    if (txCount + ruleCount > 0) {
      throw apiError(
        HttpStatus.CONFLICT,
        'SUBCATEGORY_IN_USE',
        'This sub-category has transactions and cannot be deleted',
      );
    }
    if (siblings <= 1) {
      throw apiError(HttpStatus.CONFLICT, 'SUBCATEGORY_LAST', 'A category needs at least one sub-category');
    }
    await this.prisma.subcategory.delete({ where: { id: subId } });
  }

  private async findOwned(userId: string, id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!category) throw categoryNotFound();
    return category;
  }

  private async findOwnedSub(userId: string, categoryId: string, subId: string): Promise<Subcategory> {
    await this.findOwned(userId, categoryId);
    const sub = await this.prisma.subcategory.findFirst({ where: { id: subId, categoryId, userId } });
    if (!sub) throw subcategoryNotFound();
    return sub;
  }

  private async assertCategoryNameFree(userId: string, type: CategoryType, name: string, exceptId?: string) {
    const clash = await this.prisma.category.findFirst({
      where: {
        userId,
        type,
        archivedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw apiError(HttpStatus.CONFLICT, 'CATEGORY_NAME_TAKEN', `A category named "${name}" already exists`);
    }
  }

  private async assertSubcategoryNameFree(categoryId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.subcategory.findFirst({
      where: {
        categoryId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw apiError(
        HttpStatus.CONFLICT,
        'SUBCATEGORY_NAME_TAKEN',
        `A sub-category named "${name}" already exists in this category`,
      );
    }
  }
}

function toSubcategoryDto(s: Subcategory): SubcategoryDto {
  return { id: s.id, name: s.name, sortOrder: s.sortOrder, excludeFromInsights: s.excludeFromInsights };
}

function toCategoryDto(c: Category & { subcategories: Subcategory[] }): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    sortOrder: c.sortOrder,
    archivedAt: c.archivedAt,
    subcategories: c.subcategories.map(toSubcategoryDto),
  };
}
