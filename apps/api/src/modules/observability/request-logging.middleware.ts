import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { AUTH_CONTEXT_REQUEST_KEY } from '../auth/types';
import { REQUEST_ID_HEADER } from './request-id';
import { StructuredLoggerService } from './structured-logger.service';

const TRUSTED_REQUEST_ID = /^[a-zA-Z0-9._:-]{8,128}$/;

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLoggerService) {}

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = process.hrtime.bigint();
    const incomingRequestId = request.header(REQUEST_ID_HEADER);
    const requestId = incomingRequestId && TRUSTED_REQUEST_ID.test(incomingRequestId) ? incomingRequestId : randomUUID();
    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const statusCode = response.statusCode;
      const auth = request[AUTH_CONTEXT_REQUEST_KEY];
      const tenantId = auth?.user.memberships[0]?.tenantId;
      const level = statusCode >= 500 ? 'error' : [401, 403, 429].includes(statusCode) ? 'warn' : 'info';

      this.logger.event(level, 'http.request.completed', `${request.method} ${request.originalUrl} ${statusCode}`, {
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode,
        durationMs: Math.round(durationMs),
        ip: this.clientIp(request),
        userId: auth?.user.id,
        tenantId,
      });
    });

    next();
  }

  private clientIp(request: Request) {
    return request.header('x-forwarded-for')?.split(',')[0]?.trim() || request.ip || request.socket.remoteAddress || 'unknown';
  }
}
