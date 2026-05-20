import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { NotificationService } from './modules/notification/notification.service';
import { StructuredLoggerService } from './modules/observability/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const logger = app.get(StructuredLoggerService);
  app.useLogger(logger);
  try {
    const notifications = app.get(NotificationService);
    const result = await notifications.enqueueDueReminders();
    logger.event('info', 'reminders.enqueue.completed', 'Reminder enqueue command completed', result);
  } finally {
    await app.close();
  }
}

void bootstrap();
