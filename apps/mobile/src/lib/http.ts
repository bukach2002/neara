import { API_URL, REQUEST_TIMEOUT_MS } from './config';
import { getAccessToken, hasSession } from './session-store';
import { refreshSession } from '@/auth/token-refresh';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  /** Auth/bootstrap calls set this false so a normal 401 does not sign the user out. */
  notifyUnauthorized?: boolean;
  /** Credential exchanges must never trigger an automatic refresh. */
  skipRefresh?: boolean;
  timeoutMs?: number;
};

export class ApiError extends Error {
  status: number;
  /** Safe, user-presentable message. Never contains request credentials. */
  safeMessage: string;
  /** Parsed error response, when the API returned JSON. */
  payload?: unknown;

  constructor(status: number, safeMessage: string, payload?: unknown) {
    super(safeMessage);
    this.name = 'ApiError';
    this.status = status;
    this.safeMessage = safeMessage;
    this.payload = payload;
  }

  get isNetworkError() {
    return this.status === 0;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isRateLimited() {
    return this.status === 429;
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function emitUnauthorized() {
  for (const listener of unauthorizedListeners) {
    listener();
  }
}

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim().length > 0) {
    // Plain-text errors are usually proxy HTML; do not surface raw markup.
    return payload.includes('<') ? fallback : payload.slice(0, 240);
  }

  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown; error?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.slice(0, 240);
    }
    if (Array.isArray(message)) {
      const first = message.find((entry): entry is string => typeof entry === 'string');
      if (first) {
        return first.slice(0, 240);
      }
    }
    if (typeof (payload as { error?: unknown }).error === 'string') {
      return String((payload as { error: string }).error).slice(0, 240);
    }
  }

  return fallback;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function fallbackMessage(status: number) {
  if (status === 401) {
    return 'Your session has expired. Sign in again.';
  }
  if (status === 403) {
    return 'You do not have access to this area.';
  }
  if (status === 429) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (status >= 500) {
    return 'Neara is having trouble right now. Try again shortly.';
  }
  return 'That request could not be completed.';
}

/** Credential endpoints never retry through the refresh flow. */
function isCredentialPath(path: string) {
  return (
    path.startsWith('/mobile/auth/login') ||
    path.startsWith('/mobile/auth/refresh') ||
    path.startsWith('/mobile/auth/logout') ||
    path.startsWith('/mobile/auth/password-reset')
  );
}

async function send(path: string, options: ApiRequestOptions, accessToken: string | null) {
  const method = options.method ?? 'GET';
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-request-id': createRequestId(),
  };

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  try {
    return await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      // Native holds tokens explicitly; no platform cookie store is involved.
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, 'Neara took too long to respond. Try again.');
    }
    throw new ApiError(0, 'Cannot reach Neara. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * All API traffic goes through this function:
 * - the short-lived access token is attached as `Authorization: Bearer`
 * - an expired access token is refreshed once per 401 and the request replayed
 * - a rejected refresh signs the device out exactly once
 * - request bodies (passwords, customer PII) are never logged
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const accessToken = await getAccessToken();
  let response = await send(path, options, accessToken);

  if (response.status === 401 && !options.skipRefresh && !isCredentialPath(path) && (await hasSession())) {
    const refreshed = await refreshSession();
    if (refreshed.status === 'rotated') {
      response = await send(path, options, refreshed.tokens.accessToken);
    } else if (refreshed.status === 'unavailable') {
      throw new ApiError(0, 'Cannot reach Neara. Check your connection and try again.');
    }
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 401 && options.notifyUnauthorized !== false) {
      emitUnauthorized();
    }
    throw new ApiError(response.status, readMessage(payload, fallbackMessage(response.status)), payload);
  }

  return payload as T;
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) {
    return '';
  }
  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `?${query}`;
}
