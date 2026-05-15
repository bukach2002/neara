import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, TenantStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { LookupBookingQueryDto } from './dto/lookup-booking-query.dto';

const BOOKING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class BookingService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
  ) {}

  async createPublicBooking(tenantSlug: string, dto: CreatePublicBookingDto, sourceIp?: string) {
    if (!dto.consentAccepted) {
      throw new BadRequestException('Consent is required to create a booking');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: tenantSlug, status: TenantStatus.active, archivedAt: null },
      include: {
        locations: { where: { isActive: true, archivedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      },
    });
    if (!tenant || !tenant.timezone) {
      throw new NotFoundException('Tenant not found');
    }
    const timezone = tenant.timezone;

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Invalid booking start time');
    }

    const availableSlots = await this.scheduling.getAvailableSlots({
      tenantSlug,
      serviceId: dto.serviceId,
      expertId: dto.expertId,
      date: DateTime.fromJSDate(startsAt).setZone(timezone).toISODate()!,
    });

    const matchingSlots = availableSlots.items.filter((slot) => slot.startsAt.getTime() === startsAt.getTime());
    if (matchingSlots.length === 0) {
      await this.logBookingAttempt(tenant.id, dto, startsAt, 'rejected', 'slot_not_available', sourceIp);
      throw new ConflictException('Selected slot is no longer available');
    }

    const selectedSlot = dto.expertId
      ? matchingSlots.find((slot) => slot.expert.id === dto.expertId)
      : await this.pickAutoAssignedSlot(tenant.id, matchingSlots, startsAt, timezone);

    if (!selectedSlot) {
      await this.logBookingAttempt(tenant.id, dto, startsAt, 'rejected', 'expert_not_available', sourceIp);
      throw new ConflictException('Selected expert is no longer available');
    }

    const location = tenant.locations[0];
    if (!location) {
      throw new BadRequestException('Tenant does not have an active booking location');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId: tenant.id, isActive: true, isPublic: true, archivedAt: null },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    try {
      const booking = await this.prisma.$transaction(
        async (tx) => {
          const existingConflict = await tx.booking.findFirst({
            where: {
              tenantId: tenant.id,
              expertId: selectedSlot.expert.id,
              startsAt,
              status: BookingStatus.confirmed,
            },
          });
          if (existingConflict) {
            throw new ConflictException('Selected slot is no longer available');
          }

          const duplicate = await tx.booking.findFirst({
            where: {
              tenantId: tenant.id,
              serviceId: dto.serviceId,
              expertId: selectedSlot.expert.id,
              startsAt,
              customerPhoneSnapshot: dto.customerPhone,
              status: BookingStatus.confirmed,
            },
          });
          if (duplicate) {
            throw new ConflictException('A matching active booking already exists');
          }

          const customer = await tx.customer.create({
            data: {
              tenantId: tenant.id,
              name: dto.customerName.trim(),
              phone: dto.customerPhone.trim(),
              email: dto.customerEmail?.trim().toLowerCase(),
            },
          });

          const bookingReference = await this.generateUniqueReference(tx, tenant.bookingPrefix);
          const displayTimeSnapshot = DateTime.fromJSDate(startsAt).setZone(timezone).toFormat('ccc, dd LLL yyyy, hh:mm a ZZZZ');

          return tx.booking.create({
            data: {
              bookingReference,
              tenantId: tenant.id,
              locationId: location.id,
              serviceId: service.id,
              expertId: selectedSlot.expert.id,
              customerId: customer.id,
              status: BookingStatus.confirmed,
              startsAt,
              endsAt: selectedSlot.endsAt,
              timezone,
              displayTimeSnapshot,
              tenantNameSnapshot: tenant.name,
              locationNameSnapshot: location.name,
              locationAddressSnapshot: `${location.addressLine}, ${location.locality}, ${location.city}`,
              serviceNameSnapshot: service.name,
              serviceDurationSnapshot: service.durationMinutes,
              servicePriceSnapshot: service.displayPriceAmount,
              serviceCurrencySnapshot: service.displayPriceCurrency,
              expertDisplayNameSnapshot: selectedSlot.expert.displayName,
              customerNameSnapshot: dto.customerName.trim(),
              customerPhoneSnapshot: dto.customerPhone.trim(),
              customerEmailSnapshot: dto.customerEmail?.trim().toLowerCase(),
              customerNote: dto.customerNote?.trim(),
              consentAcceptedAt: new Date(),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.audit.record({
        tenantId: tenant.id,
        actorRole: 'customer',
        entityType: 'booking',
        entityId: booking.id,
        action: 'booking.create',
        summary: `Customer booking ${booking.bookingReference} created`,
        after: this.asJson({
          id: booking.id,
          bookingReference: booking.bookingReference,
          startsAt: booking.startsAt,
          status: booking.status,
        }),
        sourceIp,
      });

      const tenantAdmins = await this.prisma.tenantMembership.findMany({
        where: { tenantId: tenant.id, role: { in: ['owner', 'admin'] } },
        include: { user: true },
      });

      await this.notifications.enqueueBookingCreated({
        tenantId: tenant.id,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        customerEmail: booking.customerEmailSnapshot,
        customerName: booking.customerNameSnapshot,
        tenantName: booking.tenantNameSnapshot,
        serviceName: booking.serviceNameSnapshot,
        expertName: booking.expertDisplayNameSnapshot,
        displayTime: booking.displayTimeSnapshot,
        tenantAdminEmails: tenantAdmins.map((membership) => membership.user.email),
      });

      return booking;
    } catch (error) {
      if (error instanceof ConflictException) {
        await this.logBookingAttempt(tenant.id, dto, startsAt, 'rejected', 'conflict', sourceIp);
        throw error;
      }

      if (this.isUniqueConstraintError(error)) {
        await this.logBookingAttempt(tenant.id, dto, startsAt, 'rejected', 'unique_constraint_conflict', sourceIp);
        throw new ConflictException('Selected slot is no longer available');
      }

      throw error;
    }
  }

  async lookupBooking(query: LookupBookingQueryDto) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        bookingReference: query.reference.trim().toUpperCase(),
        customerPhoneSnapshot: query.phone.trim(),
      },
      select: {
        id: true,
        bookingReference: true,
        status: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        displayTimeSnapshot: true,
        tenantNameSnapshot: true,
        locationNameSnapshot: true,
        locationAddressSnapshot: true,
        serviceNameSnapshot: true,
        serviceDurationSnapshot: true,
        servicePriceSnapshot: true,
        serviceCurrencySnapshot: true,
        expertDisplayNameSnapshot: true,
        customerNameSnapshot: true,
        customerPhoneSnapshot: true,
        customerEmailSnapshot: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private async pickAutoAssignedSlot(
    tenantId: string,
    slots: Array<{ startsAt: Date; endsAt: Date; expert: { id: string; displayName: string } }>,
    startsAt: Date,
    timezone: string,
  ) {
    const dayStart = DateTime.fromJSDate(startsAt).setZone(timezone).startOf('day').toUTC().toJSDate();
    const dayEnd = DateTime.fromJSDate(startsAt).setZone(timezone).plus({ days: 1 }).startOf('day').toUTC().toJSDate();
    const counts = await this.prisma.booking.groupBy({
      by: ['expertId'],
      where: {
        tenantId,
        expertId: { in: slots.map((slot) => slot.expert.id) },
        status: BookingStatus.confirmed,
        startsAt: { gte: dayStart, lt: dayEnd },
      },
      _count: { _all: true },
    });
    const countByExpert = new Map(counts.map((count) => [count.expertId, count._count._all]));
    return [...slots].sort((left, right) => {
      const countDiff = (countByExpert.get(left.expert.id) ?? 0) - (countByExpert.get(right.expert.id) ?? 0);
      if (countDiff !== 0) return countDiff;
      const nameDiff = left.expert.displayName.localeCompare(right.expert.displayName);
      return nameDiff !== 0 ? nameDiff : left.expert.id.localeCompare(right.expert.id);
    })[0];
  }

  private async generateUniqueReference(tx: Prisma.TransactionClient, prefix: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const reference = `${prefix}-${this.randomCode()}`;
      const existing = await tx.booking.findUnique({ where: { bookingReference: reference } });
      if (!existing) return reference;
    }
    throw new ConflictException('Could not generate a unique booking reference');
  }

  private randomCode() {
    let code = '';
    for (let index = 0; index < 4; index += 1) {
      code += BOOKING_CODE_ALPHABET[Math.floor(Math.random() * BOOKING_CODE_ALPHABET.length)];
    }
    return code;
  }

  private logBookingAttempt(
    tenantId: string,
    dto: CreatePublicBookingDto,
    startsAt: Date,
    status: string,
    reason: string,
    sourceIp?: string,
  ) {
    return this.prisma.bookingAttemptLog.create({
      data: {
        tenantId,
        serviceId: dto.serviceId,
        expertId: dto.expertId,
        startsAt,
        status,
        reason,
        customerName: dto.customerName?.trim(),
        customerPhone: dto.customerPhone?.trim(),
        customerEmail: dto.customerEmail?.trim().toLowerCase(),
        customerNote: dto.customerNote?.trim(),
        sourceIp,
      },
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private asJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
