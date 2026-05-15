import { PublicHeader } from '../components/PublicHeader';
import { SearchClient } from './SearchClient';

export default function SearchPage({
  searchParams,
}: {
  searchParams: {
    keyword?: string;
    locality?: string;
    category?: string;
    radiusKm?: string;
    latitude?: string;
    longitude?: string;
    searched?: string;
  };
}) {
  const radiusKm = Number(searchParams.radiusKm ?? 10);
  const latitude = Number(searchParams.latitude);
  const longitude = Number(searchParams.longitude);

  return (
    <main className="page-shell">
      <PublicHeader />
      <section className="page-heading">
        <p className="eyebrow">Search</p>
        <h1>Find your next appointment</h1>
        <p>Search by service, category, business, or locality and choose from active local providers.</p>
      </section>
      <SearchClient
        initialKeyword={searchParams.keyword ?? ''}
        initialLocality={searchParams.locality ?? ''}
        initialCategory={searchParams.category ?? ''}
        initialRadiusKm={Number.isFinite(radiusKm) ? radiusKm : 10}
        initialLatitude={Number.isFinite(latitude) ? latitude : undefined}
        initialLongitude={Number.isFinite(longitude) ? longitude : undefined}
        initialSearched={searchParams.searched === '1'}
      />
    </main>
  );
}
