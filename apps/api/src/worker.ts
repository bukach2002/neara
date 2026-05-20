import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { AppModule } from './modules/app.module';
import { NotificationService } from './modules/notification/notification.service';
import { StructuredLoggerService } from './modules/observability/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const logger = app.get(StructuredLoggerService);
  app.useLogger(logger);
  const config = app.get(ConfigService);
  const notifications = app.get(NotificationService);
  const connection = new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
    maxRetriesPerRequest: null,
  });
  connection.on('error', (error) => {
    logger.event('error', 'worker.redis.error', error instanceof Error ? error.message : 'Redis worker connection error', {
      stack: error instanceof Error ? error.stack : undefined,
    });
  });

  logger.event('info', 'worker.started', 'Notification worker started', { queue: 'notifications' });

  const worker = new Worker(
    'notifications',
    async (job) => {
      if (job.name === 'send-email') {
        logger.event('info', 'worker.job.started', 'Notification job started', {
          jobId: job.id,
          jobName: job.name,
          notificationLogId: job.data.notificationLogId,
        });
        await notifications.processEmailNotification(job.data.notificationLogId);
      }
    },
    { connection },
  );

  worker.on('completed', (job) => {
    logger.event('info', 'worker.job.completed', 'Notification job completed', {
      jobId: job.id,
      jobName: job.name,
    });
  });

  worker.on('failed', (job, error) => {
    logger.event('error', 'worker.job.failed', error.message, {
      jobId: job?.id,
      jobName: job?.name,
      stack: error.stack,
    });
  });

  worker.on('error', (error) => {
    logger.event('error', 'worker.error', error instanceof Error ? error.message : 'Notification worker error', {
      stack: error instanceof Error ? error.stack : undefined,
    });
  });

  const shutdown = async () => {
    logger.event('info', 'worker.stopping', 'Notification worker stopping');
    await worker.close();
    await connection.quit();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void bootstrap();
