import { API_URL, REQUEST_TIMEOUT_MS } from './config';
import { captureResponseCookies, getCookieHeader, getCookieValue } from './session-store';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  /** Auth/bootstrap calls set this false so a normal 401 does not sign the user out. */
  notifyUnauthorized?: boolean;
  timeoutMs?: number;
};

export class ApiError extends Error {
  status: number;
  /** Safe, user-presentable message. Never contains request credentials. */
  safeMessage: string;

  constructor(status: number, safeMessage: string) {
    super(safeMessage);
    this.name = 'ApiError';
    this.status = status;
    this.safeMessage = safeMessage;
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

/**
 * All API traffic goes through this function:
 * - session cookies are replayed from the encrypted jar
 * - the XSRF header is derived from the cookie the API issued
 * - timeouts are enforced
 * - 401s on session-bound calls trigger a single local sign-out
 * - request bodies (passwords, customer PII) are never logged
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const requestId = createRequestId();

  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-request-id': requestId,
  };

  try {
    const cookieHeader = await getCookieHeader(url);
    if (cookieHeader) {
      headers.cookie = cookieHeader;
    }

    const csrfToken = await getCookieValue('XSRF-TOKEN');
    if (csrfToken && method !== 'GET') {
      headers['x-csrf-token'] = csrfToken;
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
        // Do not let a platform cookie store compete with our audited jar.
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(0, 'Neara took too long to respond. Try again.');
      }
      throw new ApiError(0, 'Cannot reach Neara. Check your connection and try again.');
    }

    await captureResponseCookies(response, url);
    const payload = await parseResponseBody(response);

    if (!response.ok) {
      const fallback =
        response.status === 401
          ? 'Your session has expired. Sign in again.'
          : response.status === 403
            ? 'You do not have access to this area.'
            : response.status === 429
              ? 'Too many attempts. Wait a minute and try again.'
              : response.status >= 500
                ? 'Neara is having trouble right now. Try again shortly.'
                : 'That request could not be completed.';

      if (response.status === 401 && options.notifyUnauthorized !== false) {
        emitUnauthorized();
      }

      throw new ApiError(response.status, readMessage(payload, fallback));
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
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
