import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ClientEventDto } from './dto/client-event.dto';
import { requestIdFrom } from './request-id';
import { StructuredLoggerService } from './structured-logger.service';

@ApiTags('Observability')
@Controller('observability')
export class ObservabilityController {
  constructor(private readonly logger: StructuredLoggerService) {}

  @Post('client-events')
  @ApiOkResponse({ description: 'Accepts sanitized browser operational events' })
  recordClientEvent(@Body() dto: ClientEventDto, @Req() request: Request) {
    const safeEvent = this.logger.redactUnsafeClientContext({
      ...dto,
      requestId: dto.requestId ?? requestIdFrom(request),
      ip: request.ip,
      userAgent: request.header('user-agent')?.slice(0, 160),
    });

    this.logger.event('warn', 'client.event.received', dto.message ?? dto.event, safeEvent);
    return { ok: true };
  }
}
