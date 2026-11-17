import { Controller, Get } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API health status' })
  @ApiOkResponse({ description: 'API is healthy' })
  checkHealth() {
    return {
      success: true,
      data: {
        status: 'ok',
        service: 'HadiMed API',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
