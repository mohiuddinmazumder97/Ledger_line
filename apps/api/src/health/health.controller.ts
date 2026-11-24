import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ operationId: 'getHealth', summary: 'Liveness check' })
  @ApiOkResponse({ type: HealthDto })
  getHealth(): HealthDto {
    return { status: 'ok' };
  }
}
