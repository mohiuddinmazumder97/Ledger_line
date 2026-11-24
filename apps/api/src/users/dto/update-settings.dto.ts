import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, ValidateIf } from 'class-validator';
import { DashboardLayout, DrawerStyle, Theme } from '../../generated/prisma/enums.js';
import { IsTimeZone, SUPPORTED_CURRENCIES } from '../../common/validators.js';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, example: 'EUR' })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  baseCurrency?: string;

  @ApiPropertyOptional({ enum: Theme, enumName: 'Theme' })
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @ApiPropertyOptional({ enum: DashboardLayout, enumName: 'DashboardLayout' })
  @IsOptional()
  @IsEnum(DashboardLayout)
  dashboardLayout?: DashboardLayout;

  @ApiPropertyOptional({
    enum: DrawerStyle,
    enumName: 'DrawerStyle',
    nullable: true,
    type: String,
    description: 'null resets to the client default',
  })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsEnum(DrawerStyle)
  drawerStyle?: DrawerStyle | null;

  @ApiPropertyOptional({ example: 'Asia/Dhaka' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
