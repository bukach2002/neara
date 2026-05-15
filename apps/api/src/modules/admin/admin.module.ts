import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { UploadModule } from '../upload/upload.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { TenantAdminController } from './tenant-admin.controller';
import { TenantAdminService } from './tenant-admin.service';

@Module({
  imports: [AuthModule, AuditModule, NotificationModule, UploadModule],
  controllers: [PlatformAdminController, TenantAdminController],
  providers: [PlatformAdminService, TenantAdminService],
})
export class AdminModule {}
