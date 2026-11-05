import { apiRequest, buildQuery } from '@/lib/http';
import type {
  AvailableSlotsResponse,
  Category,
  SearchTenantsResponse,
  TenantDetail,
} from '@/types';

export function getCategories() {
  return apiRequest<Category[]>('/public/categories');
}

export function searchTenants(input: { keyword?: string; category?: string; locality?: string }) {
  return apiRequest<SearchTenantsResponse>(
    `/public/tenants${buildQuery({ ...input, take: 30 })}`,
  );
}

export function getTenant(slug: string) {
  return apiRequest<TenantDetail>(`/public/tenants/${encodeURIComponent(slug)}`);
}

export function getAvailableSlots(input: {
  slug: string;
  serviceId: string;
  date: string;
  expertId?: string;
}) {
  const query = buildQuery({
    serviceId: input.serviceId,
    date: input.date,
    expertId: input.expertId,
  });
  return apiRequest<AvailableSlotsResponse>(
    `/public/tenants/${encodeURIComponent(input.slug)}/available-slots${query}`,
  );
}
