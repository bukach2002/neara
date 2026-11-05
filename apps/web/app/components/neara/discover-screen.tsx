'use client';

import {
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Flower2,
  LoaderCircle,
  LocateFixed,
  MessagesSquare,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, SearchTenant } from '../../lib/api';
import { SectionHead, EmptyState } from './app-shell';
import { ProviderCard } from './provider-card';

type CategoryOption = { name: string; slug: string };
type SearchResponse = { items: SearchTenant[] };
type ReverseGeocodeResult = { locality: string; city?: string };

const fallbackCategories: CategoryOption[] = [
  { name: 'Salon', slug: 'salon' },
  { name: 'Wellness', slug: 'wellness' },
  { name: 'Clinic', slug: 'clinic' },
  { name: 'Consulting', slug: 'consulting' },
];

const categoryIcons: Record<string, typeof Sparkles> = {
  salon: Scissors,
  wellness: Flower2,
  clinic: Stethoscope,
  consulting: MessagesSquare,
};

export function DiscoverScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>(fallbackCategories);
  const [category, setCategory] = useState('');
  const [locality, setLocality] = useState('');
  const [keyword, setKeyword] = useState('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [items, setItems] = useState<SearchTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<CategoryOption[]>('/api/public/categories')
      .then((result) => setCategories(result.length ? result : fallbackCategories))
      .catch(() => setCategories(fallbackCategories));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ take: '6', radiusKm: String(radiusKm) });
    if (category) params.set('category', category);
    if (coords) {
      params.set('latitude', String(coords.latitude));
      params.set('longitude', String(coords.longitude));
    } else if (locality.trim().length >= 2) {
      params.set('locality', locality.trim());
    }

    apiGet<SearchResponse>(`/api/public/tenants?${params}`)
      .then((result) => {
        if (active) setItems(result.items);
      })
      .catch(() => {
        if (active) setError('We could not load providers right now. Please try again shortly.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category, coords, locality, radiusKm]);

  async function useCurrentLocation() {
    if (!navigator.geolocation) return;
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
        setCoords(null);
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({ radiusKm: String(radiusKm), searched: '1' });
    if (category) params.set('category', category);
    if (keyword.trim()) params.set('keyword', keyword.trim());
    if (coords) {
      params.set('latitude', String(coords.latitude));
      params.set('longitude', String(coords.longitude));
    } else if (locality.trim()) {
      params.set('locality', locality.trim());
    }
    router.push(`/search?${params.toString()}`);
  }

  const feedTitle = locality.trim() ? `Nearby in ${locality.trim()}` : 'Nearby providers';
  const viewAllParams = new URLSearchParams({ searched: '1', radiusKm: String(radiusKm) });
  if (category) viewAllParams.set('category', category);
  if (locality.trim()) viewAllParams.set('locality', locality.trim());

  return (
    <main className="n-main">
      <div className="n-stack-lg">
        <div className="n-hero">
        <span className="n-hero-badge">
          <ShieldCheck aria-hidden="true" size={14} />
          <span>Curated local area directory</span>
        </span>
        <h1 className="n-display">Find your next appointment</h1>
          <p className="n-body-lg">Discover trusted salons, clinics, wellness spaces and consultants in your local area.</p>
        </div>

        <form className="n-search-card" onSubmit={submit}>
        <div className="n-field">
          <span className="n-field-label">Service category</span>
          <div className="n-chip-row" role="group" aria-label="Service category">
            <button type="button" className="n-chip" aria-pressed={category === ''} onClick={() => setCategory('')}>
              All
            </button>
            {categories.map((item) => (
              <button
                type="button"
                className="n-chip"
                aria-pressed={category === item.slug}
                key={item.slug}
                onClick={() => setCategory(item.slug)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <label className="n-field">
          <span className="n-field-label">Local area</span>
          <span className="n-input-wrap">
            <LocateFixed className="n-input-icon" aria-hidden="true" size={18} />
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
              title="Use my current location"
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
              placeholder="e.g. Deep tissue, Balayage, Physiotherapy"
            />
          </span>
        </label>

        <div className="n-search-radii">
          <span className="n-meta">Search radius</span>
          <label className="n-field">
            <span className="n-sr">Search radius</span>
            <select className="n-select" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
            </select>
          </label>
        </div>

        <button type="submit" className="n-btn n-btn-block">
          <CalendarDays aria-hidden="true" size={18} />
          Search available slots
        </button>
      </form>
      </div>

      <section className="n-section" aria-labelledby="browse-categories">
        <div className="n-section-head">
          <h2 id="browse-categories">Browse categories</h2>
          <a className="n-section-action" href="/search?searched=1">
            Direct access
            <ChevronRight aria-hidden="true" size={14} />
          </a>
        </div>
        <div className="n-cat-grid">
          {categories.slice(0, 4).map((item) => {
            const Icon = categoryIcons[item.slug] ?? Sparkles;
            return (
              <button
                type="button"
                className="n-cat"
                key={item.slug}
                aria-pressed={category === item.slug}
                onClick={() => setCategory(category === item.slug ? '' : item.slug)}
              >
                <span className="n-cat-icon">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="n-section" aria-labelledby="nearby-providers">
        <SectionHead
          title={feedTitle}
          action={
            <a className="n-section-action" href={`/search?${viewAllParams.toString()}`}>
              View all
              <ChevronRight aria-hidden="true" size={14} />
            </a>
          }
        />
        <h2 id="nearby-providers" className="n-sr">
          {feedTitle}
        </h2>
        <p className="n-meta">
          Practitioners with confirmed schedules, published prices and transparent durations.
        </p>

        {error ? <p className="n-note" data-tone="error">{error}</p> : null}

        {loading ? (
          <div className="n-grid-providers" aria-hidden="true">
            <div className="n-skeleton" />
            <div className="n-skeleton" />
          </div>
        ) : items.length > 0 ? (
          <div className="n-grid-providers">
            {items.map((tenant) => (
              <ProviderCard tenant={tenant} key={tenant.id} />
            ))}
          </div>
        ) : (
          <EmptyState title="No providers in this selection">
            <p className="n-body">
              Try a wider radius or a different locality. New studios join the Pune directory each week.
            </p>
          </EmptyState>
        )}
      </section>

      <div className="n-receipt-assurance n-assurance">
        <CalendarCheck aria-hidden="true" size={18} />
        <span>
          <strong className="n-ink">Direct studio and artist schedules.</strong> Slots reflect live practitioner
          availability, so start times you see are held against the venue calendar.
        </span>
      </div>

      <p className="n-meta">
        Run a salon, clinic or studio? <a className="n-link" href="/business">List your business on Neara</a>.
      </p>
    </main>
  );
}
