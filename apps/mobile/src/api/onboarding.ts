import { apiRequest, buildQuery } from '@/lib/http';
import type { SlugCheck, TenantSignupResponse } from '@/types';

/** Public page-address availability check used by the business signup form. */
export function checkSlugAvailability(slug: string) {
  return apiRequest<SlugCheck>(`/public/tenant-slug/check${buildQuery({ slug })}`, {
    notifyUnauthorized: false,
  });
}

export type BusinessSignupInput = {
  businessName: string;
  slug: string;
  ownerName: string;
  email: string;
  password: string;
  timezone?: string;
};

/**
 * Creates the tenant and its owner account, and opens an admin-audience session
 * for that owner (the API sets the session and CSRF cookies on this response).
 */
export function signUpBusiness(input: BusinessSignupInput) {
  return apiRequest<TenantSignupResponse>('/public/tenant-signup', {
    method: 'POST',
    body: input,
    notifyUnauthorized: false,
  });
}
