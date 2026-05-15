import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { NotificationService } from './modules/notification/notification.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const notifications = app.get(NotificationService);
    const result = await notifications.enqueueDueReminders();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

void bootstrap();
