import { BadRequestException } from '@nestjs/common';
import { BookingStatus, PlatformRole } from '@prisma/client';
import { TenantAdminService } from './tenant-admin.service';

function setup(apiKey = 'maps-key') {
  const audit = { record: jest.fn() };
  const notifications = { enqueueBookingCancelled: jest.fn() };
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Tenant One' }),
    },
    booking: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const config = { get: jest.fn().mockReturnValue(apiKey) };
  const service = new TenantAdminService(audit as never, notifications as never, prisma as never, {} as never, config as never);
  return { audit, config, notifications, prisma, service };
}

const auth = {
  sessionId: 'session-1',
  user: {
    id: 'tenant-user-1',
    email: 'tenant.admin@neara.local',
    mobileNumber: null,
    name: 'Tenant Admin',
    platformRole: PlatformRole.none,
    memberships: [],
  },
};

function booking(status: BookingStatus = BookingStatus.confirmed) {
  return {
    id: 'booking-1',
    tenantId: 'tenant-1',
    bookingReference: 'GLOW-1234',
    status,
    customerEmailSnapshot: 'customer@example.com',
    customerNameSnapshot: 'Customer One',
    tenantNameSnapshot: 'Greenford Glow Salon',
    serviceNameSnapshot: 'Classic Haircut',
    expertDisplayNameSnapshot: 'Maya Patel',
    displayTimeSnapshot: 'Tue, 19 May 2026, 10:00 AM GMT+1',
  };
}

describe('TenantAdminService geocoding', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a Google geocoding result into location fields', async () => {
    const { service } = setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: '12 MG Road, Bengaluru, Karnataka 560001, India',
            geometry: { location: { lat: 12.9716, lng: 77.5946 } },
            address_components: [
              { long_name: 'Bengaluru', short_name: 'Bengaluru', types: ['locality'] },
              { long_name: 'Karnataka', short_name: 'KA', types: ['administrative_area_level_1'] },
              { long_name: '560001', short_name: '560001', types: ['postal_code'] },
              { long_name: 'India', short_name: 'IN', types: ['country'] },
            ],
          },
        ],
      }),
    } as never);

    await expect(service.geocodeLocation('tenant-1', '12 MG Road Bengaluru')).resolves.toEqual({
      formattedAddress: '12 MG Road, Bengaluru, Karnataka 560001, India',
      latitude: 12.9716,
      longitude: 77.5946,
      locality: 'Bengaluru',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      countryCode: 'IN',
    });
  });

  it('rejects geocoding when Google Maps is not configured', async () => {
    const { service } = setup('');

    await expect(service.geocodeLocation('tenant-1', '12 MG Road Bengaluru')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancels confirmed bookings with audit and customer notification', async () => {
    const { audit, notifications, prisma, service } = setup();
    const before = booking();
    const after = { ...before, status: BookingStatus.cancelled, cancelledAt: new Date('2026-05-18T10:00:00Z') };
    prisma.booking.findFirst.mockResolvedValue(before);
    prisma.booking.update.mockResolvedValue(after);

    await expect(service.cancelBooking('tenant-1', 'booking-1', { reason: 'Closed early' }, auth, '127.0.0.1')).resolves.toBe(after);

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.cancelled, cancelledAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      actorUserId: 'tenant-user-1',
      actorRole: 'tenant_admin',
      action: 'booking.cancelled',
      summary: 'Marked booking cancelled: Closed early',
    }));
    expect(notifications.enqueueBookingCancelled).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      bookingId: 'booking-1',
      bookingReference: 'GLOW-1234',
      customerEmail: 'customer@example.com',
      customerName: 'Customer One',
      tenantName: 'Greenford Glow Salon',
      serviceName: 'Classic Haircut',
      expertName: 'Maya Patel',
      displayTime: 'Tue, 19 May 2026, 10:00 AM GMT+1',
    });
  });

  it('rejects cancelling bookings outside the confirmed state', async () => {
    const { audit, notifications, prisma, service } = setup();
    prisma.booking.findFirst.mockResolvedValue(booking(BookingStatus.completed));

    await expect(service.cancelBooking('tenant-1', 'booking-1', {}, auth)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(notifications.enqueueBookingCancelled).not.toHaveBeenCalled();
  });
});
