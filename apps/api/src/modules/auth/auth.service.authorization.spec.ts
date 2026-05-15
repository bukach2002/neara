import { ForbiddenException } from '@nestjs/common';
import { PlatformRole, TenantRole, TenantStatus } from '@prisma/client';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthContext } from './types';

function serviceWithContext(context: AuthContext) {
  const service = new AuthService({} as never, {} as never, {} as never, {} as never);
  jest.spyOn(service, 'requireAdminContext').mockResolvedValue(context);
  return service;
}

function authContext(overrides: Partial<AuthContext['user']> = {}): AuthContext {
  return {
    sessionId: 'session-1',
    user: {
      id: 'user-1',
      email: 'admin@neara.local',
      name: 'Admin',
      platformRole: PlatformRole.none,
      memberships: [],
      ...overrides,
    },
  };
}

function membership(tenantId: string, role: TenantRole = TenantRole.admin) {
  return {
    id: `membership-${tenantId}`,
    tenantId,
    role,
    tenant: {
      id: tenantId,
      name: `Tenant ${tenantId}`,
      slug: `tenant-${tenantId}`,
      status: TenantStatus.active,
    },
  };
}

describe('AuthService authorization boundaries', () => {
  it('allows platform admins through the platform boundary', async () => {
    const context = authContext({ platformRole: PlatformRole.platform_admin });
    const service = serviceWithContext(context);

    await expect(service.requirePlatformAdmin({ method: 'GET' } as Request)).resolves.toBe(context);
  });

  it('rejects non-platform users from the platform boundary', async () => {
    const service = serviceWithContext(authContext({ memberships: [membership('tenant-a')] }));

    await expect(service.requirePlatformAdmin({ method: 'GET' } as Request)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows tenant admins only for their tenant scope', async () => {
    const context = authContext({ memberships: [membership('tenant-a')] });
    const service = serviceWithContext(context);

    await expect(service.requireTenantAdmin({ method: 'GET' } as Request, 'tenant-a')).resolves.toBe(context);
    await expect(service.requireTenantAdmin({ method: 'GET' } as Request, 'tenant-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects users with no tenant admin membership', async () => {
    const service = serviceWithContext(authContext());

    await expect(service.requireTenantAdmin({ method: 'GET' } as Request, 'tenant-a')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
