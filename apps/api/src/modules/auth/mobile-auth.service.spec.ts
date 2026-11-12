import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PlatformRole, TenantRole, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { MobileAuthService } from './mobile-auth.service';
import { signAccessToken, verifyAccessToken } from './token.service';

const SECRET = 'test-session-secret-long-enough-for-hs256';

const CONFIG_VALUES: Record<string, unknown> = {
  SESSION_SECRET: SECRET,
  AUTH_ACCESS_TOKEN_MINUTES: 15,
  AUTH_REFRESH_TOKEN_DAYS: 30,
  AUTH_LOCKOUT_THRESHOLD: 10,
  AUTH_LOCKOUT_MINUTES: 15,
  AUTH_REQUIRE_EMAIL_VERIFICATION: 'false',
  AUTH_REQUIRE_PHONE_VERIFICATION: 'false',
  AUTH_REQUIRE_PLATFORM_MFA: 'false',
};

function customerUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'customer@example.com',
    mobileNumber: '+919876543210',
    name: 'Customer One',
    passwordHash: '',
    platformRole: PlatformRole.none,
    status: UserStatus.active,
    failedLoginAttempts: 0,
    lockedUntil: null,
    mfaEnabledAt: null,
    mfaSecretCiphertext: null,
    emailVerifiedAt: null,
    mobileVerifiedAt: null,
    memberships: [],
    ...overrides,
  };
}

function setup(user: unknown = customerUser()) {
  const config = {
    get: jest.fn((key: string, fallback: unknown) => (key in CONFIG_VALUES ? CONFIG_VALUES[key] : fallback)),
  };
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(user),
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    },
    mobileRefreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'token-row-1' }),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (operations: unknown) => operations),
  };
  const sessions = { revokeAllForUser: jest.fn(), listForUser: jest.fn(), revokeListedSession: jest.fn() };
  const otp = { issue: jest.fn(), verify: jest.fn() };
  const audit = { record: jest.fn() };
  const notifications = { enqueueEmail: jest.fn() };

  const service = new MobileAuthService(
    config as never,
    prisma as never,
    sessions as never,
    otp as never,
    audit as never,
    notifications as never,
  );

  return { audit, config, notifications, otp, prisma, service, sessions };
}

const request = {
  header: jest.fn((name: string) => (name === 'user-agent' ? 'NearaTest/1.0 (iOS)' : undefined)),
} as unknown as Request;

