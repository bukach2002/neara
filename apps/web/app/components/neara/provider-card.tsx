import { ArrowRight, Clock, MapPin } from 'lucide-react';
import type { SearchTenant } from '../../lib/api';
import { availabilityState, formatDistance, formatDuration, formatPrice, initials } from './format';

export function ProviderCard({ tenant, cta = 'View availability' }: { tenant: SearchTenant; cta?: string }) {
  const state = availabilityState(tenant.availabilityState);
  const distance = formatDistance(tenant.distanceKm);
  const locality = tenant.location
    ? [tenant.location.locality, tenant.location.city].filter(Boolean).join(', ')
    : null;
  const services = tenant.services.slice(0, 2);

  return (
    <a className="n-provider" href={`/tenants/${tenant.slug}`}>
      <div className={tenant.logoUrl ? 'n-provider-media n-provider-logo' : 'n-provider-media'}>
        {tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt="" loading="lazy" />
        ) : (
          <span className="n-provider-monogram" aria-hidden="true">
            {initials(tenant.name)}
          </span>
        )}
        {tenant.category ? <span className="n-pill n-media-pill">{tenant.category.name}</span> : null}
        <span className={state.tone === 'teal' ? 'n-pill n-pill-teal n-media-state' : 'n-pill n-media-state'}>
          <span className="n-pill-dot" aria-hidden="true" />
          {state.label}
        </span>
      </div>
      <div className="n-provider-body">
        <div>
          <h3 className="n-provider-name">{tenant.name}</h3>
          <div className="n-provider-meta">
            {locality ? (
              <span>
                <MapPin aria-hidden="true" size={13} />
                {locality}
              </span>
            ) : null}
            {distance ? <span className="n-tabular">{distance}</span> : null}
          </div>
        </div>
        {tenant.description ? <p className="n-provider-desc">{tenant.description}</p> : null}
        {services.length > 0 ? (
          <div className="n-service-list">
            {services.map((service) => {
              const price = formatPrice(service.displayPriceAmount, service.displayPriceCurrency);
              return (
                <div className="n-service-row" key={service.id}>
                  <div>
                    <p className="n-service-name">{service.name}</p>
                    <p className="n-service-meta">
                      <Clock aria-hidden="true" size={11} />
                      {formatDuration(service.durationMinutes)}
                    </p>
                  </div>
                  {price ? (
                    <span className="n-service-price n-tabular">{price}</span>
                  ) : (
                    <span className="n-service-meta">Price at venue</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
        <span className="n-btn n-btn-secondary n-btn-sm n-btn-block">
          {cta}
          <ArrowRight aria-hidden="true" size={16} />
        </span>
      </div>
    </a>
  );
}
