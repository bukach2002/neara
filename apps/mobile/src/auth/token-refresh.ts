import { API_URL, REQUEST_TIMEOUT_MS } from '@/lib/config';
import { clearSession, readSessionTokens, writeSessionTokens, type SessionTokens } from '@/lib/session-store';

export type RefreshResult =
  | { status: 'rotated'; tokens: SessionTokens }
  | { status: 'rejected' }
  | { status: 'unavailable' };

type RefreshPayload = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  role?: string;
};

let inFlight: Promise<RefreshResult> | null = null;

/**
 * Exchanges the stored refresh token for a new token pair.
 *
 * Single-flight: concurrent 401s share one rotation so a token is never spent
 * twice (which the server treats as reuse and would revoke the whole family).
 */
export function refreshSession(): Promise<RefreshResult> {
  if (!inFlight) {
    inFlight = performRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function performRefresh(): Promise<RefreshResult> {
  const current = await readSessionTokens();
  if (!current) {
    return { status: 'rejected' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}/mobile/auth/refresh`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-request-id': `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      },
      body: JSON.stringify({ refreshToken: current.refreshToken, deviceId: current.deviceId }),
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      // The family is revoked, expired, or the device no longer matches.
      await clearSession();
      return { status: 'rejected' };
    }

    if (!response.ok) {
      return { status: 'unavailable' };
    }

    const payload = (await response.json()) as RefreshPayload;
    if (!payload.accessToken || !payload.refreshToken) {
      await clearSession();
      return { status: 'rejected' };
    }

    const tokens: SessionTokens = {
      deviceId: current.deviceId,
      accessToken: payload.accessToken,
      accessTokenExpiresAt: payload.accessTokenExpiresAt,
      refreshToken: payload.refreshToken,
      refreshTokenExpiresAt: payload.refreshTokenExpiresAt,
    };
    await writeSessionTokens(tokens);
    return { status: 'rotated', tokens };
  } catch {
    // Network failure: keep the session, the refresh token is still valid.
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
