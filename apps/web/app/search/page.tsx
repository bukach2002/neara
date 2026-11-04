import { AppBar, AppShell } from '../components/neara/app-shell';
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
    <AppShell>
      <AppBar />
      <SearchClient
        initialKeyword={searchParams.keyword ?? ''}
        initialLocality={searchParams.locality ?? ''}
        initialCategory={searchParams.category ?? ''}
        initialRadiusKm={Number.isFinite(radiusKm) ? radiusKm : 10}
        initialLatitude={Number.isFinite(latitude) ? latitude : undefined}
        initialLongitude={Number.isFinite(longitude) ? longitude : undefined}
        initialSearched={searchParams.searched === '1'}
      />
    </AppShell>
  );
}
