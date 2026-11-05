import { ApiError, apiRequest } from '@/lib/http';
import { clearSession } from '@/lib/session-store';
import type {
  AdminLoginResponse,
  AdminMeResponse,
  CustomerAuthResponse,
  SessionUser,
} from '@/types';
import { resolveAdminRole, type SessionRole } from '@/auth/roles';
import { signUpBusiness, type BusinessSignupInput } from './onboarding';

export type SignInOutcome = {
  role: SessionRole;
  user: SessionUser;
};

export type RestoreOutcome = {
  role: SessionRole;
  user: SessionUser;
} | null;

function normalizeCustomer(user: CustomerAuthResponse['user']): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobileNumber: user.mobileNumber,
    platformRole: 'none',
    memberships: [],
  };
}

const GENERIC_CREDENTIALS_ERROR = 'Those details did not match an account. Check and try again.';

/**
 * The existing API has two separate login endpoints and two cookie audiences:
 *
 * - customers authenticate at /public/auth/login
 * - platform/tenant admins authenticate at /admin/auth/login
 *
 * A customer account cannot sign in through the customer endpoint if it also has
 * a membership, and any active user can sign in through the admin endpoint. So
 * the customer endpoint is tried first and the admin endpoint is only used after
 * a genuine 401 on an email identifier. An admin-audience session with no role
 * is discarded immediately.
 *
 * Backend follow-up (documented in doc/16-mobile-security-backend-actions.md):
 * replace this with one /api/mobile/auth/login that resolves the role after a
 * single password verification and returns audience-bound tokens.
 */
export async function signIn(identifier: string, password: string): Promise<SignInOutcome> {
  const trimmedIdentifier = identifier.trim();
  const isEmail = trimmedIdentifier.includes('@');

  let customerCredentialsAccepted = false;
  try {
    await apiRequest<CustomerAuthResponse>('/public/auth/login', {
      method: 'POST',
      body: { identifier: trimmedIdentifier, password, trustDevice: true },
      notifyUnauthorized: false,
    });
    customerCredentialsAccepted = true;
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }
    if (error.status === 401) {
      // Genuine credential rejection: fall through to the admin endpoint below.
    } else if (error.status === 403) {
      throw new ApiError(403, 'This account is temporarily locked. Try again in a few minutes.');
    } else {
      throw error;
    }
  }

  if (customerCredentialsAccepted) {
    // Re-read the session from the server. This proves the session cookie was
    // actually retained by this client before any role-specific UI is shown.
    try {
      const confirmed = await apiRequest<{ sessionId: string; user: CustomerAuthResponse['user'] }>(
        '/public/auth/me',
        { notifyUnauthorized: false },
      );
      return { role: 'customer', user: normalizeCustomer(confirmed.user) };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
        throw new ApiError(401, 'Sign-in could not be completed on this device. Please try again.');
      }
      throw error;
    }
  }

  if (!isEmail) {
    throw new ApiError(401, GENERIC_CREDENTIALS_ERROR);
  }

  // Continue with the admin endpoint for email identifiers.

  try {
    await apiRequest<AdminLoginResponse>('/admin/auth/login', {
      method: 'POST',
      body: { email: trimmedIdentifier, password },
      notifyUnauthorized: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, GENERIC_CREDENTIALS_ERROR);
    }
    if (error instanceof ApiError && error.status === 403) {
      throw new ApiError(403, 'This account is temporarily locked. Try again in a few minutes.');
    }
    throw error;
  }

  let adminSession: AdminMeResponse;
  try {
    adminSession = await apiRequest<AdminMeResponse>('/admin/auth/me', { notifyUnauthorized: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearSession();
      throw new ApiError(401, 'Sign-in could not be completed on this device. Please try again.');
    }
    throw error;
  }

  const role = resolveAdminRole(adminSession.user);
  if (!role) {
    // The admin endpoint accepts any active user. Never keep a session that has
    // no admin role, even though the cookie is still valid for the customer app.
    await logoutAdmin().catch(() => undefined);
    await clearSession();
    throw new ApiError(403, 'This account has no admin workspace. Use the customer sign-in instead.');
  }

  return { role, user: adminSession.user };
}

/**
 * Restores a session from the encrypted cookie jar by asking the server who the
 * caller is. Customer audience is checked first because customers cannot have
 * memberships or a platform role.
 */
export async function restoreSession(): Promise<RestoreOutcome> {
  try {
    const customer = await apiRequest<{ sessionId: string; user: CustomerAuthResponse['user'] }>(
      '/public/auth/me',
      { notifyUnauthorized: false },
    );
    return { role: 'customer', user: normalizeCustomer(customer.user) };
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }
    if (error.status !== 401) {
      throw error;
    }
  }

  try {
    const admin = await apiRequest<AdminMeResponse>('/admin/auth/me', { notifyUnauthorized: false });
    const role = resolveAdminRole(admin.user);
    if (!role) {
      return null;
    }
    return { role, user: admin.user };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}

/**
 * Self-serve business registration. The signup route creates the tenant plus the
 * owner account and opens an admin-audience session for that owner, so the
 * session is re-read from the server exactly like an admin sign-in.
 */
export async function registerBusiness(input: BusinessSignupInput): Promise<SignInOutcome> {
  await signUpBusiness(input);

  let adminSession: AdminMeResponse;
  try {
    adminSession = await apiRequest<AdminMeResponse>('/admin/auth/me', { notifyUnauthorized: false });
  } catch (error) {
    await clearSession();
    if (error instanceof ApiError) {
      throw new ApiError(
        error.status,
        'Your business was created, but this device could not finish signing in. Sign in with your email and password.',
      );
    }
    throw error;
  }

  const role = resolveAdminRole(adminSession.user);
  if (!role) {
    await clearSession();
    throw new ApiError(403, 'Your business was created, but this account has no studio workspace yet.');
  }

  return { role, user: adminSession.user };
}

export function registerCustomer(input: {
  name: string;
  email?: string;
  mobileNumber?: string;
  password: string;
}): Promise<CustomerAuthResponse> {
  return apiRequest<CustomerAuthResponse>('/public/auth/register', {
    method: 'POST',
    body: { ...input, trustDevice: true },
    notifyUnauthorized: false,
  });
}

export async function requestPasswordResetOtp(identifier: string) {
  await apiRequest<{ ok: boolean }>('/public/auth/password-reset/request', {
    method: 'POST',
    body: { identifier: identifier.trim(), purpose: 'password_reset', channel: 'email' },
    notifyUnauthorized: false,
  });
}

export async function confirmPasswordReset(input: {
  identifier: string;
  otp: string;
  newPassword: string;
}) {
  await apiRequest<{ ok: boolean }>('/public/auth/password-reset/confirm', {
    method: 'POST',
    body: { ...input, identifier: input.identifier.trim() },
    notifyUnauthorized: false,
  });
}

async function logoutAdmin() {
  await apiRequest<{ ok: boolean }>('/admin/auth/logout', {
    method: 'POST',
    notifyUnauthorized: false,
  });
}

async function logoutCustomer() {
  await apiRequest<{ ok: boolean }>('/public/auth/logout', {
    method: 'POST',
    notifyUnauthorized: false,
  });
}

export async function logoutRemote(role: SessionRole) {
  if (role === 'customer') {
    await logoutCustomer();
    return;
  }
  await logoutAdmin();
}

export async function deleteCustomerAccount() {
  await apiRequest<{ ok: boolean }>('/public/auth/me', {
    method: 'DELETE',
    notifyUnauthorized: false,
  });
}
