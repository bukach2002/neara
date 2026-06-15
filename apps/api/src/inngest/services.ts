import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../modules/prisma/prisma.service';
import { StructuredLoggerService } from '../modules/observability/structured-logger.service';
import { NotificationService } from '../modules/notification/notification.service';
import { appConfigSchema } from '../support/config.schema';

let services: {
  config: ConfigService;
  logger: StructuredLoggerService;
  prisma: PrismaService;
  notifications: NotificationService;
} | null = null;

export function getInngestServices() {
  if (!services) {
    const parsedConfig = appConfigSchema.parse(process.env);
    const config = new ConfigService(parsedConfig);
    const logger = new StructuredLoggerService(config);
    const prisma = new PrismaService();
    services = {
      config,
      logger,
      prisma,
      notifications: new NotificationService(config, prisma, logger),
    };
  }
  return services;
}
