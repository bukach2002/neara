import { Platform } from 'react-native';
import { ApiError, apiRequest } from '@/lib/http';
import { clearSession, getDeviceId, readSessionTokens, writeSessionTokens } from '@/lib/session-store';
import type { MobileAuthResponse, SessionInfo, SessionListResponse, SessionUser } from '@/types';
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

const GENERIC_CREDENTIALS_ERROR = 'Those details did not match an account. Check and try again.';

function deviceLabel() {
  if (Platform.OS === 'ios') {
    return 'iPhone';
  }
  if (Platform.OS === 'android') {
    return 'Android device';
  }
  return 'Neara app';
}

function toSessionUser(user: MobileAuthResponse['user']): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobileNumber: user.mobileNumber,
    platformRole: user.platformRole,
    mobileVerified: Boolean(user.mobileVerified),
    memberships: user.memberships ?? [],
  };
}

/** Server-resolved role; a user with no workspace is a customer. */
export function roleForUser(user: SessionUser): SessionRole {
  return resolveAdminRole(user) ?? 'customer';
}

async function persistTokens(payload: MobileAuthResponse, deviceId: string) {
  await writeSessionTokens({
    deviceId,
    accessToken: payload.accessToken,
    accessTokenExpiresAt: payload.accessTokenExpiresAt,
    refreshToken: payload.refreshToken,
    refreshTokenExpiresAt: payload.refreshTokenExpiresAt,
  });
}

/**
 * One request authenticates the user and resolves the role server-side, so the
 * client no longer probes two cookie endpoints or keeps a role-less session.
 */
export async function signIn(identifier: string, password: string): Promise<SignInOutcome> {
  const deviceId = await getDeviceId();

  let payload: MobileAuthResponse;
  try {
    payload = await apiRequest<MobileAuthResponse>('/mobile/auth/login', {
      method: 'POST',
      body: {
        identifier: identifier.trim(),
        password,
        device: { id: deviceId, name: deviceLabel(), platform: Platform.OS },
      },
      notifyUnauthorized: false,
      skipRefresh: true,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, GENERIC_CREDENTIALS_ERROR, error.payload);
    }
    throw error;
  }

  await persistTokens(payload, deviceId);
  return { role: payload.role, user: toSessionUser(payload.user) };
}

/**
 * Restores the session from the keychain. The access token is refreshed when
 * needed by the HTTP client; a rejected refresh clears local material.
 */
export async function restoreSession(): Promise<RestoreOutcome> {
  const tokens = await readSessionTokens();
  if (!tokens) {
    return null;
  }

  try {
    const me = await apiRequest<{ sessionId: string; user: MobileAuthResponse['user'] }>('/mobile/auth/me', {
      notifyUnauthorized: false,
    });
    const user = toSessionUser(me.user);
    return { role: roleForUser(user), user };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      await clearSession();
      return null;
    }
    throw error;
  }
}

/**
 * Self-serve business registration. The signup route creates the tenant and the
 * owner account; the bearer sign-in that follows verifies the password once and
 * binds this device.
 */
export async function registerBusiness(input: BusinessSignupInput): Promise<SignInOutcome> {
  await signUpBusiness(input);
  return signIn(input.email, input.password);
}

export async function registerCustomer(input: {
  name: string;
  email?: string;
  mobileNumber?: string;
  password: string;
}): Promise<SignInOutcome> {
  const identifier = input.email?.trim() || input.mobileNumber?.trim();
  if (!identifier) {
    throw new ApiError(400, 'Enter an email address or mobile number.');
  }

  await apiRequest<{ user: { id: string } }>('/public/auth/register', {
    method: 'POST',
    body: { ...input, trustDevice: true },
    notifyUnauthorized: false,
    skipRefresh: true,
  });

  return signIn(identifier, input.password);
}

export type VerificationChannel = 'sms' | 'whatsapp';

/**
 * Sends a 6-digit code to the number already on the account. The endpoint is
 * public but answers `{ ok: true }` for any identifier, so it cannot be used to
 * probe which numbers exist.
 */
export async function requestPhoneCode(identifier: string, channel: VerificationChannel) {
  await apiRequest<{ ok: boolean }>('/public/auth/verify/phone/request', {
    method: 'POST',
    body: { identifier, channel },
    notifyUnauthorized: false,
    skipRefresh: true,
  });
}

export async function confirmPhoneCode(input: {
  identifier: string;
  otp: string;
  channel: VerificationChannel;
}) {
  await apiRequest<{ ok: boolean; verified: boolean }>('/public/auth/verify/phone/confirm', {
    method: 'POST',
    body: input,
    notifyUnauthorized: false,
    skipRefresh: true,
  });
}

export async function requestPasswordResetOtp(identifier: string) {
  await apiRequest<{ ok: boolean }>('/mobile/auth/password-reset/request', {
    method: 'POST',
    body: { identifier: identifier.trim() },
    notifyUnauthorized: false,
    skipRefresh: true,
  });
}

export async function confirmPasswordReset(input: {
  identifier: string;
  otp: string;
  newPassword: string;
}) {
  await apiRequest<{ ok: boolean }>('/mobile/auth/password-reset/confirm', {
    method: 'POST',
    body: { ...input, identifier: input.identifier.trim() },
    notifyUnauthorized: false,
    skipRefresh: true,
  });
}

/** Revokes this device's refresh family, then erases it locally. */
export async function logoutRemote(_role?: SessionRole) {
  const tokens = await readSessionTokens();
  try {
    if (tokens) {
      await apiRequest<{ ok: boolean }>('/mobile/auth/logout', {
        method: 'POST',
        body: { refreshToken: tokens.refreshToken },
        notifyUnauthorized: false,
        skipRefresh: true,
      });
    }
  } catch {
    // Best effort: local material is erased even when the API is unreachable.
  } finally {
    await clearSession();
  }
}

/** Revokes every session and refresh family for this account. */
export async function logoutAllRemote() {
  await apiRequest<{ ok: boolean }>('/mobile/auth/logout-all', {
    method: 'POST',
    notifyUnauthorized: false,
  });
  await clearSession();
}

export async function deleteCustomerAccount() {
  await apiRequest<{ ok: boolean }>('/mobile/auth/me', {
    method: 'DELETE',
    notifyUnauthorized: false,
  });
  await clearSession();
}

export async function listSessions(): Promise<SessionInfo[]> {
  const response = await apiRequest<SessionListResponse>('/mobile/auth/sessions');
  return response.items;
}

export async function revokeSession(sessionId: string) {
  await apiRequest<{ ok: boolean }>(`/mobile/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
}
