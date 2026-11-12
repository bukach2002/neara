import { apiRequest, buildQuery } from '@/lib/http';
import type {
  AvailabilityRule,
  BookingListResponse,
  BookingRecord,
  BookingStatus,
  GeocodeResult,
  OnboardingStatus,
  TenantDashboard,
  TenantExpert,
  TenantLocation,
  TenantProfile,
  TenantService,
} from '@/types';

function base(tenantId: string) {
  return `/admin/tenant/${encodeURIComponent(tenantId)}`;
}

export function getDashboard(tenantId: string) {
  return apiRequest<TenantDashboard>(`${base(tenantId)}/dashboard`);
}

export function getOnboarding(tenantId: string) {
  return apiRequest<OnboardingStatus>(`${base(tenantId)}/onboarding`);
}

export function getProfile(tenantId: string) {
  return apiRequest<TenantProfile>(`${base(tenantId)}/profile`);
}

export function updateProfile(
  tenantId: string,
  input: {
    name?: string;
    primaryCategoryId?: string;
    timezone?: string;
    description?: string;
    publicEmail?: string;
    publicPhone?: string;
  },
) {
  return apiRequest<TenantProfile>(`${base(tenantId)}/profile`, { method: 'PATCH', body: input });
}

export function listLocations(tenantId: string) {
  return apiRequest<TenantLocation[]>(`${base(tenantId)}/locations`);
}

export function upsertPrimaryLocation(
  tenantId: string,
  input: {
    name: string;
    addressLine: string;
    locality: string;
    city: string;
    state?: string;
    postalCode?: string;
    latitude: number;
    longitude: number;
  },
) {
  return apiRequest<TenantLocation>(`${base(tenantId)}/locations/primary`, {
    method: 'POST',
    body: input,
  });
}

export function geocodeAddress(tenantId: string, address: string) {
  return apiRequest<GeocodeResult>(`${base(tenantId)}/geocode${buildQuery({ address })}`);
}

export function createService(
  tenantId: string,
  input: { name: string; slug: string; durationMinutes: number; displayPriceAmount?: number },
) {
  return apiRequest<TenantService>(`${base(tenantId)}/services`, { method: 'POST', body: input });
}

export function createExpert(tenantId: string, input: { displayName: string; slug: string; shortBio?: string }) {
  return apiRequest<{ id: string; displayName: string; slug: string; isActive: boolean }>(
    `${base(tenantId)}/experts`,
    { method: 'POST', body: input },
  );
}

export function setExpertServices(tenantId: string, expertId: string, serviceIds: string[]) {
  return apiRequest<unknown>(`${base(tenantId)}/experts/${encodeURIComponent(expertId)}/services`, {
    method: 'POST',
    body: { serviceIds },
  });
}

export function listAvailabilityRules(tenantId: string, expertId: string) {
  return apiRequest<AvailabilityRule[]>(
    `${base(tenantId)}/experts/${encodeURIComponent(expertId)}/availability-rules`,
  );
}

export function createAvailabilityRule(
  tenantId: string,
  expertId: string,
  input: { dayOfWeek: number; startLocalTime: string; endLocalTime: string },
) {
  return apiRequest<AvailabilityRule>(
    `${base(tenantId)}/experts/${encodeURIComponent(expertId)}/availability-rules`,
    { method: 'POST', body: input },
  );
}

export function completeOnboarding(tenantId: string) {
  return apiRequest<{ tenant: { id: string; name: string; slug: string; status: string } }>(
    `${base(tenantId)}/onboarding/complete`,
    { method: 'POST', body: {} },
  );
}

export function listServices(tenantId: string) {
  return apiRequest<TenantService[]>(`${base(tenantId)}/services`);
}

export function updateService(tenantId: string, serviceId: string, input: { isActive?: boolean; isPublic?: boolean }) {
  return apiRequest<TenantService>(
    `${base(tenantId)}/services/${encodeURIComponent(serviceId)}`,
    { method: 'PATCH', body: input },
  );
}

export function listExperts(tenantId: string) {
  return apiRequest<TenantExpert[]>(`${base(tenantId)}/experts`);
}

export function updateExpert(tenantId: string, expertId: string, input: { isActive?: boolean }) {
  return apiRequest<TenantExpert>(
    `${base(tenantId)}/experts/${encodeURIComponent(expertId)}`,
    { method: 'PATCH', body: input },
  );
}

export function listBookings(
  tenantId: string,
  input: { status?: BookingStatus; search?: string; take?: number } = {},
) {
  return apiRequest<BookingListResponse>(
    `${base(tenantId)}/bookings${buildQuery({ ...input, take: input.take ?? 50 })}`,
  );
}

export function getBooking(tenantId: string, bookingId: string) {
  return apiRequest<BookingRecord>(
    `${base(tenantId)}/bookings/${encodeURIComponent(bookingId)}`,
  );
}

export function cancelBooking(tenantId: string, bookingId: string, reason?: string) {
  return apiRequest<BookingRecord>(
    `${base(tenantId)}/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: 'POST', body: { reason } },
  );
}

export function completeBooking(tenantId: string, bookingId: string, reason?: string) {
  return apiRequest<BookingRecord>(
    `${base(tenantId)}/bookings/${encodeURIComponent(bookingId)}/complete`,
    { method: 'POST', body: { reason } },
  );
}

export function markNoShow(tenantId: string, bookingId: string, reason?: string) {
  return apiRequest<BookingRecord>(
    `${base(tenantId)}/bookings/${encodeURIComponent(bookingId)}/no-show`,
    { method: 'POST', body: { reason } },
  );
}
