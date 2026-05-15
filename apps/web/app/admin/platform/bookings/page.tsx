import { AdminShell } from '../../components/AdminShell';
import { PlatformBookingsClient } from './PlatformBookingsClient';

export default function PlatformBookingsPage() {
  return (
    <AdminShell>
      <PlatformBookingsClient />
    </AdminShell>
  );
}