describe('MobileAuthService', () => {
  it('resolves a customer after one password check and mints a customer-audience token', async () => {
    const { prisma, service } = setup();
    const bcrypt = await import('bcryptjs');
    prisma.user.findFirst.mockResolvedValue(
      customerUser({ passwordHash: await bcrypt.hash('Sunset42!Harbor', 4) }),
    );

    const result = await service.login(
      { identifier: 'CUSTOMER@example.com', password: 'Sunset42!Harbor', device: { id: 'device-1', name: 'iPhone', platform: 'ios' } },
      request,
    );

    expect(result.role).toBe('customer');
    const claims = verifyAccessToken(result.accessToken, SECRET);
    expect(claims).toEqual(
      expect.objectContaining({ sub: 'user-1', aud: 'customer', did: 'device-1', typ: 'neara.mobile.access' }),
    );
    expect(result.refreshToken.length).toBeGreaterThan(20);
    expect(prisma.mobileRefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deviceId: 'device-1' }) }),
    );
    // No cookies are issued on the bearer surface.
    expect(result).not.toHaveProperty('csrfToken');
  });

  it('returns the platform audience for platform admins', async () => {
    const { prisma, service } = setup();
    const bcrypt = await import('bcryptjs');
    prisma.user.findFirst.mockResolvedValue(
      customerUser({ id: 'admin-1', platformRole: PlatformRole.platform_admin, passwordHash: await bcrypt.hash('Sunset42!Harbor', 4) }),
    );

    const result = await service.login({ identifier: 'customer@example.com', password: 'Sunset42!Harbor' }, request);

    expect(result.role).toBe('platform_admin');
    expect(verifyAccessToken(result.accessToken, SECRET)).toEqual(expect.objectContaining({ aud: 'platform' }));
  });

  it('marks tenant members as tenant admins with a tenant audience', async () => {
    const { prisma, service } = setup();
    const bcrypt = await import('bcryptjs');
    prisma.user.findFirst.mockResolvedValue(
      customerUser({
        platformRole: PlatformRole.none,
        memberships: [
          { tenantId: 'tenant-1', role: TenantRole.owner, tenant: { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-one', status: 'active' } },
        ],
        passwordHash: await bcrypt.hash('Sunset42!Harbor', 4),
      }),
    );

    const result = await service.login({ identifier: 'customer@example.com', password: 'Sunset42!Harbor' }, request);

    expect(result.role).toBe('tenant_admin');
    expect(result.tenants).toEqual([expect.objectContaining({ id: 'tenant-1', role: TenantRole.owner })]);
    expect(verifyAccessToken(result.accessToken, SECRET)).toEqual(expect.objectContaining({ aud: 'tenant' }));
  });

  it('refuses to sign in an inactive account after a valid password', async () => {
    const { prisma, service } = setup();
    const bcrypt = await import('bcryptjs');
    prisma.user.findFirst.mockResolvedValue(
      customerUser({ status: UserStatus.inactive, passwordHash: await bcrypt.hash('Sunset42!Harbor', 4) }),
    );

    await expect(
      service.login({ identifier: 'customer@example.com', password: 'Sunset42!Harbor' }, request),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks native sign-in until the phone number is verified when enforcement is on', async () => {
    const { prisma, service } = setup();
    const bcrypt = await import('bcryptjs');
    prisma.user.findFirst.mockResolvedValue(
      customerUser({ passwordHash: await bcrypt.hash('Sunset42!Harbor', 4) }),
    );
    CONFIG_VALUES.AUTH_REQUIRE_PHONE_VERIFICATION = 'true';

    try {
      await expect(
        service.login({ identifier: 'customer@example.com', password: 'Sunset42!Harbor' }, request),
      ).rejects.toThrow('Verify your phone number before signing in');

      prisma.user.findFirst.mockResolvedValue(
        customerUser({ mobileVerifiedAt: new Date(), passwordHash: await bcrypt.hash('Sunset42!Harbor', 4) }),
      );
      await expect(
        service.login({ identifier: 'customer@example.com', password: 'Sunset42!Harbor' }, request),
      ).resolves.toEqual(expect.objectContaining({ role: 'customer' }));
    } finally {
      CONFIG_VALUES.AUTH_REQUIRE_PHONE_VERIFICATION = 'false';
    }
  });

  it('returns one generic 401 for unknown accounts and wrong passwords', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue(null);

    const unknown = await service.login({ identifier: 'nobody@example.com', password: 'Sunset42!Harbor' }, request).catch((error) => error);
    expect(unknown).toBeInstanceOf(UnauthorizedException);
    expect(unknown.message).toBe('Invalid identifier or password');

    const bcrypt = await import('bcryptjs');
    prisma.user.findFirst.mockResolvedValue(customerUser({ passwordHash: await bcrypt.hash('RightPassword1!', 4) }));
    const wrong = await service.login({ identifier: 'customer@example.com', password: 'WrongPassword1!' }, request).catch((error) => error);
    expect(wrong).toBeInstanceOf(UnauthorizedException);
    expect(wrong.message).toBe('Invalid identifier or password');
  });

  it('requires a bearer token on protected routes', async () => {
    const { service } = setup();

    await expect(service.requireContext({ header: jest.fn().mockReturnValue(undefined) } as unknown as Request)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      service.requireContext({ header: jest.fn().mockReturnValue('Bearer not-a-token') } as unknown as Request),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a valid token once its refresh family is revoked', async () => {
    const { prisma, service } = setup();
    const token = signAccessToken(
      { sub: 'user-1', sid: '7951c4f1-1b4e-4d4e-9f0c-6f5d0d6f4b11', aud: 'customer', did: 'device-1', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 },
      SECRET,
    );
    prisma.mobileRefreshToken.findFirst.mockResolvedValue(null);

    await expect(
      service.requireContext({ header: jest.fn().mockReturnValue(`Bearer ${token}`) } as unknown as Request),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const { audit, prisma, service } = setup();
    const stored = {
      id: 'row-1',
      userId: 'user-1',
      familyId: '7951c4f1-1b4e-4d4e-9f0c-6f5d0d6f4b11',
      tokenHash: 'hash',
      deviceId: 'device-1',
      deviceName: 'iPhone',
      platform: 'ios',
      audience: 'customer',
      revokedAt: null,
      replacedByTokenHash: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: customerUser(),
    };
    prisma.mobileRefreshToken.findUnique.mockResolvedValue(stored);
    prisma.mobileRefreshToken.update.mockResolvedValue({});
    prisma.mobileRefreshToken.create.mockResolvedValue({});

    const rotated = await service.refresh({ refreshToken: 'refresh-token', deviceId: 'device-1' }, request);
    expect(rotated.refreshToken).not.toBe('refresh-token');
    expect(rotated.accessToken).toBeTruthy();

    prisma.mobileRefreshToken.findUnique.mockResolvedValue({ ...stored, revokedAt: new Date(), replacedByTokenHash: 'other' });
    await expect(service.refresh({ refreshToken: 'refresh-token', deviceId: 'device-1' }, request)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.mobileRefreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ familyId: stored.familyId, revokedAt: null }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'mobile.refresh.reuse_detected' }));
  });
});
