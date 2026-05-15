import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { BookingService } from './booking.service';

@Module({
  imports: [AuditModule, NotificationModule, SchedulingModule],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
