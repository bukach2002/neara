import { BadRequestException } from '@nestjs/common';
import { BookingStatus, PlatformRole } from '@prisma/client';
import { PlatformAdminService } from './platform-admin.service';

const auth = {
  sessionId: 'session-1',
  user: {
    id: 'platform-user-1',
    email: 'platform.admin@neara.local',
    name: 'Platform Admin',
    platformRole: PlatformRole.platform_admin,
    memberships: [],
  },
};

function booking(status: BookingStatus = BookingStatus.confirmed) {
  return {
    id: 'booking-1',
    tenantId: 'tenant-1',
    bookingReference: 'NEAR-7A2K',
    status,
    customerEmailSnapshot: 'customer@example.com',
    customerNameSnapshot: 'Customer One',
    tenantNameSnapshot: 'Neara Studio',
    serviceNameSnapshot: 'Haircut',
    expertDisplayNameSnapshot: 'Expert One',
    displayTimeSnapshot: '15 May 2026, 10:00',
  };
}

function setup() {
  const audit = { record: jest.fn() };
  const notifications = { enqueueBookingCancelled: jest.fn() };
  const prisma = {
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new PlatformAdminService(audit as never, notifications as never, prisma as never);
  return { audit, notifications, prisma, service };
}

describe('PlatformAdminService booking operations', () => {
  it('lists bookings with tenant, status, date, and search filters', async () => {
    const { prisma, service } = setup();
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);

    await service.listBookings({
      tenantId: 'tenant-1',
      status: BookingStatus.confirmed,
      from: '2026-05-15',
      to: '2026-05-15',
      search: 'NEAR',
      take: 20,
      skip: 5,
    });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { startsAt: 'desc' },
        take: 20,
        skip: 5,
        include: expect.objectContaining({
          tenant: { select: { id: true, name: true, slug: true } },
        }),
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: BookingStatus.confirmed,
          startsAt: {
            gte: new Date('2026-05-15'),
            lte: new Date('2026-05-15T23:59:59.999Z'),
          },
          OR: expect.arrayContaining([
            { bookingReference: { contains: 'NEAR', mode: 'insensitive' } },
            { customerNameSnapshot: { contains: 'NEAR', mode: 'insensitive' } },
          ]),
        }),
      }),
    );
    expect(prisma.booking.count).toHaveBeenCalledWith({ where: prisma.booking.findMany.mock.calls[0][0].where });
  });

  it('cancels confirmed bookings with audit and customer notification', async () => {
    const { audit, notifications, prisma, service } = setup();
    const before = booking();
    const after = { ...before, status: BookingStatus.cancelled, cancelledAt: new Date('2026-05-14T10:00:00Z') };
    prisma.booking.findUnique.mockResolvedValue(before);
    prisma.booking.update.mockResolvedValue(after);

    await expect(service.cancelBooking('booking-1', { reason: 'Tenant closed' }, auth, '127.0.0.1')).resolves.toBe(after);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.cancelled, cancelledAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'platform-user-1',
        actorRole: 'platform_admin',
        action: 'booking.cancelled',
        summary: 'Cancelled booking as platform admin: Tenant closed',
        sourceIp: '127.0.0.1',
      }),
    );
    expect(notifications.enqueueBookingCancelled).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      bookingId: 'booking-1',
      bookingReference: 'NEAR-7A2K',
      customerEmail: 'customer@example.com',
      customerName: 'Customer One',
      tenantName: 'Neara Studio',
      serviceName: 'Haircut',
      expertName: 'Expert One',
      displayTime: '15 May 2026, 10:00',
    });
  });

  it('rejects cancellation when a booking is no longer confirmed', async () => {
    const { audit, notifications, prisma, service } = setup();
    prisma.booking.findUnique.mockResolvedValue(booking(BookingStatus.completed));

    await expect(service.cancelBooking('booking-1', {}, auth)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(notifications.enqueueBookingCancelled).not.toHaveBeenCalled();
  });
});
