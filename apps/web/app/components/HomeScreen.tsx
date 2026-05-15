'use client';

import { BriefcaseBusiness, HeartPulse, Leaf, Scissors, Search, Sparkles, Stethoscope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { HomeSearchForm } from './HomeSearchForm';
import { PublicHeader } from './PublicHeader';
import { SectionHeader } from './ui';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

const fallbackCategories: Category[] = [
  { id: 'salon', name: 'Salon', slug: 'salon', description: 'Hair, nails, grooming' },
  { id: 'wellness', name: 'Wellness', slug: 'wellness', description: 'Therapy, fitness, recovery' },
  { id: 'clinic', name: 'Clinic', slug: 'clinic', description: 'Doctors, dentists, care' },
  { id: 'consulting', name: 'Consulting', slug: 'consulting', description: 'Advisors and specialists' },
];

const categoryIcons = {
  salon: Scissors,
  wellness: Leaf,
  clinic: Stethoscope,
  medical: HeartPulse,
  consulting: BriefcaseBusiness,
  beauty: Sparkles,
};

export function HomeScreen() {
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);

  useEffect(() => {
    apiGet<{ id: string; name: string; slug: string; description: string | null }[]>('/api/public/categories')
      .then((items) => {
        if (items.length) setCategories(items);
      })
      .catch(() => null);
  }, []);

  return (
    <main className="public-shell app-home-shell">
      <PublicHeader />
      <section className="home-hero">
        <div className="search-copy">
          <p className="eyebrow">Local appointments</p>
          <h1>Book trusted services in seconds</h1>
          <p>Find nearby experts, compare services, and reserve a confirmed slot without an account.</p>
        </div>
        <HomeSearchForm />
        <div className="feature-visual" aria-label="Featured appointment spaces">
          <div className="feature-visual-panel">
            <img
              src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80"
              alt=""
            />
          </div>
          <div className="feature-stat">
            <Search aria-hidden="true" size={18} />
            <span>Search by service, business, or locality</span>
          </div>
        </div>
      </section>

      <section className="content-band" aria-label="Popular categories">
        <SectionHeader
          title="Popular categories"
          action={<a className="inline-link" href="/search">View all</a>}
        />
        <div className="category-grid">
          {categories.map((category) => {
            const Icon = categoryIcons[category.slug as keyof typeof categoryIcons] ?? Sparkles;
            return (
              <a href={`/search?category=${encodeURIComponent(category.slug)}&searched=1`} key={category.id}>
                <span className="category-icon" aria-hidden="true">
                  <Icon size={28} />
                </span>
                <strong>{category.name}</strong>
                <small>{category.description ?? categoryFallbackCopy(category.slug)}</small>
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function categoryFallbackCopy(slug: string) {
  if (slug === 'clinic') return 'Doctors, dentists';
  if (slug === 'salon') return 'Hair, nails, beauty';
  if (slug === 'wellness') return 'Wellness, recovery';
  if (slug === 'consulting') return 'Advisors, specialists';
  return 'Local services';
}
