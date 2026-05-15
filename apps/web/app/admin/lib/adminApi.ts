'use client';

import { apiBaseUrl } from '../../lib/api';

function csrfToken() {
  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
    ?.slice('XSRF-TOKEN='.length);
}

export async function adminGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include' });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function adminSend<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const token = csrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-csrf-token': token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function adminUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = csrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { 'x-csrf-token': token } : {}),
    },
    body: formData,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  platformRole: string;
  memberships: Array<{ tenantId: string; role: string; tenant: { id: string; name: string; slug: string; status: string } }>;
};

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string | null;
  bookingPrefix: string;
  primaryCategory: { name: string } | null;
  _count: { services: number; experts: number; bookings: number; memberships: number };
};

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  _count: { tenants: number };
};
