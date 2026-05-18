import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { NotificationModule } from './notification/notification.module';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { appConfigSchema } from '../support/config.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env', '../../.env'],
      validate: (env) => appConfigSchema.parse(env),
    }),
    PrismaModule,
    AuthModule,
    NotificationModule,
    ObservabilityModule,
    RateLimitModule,
    HealthModule,
    PublicModule,
    AdminModule,
  ],
})
export class AppModule {}
