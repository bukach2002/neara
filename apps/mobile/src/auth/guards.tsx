import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { homePathForRole, type SessionRole } from './roles';
import { BootScreen } from '@/components/layout';

type GuardResult =
  | { state: 'loading' }
  | { state: 'redirect'; href: string }
  | { state: 'ready' };

/**
 * Guards are UX only. Every screen still calls an API route that verifies the
 * session and role server-side, so a bypassed guard grants no data access.
 */
export function useRoleGuard(expectedRole: SessionRole): GuardResult {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return { state: 'loading' };
  }
  if (auth.status === 'error') {
    return { state: 'redirect', href: '/sign-in' };
  }
  if (auth.status === 'anonymous' || !auth.role) {
    return { state: 'redirect', href: '/sign-in' };
  }
  if (auth.role !== expectedRole) {
    return { state: 'redirect', href: homePathForRole(auth.role) };
  }
  return { state: 'ready' };
}

export function RoleGate({ role, children }: { role: SessionRole; children: ReactNode }) {
  const guard = useRoleGuard(role);
  if (guard.state === 'loading') {
    return <BootScreen />;
  }
  if (guard.state === 'redirect') {
    return <Redirect href={guard.href} />;
  }
  return <>{children}</>;
}
