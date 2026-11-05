import { apiRequest, buildQuery } from '@/lib/http';
import type {
  AuditLogEntry,
  BookingListResponse,
  BookingRecord,
  BookingStatus,
  Category,
  LogListResponse,
  NotificationLogEntry,
  PlatformTenant,
} from '@/types';

export function listTenants() {
  return apiRequest<PlatformTenant[]>('/admin/platform/tenants');
}

export function getTenant(tenantId: string) {
  return apiRequest<PlatformTenant>(`/admin/platform/tenants/${encodeURIComponent(tenantId)}`);
}

export function setTenantStatus(tenantId: string, action: 'activate' | 'inactivate' | 'suspend') {
  return apiRequest<PlatformTenant>(
    `/admin/platform/tenants/${encodeURIComponent(tenantId)}/${action}`,
    { method: 'POST' },
  );
}

export function listCategories() {
  return apiRequest<Category[]>('/admin/platform/categories');
}

export function updateCategory(categoryId: string, input: { isActive: boolean }) {
  return apiRequest<Category>(`/admin/platform/categories/${encodeURIComponent(categoryId)}`, {
    method: 'PATCH',
    body: input,
  });
}

export function createCategory(input: { name: string; slug: string; description?: string }) {
  return apiRequest<Category>('/admin/platform/categories', { method: 'POST', body: input });
}

export function listBookings(input: { search?: string; status?: BookingStatus; take?: number }) {
  return apiRequest<BookingListResponse>(
    `/admin/platform/bookings${buildQuery({ ...input, take: input.take ?? 50 })}`,
  );
}

export function getBooking(bookingId: string) {
  return apiRequest<BookingRecord>(
    `/admin/platform/bookings/${encodeURIComponent(bookingId)}`,
  );
}

export function cancelBooking(bookingId: string, reason?: string) {
  return apiRequest<BookingRecord>(
    `/admin/platform/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: 'POST', body: { reason } },
  );
}

export function listAuditLogs(input: { search?: string; take?: number } = {}) {
  return apiRequest<LogListResponse<AuditLogEntry>>(
    `/admin/platform/audit-logs${buildQuery({ ...input, take: input.take ?? 40 })}`,
  );
}

export function listNotificationLogs(input: { search?: string; take?: number } = {}) {
  return apiRequest<LogListResponse<NotificationLogEntry>>(
    `/admin/platform/notification-logs${buildQuery({ ...input, take: input.take ?? 40 })}`,
  );
}

export function getQueueStats() {
  return apiRequest<Record<string, unknown>>('/admin/platform/queue/notifications');
}
