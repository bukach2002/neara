import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ErrorContext = {
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  tenantId?: string;
};

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(private readonly config: ConfigService) {}

  captureException(error: unknown, context: ErrorContext = {}) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error({ message, ...context }, stack);

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
