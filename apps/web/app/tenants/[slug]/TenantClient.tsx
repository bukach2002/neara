'use client';

import { useEffect, useState } from 'react';
import { PublicHeader } from '../../components/PublicHeader';
import { Badge, Notice, SectionHeader } from '../../components/ui';
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
        <Notice tone="error">{error}</Notice>
      </main>
    );
  }

  if (!tenant) {
    return (
      <main className="page-shell">
        <PublicHeader />
        <Notice>Loading tenant...</Notice>
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
          <div className="hero-badges">
            <Badge tone="active">{tenant.services.length} services</Badge>
            <Badge tone="active">{tenant.experts.length} experts</Badge>
          </div>
        </div>
        <div className="tenant-media" aria-hidden="true">
          {tenant.logoUrl ? <img src={tenant.logoUrl} alt="" /> : <span>{tenant.name.slice(0, 1)}</span>}
        </div>
      </section>

      <section className="split-layout">
        <div>
          <SectionHeader title="Services" />
          <div className="stack-list">
            {tenant.services.map((service) => (
              <article className="compact-card service-card" key={service.id}>
                <div>
                  <h3>{service.name}</h3>
                  <p>{service.description ?? `${service.durationMinutes} minutes`}</p>
                </div>
                <p className="muted">
                  {service.durationMinutes} min {service.displayPriceAmount ? `- ${service.displayPriceCurrency ?? 'INR'} ${service.displayPriceAmount}` : ''}
                </p>
              </article>
            ))}
          </div>

          <SectionHeader title="Experts" />
          <div className="stack-list">
            {tenant.experts.map((expert) => (
              <article className="compact-card expert-card" key={expert.id}>
                <div className="expert-avatar" aria-hidden="true">
                  {expert.photoUrl ? <img src={expert.photoUrl} alt="" /> : <span>{expert.displayName.slice(0, 1)}</span>}
                </div>
                <div>
                  <h3>{expert.displayName}</h3>
                  <p>{expert.shortBio ?? 'Available for selected services.'}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <BookingPanel tenant={tenant} />
      </section>
    </main>
  );
}
