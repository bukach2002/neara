import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AvailabilityExceptionType, BookingStatus, TenantStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';

type SlotLookupInput = {
  tenantSlug: string;
  serviceId: string;
  date: string;
  expertId?: string;
};

type CandidateSlot = {
  startsAt: Date;
  endsAt: Date;
  displayTime: string;
  expert: {
    id: string;
    displayName: string;
    photoUrl: string | null;
    shortBio: string | null;
  };
};

const SLOT_INTERVAL_MINUTES = 15;
const MIN_NOTICE_HOURS = 2;
const ADVANCE_BOOKING_DAYS = 30;

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableSlots(input: SlotLookupInput) {
    const date = DateTime.fromISO(input.date, { zone: 'utc' });
    if (!date.isValid) {
      throw new BadRequestException('Date must be ISO formatted');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: input.tenantSlug, status: TenantStatus.active, archivedAt: null },
      include: {
        services: {
          where: { id: input.serviceId, isActive: true, isPublic: true, archivedAt: null },
        },
        experts: {
          where: {
            id: input.expertId,
            isActive: true,
            archivedAt: null,
            expertServices: { some: { serviceId: input.serviceId, isActive: true } },
          },
          orderBy: { displayName: 'asc' },
        },
      },
    });

    if (!tenant || !tenant.timezone) {
      throw new NotFoundException('Tenant not found');
    }

    const service = tenant.services[0];
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (tenant.experts.length === 0) {
      return { items: [], meta: this.meta(tenant.timezone) };
    }

    const targetDay = DateTime.fromISO(input.date.slice(0, 10), { zone: tenant.timezone }).startOf('day');
    if (!targetDay.isValid) {
      throw new BadRequestException('Date is invalid for tenant timezone');
    }

    this.assertWithinBookingWindow(targetDay, tenant.timezone);

    const [rules, exceptions, bookings] = await Promise.all([
      this.prisma.availabilityRule.findMany({
        where: { tenantId: tenant.id, expertId: { in: tenant.experts.map((expert) => expert.id) }, isActive: true },
      }),
      this.prisma.availabilityException.findMany({
        where: {
          tenantId: tenant.id,
          expertId: { in: tenant.experts.map((expert) => expert.id) },
          startsOn: { lte: targetDay.toJSDate() },
          endsOn: { gte: targetDay.toJSDate() },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          tenantId: tenant.id,
          expertId: { in: tenant.experts.map((expert) => expert.id) },
          status: BookingStatus.confirmed,
          startsAt: { lt: targetDay.plus({ days: 1 }).toUTC().toJSDate() },
          endsAt: { gt: targetDay.toUTC().toJSDate() },
        },
      }),
    ]);

    const slots = tenant.experts.flatMap((expert) =>
      this.generateExpertSlots({
        timezone: tenant.timezone!,
        targetDay,
        serviceDurationMinutes: service.durationMinutes,
        expert,
        rules: rules.filter((rule) => rule.expertId === expert.id),
        exceptions: exceptions.filter((exception) => exception.expertId === expert.id),
        bookings: bookings.filter((booking) => booking.expertId === expert.id),
      }),
    );

    slots.sort((left, right) => {
      const diff = left.startsAt.getTime() - right.startsAt.getTime();
      return diff !== 0 ? diff : left.expert.displayName.localeCompare(right.expert.displayName);
    });

    return {
      items: slots,
      meta: this.meta(tenant.timezone),
    };
  }

  private generateExpertSlots(input: {
    timezone: string;
    targetDay: DateTime;
    serviceDurationMinutes: number;
    expert: { id: string; displayName: string; photoUrl: string | null; shortBio: string | null };
    rules: Array<{ dayOfWeek: number; startLocalTime: string; endLocalTime: string }>;
    exceptions: Array<{
      type: AvailabilityExceptionType;
      startLocalTime: string | null;
      endLocalTime: string | null;
    }>;
    bookings: Array<{ startsAt: Date; endsAt: Date }>;
  }): CandidateSlot[] {
    const windows = this.windowsForDay(input);
    const blockWindows = input.exceptions
      .filter((exception) => exception.type === AvailabilityExceptionType.block)
      .map((exception) => this.windowFromLocalTimes(input.targetDay, input.timezone, exception.startLocalTime, exception.endLocalTime))
      .filter((window): window is { start: DateTime; end: DateTime } => Boolean(window));

    const now = DateTime.now().setZone(input.timezone);
    const minimumStart = now.plus({ hours: MIN_NOTICE_HOURS });

    return windows.flatMap((window) => {
      const slots: CandidateSlot[] = [];
      let cursor = window.start;

      while (cursor.plus({ minutes: input.serviceDurationMinutes }) <= window.end) {
        const slotEnd = cursor.plus({ minutes: input.serviceDurationMinutes });
        const isValidLocalTime = cursor.isValid && slotEnd.isValid;
        const satisfiesNotice = cursor >= minimumStart;
        const overlapsBlock = blockWindows.some((block) => cursor < block.end && slotEnd > block.start);
        const overlapsBooking = input.bookings.some((booking) => cursor.toUTC().toJSDate() < booking.endsAt && slotEnd.toUTC().toJSDate() > booking.startsAt);

        if (isValidLocalTime && satisfiesNotice && !overlapsBlock && !overlapsBooking) {
          slots.push({
            startsAt: cursor.toUTC().toJSDate(),
            endsAt: slotEnd.toUTC().toJSDate(),
            displayTime: cursor.toFormat('ccc, dd LLL yyyy, hh:mm a ZZZZ'),
            expert: input.expert,
          });
        }

        cursor = cursor.plus({ minutes: SLOT_INTERVAL_MINUTES });
      }

      return slots;
    });
  }

  private windowsForDay(input: {
    timezone: string;
    targetDay: DateTime;
    rules: Array<{ dayOfWeek: number; startLocalTime: string; endLocalTime: string }>;
    exceptions: Array<{ type: AvailabilityExceptionType; startLocalTime: string | null; endLocalTime: string | null }>;
  }) {
    const overrides = input.exceptions.filter((exception) => exception.type === AvailabilityExceptionType.override);
    const sourceWindows =
      overrides.length > 0
        ? overrides.map((override) => ({ startLocalTime: override.startLocalTime, endLocalTime: override.endLocalTime }))
        : input.rules
            .filter((rule) => rule.dayOfWeek === input.targetDay.weekday % 7)
            .map((rule) => ({ startLocalTime: rule.startLocalTime, endLocalTime: rule.endLocalTime }));

    return sourceWindows
      .map((window) => this.windowFromLocalTimes(input.targetDay, input.timezone, window.startLocalTime, window.endLocalTime))
      .filter((window): window is { start: DateTime; end: DateTime } => Boolean(window));
  }

  private windowFromLocalTimes(targetDay: DateTime, timezone: string, startLocalTime: string | null, endLocalTime: string | null) {
    const start = startLocalTime ?? '00:00';
    const end = endLocalTime ?? '23:59';
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const startDateTime = targetDay.setZone(timezone).set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
    const endDateTime = targetDay.setZone(timezone).set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });

    if (!startDateTime.isValid || !endDateTime.isValid || endDateTime <= startDateTime) {
      return null;
    }

    return { start: startDateTime, end: endDateTime };
  }

  private assertWithinBookingWindow(targetDay: DateTime, timezone: string) {
    const today = DateTime.now().setZone(timezone).startOf('day');
    if (targetDay < today) {
      throw new BadRequestException('Date is in the past');
    }
    if (targetDay > today.plus({ days: ADVANCE_BOOKING_DAYS })) {
      throw new BadRequestException('Date exceeds the 30-day advance booking window');
    }
  }

  private meta(timezone: string) {
    return {
      timezone,
      slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
      minimumNoticeHours: MIN_NOTICE_HOURS,
      advanceBookingDays: ADVANCE_BOOKING_DAYS,
    };
  }
}
