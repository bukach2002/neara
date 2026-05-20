export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_APP_URL || process.env.API_APP_URL || 'http://localhost:4000').replace(/\/$/, '');

type ApiRequestOptions = RequestInit & {
  method?: string;
};

const REQUEST_ID_HEADER = 'x-request-id';

function createRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowMs() {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function sendClientEvent(event: {
  event: string;
  path: string;
  method?: string;
  status?: number;
  durationMs?: number;
  requestId?: string;
  category?: string;
  message?: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  const body = JSON.stringify(event);
  const url = `${apiBaseUrl}/api/observability/client-events`;
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon(url, blob)) {
      return;
    }
  }

  void fetch(url, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body,
  }).catch(() => undefined);
}

export async function apiFetch(path: string, options: ApiRequestOptions = {}) {
  const requestId = createRequestId();
  const method = options.method ?? 'GET';
  const startedAt = nowMs();
  const headers = new Headers(options.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      method,
      headers,
    });

    if (!response.ok) {
      const message = await response.text();
      sendClientEvent({
        event: 'api.request.failed',
        path,
        method,
        status: response.status,
        durationMs: Math.round(nowMs() - startedAt),
        requestId: response.headers.get(REQUEST_ID_HEADER) ?? requestId,
        category: 'http_error',
        message: message.slice(0, 240),
      });
      const httpError = new Error(message) as Error & { clientEventLogged?: boolean };
      httpError.clientEventLogged = true;
      throw httpError;
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError' && !(error as Error & { clientEventLogged?: boolean }).clientEventLogged) {
      sendClientEvent({
        event: 'api.request.failed',
        path,
        method,
        durationMs: Math.round(nowMs() - startedAt),
        requestId,
        category: 'network_error',
        message: error.message.slice(0, 240),
      });
    }
    throw error;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path, { credentials: 'include' });
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await apiFetch(path, {
    method: 'DELETE',
    credentials: 'include',
  });
  return response.json() as Promise<T>;
}

export type SearchTenant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  distanceKm: number | null;
  availabilityState: string;
  category: { name: string; slug: string } | null;
  location: { locality: string; city: string; addressLine: string } | null;
  services: Array<{ id: string; name: string; durationMinutes: number; displayPriceAmount: string | null; displayPriceCurrency: string | null }>;
};

export type TenantDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  timezone: string;
  primaryCategory: { name: string; slug: string } | null;
  locations: Array<{ name: string; addressLine: string; locality: string; city: string }>;
  services: Array<ServiceDetail>;
  experts: Array<ExpertDetail>;
};

export type ServiceDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  displayPriceAmount: string | null;
  displayPriceCurrency: string | null;
  expertServices: Array<{ expert: ExpertDetail }>;
};

export type ExpertDetail = {
  id: string;
  displayName: string;
  shortBio: string | null;
  photoUrl: string | null;
};

export type Slot = {
  startsAt: string;
  endsAt: string;
  displayTime: string;
  expert: ExpertDetail;
};

export type CustomerUser = {
  id: string;
  name: string;
  email: string | null;
  mobileNumber: string | null;
};

export type CustomerAuthResponse = {
  user: CustomerUser;
  trustedDevice?: boolean;
  expiresAt?: string;
};
