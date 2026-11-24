import { ApiProperty } from '@nestjs/swagger';
import { DashboardLayout, DrawerStyle, Theme } from '../../generated/prisma/enums.js';
import type { User } from '../../generated/prisma/client.js';

export class MeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Alex Moreno' })
  name!: string;

  @ApiProperty({ format: 'email', example: 'alex@example.com' })
  email!: string;

  @ApiProperty({ example: 'USD', description: 'ISO-4217 code' })
  baseCurrency!: string;

  @ApiProperty({ enum: Theme, enumName: 'Theme' })
  theme!: Theme;

  @ApiProperty({ enum: DashboardLayout, enumName: 'DashboardLayout' })
  dashboardLayout!: DashboardLayout;

  @ApiProperty({
    enum: DrawerStyle,
    enumName: 'DrawerStyle',
    nullable: true,
    type: String,
    description: 'null = client default (web: FORM, mobile: KEYPAD)',
  })
  drawerStyle!: DrawerStyle | null;

  @ApiProperty({ example: 'America/New_York', description: 'IANA time zone' })
  timezone!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  onboardedAt!: Date | null;
}

/** The only place a User row becomes an API shape — never leaks passwordHash. */
export function toMe(user: User): MeDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    baseCurrency: user.baseCurrency,
    theme: user.theme,
    dashboardLayout: user.dashboardLayout,
    drawerStyle: user.drawerStyle,
    timezone: user.timezone,
    onboardedAt: user.onboardedAt,
  };
}
