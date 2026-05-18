import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { AppModule } from './modules/app.module';
import { NotificationService } from './modules/notification/notification.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const config = app.get(ConfigService);
  const notifications = app.get(NotificationService);
  const connection = new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
    maxRetriesPerRequest: null,
  });
  connection.on('error', (error) => {
    console.error('Redis worker connection error', error instanceof Error ? error.message : error);
  });

  const worker = new Worker(
    'notifications',
    async (job) => {
      if (job.name === 'send-email') {
        await notifications.processEmailNotification(job.data.notificationLogId);
      }
    },
    { connection },
  );

  worker.on('completed', (job) => {
    console.log(`Notification job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`Notification job ${job?.id ?? 'unknown'} failed`, error);
  });

  worker.on('error', (error) => {
    console.error('Notification worker error', error instanceof Error ? error.message : error);
  });

  const shutdown = async () => {
    await worker.close();
    await connection.quit();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void bootstrap();
