import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { OtpChannel, OtpPurpose, PlatformRole, SessionAudience, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CustomerAuthService } from './customer-auth.service';

function response() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

function setup() {
  const config = { get: jest.fn((key: string, fallback: unknown) => fallback) };
  const notifications = { enqueueEmail: jest.fn() };
  const prisma = {
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    otpToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
  };
  const service = new CustomerAuthService(config as never, notifications as never, prisma as never);
  return { config, notifications, prisma, service };
}

describe('CustomerAuthService', () => {
  it('registers an email customer and creates a customer session', async () => {
    const { prisma, service } = setup();
    const res = response();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      mobileNumber: null,
    });
    prisma.session.create.mockResolvedValue({ id: 'session-1' });

    await expect(
      service.register(
        {
          name: 'Customer One',
          email: 'CUSTOMER@example.com',
          password: 'ChangeMe123!',
          trustDevice: true,
        },
        res as never,
      ),
    ).resolves.toEqual(expect.objectContaining({ user: expect.objectContaining({ email: 'customer@example.com' }), trustedDevice: true }));

    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'customer@example.com', platformRole: PlatformRole.none }),
    }));
    expect(prisma.session.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ audience: SessionAudience.customer, trustedDevice: true }),
    }));
    expect(res.cookie).toHaveBeenCalledWith('neara.customer.sid', expect.any(String), expect.objectContaining({ httpOnly: true }));
  });

  it('rejects duplicate customer identifiers', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({ name: 'Customer One', mobileNumber: '+919876543210', password: 'ChangeMe123!' }, response() as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in by mobile number with a password', async () => {
    const { prisma, service } = setup();
    const passwordHash = await bcrypt.hash('ChangeMe123!', 4);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: null,
      mobileNumber: '+919876543210',
      passwordHash,
      status: UserStatus.active,
    });
    prisma.session.create.mockResolvedValue({ id: 'session-1' });

    await expect(
      service.login({ identifier: '+919876543210', password: 'ChangeMe123!' }, response() as never),
    ).resolves.toEqual(expect.objectContaining({ user: expect.objectContaining({ mobileNumber: '+919876543210' }) }));
  });

  it('creates and emails a login OTP for email customers', async () => {
    const { notifications, prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      status: UserStatus.active,
    });
    prisma.otpToken.create.mockResolvedValue({ id: 'otp-1' });

    await expect(service.requestOtp({ identifier: 'customer@example.com', purpose: 'login', channel: 'email' })).resolves.toEqual({ ok: true });

    expect(prisma.otpToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ purpose: OtpPurpose.login, channel: OtpChannel.email, recipient: 'customer@example.com' }),
    }));
    expect(notifications.enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
      templateKey: 'customer_login_otp',
      recipientEmail: 'customer@example.com',
    }));
  });

  it('confirms a login OTP once and creates a customer session', async () => {
    const { prisma, service } = setup();
    const user = {
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      mobileNumber: null,
      status: UserStatus.active,
    };
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpToken.findFirst.mockResolvedValue({
      id: 'otp-1',
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    prisma.otpToken.update.mockResolvedValue({ id: 'otp-1' });
    prisma.session.create.mockResolvedValue({ id: 'session-1' });

    await expect(
      service.confirmOtp({ identifier: 'customer@example.com', otp: '123456', purpose: 'login' }, response() as never),
    ).resolves.toEqual(expect.objectContaining({ user: expect.objectContaining({ id: 'user-1' }) }));

    expect(prisma.otpToken.update).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { consumedAt: expect.any(Date), attempts: { increment: 1 } },
    });
  });

  it('rejects expired OTPs', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      status: UserStatus.active,
    });
    prisma.otpToken.findFirst.mockResolvedValue({
      id: 'otp-1',
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
    });

    await expect(
      service.confirmOtp({ identifier: 'customer@example.com', otp: '123456', purpose: 'login' }, response() as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
