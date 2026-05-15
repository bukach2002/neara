export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_APP_URL || process.env.API_APP_URL || 'http://localhost:4000').replace(/\/$/, '');

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
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
