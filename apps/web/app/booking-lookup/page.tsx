import { AppBar, AppShell } from '../components/neara/app-shell';
import { BookingLookupClient } from './BookingLookupClient';

export default function BookingLookupPage({
  searchParams,
}: {
  searchParams: { reference?: string };
}) {
  return (
    <AppShell>
      <AppBar />
      <BookingLookupClient initialReference={searchParams.reference ?? ''} />
    </AppShell>
  );
}
