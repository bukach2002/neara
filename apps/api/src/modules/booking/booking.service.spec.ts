import { BookingService } from './booking.service';
import { ConflictException } from '@nestjs/common';
import { BookingStatus, TenantStatus } from '@prisma/client';

describe('BookingService', () => {
  it('generates a 4-character uppercase booking code without ambiguous characters', () => {
    const service = new BookingService({} as never, {} as never, {} as never, {} as never);

    const code = service['randomCode']();

    expect(code).toMatch(/^[A-Z2-9]{4}$/);
    expect(code).not.toMatch(/[IO01]/);
  });

  it('logs and rejects a booking when the selected slot conflicts inside the transaction', async () => {
    const startsAt = new Date('2026-05-15T04:30:00.000Z');
    const tenant = {
      id: 'tenant-1',
      slug: 'near-beauty-studio',
      status: TenantStatus.active,
      timezone: 'Asia/Kolkata',
      bookingPrefix: 'NEAR',
      name: 'Near Beauty Studio',
      locations: [{ id: 'location-1', name: 'Main', addressLine: '12 MG Road', locality: 'Indiranagar', city: 'Bengaluru' }],
    };
    const serviceRow = { id: 'service-1', name: 'Haircut', durationMinutes: 45, displayPriceAmount: null, displayPriceCurrency: 'INR' };
    const prisma = {
      tenant: { findFirst: jest.fn().mockResolvedValue(tenant) },
      service: { findFirst: jest.fn().mockResolvedValue(serviceRow) },
      bookingAttemptLog: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          booking: {
            findFirst: jest.fn().mockResolvedValueOnce({ id: 'existing-booking' }),
          },
        }),
      ),
    };
    const scheduling = {
      getAvailableSlots: jest.fn().mockResolvedValue({
        items: [
          {
            startsAt,
            endsAt: new Date('2026-05-15T05:15:00.000Z'),
            expert: { id: 'expert-1', displayName: 'Expert One' },
          },
        ],
      }),
    };
    const service = new BookingService({} as never, {} as never, prisma as never, scheduling as never);

    await expect(
      service.createPublicBooking(
        'near-beauty-studio',
        {
          serviceId: 'service-1',
          expertId: 'expert-1',
          startsAt: startsAt.toISOString(),
          customerName: 'Customer One',
          customerPhone: '+919876543210',
          consentAccepted: true,
        },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(prisma.bookingAttemptLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        serviceId: 'service-1',
        expertId: 'expert-1',
        status: 'rejected',
        reason: 'conflict',
        sourceIp: '127.0.0.1',
      }),
    });
  });
});
