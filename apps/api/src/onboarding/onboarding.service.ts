import { HttpStatus, Injectable } from '@nestjs/common';
import { CATEGORY_TEMPLATES, templateCategoryCreates } from '../categories/category-templates.js';
import { apiError } from '../common/errors.js';
import { toMinor } from '../common/money.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type MeDto, toMe } from '../users/dto/me.dto.js';
import type { CategoryTemplateDto, OnboardingDto } from './dto/onboarding.dto.js';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  templates(): CategoryTemplateDto[] {
    return CATEGORY_TEMPLATES.map((t) => ({ id: t.id, name: t.name, type: t.type, subs: [...t.subs] }));
  }

  async complete(userId: string, dto: OnboardingDto): Promise<MeDto> {
    let openingBalanceMinor: bigint;
    try {
      openingBalanceMinor = toMinor(dto.account.openingBalance, dto.baseCurrency);
    } catch (error) {
      throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_AMOUNT', (error as Error).message);
    }

    return this.prisma.$transaction(async (tx) => {
      // Claim onboarding atomically: the row lock makes a concurrent second call see onboardedAt set.
      const claimed = await tx.user.updateMany({
        where: { id: userId, onboardedAt: null },
        data: { onboardedAt: new Date(), baseCurrency: dto.baseCurrency },
      });
      if (claimed.count === 0) {
        throw apiError(HttpStatus.CONFLICT, 'ALREADY_ONBOARDED', 'Onboarding is already complete');
      }

      await tx.account.create({
        data: {
          userId,
          name: dto.account.name,
          kind: 'BANK',
          currency: dto.baseCurrency,
          openingBalanceMinor,
          sortOrder: 0,
        },
      });
      for (const data of templateCategoryCreates(userId, dto.categoryTemplateIds)) {
        await tx.category.create({ data });
      }
      return toMe(await tx.user.findUniqueOrThrow({ where: { id: userId } }));
    });
  }
}
