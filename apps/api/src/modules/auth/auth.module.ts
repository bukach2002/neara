import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfService } from './csrf.service';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { TenantAdminGuard } from './guards/tenant-admin.guard';

@Module({
  imports: [NotificationModule, RateLimitModule],
  controllers: [AuthController, CustomerAuthController],
  providers: [AuthService, CsrfService, CustomerAuthService, PlatformAdminGuard, TenantAdminGuard],
  exports: [AuthService, CsrfService, CustomerAuthService, PlatformAdminGuard, TenantAdminGuard],
})
export class AuthModule {}
