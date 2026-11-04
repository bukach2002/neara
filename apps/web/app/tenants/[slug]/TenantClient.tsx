'use client';

import { Clock, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet, TenantDetail } from '../../lib/api';
import { AppBar, EmptyState, SectionHead } from '../../components/neara/app-shell';
import { formatDuration, formatPrice, initials } from '../../components/neara/format';
import { Pill } from '../../components/neara/primitives';
import { BookingPanel } from './BookingPanel';

export function TenantClient({ slug }: { slug: string }) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<TenantDetail>(`/api/public/tenants/${slug}`)
      .then(setTenant)
      .catch(() => setError('We could not open this studio. It may no longer be listed.'));
  }, [slug]);

  if (error) {
    return (
      <>
        <AppBar variant="back" title="Studio details" />
        <main className="n-main">
          <EmptyState title="Studio unavailable">
            <p className="n-body">{error}</p>
            <a className="n-btn n-btn-secondary n-btn-sm n-mt" href="/">
              Back to discover
            </a>
          </EmptyState>
        </main>
      </>
    );
  }

  if (!tenant) {
    return (
      <>
        <AppBar variant="back" title="Studio details" />
        <main className="n-main" aria-busy="true">
          <div className="n-skeleton n-mt" aria-hidden="true" />
          <div className="n-skeleton n-mt" aria-hidden="true" />
        </main>
      </>
    );
  }

  const location = tenant.locations[0];
  const hasAvailability = tenant.services.length > 0 && tenant.experts.length > 0;

  return (
    <>
      <AppBar variant="back" title="Studio details" />
      <main className="n-main">
        <div className="n-detail-hero">
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt="" />
          ) : (
            <span className="n-provider-monogram" aria-hidden="true">
              {initials(tenant.name)}
            </span>
          )}
          <div className="n-detail-hero-badges">
            <Pill>{tenant.primaryCategory?.name ?? 'Appointment studio'}</Pill>
            <Pill tone={hasAvailability ? 'teal' : 'neutral'} dot>
              {hasAvailability ? 'Slots available' : 'No slots for now'}
            </Pill>
          </div>
        </div>

        <div className="n-detail-intro">
          <h1 className="n-display">{tenant.name}</h1>
          {location ? (
            <p className="n-detail-address">
              <MapPin aria-hidden="true" size={14} />
              {[location.addressLine, location.locality, location.city].filter(Boolean).join(', ')}
            </p>
          ) : null}
          {tenant.description ? <p className="n-body">{tenant.description}</p> : null}
          <div className="n-detail-facts">
            <Pill>{tenant.services.length} services</Pill>
            <Pill>{tenant.experts.length} practitioners</Pill>
          </div>
        </div>

        <div className="n-detail-grid">
          <div>
            <section aria-labelledby="studio-services">
              <SectionHead title="Services" />
              <h2 id="studio-services" className="n-sr">
                Services
              </h2>
              <div className="n-stack">
                {tenant.services.length > 0 ? (
                  tenant.services.map((service) => {
                    const price = formatPrice(service.displayPriceAmount, service.displayPriceCurrency);
                    return (
                      <div className="n-service-item" key={service.id}>
                        <div className="n-service-item-body">
                          <div className="n-service-item-head">
                            <h3>{service.name}</h3>
                            {price ? <span className="n-tabular">{price}</span> : null}
                          </div>
                          <p className="n-service-meta">
                            <Clock aria-hidden="true" size={12} />
                            {formatDuration(service.durationMinutes)}
                          </p>
                          {service.description ? <p className="n-option-sub">{service.description}</p> : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="n-meta">This studio has not published a service list yet.</p>
                )}
              </div>
            </section>

            <section className="n-mt-xl" aria-labelledby="studio-experts">
              <SectionHead title="Practitioners" />
              <h2 id="studio-experts" className="n-sr">
                Practitioners
              </h2>
              <div className="n-expert-strip">
                {tenant.experts.length > 0 ? (
                  tenant.experts.map((expert) => (
                    <div className="n-expert" key={expert.id}>
                      <span className="n-expert-avatar" aria-hidden="true">
                        {expert.photoUrl ? <img src={expert.photoUrl} alt="" /> : initials(expert.displayName)}
                      </span>
                      <div>
                        <p className="n-option-title">{expert.displayName}</p>
                        {expert.shortBio ? <p className="n-option-sub">{expert.shortBio}</p> : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="n-meta">No practitioners listed yet.</p>
                )}
              </div>
            </section>

            <p className="n-receipt-assurance n-assurance">
              <Sparkles aria-hidden="true" size={16} />
              <span>
                Prices and durations are set by the studio. Nothing is charged online — settle directly at
                the venue after your appointment.
              </span>
            </p>
          </div>

          <BookingPanel tenant={tenant} />
        </div>
      </main>
    </>
  );
}
