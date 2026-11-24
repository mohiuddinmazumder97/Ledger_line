import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { type MeDto, toMe } from './dto/me.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<MeDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        baseCurrency: dto.baseCurrency,
        theme: dto.theme,
        dashboardLayout: dto.dashboardLayout,
        // undefined = leave as is; null = back to the client default.
        drawerStyle: dto.drawerStyle,
        timezone: dto.timezone,
      },
    });
    return toMe(user);
  }
}
