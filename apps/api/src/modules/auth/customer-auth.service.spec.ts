import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { PlatformRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CustomerAuthService } from './customer-auth.service';

function response() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

function request() {
  return {
    header: jest.fn().mockReturnValue('jest-agent'),
  };
}

function setup() {
  const config = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
  const notifications = { enqueueEmail: jest.fn() };
  const prisma = {
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    customer: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    tenantMembership: { count: jest.fn().mockResolvedValue(0) },
  };
  const sessions = {
    createCookieSession: jest.fn().mockResolvedValue({ sessionId: 'session-1', csrfToken: 'csrf-token', expiresAt: new Date() }),
    revokeAllForUser: jest.fn(),
    readCookie: jest.fn(),
    sessionCookieName: jest.fn().mockReturnValue('neara.customer.sid'),
    revokeByToken: jest.fn(),
    clearCookies: jest.fn(),
    requireSession: jest.fn(),
  };
  const otp = { issue: jest.fn(), verify: jest.fn() };
  const audit = { record: jest.fn() };
  const csrf = { verifyRequest: jest.fn(), verifyOrigin: jest.fn() };

  const service = new CustomerAuthService(
    config as never,
    notifications as never,
    prisma as never,
    sessions as never,
    audit as never,
    otp as never,
    csrf as never,
  );

  return { audit, config, csrf, notifications, otp, prisma, service, sessions };
}

describe('CustomerAuthService', () => {
  it('registers an email customer and creates a customer session', async () => {
    const { otp, prisma, service, sessions } = setup();
    const res = response();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      mobileNumber: null,
    });

    await expect(
      service.register(
        {
          name: 'Customer One',
          email: 'CUSTOMER@example.com',
          password: 'Sunset42!Harbor',
          trustDevice: true,
        },
        request() as never,
        res as never,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ user: expect.objectContaining({ email: 'customer@example.com' }), trustedDevice: true }),
    );

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'customer@example.com', platformRole: PlatformRole.none }),
      }),
    );
    expect(sessions.createCookieSession).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'customer', trustedDevice: true }),
    );
    // New accounts get a verification code, but registration still succeeds.
    expect(otp.issue).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'verify_email', email: 'customer@example.com' }));
  });

  it('rejects duplicate customer identifiers', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({ name: 'Customer One', mobileNumber: '+919876543210', password: 'Sunset42!Harbor' }, request() as never, response() as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects weak registration passwords', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.register({ name: 'Customer One', email: 'customer@example.com', password: 'password123' }, request() as never, response() as never),
    ).rejects.toBeDefined();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('logs in by mobile number with a password', async () => {
    const { prisma, service, sessions } = setup();
    const passwordHash = await bcrypt.hash('Sunset42!Harbor', 4);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: null,
      mobileNumber: '+919876543210',
      passwordHash,
      status: UserStatus.active,
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerifiedAt: null,
      mobileVerifiedAt: null,
    });

    await expect(
      service.login({ identifier: '+919876543210', password: 'Sunset42!Harbor' }, request() as never, response() as never),
    ).resolves.toEqual(expect.objectContaining({ user: expect.objectContaining({ mobileNumber: '+919876543210' }) }));

    expect(sessions.createCookieSession).toHaveBeenCalledWith(expect.objectContaining({ audience: 'customer' }));
  });

  it('returns one generic error for unknown accounts and bad passwords', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue(null);

    const unknown = await service.login({ identifier: 'nobody@example.com', password: 'Sunset42!Harbor' }, request() as never, response() as never).catch((error) => error);
    expect(unknown).toBeInstanceOf(UnauthorizedException);
    expect(unknown.message).toBe('Invalid identifier or password');

    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      mobileNumber: null,
      passwordHash: await bcrypt.hash('RightPassword1', 4),
      status: UserStatus.active,
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerifiedAt: null,
      mobileVerifiedAt: null,
    });

    const wrong = await service.login({ identifier: 'customer@example.com', password: 'WrongPassword1' }, request() as never, response() as never).catch((error) => error);
    expect(wrong).toBeInstanceOf(UnauthorizedException);
    expect(wrong.message).toBe('Invalid identifier or password');
  });

  it('issues a login OTP through the shared OTP service', async () => {
    const { otp, prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      status: UserStatus.active,
      lockedUntil: null,
    });

    await expect(service.requestOtp({ identifier: 'customer@example.com', purpose: 'login', channel: 'email' })).resolves.toEqual({ ok: true });

    expect(otp.issue).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', purpose: 'login', email: 'customer@example.com' }),
    );
  });

  it('does not reveal whether an OTP identifier exists', async () => {
    const { otp, prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.requestOtp({ identifier: 'missing@example.com', purpose: 'login' })).resolves.toEqual({ ok: true });
    expect(otp.issue).not.toHaveBeenCalled();
  });

  it('confirms a login OTP once and creates a customer session', async () => {
    const { otp, prisma, service, sessions } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      mobileNumber: null,
      status: UserStatus.active,
    });
    otp.verify.mockResolvedValue(undefined);

    await expect(
      service.confirmOtp({ identifier: 'customer@example.com', otp: '123456', purpose: 'login' }, request() as never, response() as never),
    ).resolves.toEqual(expect.objectContaining({ user: expect.objectContaining({ id: 'user-1' }) }));

    expect(otp.verify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', purpose: 'login', otp: '123456' }));
    expect(sessions.createCookieSession).toHaveBeenCalledWith(expect.objectContaining({ audience: 'customer' }));
  });

  it('issues an SMS verification code for the number on the account', async () => {
    const { otp, prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      mobileNumber: '+919876543210',
      status: UserStatus.active,
      lockedUntil: null,
    });

    await expect(service.requestPhoneVerification('+919876543210', 'sms')).resolves.toEqual({ ok: true });

    expect(otp.issue).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', purpose: 'verify_mobile', channel: 'sms', phone: '+919876543210' }),
    );
  });

  it('does not send a code when the identifier is unknown or has no number', async () => {
    const { otp, prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.requestPhoneVerification('+919000000000', 'whatsapp')).resolves.toEqual({ ok: true });
    expect(otp.issue).not.toHaveBeenCalled();
  });

  it('confirms the phone code and records mobileVerifiedAt', async () => {
    const { otp, prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      mobileNumber: '+919876543210',
      status: UserStatus.active,
    });
    otp.verify.mockResolvedValue(undefined);

    await expect(service.confirmPhoneVerification('+919876543210', '123456', 'whatsapp')).resolves.toEqual({
      ok: true,
      verified: true,
    });

    expect(otp.verify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', purpose: 'verify_mobile', channel: 'whatsapp', otp: '123456' }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: { mobileVerifiedAt: expect.any(Date) } }),
    );
  });

  it('propagates expired or exhausted OTP failures', async () => {
    const { otp, prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Customer One',
      email: 'customer@example.com',
      status: UserStatus.active,
    });
    otp.verify.mockRejectedValue(new UnauthorizedException('Invalid or expired code'));

    await expect(
      service.confirmOtp({ identifier: 'customer@example.com', otp: '123456', purpose: 'login' }, request() as never, response() as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
