'use client';

import { CalendarDays, Clock, LoaderCircle, LocateFixed, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiGet, SearchTenant, TenantDetail } from '../lib/api';
import { Badge, Notice } from './ui';

type ReverseGeocodeResult = { locality: string; city?: string };
type CategoryOption = { name: string; slug: string };
type SearchOption = { label: string; type: 'Business' | 'Service' | 'Expert' };
type SearchResponse = { items: SearchTenant[] };

const fallbackCategories: CategoryOption[] = [
  { name: 'Salon', slug: 'salon' },
  { name: 'Wellness', slug: 'wellness' },
  { name: 'Clinic', slug: 'clinic' },
  { name: 'Consulting', slug: 'consulting' },
];

export function HomeSearchForm() {
  const [locality, setLocality] = useState('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>(fallbackCategories);
  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);
  const [items, setItems] = useState<SearchTenant[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const hasLocation = Boolean(coords || locality.trim().length >= 2);

  useEffect(() => {
    useCurrentLocation();
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasLocation) {
      setSearchOptions([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadLocationOptions();
    }, coords ? 0 : 350);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.latitude, coords?.longitude, locality, radiusKm]);

  async function loadCategories() {
    try {
      const items = await apiGet<Array<{ name: string; slug: string }>>('/api/public/categories');
      const nextCategories = items.map((item) => ({ name: item.name, slug: item.slug })).sort((left, right) => left.name.localeCompare(right.name));
      setCategories(nextCategories.length ? nextCategories : fallbackCategories);
    } catch {
      setCategories(fallbackCategories);
    }
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextCoords = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };
        setCoords(nextCoords);
        try {
          const result = await apiGet<ReverseGeocodeResult>(
            `/api/public/reverse-geocode?latitude=${nextCoords.latitude}&longitude=${nextCoords.longitude}`,
          );
          setLocality(result.city && result.city !== result.locality ? `${result.locality}, ${result.city}` : result.locality);
        } catch {
          setLocality('');
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        setCoords(null);
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  function updateLocality(value: string) {
    setLocality(value);
    if (coords) {
      setCoords(null);
    }
  }

  async function loadLocationOptions() {
    const params = new URLSearchParams({ radiusKm: String(radiusKm), take: '40' });
    if (coords) {
      params.set('latitude', String(coords.latitude));
      params.set('longitude', String(coords.longitude));
    } else {
      params.set('locality', locality.trim());
    }

    try {
      const result = await apiGet<SearchResponse>(`/api/public/tenants?${params}`);
      const nextOptions = await buildSearchOptions(result.items);
      setSearchOptions(nextOptions);
    } catch {
      setSearchOptions([]);
    }
  }

  async function buildSearchOptions(tenants: SearchTenant[]) {
    const options = new Map<string, SearchOption>();
    for (const tenant of tenants) {
      options.set(`Business:${tenant.name.toLowerCase()}`, { label: tenant.name, type: 'Business' });
      for (const service of tenant.services) {
        options.set(`Service:${service.name.toLowerCase()}`, { label: service.name, type: 'Service' });
      }
    }

    const detailResults = await Promise.allSettled(
      tenants.slice(0, 12).map((tenant) => apiGet<TenantDetail>(`/api/public/tenants/${tenant.slug}`)),
    );
    for (const detail of detailResults) {
      if (detail.status !== 'fulfilled') continue;
      for (const expert of detail.value.experts) {
        options.set(`Expert:${expert.displayName.toLowerCase()}`, { label: expert.displayName, type: 'Expert' });
      }
    }

    return Array.from(options.values()).sort((left, right) => left.label.localeCompare(right.label));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSearched(true);
    setSearching(true);
    setSearchError('');
    const params = new URLSearchParams({ radiusKm: String(radiusKm) });
    if (category) params.set('category', category);
    if (keyword.trim()) params.set('keyword', keyword.trim());
    if (coords) {
      params.set('latitude', String(coords.latitude));
      params.set('longitude', String(coords.longitude));
    } else if (locality.trim()) {
      params.set('locality', locality.trim());
    }

    try {
      const result = await apiGet<SearchResponse>(`/api/public/tenants?${params}`);
      setItems(result.items);
    } catch {
      setSearchError('Search is unavailable right now.');
    } finally {
      setSearching(false);
    }
  }

  const keywordPlaceholder = hasLocation ? 'Business, service, or expert' : 'Set locality first';
  const groupedOptions = useMemo(() => searchOptions, [searchOptions]);

  return (
    <div className="home-search-stack">
      <form className="search-panel home-search-panel home-search-panel-focused" onSubmit={submit}>
        <label>
          <span>Category</span>
          <div className="field">
            <SlidersHorizontal aria-hidden="true" size={18} />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((item) => (
                <option value={item.slug} key={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label>
          <span>Locality</span>
          <div className="field">
            <button type="button" className="field-icon-button" onClick={() => useCurrentLocation()} aria-label="Use my location" title="Use my location">
              <LocateFixed aria-hidden="true" size={18} />
            </button>
            <input value={locality} onChange={(event) => updateLocality(event.target.value)} placeholder="Enter locality or city" autoComplete="off" />
            {detectingLocation && <LoaderCircle className="field-spinner" aria-label="Detecting location" size={16} />}
          </div>
        </label>

        <label>
          <span>Name, business, service, or expert</span>
          <div className="field">
            <Search aria-hidden="true" size={18} />
            <input
              list="home-search-options"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={keywordPlaceholder}
              disabled={!hasLocation}
            />
            <datalist id="home-search-options">
              {groupedOptions.map((item) => (
                <option value={item.label} label={item.type} key={`${item.type}-${item.label}`} />
              ))}
            </datalist>
          </div>
        </label>

        <button type="submit">
          <CalendarDays aria-hidden="true" size={18} />
          Search
        </button>

        <div className="nearby-controls">
          <label>
            <span><MapPin aria-hidden="true" size={14} /> Radius</span>
            <select name="radiusKm" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
            </select>
          </label>
        </div>
      </form>

      {searchError && <Notice tone="error">{searchError}</Notice>}
      {searching && <Notice>Searching...</Notice>}
      {hasSearched && !searching && items.length === 0 && <Notice>No matching tenants yet.</Notice>}
      {items.length > 0 && (
        <div className="result-list home-result-list">
          {items.map((tenant) => (
            <a className="result-card" href={`/tenants/${tenant.slug}`} key={tenant.id}>
              <div className="result-media" aria-hidden="true">
                {tenant.logoUrl ? <img src={tenant.logoUrl} alt="" /> : <span>{tenant.name.slice(0, 1)}</span>}
              </div>
              <div>
                <p className="eyebrow">{tenant.category?.name ?? 'Service'}</p>
                <h2>{tenant.name}</h2>
                <p>{tenant.description ?? 'Local appointment booking available.'}</p>
                <p className="muted result-location">
                  <MapPin aria-hidden="true" size={15} />
                  {tenant.location ? `${tenant.location.locality}, ${tenant.location.city}` : 'Location coming soon'}
                </p>
                <div className="service-chips">
                  {tenant.services.slice(0, 3).map((service) => (
                    <span key={service.id}>
                      {service.name}
                      <small>
                        <Clock aria-hidden="true" size={12} />
                        {service.durationMinutes} min
                        {service.displayPriceAmount ? ` - ${service.displayPriceCurrency ?? 'INR'} ${service.displayPriceAmount}` : ''}
                      </small>
                    </span>
                  ))}
                </div>
              </div>
              <div className="result-meta">
                <span>{tenant.distanceKm === null ? 'Nearby' : `${tenant.distanceKm.toFixed(1)} km`}</span>
                <Badge tone={tenant.availabilityState === 'availability_configured' ? 'active' : 'inactive'}>
                  {tenant.availabilityState === 'availability_configured' ? 'Slots available' : 'No slots'}
                </Badge>
                <span className="card-action">Book</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
