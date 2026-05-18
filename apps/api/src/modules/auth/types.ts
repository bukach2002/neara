import { PlatformRole, TenantRole } from '@prisma/client';

export const AUTH_CONTEXT_REQUEST_KEY = 'authContext';

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  mobileNumber: string | null;
  name: string;
  platformRole: PlatformRole;
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
  user: AuthenticatedUser;
};

declare module 'express-serve-static-core' {
  interface Request {
    [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  }
}
