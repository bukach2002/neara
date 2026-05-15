'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { apiGet } from '../lib/api';

export type LocalitySuggestion = {
  description: string;
  placeId: string;
  latitude: number;
  longitude: number;
};

type LocalityAutocompleteProps = {
  value: string;
  name?: string;
  placeholder?: string;
  onManualChange: (value: string) => void;
  onSelect: (suggestion: LocalitySuggestion) => void;
};

export function LocalityAutocomplete({ value, name, placeholder, onManualChange, onSelect }: LocalityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocalitySuggestion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const input = value.trim();
    if (input.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const result = await apiGet<{ items: LocalitySuggestion[] }>(`/api/public/place-autocomplete?input=${encodeURIComponent(input)}`);
        setSuggestions(result.items);
        setOpen(result.items.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [value]);

  function change(event: ChangeEvent<HTMLInputElement>) {
    onManualChange(event.target.value);
  }

  function selectSuggestion(suggestion: LocalitySuggestion) {
    onSelect(suggestion);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="autocomplete-field">
      <input name={name} value={value} onChange={change} placeholder={placeholder} autoComplete="off" />
      {open && (
        <div className="autocomplete-menu">
          {suggestions.map((suggestion) => (
            <button type="button" key={suggestion.placeId} onClick={() => selectSuggestion(suggestion)}>
              {suggestion.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
