'use client';

import { CalendarDays, LocateFixed, Search } from 'lucide-react';
import { useState } from 'react';
import { apiGet } from '../lib/api';
import { LocalityAutocomplete, LocalitySuggestion } from './LocalityAutocomplete';

type ReverseGeocodeResult = { locality: string; city?: string };

export function HomeSearchForm() {
  const [locality, setLocality] = useState('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [status, setStatus] = useState('');

  function useCurrentLocation() {
    setStatus('');
    if (!navigator.geolocation) {
      setStatus('Location is not available in this browser.');
      return;
    }

    setStatus('Getting your location...');
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
          setStatus(`Using ${result.locality} within ${radiusKm} km.`);
        } catch {
          setStatus(`Location ready. Search will use ${radiusKm} km.`);
        }
      },
      () => setStatus('Location permission was denied. You can still search by locality.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  function clearCurrentLocation() {
    setCoords(null);
    setStatus('');
  }

  function updateLocality(value: string) {
    setLocality(value);
    if (coords) {
      setCoords(null);
      setStatus('Using typed locality.');
    }
  }

  function selectLocality(suggestion: LocalitySuggestion) {
    setLocality(suggestion.description);
    setCoords({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setStatus(`Using ${suggestion.description} within ${radiusKm} km.`);
  }

  return (
    <form className="search-panel" action="/search">
      <input type="hidden" name="searched" value="1" />
      {coords && (
        <>
          <input type="hidden" name="latitude" value={coords.latitude} />
          <input type="hidden" name="longitude" value={coords.longitude} />
        </>
      )}
      <label>
        <span>What do you need?</span>
        <div className="field">
          <Search aria-hidden="true" size={18} />
          <input name="keyword" placeholder="Search services or businesses" />
        </div>
      </label>
      <label>
        <span>Locality</span>
        <div className="field">
          <button type="button" className="field-icon-button" onClick={useCurrentLocation} aria-label="Use my location" title="Use my location">
            <LocateFixed aria-hidden="true" size={18} />
          </button>
          <LocalityAutocomplete
            name="locality"
            value={locality}
            onManualChange={updateLocality}
            onSelect={selectLocality}
            placeholder="Pimple Saudagar, Pune..."
          />
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
          <select name="radiusKm" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
          </select>
        </label>
        {status && <span className="nearby-status">{status}</span>}
      </div>
    </form>
  );
}
