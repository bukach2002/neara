import type { Membership, SessionUser } from '@/types';

export type SessionRole = 'customer' | 'tenant_admin' | 'platform_admin';

const TENANT_ADMIN_ROLES = new Set(['owner', 'admin', 'staff']);

export function tenantMemberships(user: SessionUser): Membership[] {
  return user.memberships.filter((membership) => TENANT_ADMIN_ROLES.has(String(membership.role)));
}

/**
 * Role is derived only from a server-verified session payload. The client never
 * stores a role claim locally, and route guards are convenience only: every API
 * call is authorized again by the backend.
 */
export function resolveAdminRole(user: SessionUser): Exclude<SessionRole, 'customer'> | null {
  if (user.platformRole === 'platform_admin') {
    return 'platform_admin';
  }
  if (tenantMemberships(user).length > 0) {
    return 'tenant_admin';
  }
  return null;
}

export function homePathForRole(role: SessionRole): string {
  switch (role) {
    case 'platform_admin':
      return '/(platform)';
    case 'tenant_admin':
      return '/(tenant)';
    case 'customer':
    default:
      return '/(customer)/discover';
  }
}
