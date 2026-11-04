'use client';

import { ChevronDown, LoaderCircle, LocateFixed, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { apiGet, SearchTenant } from '../lib/api';
import { EmptyState } from '../components/neara/app-shell';
import { ProviderCard } from '../components/neara/provider-card';

type SearchResponse = { items: SearchTenant[] };
type CategoryOption = { name: string; slug: string };
type ReverseGeocodeResult = { locality: string; city?: string };

const fallbackCategories: CategoryOption[] = [
  { name: 'Salon', slug: 'salon' },
  { name: 'Wellness', slug: 'wellness' },
  { name: 'Clinic', slug: 'clinic' },
  { name: 'Consulting', slug: 'consulting' },
];

export function SearchClient({
  initialKeyword = '',
  initialLocality = '',
  initialCategory = '',
  initialRadiusKm = 10,
  initialLatitude,
  initialLongitude,
  initialSearched = false,
}: {
  initialKeyword?: string;
  initialLocality?: string;
  initialCategory?: string;
  initialRadiusKm?: number;
  initialLatitude?: number;
  initialLongitude?: number;
  initialSearched?: boolean;
}) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [locality, setLocality] = useState(initialLocality);
  const [category, setCategory] = useState(initialCategory);
  const [radiusKm, setRadiusKm] = useState(initialRadiusKm);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialLatitude !== undefined && initialLongitude !== undefined
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : null,
  );
  const [categories, setCategories] = useState<CategoryOption[]>(fallbackCategories);
  const [items, setItems] = useState<SearchTenant[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(initialSearched);
  const [filtersOpen, setFiltersOpen] = useState(!initialSearched);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    apiGet<CategoryOption[]>('/api/public/categories')
      .then((result) => setCategories(result.length ? result : fallbackCategories))
      .catch(() => setCategories(fallbackCategories));
  }, []);

  useEffect(() => {
    if (initialSearched) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parameters(overrides: { categorySlug?: string; radius?: number } = {}) {
    const params = new URLSearchParams({ radiusKm: String(overrides.radius ?? radiusKm), take: '20' });
    const nextCategory = overrides.categorySlug ?? category;
    if (nextCategory) params.set('category', nextCategory);
    if (keyword.trim()) params.set('keyword', keyword.trim());
    if (coords) {
      params.set('latitude', String(coords.latitude));
      params.set('longitude', String(coords.longitude));
    } else if (locality.trim()) {
      params.set('locality', locality.trim());
    }
    return params;
  }

  async function load(overrides: { categorySlug?: string; radius?: number } = {}) {
    setHasSearched(true);
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<SearchResponse>(`/api/public/tenants?${parameters(overrides)}`);
      setItems(result.items);
    } catch {
      setError('Search is unavailable right now. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }

  function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFiltersOpen(false);
    void load();
  }

  function chooseCategory(slug: string) {
    setCategory(slug);
    void load({ categorySlug: slug });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const next = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };
        setCoords(next);
        try {
          const result = await apiGet<ReverseGeocodeResult>(
            `/api/public/reverse-geocode?latitude=${next.latitude}&longitude=${next.longitude}`,
          );
          setLocality(result.city && result.city !== result.locality ? `${result.locality}, ${result.city}` : result.locality);
        } catch {
          setLocality('');
        } finally {
          setDetecting(false);
        }
      },
      () => {
        setDetecting(false);
        setError('Location permission was denied. You can still search by locality.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  const placeLabel = locality.trim() || 'Pune';

  return (
    <main className="n-main">
      <h1 className="n-sr">Search results</h1>

      <div className="n-filter-bar">
        <button type="button" className="n-locality-button" onClick={() => setFiltersOpen((open) => !open)}>
          <MapPin aria-hidden="true" size={17} />
          <div>
            <strong>{placeLabel}</strong>
            <small>{coords ? 'Using your current location' : 'Locality and filters'}</small>
          </div>
          <ChevronDown aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          className="n-btn n-btn-secondary n-btn-sm"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
        >
          {filtersOpen ? <X aria-hidden="true" size={16} /> : <SlidersHorizontal aria-hidden="true" size={16} />}
          {filtersOpen ? 'Close' : 'Edit filters'}
        </button>
      </div>

      {filtersOpen ? (
        <form className="n-filter-panel n-mt" onSubmit={runSearch}>
          <label className="n-field">
            <span className="n-field-label">Locality</span>
            <span className="n-input-wrap">
              <MapPin className="n-input-icon" aria-hidden="true" size={18} />
              <input
                className="n-input n-input-has-action"
                value={locality}
                onChange={(event) => {
                  setLocality(event.target.value);
                  if (coords) setCoords(null);
                }}
                placeholder="Koregaon Park or Kalyani Nagar"
                autoComplete="off"
              />
              <button
                type="button"
                className="n-input-action"
                onClick={useCurrentLocation}
                aria-label="Use my current location"
              >
                {detecting ? <LoaderCircle aria-hidden="true" size={17} /> : <LocateFixed aria-hidden="true" size={17} />}
              </button>
            </span>
          </label>

          <label className="n-field">
            <span className="n-field-label">Service, practitioner or studio</span>
            <span className="n-input-wrap">
              <Search className="n-input-icon" aria-hidden="true" size={18} />
              <input
                className="n-input"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Deep tissue, Balayage, Physiotherapy"
              />
            </span>
          </label>

          <div className="n-field">
            <span className="n-field-label">Search radius</span>
            <div className="n-chip-row" role="group" aria-label="Search radius">
              {[5, 10, 25, 50].map((radius) => (
                <button
                  type="button"
                  className="n-chip"
                  key={radius}
                  aria-pressed={radiusKm === radius}
                  onClick={() => {
                    setRadiusKm(radius);
                    void load({ radius });
                  }}
                >
                  {radius} km
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="n-btn n-btn-block">
            <Search aria-hidden="true" size={18} />
            Show available slots
          </button>
        </form>
      ) : null}

      <div className="n-chip-row n-mt" role="group" aria-label="Category">
        <button type="button" className="n-chip" aria-pressed={category === ''} onClick={() => chooseCategory('')}>
          All modalities
        </button>
        {categories.map((item) => (
          <button
            type="button"
            className="n-chip"
            key={item.slug}
            aria-pressed={category === item.slug}
            onClick={() => chooseCategory(item.slug)}
          >
            {item.name}
          </button>
        ))}
      </div>

      {error ? (
        <p className="n-note n-mt" data-tone="error">
          {error}
        </p>
      ) : null}

      {!filtersOpen ? (
        <p className="n-result-count n-mt">
          {loading ? 'Finding providers…' : (
            <>
              <strong className="n-tabular">{items.length}</strong>
              {items.length === 1 ? ' provider' : ' providers'} in {placeLabel} · within {radiusKm} km
            </>
          )}
        </p>
      ) : null}

      <div className="n-grid-providers n-mt">
        {loading
          ? [0, 1, 2].map((key) => <div className="n-skeleton" key={key} aria-hidden="true" />)
          : items.map((tenant) => <ProviderCard tenant={tenant} cta="View services & book" key={tenant.id} />)}
      </div>

      {!loading && hasSearched && items.length === 0 && !error ? (
        <div className="n-mt">
          <EmptyState title="No providers matched this search">
            <p className="n-body">Widen the radius, choose another category, or search a nearby locality.</p>
          </EmptyState>
        </div>
      ) : null}
    </main>
  );
}
