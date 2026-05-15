import { AdminShell } from '../components/AdminShell';
import { PlatformClient } from './PlatformClient';

export default function PlatformPage() {
  return (
    <AdminShell>
      <PlatformClient />
    </AdminShell>
  );
}
