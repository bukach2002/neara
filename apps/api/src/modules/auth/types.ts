import { PlatformRole, TenantRole } from '@prisma/client';

export const AUTH_CONTEXT_REQUEST_KEY = 'authContext';

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  mobileNumber: string | null;
  name: string;
  platformRole: PlatformRole;
  mfaEnabled: boolean;
  mobileVerified: boolean;
  memberships: Array<{
    tenantId: string;
    role: TenantRole;
    tenant: {
      id: string;
      name: string;
      slug: string;
      status: string;
    };
  }>;
};

export type AuthContext = {
  sessionId: string;
  /** When this session started authenticating (used for step-up freshness). */
  authenticatedAt: Date;
  user: AuthenticatedUser;
};

export function hasTenantRole(
  context: AuthContext,
  tenantId: string,
  allowedRoles: TenantRole[] = [TenantRole.owner, TenantRole.admin, TenantRole.staff],
) {
  return context.user.memberships.some(
    (membership) => membership.tenantId === tenantId && allowedRoles.includes(membership.role),
  );
}

declare module 'express-serve-static-core' {
  interface Request {
    [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  }
}
