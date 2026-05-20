import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';

type ErrorContext = {
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  tenantId?: string;
};

@Injectable()
export class ObservabilityService {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {}

  captureException(error: unknown, context: ErrorContext = {}) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.event('error', 'exception.captured', message, { ...context, stack });

    const webhookUrl = this.config.get<string>('ERROR_TRACKING_WEBHOOK_URL', '');
    if (!webhookUrl) return;

    void fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message,
        stack,
        context,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  }
}
