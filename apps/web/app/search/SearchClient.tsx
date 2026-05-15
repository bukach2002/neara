'use client';

import { CalendarDays, LocateFixed, Search } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { apiGet, SearchTenant } from '../lib/api';

type SearchResponse = { items: SearchTenant[] };
type ReverseGeocodeResult = { locality: string; city?: string };

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
    initialLatitude !== undefined && initialLongitude !== undefined ? { latitude: initialLatitude, longitude: initialLongitude } : null,
  );
  const [items, setItems] = useState<SearchTenant[]>([]);
  const [error, setError] = useState('');
  const [locationStatus, setLocationStatus] = useState(
    initialLatitude !== undefined && initialLongitude !== undefined ? `Using location within ${initialRadiusKm} km.` : '',
  );
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(initialSearched);

  async function runSearch(event?: FormEvent, overrideCoords = coords) {
    event?.preventDefault();
    setHasSearched(true);
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (locality) params.set('locality', locality);
    if (category) params.set('category', category.toLowerCase());
    params.set('radiusKm', String(radiusKm));
    if (overrideCoords) {
      params.set('latitude', String(overrideCoords.latitude));
      params.set('longitude', String(overrideCoords.longitude));
    }

    try {
      const result = await apiGet<SearchResponse>(`/api/public/tenants?${params}`);
      setItems(result.items);
    } catch {
      setError('Search is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }

  function useCurrentLocation() {
    setError('');
    setLocationStatus('');
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }

    setLocationStatus('Getting your location...');
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
          setLocationStatus(`Using ${result.locality} within ${radiusKm} km. Click Search to find tenants.`);
        } catch {
          setLocationStatus(`Location ready. Click Search to find tenants within ${radiusKm} km.`);
        }
      },
      () => {
        setLocationStatus('');
        setError('Location permission was denied. You can still search by locality.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  function clearCurrentLocation() {
    setCoords(null);
    setLocationStatus('');
  }

  useEffect(() => {
    if (initialSearched) void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <form className="search-panel search-panel-page" onSubmit={runSearch}>
        <label>
          <span>What do you need?</span>
          <div className="field">
            <Search aria-hidden="true" size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search services or businesses" />
          </div>
        </label>
        <label>
          <span>Locality</span>
          <div className="field">
            <button type="button" className="field-icon-button" onClick={useCurrentLocation} aria-label="Use my location" title="Use my location">
              <LocateFixed aria-hidden="true" size={18} />
            </button>
            <input value={locality} onChange={(event) => setLocality(event.target.value)} placeholder="Bengaluru, Mumbai, Delhi..." />
          </div>
        </label>
        <label>
          <span>Category</span>
          <div className="field">
            <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="salon" />
          </div>
        </label>
        <button type="submit">
          <CalendarDays aria-hidden="true" size={18} />
          Search
        </button>
        <div className="nearby-controls">
          {coords && (
            <button type="button" className="link-button" onClick={clearCurrentLocation}>
              Clear location
            </button>
          )}
          <label>
            <span>Radius</span>
            <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
            </select>
          </label>
        </div>
      </form>

      {error && <p className="notice error">{error}</p>}
      {locationStatus && <p className="notice">{locationStatus}</p>}
      {loading && <p className="notice">Searching...</p>}

      <div className="result-list">
        {items.map((tenant) => (
          <a className="result-card" href={`/tenants/${tenant.slug}`} key={tenant.id}>
            <div>
              <p className="eyebrow">{tenant.category?.name ?? 'Service'}</p>
              <h2>{tenant.name}</h2>
              <p>{tenant.description ?? 'Local appointment booking available.'}</p>
              <p className="muted">{tenant.location ? `${tenant.location.locality}, ${tenant.location.city}` : 'Location coming soon'}</p>
            </div>
            <div className="result-meta">
              <span>{tenant.distanceKm === null ? 'Nearby' : `${tenant.distanceKm.toFixed(1)} km`}</span>
              <span>{tenant.availabilityState === 'availability_configured' ? 'Slots available' : 'No slots currently available'}</span>
            </div>
          </a>
        ))}
        {!loading && hasSearched && items.length === 0 && <p className="notice">No matching tenants yet.</p>}
      </div>
    </>
  );
}
