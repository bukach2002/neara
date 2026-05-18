'use client';

import { HomeSearchForm } from './HomeSearchForm';
import { PublicHeader } from './PublicHeader';

export function HomeScreen() {
  return (
    <main className="public-shell app-home-shell">
      <PublicHeader />
      <section className="home-hero home-hero-focused">
        <div className="search-copy">
          <h1>Find the right appointment near you</h1>
          <p>Choose a category, confirm your locality, then search by business, service, or expert.</p>
        </div>
        <HomeSearchForm />
      </section>
    </main>
  );
}
