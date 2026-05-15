'use client';

import { useEffect, useState } from 'react';
import { PublicHeader } from '../../components/PublicHeader';
import { apiGet, TenantDetail } from '../../lib/api';
import { BookingPanel } from './BookingPanel';

export function TenantClient({ slug }: { slug: string }) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<TenantDetail>(`/api/public/tenants/${slug}`)
      .then(setTenant)
      .catch(() => setError('This tenant is not available.'));
  }, [slug]);

  if (error) {
    return (
      <main className="page-shell">
        <PublicHeader />
        <p className="notice error">{error}</p>
      </main>
    );
  }

  if (!tenant) {
    return (
      <main className="page-shell">
        <PublicHeader />
        <p className="notice">Loading tenant...</p>
      </main>
    );
  }

  const location = tenant.locations[0];

  return (
    <main className="page-shell">
      <PublicHeader />
      <section className="tenant-hero">
        <div>
          <p className="eyebrow">{tenant.primaryCategory?.name ?? 'Appointment booking'}</p>
          <h1>{tenant.name}</h1>
          <p>{tenant.description ?? 'Book a confirmed appointment without creating an account.'}</p>
          {location && <p className="muted">{`${location.addressLine}, ${location.locality}, ${location.city}`}</p>}
        </div>
        {tenant.logoUrl && <img src={tenant.logoUrl} alt="" />}
      </section>

      <section className="split-layout">
        <div>
          <h2>Services</h2>
          <div className="stack-list">
            {tenant.services.map((service) => (
              <article className="compact-card" key={service.id}>
                <h3>{service.name}</h3>
                <p>{service.description ?? `${service.durationMinutes} minutes`}</p>
                <p className="muted">
                  {service.durationMinutes} min {service.displayPriceAmount ? `• ${service.displayPriceCurrency ?? 'INR'} ${service.displayPriceAmount}` : ''}
                </p>
              </article>
            ))}
          </div>

          <h2>Experts</h2>
          <div className="stack-list">
            {tenant.experts.map((expert) => (
              <article className="compact-card" key={expert.id}>
                <h3>{expert.displayName}</h3>
                <p>{expert.shortBio ?? 'Available for selected services.'}</p>
              </article>
            ))}
          </div>
        </div>
        <BookingPanel tenant={tenant} />
      </section>
    </main>
  );
}
