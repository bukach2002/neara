import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingModule } from '../booking/booking.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [AuthModule, BookingModule, RateLimitModule, SchedulingModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
