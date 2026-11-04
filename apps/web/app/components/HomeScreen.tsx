'use client';

import { HomeSearchForm } from './HomeSearchForm';
import { PublicHeader } from './PublicHeader';

export function HomeScreen() {
  return (
    <main className="public-shell app-home-shell">
      <PublicHeader />
      <section className="home-hero home-hero-focused">
        <div className="search-copy">
          <h1>Book your appointment</h1>          
        </div>
        <HomeSearchForm />
      </section>
    </main>
  );
}
