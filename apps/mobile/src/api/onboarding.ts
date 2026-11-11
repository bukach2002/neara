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
 * Creates the tenant and its owner account. Any cookies on this response are
 * ignored by the native app: the caller signs in through `/mobile/auth/login`
 * to bind an admin-audience bearer token to this device.
 */
export function signUpBusiness(input: BusinessSignupInput) {
  return apiRequest<TenantSignupResponse>('/public/tenant-signup', {
    method: 'POST',
    body: input,
    notifyUnauthorized: false,
  });
}
