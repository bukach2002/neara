import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ObservabilityService } from './observability.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly observability: ObservabilityService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' };

    if (statusCode >= 500) {
      this.observability.captureException(exception, {
        method: request.method,
        path: request.originalUrl,
        statusCode,
      });
    }

    response.status(statusCode).json(typeof body === 'string' ? { message: body } : body);
  }
}
