import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOkResponse({ description: 'Application liveness probe' })
  health() {
    return this.healthService.basic();
  }

  @Get('health/dependencies')
  @ApiOkResponse({ description: 'Database, Redis, email, and storage readiness probe' })
  dependencies() {
    return this.healthService.dependencies();
  }
}
