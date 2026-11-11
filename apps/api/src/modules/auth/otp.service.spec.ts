import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { OtpService } from './otp.service';

type Row = {
  id: string;
  userId: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
  tokenHash: string;
  recipient: string | null;
  attempts: number;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
};

function setup() {
  const rows: Row[] = [];
  const prisma = {
    otpToken: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter(
          (row) =>
            row.userId === where.userId &&
            row.purpose === where.purpose &&
            row.channel === where.channel &&
            (where.consumedAt === null ? row.consumedAt === null : true),
        ),
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = {
          id: `otp-${rows.length + 1}`,
          userId: data.userId as string,
          purpose: data.purpose as OtpPurpose,
          channel: data.channel as OtpChannel,
          tokenHash: data.tokenHash as string,
          recipient: (data.recipient as string) ?? null,
          attempts: 0,
          consumedAt: null,
          expiresAt: data.expiresAt as Date,
          createdAt: new Date(),
        };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((item) => item.id === where.id);
        if (row) {
          row.consumedAt = data.consumedAt as Date;
          row.attempts += 1;
        }
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { id: { in: string[] } }; data: Record<string, unknown> }) => {
        const matched = rows.filter((row) => where.id.in.includes(row.id));
        for (const row of matched) {
          if (typeof data.consumedAt === 'object') {
            row.consumedAt = data.consumedAt as Date;
          }
          const increment = data.attempts as { increment?: number } | undefined;
          if (increment?.increment) {
            row.attempts += increment.increment;
          }
        }
        return { count: matched.length };
      }),
    },
  };
  const notifications = { enqueueEmail: jest.fn(), enqueueSms: jest.fn() };
  const audit = { record: jest.fn() };
  const config = new ConfigService({
    AUTH_OTP_MAX_ATTEMPTS: 5,
    AUTH_OTP_MAX_ACTIVE: 3,
    SESSION_SECRET: 'test-session-secret-for-otp-hashing',
  } as never);

  const service = new OtpService(config, prisma as never, notifications as never, audit as never);
  return { audit, notifications, prisma, rows, service };
}

describe('OtpService', () => {
  it('issues a hashed single-use code and emails it', async () => {
    const { notifications, prisma, rows, service } = setup();

    await service.issue({ userId: 'user-1', email: 'customer@example.com', purpose: 'login', name: 'Customer' });

    const email = notifications.enqueueEmail.mock.calls[0][0] as { payload: { otp: string } };
    expect(email.payload.otp).toMatch(/^\d{6}$/);
    expect(rows[0].tokenHash).toHaveLength(64);
    expect(rows[0].tokenHash).not.toContain(email.payload.otp);
    expect(prisma.otpToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipient: 'customer@example.com', channel: OtpChannel.email }) }),
    );
  });

  it('accepts the correct code once and consumes it', async () => {
    const { notifications, service } = setup();
    await service.issue({ userId: 'user-1', email: 'customer@example.com', purpose: 'login', name: 'Customer' });
    const otp = (notifications.enqueueEmail.mock.calls[0][0] as { payload: { otp: string } }).payload.otp;

    await expect(service.verify({ userId: 'user-1', purpose: 'login', otp })).resolves.toEqual({ consumedTokenId: expect.any(String) });
    await expect(service.verify({ userId: 'user-1', purpose: 'login', otp })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('invalidates the code after the configured number of wrong attempts', async () => {
    const { audit, notifications, service } = setup();
    await service.issue({ userId: 'user-1', email: 'customer@example.com', purpose: 'login', name: 'Customer' });
    const otp = (notifications.enqueueEmail.mock.calls[0][0] as { payload: { otp: string } }).payload.otp;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.verify({ userId: 'user-1', purpose: 'login', otp: '000000' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }

    // The correct sixth attempt must fail because the code was destroyed.
    await expect(service.verify({ userId: 'user-1', purpose: 'login', otp })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'customer.otp.locked' }));
  });

  it('rejects expired codes', async () => {
    const { notifications, rows, service } = setup();
    await service.issue({ userId: 'user-1', email: 'customer@example.com', purpose: 'login', name: 'Customer' });
    const otp = (notifications.enqueueEmail.mock.calls[0][0] as { payload: { otp: string } }).payload.otp;
    rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.verify({ userId: 'user-1', purpose: 'login', otp })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('delivers a phone code over SMS and verifies it on the same channel', async () => {
    const { notifications, service } = setup();

    await service.issue({
      userId: 'user-1',
      purpose: 'verify_mobile',
      name: 'Customer',
      channel: OtpChannel.sms,
      phone: '+919876543210',
    });

    const sms = notifications.enqueueSms.mock.calls[0][0] as { recipientPhone: string; channel: string; payload: { otp: string } };
    expect(sms).toEqual(expect.objectContaining({ recipientPhone: '+919876543210', channel: 'sms' }));
    expect(notifications.enqueueEmail).not.toHaveBeenCalled();

    // The emailed channel has no code, so only the SMS channel can succeed.
    await expect(
      service.verify({ userId: 'user-1', purpose: 'verify_mobile', otp: sms.payload.otp }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.verify({ userId: 'user-1', purpose: 'verify_mobile', otp: sms.payload.otp, channel: OtpChannel.sms }),
    ).resolves.toEqual({ consumedTokenId: expect.any(String) });
  });

  it('caps the number of live codes per purpose', async () => {
    const { rows, service } = setup();

    for (let index = 0; index < 4; index += 1) {
      await service.issue({ userId: 'user-1', email: 'customer@example.com', purpose: 'login', name: 'Customer' });
    }

    const live = rows.filter((row) => row.consumedAt === null);
    expect(live).toHaveLength(3);
  });
});
