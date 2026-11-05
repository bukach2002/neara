import { apiRequest, buildQuery } from '@/lib/http';
import type {
  BookingListResponse,
  BookingRecord,
  BookingStatus,
  OnboardingStatus,
  TenantDashboard,
  TenantExpert,
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
