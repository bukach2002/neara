import { BookingService } from './booking.service';
import { ConflictException } from '@nestjs/common';
import { BookingStatus, Prisma, TenantStatus } from '@prisma/client';

describe('BookingService', () => {
  it('generates an 8-character uppercase booking code without ambiguous characters', () => {
    const service = new BookingService({} as never, {} as never, {} as never, {} as never);

    for (let index = 0; index < 50; index += 1) {
      const code = service['randomCode']();
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it('masks customer contact details for unauthenticated lookups', async () => {
    const audit = { record: jest.fn() };
    const prisma = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          bookingReference: 'NEAR-ABCD1234',
          status: BookingStatus.confirmed,
          customerNameSnapshot: 'Priya Sharma',
          customerPhoneSnapshot: '+919876543210',
          customerEmailSnapshot: 'priya@example.com',
          customerNote: 'Gate code 4411',
          customer: { userId: 'user-1' },
        }),
      },
    };
    const service = new BookingService(audit as never, {} as never, prisma as never, {} as never);

    const result = await service.lookupBooking({ reference: 'near-abcd1234', phone: '+919876543210' });

    expect(result.customerNameSnapshot).not.toBe('Priya Sharma');
    expect(result.customerPhoneSnapshot).not.toBe('+919876543210');
    expect(result.customerEmailSnapshot).toBeNull();
    expect(result.customerNote).toBeNull();
    expect(result).not.toHaveProperty('customer');
  });

  it('returns the complete record to the signed-in owner', async () => {
    const audit = { record: jest.fn() };
    const booking = {
      id: 'booking-1',
      bookingReference: 'NEAR-ABCD1234',
      status: BookingStatus.confirmed,
      customerNameSnapshot: 'Priya Sharma',
      customerPhoneSnapshot: '+919876543210',
      customerEmailSnapshot: 'priya@example.com',
      customerNote: 'Gate code 4411',
      customer: { userId: 'user-1' },
    };
    const prisma = { booking: { findFirst: jest.fn().mockResolvedValue(booking) } };
    const service = new BookingService(audit as never, {} as never, prisma as never, {} as never);

    const result = await service.lookupBooking(
      { reference: 'NEAR-ABCD1234', phone: '+919876543210' },
      { userId: 'user-1', mobileNumber: '+919876543210' },
    );

    expect(result.customerEmailSnapshot).toBe('priya@example.com');
    expect(result.customerNote).toBe('Gate code 4411');
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
    );
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

  it('maps database unique conflicts to a clean booking conflict response', async () => {
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
    const prisma = {
      tenant: { findFirst: jest.fn().mockResolvedValue(tenant) },
      service: { findFirst: jest.fn().mockResolvedValue({ id: 'service-1', name: 'Haircut', durationMinutes: 45 }) },
      bookingAttemptLog: { create: jest.fn() },
      $transaction: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      ),
    };
    const scheduling = {
      getAvailableSlots: jest.fn().mockResolvedValue({
        items: [{ startsAt, endsAt: new Date('2026-05-15T05:15:00.000Z'), expert: { id: 'expert-1', displayName: 'Expert One' } }],
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

    expect(prisma.bookingAttemptLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'rejected',
        reason: 'unique_constraint_conflict',
      }),
    });
  });
});
