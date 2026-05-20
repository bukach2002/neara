import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';
import { RequestLoggingMiddleware } from './request-logging.middleware';
import { StructuredLoggerService } from './structured-logger.service';

@Global()
@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityService, RequestLoggingMiddleware, StructuredLoggerService],
  exports: [ObservabilityService, StructuredLoggerService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
